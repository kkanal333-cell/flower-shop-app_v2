import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';

// Supabase 연동
const SUPABASE_URL = 'https://zthuqzzholyjolteuvty.supabase.co';
const SUPABASE_KEY = 'sb_publishable_xkg9ULmNiqKrCcESytGbmw_u1Z12_gG';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const PAYMENT_OPTIONS = ["네이버", "전화", "입금", "현금", "미결제"];
const PRODUCT_OPTIONS = ["꽃다발", "꽃바구니", "햇살콘플라워", "꽃묶음", "식물", "용품", "시즌한정", "기타"];

export default function App() {
  const [activeMenu, setActiveMenu] = useState('new'); // 'new' | 'orders' | 'customers' | 'notifications'
  const [subTab, setSubTab] = useState('calendar'); // 'calendar' | 'list'
  
  const [orders, setOrders] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [editingOrder, setEditingOrder] = useState(null);

  // 현재 한국 날짜 및 시간 반환 Helper
  const getNowFormatted = () => {
    const now = new Date();
    const date = now.toISOString().split('T')[0];
    const time = now.toTimeString().slice(0, 5);
    return { date, time };
  };

  const [newOrder, setNewOrder] = useState({
    customer_name: '',
    phone: '010-',
    product_name: '꽃다발',
    amount: 55000,
    pickup_date: new Date().toISOString().split('T')[0],
    pickup_time: '14:00',
    receipt_date: getNowFormatted().date,
    receipt_time: getNowFormatted().time,
    payment_method: '네이버',
    memo: ''
  });

  const fetchData = async () => {
    const { data: orderData } = await supabase
      .from('orders')
      .select('*, customers(name, phone)')
      .order('id', { ascending: false });

    if (orderData) setOrders(orderData);

    const { data: customerData } = await supabase
      .from('customers')
      .select('*')
      .order('id', { ascending: false });

    if (customerData) setCustomers(customerData);
  };

  useEffect(() => {
    fetchData();
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
    const receiptDatetime = `${newOrder.receipt_date}T${newOrder.receipt_time}:00`;

    await supabase.from('orders').insert([{
      customer_id: customerId,
      product_name: newOrder.product_name,
      product: newOrder.product_name,
      amount: Number(newOrder.amount),
      pickup_datetime: pickupDatetime,
      created_at: receiptDatetime,
      payment_method: newOrder.payment_method,
      status: newOrder.payment_method,
      memo: newOrder.memo
    }]);

    alert('🌸 주문이 성공적으로 등록되었습니다!');
    setNewOrder({
      ...newOrder,
      customer_name: '',
      memo: '',
      receipt_date: getNowFormatted().date,
      receipt_time: getNowFormatted().time
    });
    setActiveMenu('orders');
    fetchData();
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

    alert('✅ 주문 수정이 완료되었습니다!');
    setEditingOrder(null);
    fetchData();
  };

  // CSV 파일 내보내기
  const exportToCSV = () => {
    if (orders.length === 0) return alert('다운로드할 주문 데이터가 없습니다.');
    let csvContent = "data:text/csv;charset=utf-8,\uFEFF";
    csvContent += "ID,고객명,연락처,상품명,금액,결제방식,픽업일시,접수일시,메모\n";

    orders.forEach(o => {
      const row = [
        o.id,
        `"${o.customers?.name || ''}"`,
        `"${o.customers?.phone || ''}"`,
        `"${o.product_name || ''}"`,
        o.amount || 0,
        `"${o.payment_method || ''}"`,
        `"${o.pickup_datetime || ''}"`,
        `"${o.created_at || ''}"`,
        `"${(o.memo || '').replace(/\n/g, ' ')}"`
      ].join(",");
      csvContent += row + "\n";
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `주문목록_백업_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const calendarEvents = orders.map(o => ({
    id: String(o.id),
    title: `[${o.payment_method || '입금'}] ${o.customers?.name || '고객'}`,
    start: o.pickup_datetime,
    backgroundColor: o.payment_method === '네이버' ? '#e0f2fe' : o.payment_method === '전화' ? '#f3e8ff' : '#dcfce7',
    textColor: '#1e293b'
  }));

  const selectedDayOrders = selectedDate
    ? orders.filter(o => o.pickup_datetime && o.pickup_datetime.startsWith(selectedDate))
    : [];

  return (
    <div className="min-h-screen bg-slate-100/70 flex flex-col md:flex-row pb-20 md:pb-0">
      {/* 📌 왼쪽 사이드바 (이전 디자인의 깔끔함 + 이미지 메뉴 스타일 반영) */}
      <aside className="bg-slate-50 border-b md:border-b-0 md:border-r border-slate-200 w-full md:w-64 p-5 flex flex-col shrink-0 shadow-xs">
        <div className="flex items-center gap-2 text-rose-600 font-extrabold text-xl mb-1">
          <span className="text-2xl">📌</span>
          <span>메뉴</span>
        </div>
        <p className="text-xs text-slate-400 mb-6 font-medium">이동할 메뉴를 선택하세요</p>

        <nav className="flex flex-col gap-2.5 w-full text-sm">
          {[
            { id: 'new', label: '📝 신규 주문 및 고객 등록' },
            { id: 'orders', label: '📋 전체 주문 목록 & 달력' },
            { id: 'customers', label: '🎂 고객 관리' },
            { id: 'notifications', label: '🔔 알림 발송 현황' },
            { id: 'backup', label: '💾 데이터 CSV 백업' },
          ].map(menu => (
            <label
              key={menu.id}
              onClick={() => {
                if (menu.id === 'backup') {
                  exportToCSV();
                } else {
                  setActiveMenu(menu.id);
                }
              }}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-all ${
                activeMenu === menu.id
                  ? 'bg-rose-50/80 text-rose-600 font-bold border-l-4 border-rose-500 shadow-2xs'
                  : 'text-slate-700 hover:bg-slate-200/50'
              }`}
            >
              <input
                type="radio"
                name="sidebar-menu"
                checked={activeMenu === menu.id}
                onChange={() => {}}
                className="w-4 h-4 accent-rose-500 cursor-pointer"
              />
              <span>{menu.label}</span>
            </label>
          ))}
        </nav>
      </aside>

      {/* 📌 오른쪽 메인 영역 (이전 디자인 스타일 유지) */}
      <main className="flex-1 p-4 md:p-8 max-w-6xl mx-auto w-full">
        {/* 메뉴 1: 전체 주문 목록 & 달력 */}
        {activeMenu === 'orders' && (
          <div className="space-y-6">
            <div className="bg-white p-5 md:p-6 rounded-xl border border-slate-200 shadow-sm">
              <h2 className="text-2xl font-bold text-slate-800 mb-4 flex items-center gap-2">
                <span>📋</span> 주문 내역 및 픽업 달력
              </h2>

              <div className="flex border-b border-slate-200 mb-6 gap-6">
                <button
                  onClick={() => setSubTab('calendar')}
                  className={`pb-3 text-sm font-bold flex items-center gap-1.5 relative transition-colors ${
                    subTab === 'calendar' ? 'text-rose-600' : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  <span>📅</span> 픽업 달력
                  {subTab === 'calendar' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-rose-500 rounded-full" />}
                </button>

                <button
                  onClick={() => setSubTab('list')}
                  className={`pb-3 text-sm font-bold flex items-center gap-1.5 relative transition-colors ${
                    subTab === 'list' ? 'text-rose-600' : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  <span>📊</span> 전체 주문 목록
                  {subTab === 'list' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-rose-500 rounded-full" />}
                </button>
              </div>

              {subTab === 'calendar' && (
                <FullCalendar
                  plugins={[dayGridPlugin, interactionPlugin]}
                  initialView="dayGridMonth"
                  locale="ko"
                  height="auto"
                  events={calendarEvents}
                  dateClick={(info) => setSelectedDate(info.dateStr)}
                  eventClick={(info) => {
                    const target = orders.find(o => String(o.id) === info.event.id);
                    if (target) setEditingOrder(target);
                  }}
                />
              )}

              {subTab === 'list' && (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-500 text-xs md:text-sm bg-slate-50">
                        <th className="py-3 px-3">픽업일시</th>
                        <th className="py-3 px-3">접수일시</th>
                        <th className="py-3 px-3">고객명</th>
                        <th className="py-3 px-3">연락처</th>
                        <th className="py-3 px-3">상품명</th>
                        <th className="py-3 px-3">금액</th>
                        <th className="py-3 px-3">결제수단</th>
                        <th className="py-3 px-3">관리</th>
                      </tr>
                    </thead>
                    <tbody>
                      {orders.map(o => (
                        <tr key={o.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors text-sm">
                          <td className="py-3 px-3 text-slate-600">{o.pickup_datetime?.replace('T', ' ').slice(0, 16) || '-'}</td>
                          <td className="py-3 px-3 text-xs text-slate-400">{o.created_at?.replace('T', ' ').slice(0, 16) || '-'}</td>
                          <td className="py-3 px-3 font-bold text-slate-900">{o.customers?.name || '-'}</td>
                          <td className="py-3 px-3 text-slate-600">{o.customers?.phone || '-'}</td>
                          <td className="py-3 px-3 font-semibold text-slate-800">{o.product_name}</td>
                          <td className="py-3 px-3 font-bold text-rose-600">{o.amount?.toLocaleString()}원</td>
                          <td className="py-3 px-3"><span className="px-2 py-1 bg-slate-100 rounded text-xs font-medium">{o.payment_method}</span></td>
                          <td className="py-3 px-3">
                            <button onClick={() => setEditingOrder(o)} className="text-xs bg-slate-100 text-slate-700 px-2.5 py-1 rounded hover:bg-slate-200 font-medium">수정</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {subTab === 'calendar' && selectedDate && (
              <div className="bg-white p-5 md:p-6 rounded-xl border border-slate-200 shadow-sm">
                <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                  <span>📅</span> {selectedDate} 픽업 주문 목록
                </h3>

                {selectedDayOrders.length === 0 ? (
                  <div className="bg-sky-50 text-sky-700 p-4 rounded-xl text-sm font-medium text-center border border-sky-100">
                    해당 날짜에 픽업 예정인 주문이 없습니다.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {selectedDayOrders.map(o => (
                      <div key={o.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 flex flex-col justify-between gap-3">
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="font-bold text-slate-900 text-base">{o.customers?.name || '익명'}</span>
                            <span className="text-xs text-slate-500 ml-2">{o.customers?.phone || ''}</span>
                            <p className="text-sm font-semibold text-rose-600 mt-1">{o.product_name}</p>
                          </div>
                          <span className="px-2.5 py-1 bg-white border border-slate-200 rounded-md text-xs font-bold text-slate-700">
                            {o.payment_method}
                          </span>
                        </div>
                        {o.memo && <p className="text-xs text-slate-600 bg-white p-2 rounded-lg border border-slate-100">💬 {o.memo}</p>}
                        <div className="flex justify-between items-center pt-2 border-t border-slate-200/80">
                          <span className="font-bold text-slate-800 text-sm">{o.amount?.toLocaleString()}원</span>
                          <button onClick={() => setEditingOrder(o)} className="text-xs bg-rose-500 text-white px-3 py-1.5 rounded-lg font-semibold hover:bg-rose-600 transition-colors">수정</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* 메뉴 2: 신규 주문 및 고객 등록 */}
        {activeMenu === 'new' && (
          <div className="max-w-xl mx-auto bg-white p-6 md:p-8 rounded-xl border border-slate-200 shadow-sm">
            <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
              <span>📝</span> 신규 주문 및 고객 등록
            </h2>

            <form onSubmit={handleCreateOrder} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-600">고객 성명 *</label>
                  <input
                    type="text"
                    value={newOrder.customer_name}
                    onChange={e => setNewOrder({...newOrder, customer_name: e.target.value})}
                    className="w-full p-3 border rounded-xl mt-1 text-sm bg-slate-50"
                    placeholder="홍길동"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-600">휴대폰 번호</label>
                  <input
                    type="text"
                    value={newOrder.phone}
                    onChange={e => setNewOrder({...newOrder, phone: formatPhone(e.target.value)})}
                    className="w-full p-3 border rounded-xl mt-1 text-sm bg-slate-50"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-600">상품종류 *</label>
                  <select
                    value={newOrder.product_name}
                    onChange={e => setNewOrder({...newOrder, product_name: e.target.value})}
                    className="w-full p-3 border rounded-xl mt-1 text-sm bg-slate-50"
                  >
                    {PRODUCT_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-600">결제 금액 (원)</label>
                  <input
                    type="number"
                    value={newOrder.amount}
                    onChange={e => setNewOrder({...newOrder, amount: e.target.value})}
                    className="w-full p-3 border rounded-xl mt-1 text-sm bg-slate-50"
                  />
                </div>
              </div>

              {/* 픽업 일시 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-600">픽업 날짜 *</label>
                  <input
                    type="date"
                    value={newOrder.pickup_date}
                    onChange={e => setNewOrder({...newOrder, pickup_date: e.target.value})}
                    className="w-full p-3 border rounded-xl mt-1 text-sm bg-slate-50"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-600">픽업 시간 *</label>
                  <input
                    type="time"
                    value={newOrder.pickup_time}
                    onChange={e => setNewOrder({...newOrder, pickup_time: e.target.value})}
                    className="w-full p-3 border rounded-xl mt-1 text-sm bg-slate-50"
                  />
                </div>
              </div>

              {/* 📌 접수 일시 (픽업 일시 바로 아래에 표시) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-100/70 p-3 rounded-xl border border-slate-200">
                <div>
                  <label className="text-xs font-bold text-slate-700">접수 날짜 (현재 기준)</label>
                  <input
                    type="date"
                    value={newOrder.receipt_date}
                    onChange={e => setNewOrder({...newOrder, receipt_date: e.target.value})}
                    className="w-full p-2.5 border rounded-lg mt-1 text-sm bg-white"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700">접수 시간 (현재 기준)</label>
                  <input
                    type="time"
                    value={newOrder.receipt_time}
                    onChange={e => setNewOrder({...newOrder, receipt_time: e.target.value})}
                    className="w-full p-2.5 border rounded-lg mt-1 text-sm bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-600">결제 방식 *</label>
                <select
                  value={newOrder.payment_method}
                  onChange={e => setNewOrder({...newOrder, payment_method: e.target.value})}
                  className="w-full p-3 border rounded-xl mt-1 text-sm bg-slate-50"
                >
                  {PAYMENT_OPTIONS.map(pm => <option key={pm} value={pm}>{pm}</option>)}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-600">고객 요구사항 / 메모</label>
                <textarea
                  value={newOrder.memo}
                  onChange={e => setNewOrder({...newOrder, memo: e.target.value})}
                  className="w-full p-3 border rounded-xl mt-1 text-sm bg-slate-50"
                  rows={3}
                  placeholder="요청사항이나 특이사항을 적어주세요."
                />
              </div>

              <button
                type="submit"
                className="w-full py-3.5 bg-rose-500 text-white font-bold rounded-xl shadow-md hover:bg-rose-600 transition-colors text-base mt-2"
              >
                🌸 주문 저장하기
              </button>
            </form>
          </div>
        )}

        {/* 메뉴 3: 고객 관리 */}
        {activeMenu === 'customers' && (
          <div className="bg-white p-6 md:p-8 rounded-xl border border-slate-200 shadow-sm">
            <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
              <span>🎂</span> 고객 목록 ({customers.length}명)
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 text-sm bg-slate-50">
                    <th className="py-3 px-4">고객 ID</th>
                    <th className="py-3 px-4">성명</th>
                    <th className="py-3 px-4">연락처</th>
                  </tr>
                </thead>
                <tbody>
                  {customers.map(c => (
                    <tr key={c.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors text-sm">
                      <td className="py-3 px-4 text-slate-400">#{c.id}</td>
                      <td className="py-3 px-4 font-bold text-slate-900">{c.name}</td>
                      <td className="py-3 px-4 text-slate-600">{c.phone || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 메뉴 4: 알림 발송 현황 */}
        {activeMenu === 'notifications' && (
          <div className="bg-white p-6 md:p-8 rounded-xl border border-slate-200 shadow-sm text-center py-12">
            <span className="text-4xl mb-3 block">🔔</span>
            <h2 className="text-xl font-bold text-slate-800 mb-2">알림 발송 현황</h2>
            <p className="text-sm text-slate-500">안내 문자 및 알림톡 내역이 표시되는 메뉴입니다.</p>
          </div>
        )}

        {/* 수정 모달 */}
        {editingOrder && (
          <div className="bg-white p-5 md:p-6 rounded-xl border-2 border-rose-300 shadow-lg mt-6">
            <h3 className="text-lg font-bold text-rose-950 mb-4 flex items-center gap-2">
              <span>✏️</span> 주문 #{editingOrder.id} 수정하기
            </h3>
            <form onSubmit={handleUpdateOrder} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-slate-600">상품명</label>
                <select value={editingOrder.product_name} onChange={e => setEditingOrder({...editingOrder, product_name: e.target.value})} className="w-full p-3 border rounded-xl mt-1 text-sm bg-slate-50">
                  {PRODUCT_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-600">금액</label>
                <input type="number" value={editingOrder.amount} onChange={e => setEditingOrder({...editingOrder, amount: e.target.value})} className="w-full p-3 border rounded-xl mt-1 text-sm bg-slate-50" />
              </div>
              <div className="md:col-span-2">
                <label className="text-xs font-bold text-slate-600">메모</label>
                <textarea value={editingOrder.memo || ''} onChange={e => setEditingOrder({...editingOrder, memo: e.target.value})} className="w-full p-3 border rounded-xl mt-1 text-sm bg-slate-50" rows={2} />
              </div>
              <div className="md:col-span-2 flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setEditingOrder(null)} className="px-4 py-2 border rounded-xl text-sm font-semibold text-slate-600">취소</button>
                <button type="submit" className="px-5 py-2 bg-rose-500 text-white rounded-xl text-sm font-bold shadow-md hover:bg-rose-600">저장</button>
              </div>
            </form>
          </div>
        )}
      </main>
    </div>
  );
}
