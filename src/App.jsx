import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';

// --- Configuration & Constants ---
const SUPABASE_URL = 'https://zthuqzzholyjolteuvty.supabase.co';
const SUPABASE_KEY = 'sb_publishable_xkg9ULmNiqKrCcESytGbmw_u1Z12_gG';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const OPTIONS = {
  PAYMENT: ["신용카드", "현금", "계좌이체", "전화예약입금", "네이버", "인스타", "미결제"],
  PRODUCT: ["꽃다발", "꽃바구니", "햇살콘플라워", "꽃묶음", "식물", "용품", "시즌한정", "기타"],
  AMPM: ["오전", "오후"]
};

// --- Utilities ---
const formatShortDateTime = (isoStr) => {
  if (!isoStr) return '-';
  const date = new Date(isoStr.replace(' ', 'T'));
  return `${String(date.getFullYear()).slice(-2)}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
};

const getKSTNow = () => {
  const now = new Date();
  const kst = new Date(now.getTime() + (now.getTimezoneOffset() + 540) * 60000);
  return {
    date: kst.toISOString().split('T')[0],
    time: kst.toTimeString().slice(0, 5),
    day: kst.getDay(),
    hour: kst.getHours()
  };
};

// --- Components ---
const TimePicker = ({ value, onChange }) => {
  const [h, m] = (value || '14:00').split(':');
  const ampm = parseInt(h) >= 12 ? '오후' : '오전';
  const hour = String(parseInt(h) % 12 || 12).padStart(2, '0');

  const update = (newAmpm, newH, newM) => {
    let fullH = parseInt(newH);
    if (newAmpm === '오후' && fullH < 12) fullH += 12;
    if (newAmpm === '오전' && fullH === 12) fullH = 0;
    onChange(`${String(fullH).padStart(2, '0')}:${newM}`);
  };

  return (
    <div className="flex gap-1 p-2 border border-slate-300 rounded-xl bg-white">
      <select value={ampm} onChange={(e) => update(e.target.value, hour, m)} className="bg-transparent focus:outline-none">{OPTIONS.AMPM.map(a => <option key={a} value={a}>{a}</option>)}</select>
      <select value={hour} onChange={(e) => update(ampm, e.target.value, m)} className="bg-transparent focus:outline-none">{Array.from({length:12}, (_,i)=>String(i+1).padStart(2,'0')).map(h => <option key={h} value={h}>{h}시</option>)}</select>
      <select value={m} onChange={(e) => update(ampm, hour, e.target.value)} className="bg-transparent focus:outline-none">{["00","15","30","45"].map(m => <option key={m} value={m}>{m}분</option>)}</select>
    </div>
  );
};

export default function App() {
  const [auth, setAuth] = useState(sessionStorage.getItem('app_authenticated') === 'true');
  const [menu, setMenu] = useState('orders');
  const [data, setData] = useState({ orders: [], customers: [] });
  const [editing, setEditing] = useState(null);

  const fetchData = useCallback(async () => {
    const [{ data: orders }, { data: customers }] = await Promise.all([
      supabase.from('orders').select('*, customers(id, name, phone)').order('id', { ascending: false }),
      supabase.from('customers').select('*').order('id', { ascending: false })
    ]);
    setData({ orders: orders || [], customers: customers || [] });
  }, []);

  useEffect(() => { if (auth) fetchData(); }, [auth, fetchData]);

  if (!auth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-800">
        <form onSubmit={(e) => { e.preventDefault(); if (e.target.pin.value === '8005') { setAuth(true); sessionStorage.setItem('app_authenticated', 'true'); } }} className="bg-white p-8 rounded-2xl shadow-xl">
          <h2 className="text-xl font-bold mb-4">비밀번호를 입력하세요</h2>
          <input name="pin" type="password" maxLength={4} className="w-full text-center text-2xl p-3 border rounded-xl" autoFocus />
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row">
      <aside className="w-full md:w-28 bg-white border-r p-2 flex md:flex-col gap-2">
        {['new', 'orders', 'customers', 'backup'].map(id => (
          <button key={id} onClick={() => setMenu(id)} className={`p-3 rounded-xl font-bold ${menu === id ? 'bg-rose-100 text-rose-700' : ''}`}>
            {id.toUpperCase()}
          </button>
        ))}
      </aside>

      <main className="flex-1 p-6">
        {menu === 'orders' && (
          <div className="bg-white p-6 rounded-2xl shadow-sm">
            <FullCalendar plugins={[dayGridPlugin, interactionPlugin]} initialView="dayGridMonth" events={data.orders.map(o => ({ start: o.pickup_datetime?.split(' ')[0], title: '1건' }))} />
            <div className="mt-6 overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="bg-slate-100"><th>픽업일시</th><th>고객명</th><th>상품</th><th>메모</th></tr></thead>
                <tbody>
                  {data.orders.map(o => (
                    <tr key={o.id} className="border-b">
                      <td>{formatShortDateTime(o.pickup_datetime)}</td>
                      <td>{o.customers?.name}</td>
                      <td>{o.product_name}</td>
                      <td>{o.memo}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
