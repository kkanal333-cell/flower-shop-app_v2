import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import { Calendar, UserPlus, Flower2 } from 'lucide-react';

// Supabase 연동
const SUPABASE_URL = 'https://zthuqzzholyjolteuvty.supabase.co';
const SUPABASE_KEY = 'sb_publishable_xkg9ULmNiqKrCcESytGbmw_u1Z12_gG';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const PAYMENT_OPTIONS = ["네이버", "전화", "입금", "현금", "미결제"];
const PRODUCT_OPTIONS = ["꽃다발", "꽃바구니", "햇살콘플라워", "꽃묶음", "식물", "용품", "시즌한정", "기타"];

export default function App() {
  const [activeTab, setActiveTab] = useState('calendar');
  const [orders, setOrders] = useState([]);
  const [selectedDate, setSelectedDate] = useState(null);
  const [editingOrder, setEditingOrder] = useState(null);

  const [newOrder, setNewOrder] = useState({
    customer_name: '',
    phone: '010-',
    product_name: '꽃다발',
    amount: 55000,
    pickup_date: new Date().toISOString().split('T')[0],
    pickup_time: '14:00',
    payment_method: '입금',
    memo: ''
  });

  const fetchOrders = async () => {
    const { data, error } = await supabase
      .from('orders')
      .select('*, customers(name, phone)')
      .order('id', { ascending: false });

    if (!error && data) {
      setOrders(data);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const formatPhone = (val) => {
    const nums = val.replace(/[^0-9]/g, '');
    if (nums.length <= 3) return nums;
    if (nums.length <= 7) return `${nums.slice(0, 3)}-${nums.slice(3)}`;
    return `${nums.slice(0, 3)}-${nums.slice(3, 7)}-${nums.slice(7, 11)}`;
  };

  const handleCreateOrder = async (e) => {
    e.preventDefault();
    if (!newOrder.customer_name) return alert('고객 성명을 입력해주세요.');

    let customerId;
    const { data: custData } = await supabase
      .from('customers')
      .select('id')
      .eq('name', newOrder.customer_name)
      .eq('phone', newOrder.phone)
      .maybeSingle();

    if (custData) {
      customerId = custData.id;
    } else {
      const { data: newCust } = await supabase
        .from('customers')
        .insert([{ name: newOrder.customer_name, phone: newOrder.phone }])
        .select()
        .single();
      customerId = newCust?.id;
    }

    const pickupDatetime = `${newOrder.pickup_date}T${newOrder.pickup_time}:00`;
    await supabase.from('orders').insert([{
      customer_id: customerId,
      product_name: newOrder.product_name,
      product: newOrder.product_name,
      amount: Number(newOrder.amount),
      pickup_datetime: pickupDatetime,
      payment_method: newOrder.payment_method,
      status: newOrder.payment_method,
      memo: newOrder.memo
    }]);

    alert('주문이 등록되었습니다!');
    setNewOrder({ ...newOrder, customer_name: '', memo: '' });
    fetchOrders();
  };

  const handleUpdateOrder = async (e) => {
    e.preventDefault();
    await supabase.from('orders').update({
      product_name: editingOrder.product_name,
      amount: Number(editingOrder.amount),
      pickup_datetime: editingOrder.pickup_datetime,
      payment_method: editingOrder.payment_method,
      memo: editingOrder.memo
    }).eq('id', editingOrder.id);

    alert('주문 수정이 완료되었습니다!');
    setEditingOrder(null);
    fetchOrders();
  };

  const calendarEvents = orders.map(o => ({
    id: String(o.id),
    title: `[${o.payment_method || '입금'}] ${o.customers?.name || '고객'} - ${o.product_name}`,
    start: o.pickup_datetime,
    backgroundColor: o.payment_method === '네이버' ? '#e0f2fe' : o.payment_method === '전화' ? '#e9d8fd' : '#dcfce7',
    borderColor: '#cbd5e1',
    textColor: '#1e293b'
  }));

  const selectedDayOrders = selectedDate
    ? orders.filter(o => o.pickup_datetime && o.pickup_datetime.startsWith(selectedDate))
    : [];

  return (
    <div className="flex min-h-screen bg-slate-50">
      <div className="w-64 bg-white border-r border-slate-200 p-6 flex flex-col gap-2">
        <div className="flex items-center gap-2 mb-8 text-purple-900 font-bold text-xl">
          <Flower2 className="w-7 h-7 text-purple-600" />
          <span>화사한 하루</span>
        </div>

        <button onClick={() => setActiveTab('calendar')} className={`flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all ${activeTab === 'calendar' ? 'bg-purple-100 text-purple-900 font-semibold' : 'text-slate-600 hover:bg-slate-100'}`}>
          <Calendar className="w-5 h-5" /> 픽업 달력 & 목록
        </button>
        <button onClick={() => setActiveTab('new')} className={`flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all ${activeTab === 'new' ? 'bg-purple-100 text-purple-900 font-semibold' : 'text-slate-600 hover:bg-slate-100'}`}>
          <UserPlus className="w-5 h-5" /> 신규 주문 등록
        </button>
      </div>

      <div className="flex-1 p-8 overflow-y-auto">
        {activeTab === 'calendar' && (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <FullCalendar
                plugins={[dayGridPlugin, interactionPlugin]}
                initialView="dayGridMonth"
                locale="ko"
                height={550}
                events={calendarEvents}
                dateClick={(info) => setSelectedDate(info.dateStr)}
                eventClick={(info) => {
                  const target = orders.find(o => String(o.id) === info.event.id);
                  if (target) setEditingOrder(target);
                }}
              />
            </div>

            {selectedDate && (
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm animate-fadeIn">
                <h3 className="text-lg font-bold text-slate-800 mb-4">📅 {selectedDate} 픽업 목록</h3>
                {selectedDayOrders.length === 0 ? (
                  <p className="text-slate-400 text-sm">해당 날짜에 예정된 픽업 주문이 없습니다.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 text-slate-500 text-sm">
                          <th className="py-2">고객명</th>
                          <th className="py-2">연락처</th>
                          <th className="py-2">상품명</th>
                          <th className="py-2">금액</th>
                          <th className="py-2">결제수단</th>
                          <th className="py-2">작업</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedDayOrders.map(o => (
                          <tr key={o.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                            <td className="py-3 font-semibold">{o.customers?.name || '-'}</td>
                            <td className="py-3 text-slate-600">{o.customers?.phone || '-'}</td>
                            <td className="py-3">{o.product_name}</td>
                            <td className="py-3 font-semibold text-purple-900">{o.amount?.toLocaleString()}원</td>
                            <td className="py-3"><span className="px-2.5 py-1 bg-slate-100 rounded-lg text-xs font-semibold">{o.payment_method}</span></td>
                            <td className="py-3">
                              <button onClick={() => setEditingOrder(o)} className="text-xs bg-purple-50 text-purple-700 px-3 py-1.5 rounded-lg font-semibold hover:bg-purple-100">수정</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {editingOrder && (
              <div className="bg-white p-6 rounded-2xl border border-purple-200 shadow-md">
                <h3 className="text-lg font-bold text-purple-950 mb-4">✏️ 주문 #{editingOrder.id} 수정하기</h3>
                <form onSubmit={handleUpdateOrder} className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-slate-600">상품명</label>
                    <select value={editingOrder.product_name} onChange={e => setEditingOrder({...editingOrder, product_name: e.target.value})} className="w-full p-2.5 border rounded-xl mt-1 text-sm">
                      {PRODUCT_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-600">금액</label>
                    <input type="number" value={editingOrder.amount} onChange={e => setEditingOrder({...editingOrder, amount: e.target.value})} className="w-full p-2.5 border rounded-xl mt-1 text-sm" />
                  </div>
                  <div className="col-span-2">
                    <label className="text-xs font-bold text-slate-600">메모</label>
                    <textarea value={editingOrder.memo || ''} onChange={e => setEditingOrder({...editingOrder, memo: e.target.value})} className="w-full p-2.5 border rounded-xl mt-1 text-sm" rows={2} />
                  </div>
                  <div className="col-span-2 flex justify-end gap-2">
                    <button type="button" onClick={() => setEditingOrder(null)} className="px-4 py-2 border rounded-xl text-sm font-semibold">취소</button>
                    <button type="submit" className="px-4 py-2 bg-purple-600 text-white rounded-xl text-sm font-semibold shadow-sm">저장</button>
                  </div>
                </form>
              </div>
            )}
          </div>
        )}

        {activeTab === 'new' && (
          <div className="max-w-2xl bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
            <h2 className="text-xl font-bold text-slate-800 mb-6">📝 신규 주문 등록</h2>
            <form onSubmit={handleCreateOrder} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-600">고객 성명 *</label>
                  <input type="text" value={newOrder.customer_name} onChange={e => setNewOrder({...newOrder, customer_name: e.target.value})} className="w-full p-2.5 border rounded-xl mt-1 text-sm" required />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-600">휴대폰 번호</label>
                  <input type="text" value={newOrder.phone} onChange={e => setNewOrder({...newOrder, phone: formatPhone(e.target.value)})} className="w-full p-2.5 border rounded-xl mt-1 text-sm" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-600">상품명</label>
                  <select value={newOrder.product_name} onChange={e => setNewOrder({...newOrder, product_name: e.target.value})} className="w-full p-2.5 border rounded-xl mt-1 text-sm">
                    {PRODUCT_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-600">금액</label>
                  <input type="number" value={newOrder.amount} onChange={e => setNewOrder({...newOrder, amount: e.target.value})} className="w-full p-2.5 border rounded-xl mt-1 text-sm" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-600">픽업 날짜</label>
                  <input type="date" value={newOrder.pickup_date} onChange={e => setNewOrder({...newOrder, pickup_date: e.target.value})} className="w-full p-2.5 border rounded-xl mt-1 text-sm" />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-600">픽업 시간</label>
                  <input type="time" value={newOrder.pickup_time} onChange={e => setNewOrder({...newOrder, pickup_time: e.target.value})} className="w-full p-2.5 border rounded-xl mt-1 text-sm" />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-600">결제 방식</label>
                <select value={newOrder.payment_method} onChange={e => setNewOrder({...newOrder, payment_method: e.target.value})} className="w-full p-2.5 border rounded-xl mt-1 text-sm">
                  {PAYMENT_OPTIONS.map(pm => <option key={pm} value={pm}>{pm}</option>)}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-600">메모 / 요구사항</label>
                <textarea value={newOrder.memo} onChange={e => setNewOrder({...newOrder, memo: e.target.value})} className="w-full p-2.5 border rounded-xl mt-1 text-sm" rows={3} />
              </div>

              <button type="submit" className="w-full py-3 bg-purple-600 text-white font-semibold rounded-xl shadow-md hover:bg-purple-700 transition-colors">
                🌸 주문 저장하기
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
