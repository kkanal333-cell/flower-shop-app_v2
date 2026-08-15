import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';

// Supabase 연동
const SUPABASE_URL = 'https://zthuqzzholyjolteuvty.supabase.co';
const SUPABASE_KEY = 'sb_publishable_xkg9ULmNiqKrCcESytGbmw_u1Z12_gG';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// 옵션 목록
const PAYMENT_OPTIONS = ["신용카드", "현금", "계좌이체", "전화예약입금", "네이버", "인스타", "미결제"];
const PRODUCT_OPTIONS = ["꽃다발", "꽃바구니", "햇살콘플라워", "꽃묶음", "식물", "용품", "시즌한정", "기타"];

const AMPM_OPTIONS = ["오전", "오후"];
const HOUR_OPTIONS = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'));
const MINUTE_OPTIONS = ["00", "15", "30", "45"];

const parseTimeToParts = (timeStr) => {
  if (!timeStr) return { ampm: "오후", hour: "02", minute: "00" };
  const [hStr, mStr] = timeStr.split(':');
  let h = parseInt(hStr, 10);
  let m = parseInt(mStr, 10);

  m = Math.round(m / 15) * 15;
  if (m === 60) {
    m = 0;
    h = (h + 1) % 24;
  }

  const ampm = h >= 12 ? "오후" : "오전";
  let h12 = h % 12;
  if (h12 === 0) h12 = 12;

  return {
    ampm,
    hour: String(h12).padStart(2, '0'),
    minute: String(m).padStart(2, '0')
  };
};

const formatPartsToTime = (ampm, hour, minute) => {
  let h = parseInt(hour, 10);
  if (ampm === "오후" && h < 12) h += 12;
  if (ampm === "오전" && h === 12) h = 0;
  return `${String(h).padStart(2, '0')}:${minute}`;
};

const getKoreaNowFormatted = () => {
  const now = new Date();
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  const kst = new Date(utc + (9 * 60 * 60 * 1000));

  const year = kst.getFullYear();
  const month = String(kst.getMonth() + 1).padStart(2, '0');
  const day = String(kst.getDate()).padStart(2, '0');
  const dateStr = `${year}-${month}-${day}`;

  let hours = kst.getHours();
  let minutes = Math.round(kst.getMinutes() / 15) * 15;
  if (minutes === 60) {
    minutes = 0;
    hours = (hours + 1) % 24;
  }

  const timeStr = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  return { date: dateStr, time: timeStr };
};

export default function App() {
  const [activeMenu, setActiveMenu] = useState('orders');
  const [subTab, setSubTab] = useState('calendar');
  
  const [orders, setOrders] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [selectedDate, setSelectedDate] = useState(getKoreaNowFormatted().date);
  const [editingOrder, setEditingOrder] = useState(null);

  const parseDateTime = (datetimeStr, fallbackDate = '', fallbackTime = '14:00') => {
    if (!datetimeStr) return { date: fallbackDate, time: fallbackTime };
    const cleanStr = datetimeStr.replace(' ', 'T');
    const parts = cleanStr.split('T');
    const date = parts[0] || fallbackDate;
    let time = fallbackTime;
    if (parts[1]) {
      time = parts[1].slice(0, 5);
    }
    return { date, time };
  };

  const initialKst = getKoreaNowFormatted();
  const [newOrder, setNewOrder] = useState({
    customer_name: '',
    phone: '',
    product_name: '꽃다발',
    amount: 55000,
    pickup_date: initialKst.date,
    pickup_time: '14:00',
    receipt_date: initialKst.date,
    receipt_time: initialKst.time,
    payment_method: '신용카드',
    memo: ''
  });

  const handleMenuChange = (menuId) => {
    setActiveMenu(menuId);
    if (menuId === 'new') {
      const kstNow = getKoreaNowFormatted();
      setNewOrder(prev => ({
        ...prev,
        pickup_date: kstNow.date,
        receipt_date: kstNow.date,
        receipt_time: kstNow.time
      }));
    }
  };

  const fetchData = async () => {
    const { data: orderData, error: orderError } = await supabase
      .from('orders')
      .select('*, customers(id, name, phone)')
      .order('id', { ascending: false });

    if (orderData) setOrders(orderData);
    if (orderError) console.error("Orders fetch error:", orderError);

    const { data: customerData, error: customerError } = await supabase
      .from('customers')
      .select('*')
      .order('id', { ascending: false });

    if (customerData) setCustomers(customerData);
    if (customerError) console.error("Customers fetch error:", customerError);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const formatPhone = (val) => {
    if (!val) return '';
    const nums = val.replace(/[^0-9]/g, '');
    
    if (nums.length === 11) {
      return `${nums.slice(0, 3)}-${nums.slice(3, 7)}-${nums.slice(7)}`;
    }
    if (nums.length === 10) {
      if (nums.startsWith('02')) {
        return `${nums.slice(0, 2)}-${nums.slice(2, 6)}-${nums.slice(6)}`;
      }
      return `${nums.slice(0, 3)}-${nums.slice(3, 6)}-${nums.slice(6)}`;
    }
    if (nums.length > 7) {
      return `${nums.slice(0, 3)}-${nums.slice(3, 7)}-${nums.slice(7, 11)}`;
    }
    if (nums.length > 3) {
      return `${nums.slice(0, 3)}-${nums.slice(3)}`;
    }
    return nums;
  };

  const handleCreateOrder = async (e) => {
    e.preventDefault();
    if (!newOrder.customer_name) return alert('고객 성명을 입력해주세요.');
    
    const rawNums = newOrder.phone.replace(/[^0-9]/g, '');
    if (!newOrder.phone || rawNums.length < 10) {
      return alert('올바른 휴대폰 번호를 입력해주세요. (최소 10자리 이상)');
    }

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
      const { data: newCust, error: custErr } = await supabase
        .from('customers')
        .insert([{ name: newOrder.customer_name, phone: newOrder.phone }])
        .select()
        .single();
      
      if (custErr) {
        alert('고객 정보 저장 실패: ' + custErr.message);
        return;
      }
      customerId = newCust?.id;
    }

    const pickupDatetime = `${newOrder.pickup_date}T${newOrder.pickup_time}:00`;
    const receiptDatetime = `${newOrder.receipt_date}T${newOrder.receipt_time}:00`;

    const { error: orderErr } = await supabase.from('orders').insert([{
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

    if (orderErr) {
      alert('주문 저장 실패: ' + orderErr.message);
      return;
    }

    alert('주문이 성공적으로 등록되었습니다!');
    
    const kstNow = getKoreaNowFormatted();
    setNewOrder({
      customer_name: '',
      phone: '',
      product_name: '꽃다발',
      amount: 55000,
      pickup_date: kstNow.date,
      pickup_time: '14:00',
      receipt_date: kstNow.date,
      receipt_time: kstNow.time,
      payment_method: '신용카드',
      memo: ''
    });
    setActiveMenu('orders');
    fetchData();
  };

  const startEditOrder = (order) => {
    const kstNow = getKoreaNowFormatted();
    const pickup = parseDateTime(order.pickup_datetime, kstNow.date, '14:00');
    const receipt = parseDateTime(order.created_at, kstNow.date, kstNow.time);

    setEditingOrder({
      id: order.id,
      customer_id: order.customer_id,
      customer_name: order.customers?.name || '',
      phone: order.customers?.phone || '',
      product_name: order.product_name || '꽃다발',
      amount: order.amount || 0,
      pickup_date: pickup.date,
      pickup_time: pickup.time,
      receipt_date: receipt.date,
      receipt_time: receipt.time,
      payment_method: order.payment_method || '신용카드',
      memo: order.memo || ''
    });
  };

  const handleUpdateOrder = async (e) => {
    e.preventDefault();
    
    const rawNums = editingOrder.phone.replace(/[^0-9]/g, '');
    if (!editingOrder.phone || rawNums.length < 10) {
      return alert('올바른 휴대폰 번호를 입력해주세요.');
    }

    if (editingOrder.customer_id) {
      await supabase.from('customers').update({
        name: editingOrder.customer_name,
        phone: editingOrder.phone
      }).eq('id', editingOrder.customer_id);
    }

    const pickupDatetime = `${editingOrder.pickup_date}T${editingOrder.pickup_time}:00`;
    const receiptDatetime = `${editingOrder.receipt_date}T${editingOrder.receipt_time}:00`;

    await supabase.from('orders').update({
      product_name: editingOrder.product_name,
      product: editingOrder.product_name,
      amount: Number(editingOrder.amount),
      pickup_datetime: pickupDatetime,
      created_at: receiptDatetime,
      payment_method: editingOrder.payment_method,
      status: editingOrder.payment_method,
      memo: editingOrder.memo
    }).eq('id', editingOrder.id);

    alert('✅ 모든 수정사항이 저장되었습니다!');
    setEditingOrder(null);
    fetchData();
  };

  const exportOrdersCSV = () => {
    if (orders.length === 0) return alert('다운로드할 주문 데이터가 없습니다.');
    let csvContent = "data:text/csv;charset=utf-8,\uFEFF";
    csvContent += "ID,고객ID,상품명,금액,결제방식,픽업일시,접수일시,메모\n";

    orders.forEach(o => {
      const row = [
        o.id,
        o.customer_id || '',
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
    link.setAttribute("download", `주문목록_${getKoreaNowFormatted().date}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportCustomersCSV = () => {
    if (customers.length === 0) return alert('다운로드할 고객 데이터가 없습니다.');
    let csvContent = "data:text/csv;charset=utf-8,\uFEFF";
    csvContent += "ID,성명,연락처\n";

    customers.forEach(c => {
      const row = [
        c.id,
        `"${c.name || ''}"`,
        `"${c.phone || ''}"`
      ].join(",");
      csvContent += row + "\n";
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `고객목록_${getKoreaNowFormatted().date}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleImportCSV = async (e, type) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target.result;
      const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
      if (lines.length <= 1) return alert('올바른 CSV 파일이 아니거나 데이터가 없습니다.');

      const parseCSVLine = (line) => {
        const result = [];
        let cur = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
          const char = line[i];
          if (char === '"') inQuotes = !inQuotes;
          else if (char === ',' && !inQuotes) {
            result.push(cur.trim().replace(/^"|"$/g, ''));
            cur = '';
          } else {
            cur += char;
          }
        }
        result.push(cur.trim().replace(/^"|"$/g, ''));
        return result;
      };

      if (type === 'customers') {
        const newCusts = [];
        for (let i = 1; i < lines.length; i++) {
          const cols = parseCSVLine(lines[i]);
          if (cols[1]) {
            newCusts.push({ name: cols[1], phone: cols[2] || '' });
          }
        }
        if (newCusts.length > 0) {
          await supabase.from('customers').insert(newCusts);
          alert(`${newCusts.length}명의 고객 정보 복원이 완료되었습니다.`);
        }
      } else if (type === 'orders') {
        const newOrders = [];
        for (let i = 1; i < lines.length; i++) {
          const cols = parseCSVLine(lines[i]);
          if (cols[2]) {
            newOrders.push({
              customer_id: cols[1] ? Number(cols[1]) : null,
              product_name: cols[2],
              product: cols[2],
              amount: Number(cols[3]) || 0,
              payment_method: cols[4] || '신용카드',
              status: cols[4] || '신용카드',
              pickup_datetime: cols[5] || null,
              created_at: cols[6] || new Date().toISOString(),
              memo: cols[7] || ''
            });
          }
        }
        if (newOrders.length > 0) {
          await supabase.from('orders').insert(newOrders);
          alert(`${newOrders.length}건의 주문 정보 복원이 완료되었습니다.`);
        }
      }

      fetchData();
      e.target.value = '';
    };
    reader.readAsText(file, 'UTF-8');
  };

  const getCalendarEvents = () => {
    const countsByDate = {};

    orders.forEach(o => {
      if (o.pickup_datetime) {
        const dateStr = o.pickup_datetime.split('T')[0];
        countsByDate[dateStr] = (countsByDate[dateStr] || 0) + 1;
      }
    });

    return Object.keys(countsByDate).map(date => ({
      id: date,
      title: `${countsByDate[date]}건`,
      start: date,
      allDay: true,
      backgroundColor: '#ffe4e6',
      textColor: '#9f1239',
      borderColor: '#f43f5e'
    }));
  };

  const selectedDayOrders = selectedDate
    ? orders.filter(o => o.pickup_datetime && o.pickup_datetime.startsWith(selectedDate))
    : [];

  const menuList = [
    { id: 'new', label: '📝 등록' },
    { id: 'orders', label: '📋 주문/달력' },
    { id: 'customers', label: '🎂 고객' },
    { id: 'notifications', label: '🔔 알림' },
    { id: 'backup', label: '💾 백업/복원' },
  ];

  const TimePickerCustom = ({ value, onChange, bgClass = "bg-slate-50" }) => {
    const { ampm, hour, minute } = parseTimeToParts(value);

    const handleAmpmChange = (e) => {
      onChange(formatPartsToTime(e.target.value, hour, minute));
    };
    const handleHourChange = (e) => {
      onChange(formatPartsToTime(ampm, e.target.value, minute));
    };
    const handleMinuteChange = (e) => {
      onChange(formatPartsToTime(ampm, hour, e.target.value));
    };

    return (
      <div className={`flex items-center gap-1 p-1 md:p-1.5 border rounded-xl mt-1 ${bgClass} border-slate-200`}>
        <select
          value={ampm}
          onChange={handleAmpmChange}
          className="bg-transparent text-xs md:text-sm font-semibold p-1 focus:outline-none cursor-pointer"
        >
          {AMPM_OPTIONS.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <select
          value={hour}
          onChange={handleHourChange}
          className="bg-transparent text-xs md:text-sm font-semibold p-1 focus:outline-none cursor-pointer flex-1 text-center"
        >
          {HOUR_OPTIONS.map(h => <option key={h} value={h}>{h}시</option>)}
        </select>
        <span className="text-xs text-slate-400 font-bold">:</span>
        <select
          value={minute}
          onChange={handleMinuteChange}
          className="bg-transparent text-xs md:text-sm font-semibold p-1 focus:outline-none cursor-pointer flex-1 text-center"
        >
          {MINUTE_OPTIONS.map(m => <option key={m} value={m}>{m}분</option>)}
        </select>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-100/70 flex flex-col md:flex-row pb-12 md:pb-0">
      {/* 사이드바 */}
      <aside className="bg-slate-50 border-b md:border-b-0 md:border-r border-slate-200 w-full md:w-56 p-1.5 md:p-5 flex flex-col shrink-0 shadow-xs">
        <div className="hidden md:flex items-center gap-2 text-rose-600 font-extrabold text-xl mb-1">
          <span className="text-2xl">📌</span>
          <span>메뉴</span>
        </div>
        <p className="hidden md:block text-xs text-slate-400 mb-6 font-medium">이동할 메뉴를 선택하세요</p>

        <nav className="flex md:flex-col justify-between md:justify-start gap-1 md:gap-2.5 w-full text-xs md:text-sm py-1 md:py-0">
          {menuList.map(menu => (
            <label
              key={menu.id}
              onClick={() => handleMenuChange(menu.id)}
              className={`flex items-center justify-center md:justify-start gap-1 md:gap-3 px-1.5 md:px-3 py-1.5 md:py-2.5 rounded-lg cursor-pointer whitespace-nowrap transition-all flex-1 md:flex-none text-center ${
                activeMenu === menu.id
                  ? 'bg-rose-50 text-rose-600 font-bold border-b-2 md:border-b-0 md:border-l-4 border-rose-500 shadow-2xs'
                  : 'text-slate-600 hover:bg-slate-200/50'
              }`}
            >
              <input
                type="radio"
                name="sidebar-menu"
                checked={activeMenu === menu.id}
                onChange={() => {}}
                className="w-3.5 h-3.5 md:w-4 md:h-4 accent-rose-500 cursor-pointer hidden md:inline"
              />
              <span className="text-[11px] sm:text-xs md:text-sm">{menu.label}</span>
            </label>
          ))}
        </nav>
      </aside>

      {/* 메인 콘텐츠 영역 */}
      <main className="flex-1 p-2 md:p-8 max-w-6xl mx-auto w-full">
        {/* 1. 신규 등록 */}
        {activeMenu === 'new' && (
          <div className="max-w-2xl mx-auto bg-white p-3 md:p-8 rounded-2xl border border-slate-200 shadow-sm">
            <h2 className="text-base md:text-xl font-bold text-slate-800 mb-4 md:mb-6 flex items-center gap-2">
              <span>📝</span> 신규 주문 및 고객 등록
            </h2>

            <form onSubmit={handleCreateOrder} className="space-y-3 md:space-y-4">
              <div className="grid grid-cols-2 gap-2 md:gap-4">
                <div>
                  <label className="text-[10px] md:text-xs font-bold text-slate-600">고객 성명 *</label>
                  <input
                    type="text"
                    value={newOrder.customer_name}
                    onChange={e => setNewOrder({...newOrder, customer_name: e.target.value})}
                    className="w-full p-2 md:p-3 border rounded-xl mt-1 text-xs md:text-sm bg-slate-50 border-slate-200"
                    placeholder="홍길동"
                    required
                  />
                </div>
                <div>
                  <label className="text-[10px] md:text-xs font-bold text-slate-600">휴대폰 번호 *</label>
                  <input
                    type="text"
                    value={newOrder.phone}
                    onChange={e => setNewOrder({...newOrder, phone: formatPhone(e.target.value)})}
                    className="w-full p-2 md:p-3 border rounded-xl mt-1 text-xs md:text-sm bg-slate-50 border-slate-200"
                    placeholder="010-0000-0000"
                    maxLength={13}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 md:gap-4">
                <div>
                  <label className="text-[10px] md:text-xs font-bold text-slate-600">상품종류 *</label>
                  <select
                    value={newOrder.product_name}
                    onChange={e => setNewOrder({...newOrder, product_name: e.target.value})}
                    className="w-full p-2 md:p-3 border rounded-xl mt-1 text-xs md:text-sm bg-slate-50 border-slate-200"
                  >
                    {PRODUCT_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] md:text-xs font-bold text-slate-600">결제 금액 (원)</label>
                  <input
                    type="number"
                    value={newOrder.amount}
                    onChange={e => setNewOrder({...newOrder, amount: e.target.value})}
                    className="w-full p-2 md:p-3 border rounded-xl mt-1 text-xs md:text-sm bg-slate-50 border-slate-200"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 md:gap-4">
                <div>
                  <label className="text-[10px] md:text-xs font-bold text-slate-600">픽업 날짜 *</label>
                  <input
                    type="date"
                    value={newOrder.pickup_date}
                    onChange={e => setNewOrder({...newOrder, pickup_date: e.target.value})}
                    className="w-full p-2 md:p-3 border rounded-xl mt-1 text-xs md:text-sm bg-slate-50 border-slate-200"
                  />
                </div>
                <div>
                  <label className="text-[10px] md:text-xs font-bold text-slate-600">픽업 시간 * (15분 단위)</label>
                  <TimePickerCustom
                    value={newOrder.pickup_time}
                    onChange={val => setNewOrder({...newOrder, pickup_time: val})}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 md:gap-4 bg-slate-50 p-2.5 md:p-3 rounded-2xl border border-slate-200">
                <div>
                  <label className="text-[10px] md:text-xs font-bold text-slate-700">접수 날짜 (현재 시각)</label>
                  <input
                    type="date"
                    value={newOrder.receipt_date}
                    onChange={e => setNewOrder({...newOrder, receipt_date: e.target.value})}
                    className="w-full p-2 border rounded-xl mt-1 text-xs md:text-sm bg-white border-slate-200"
                  />
                </div>
                <div>
                  <label className="text-[10px] md:text-xs font-bold text-slate-700">접수 시간 (현재 시각)</label>
                  <TimePickerCustom
                    value={newOrder.receipt_time}
                    onChange={val => setNewOrder({...newOrder, receipt_time: val})}
                    bgClass="bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] md:text-xs font-bold text-slate-600">결제 방식 *</label>
                <select
                  value={newOrder.payment_method}
                  onChange={e => setNewOrder({...newOrder, payment_method: e.target.value})}
                  className="w-full p-2 md:p-3 border rounded-xl mt-1 text-xs md:text-sm bg-slate-50 border-slate-200"
                >
                  {PAYMENT_OPTIONS.map(pm => <option key={pm} value={pm}>{pm}</option>)}
                </select>
              </div>

              <div>
                <label className="text-[10px] md:text-xs font-bold text-slate-600">고객 요구사항 / 메모</label>
                <textarea
                  value={newOrder.memo}
                  onChange={e => setNewOrder({...newOrder, memo: e.target.value})}
                  className="w-full p-2 md:p-3 border rounded-xl mt-1 text-xs md:text-sm bg-slate-50 border-slate-200"
                  rows={3}
                  placeholder="요청사항이나 특이사항을 적어주세요."
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 md:py-3.5 bg-rose-500 text-black font-extrabold rounded-xl shadow-md hover:bg-rose-600 transition-colors text-sm md:text-base mt-2 cursor-pointer"
              >
                주문 저장하기
              </button>
            </form>
          </div>
        )}

        {/* 2. 주문 & 달력 */}
        {activeMenu === 'orders' && (
          <div className="space-y-3 md:space-y-6">
            <div className="bg-white p-2 sm:p-3 md:p-6 rounded-xl border border-slate-200 shadow-sm">
              <div className="flex border-b border-slate-200 mb-2 md:mb-6 gap-6">
                <button
                  onClick={() => setSubTab('calendar')}
                  className={`pb-2 text-xs md:text-sm font-bold flex items-center gap-1.5 relative transition-colors ${
                    subTab === 'calendar' ? 'text-rose-600' : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  <span>📅</span> 픽업 달력
                  {subTab === 'calendar' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-rose-500 rounded-full" />}
                </button>

                <button
                  onClick={() => setSubTab('list')}
                  className={`pb-2 text-xs md:text-sm font-bold flex items-center gap-1.5 relative transition-colors ${
                    subTab === 'list' ? 'text-rose-600' : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  <span>📊</span> 전체 주문 목록
                  {subTab === 'list' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-rose-500 rounded-full" />}
                </button>
              </div>

              {subTab === 'calendar' && (
                <div className="calendar-compact">
                  <FullCalendar
                    plugins={[dayGridPlugin, interactionPlugin]}
                    initialView="dayGridMonth"
                    locale="ko"
                    aspectRatio={1.5}
                    fixedWeekCount={false}
                    dayMaxEventRows={true}
                    contentHeight="auto"
                    events={getCalendarEvents()}
                    dateClick={(info) => setSelectedDate(info.dateStr)}
                    eventClick={(info) => setSelectedDate(info.event.startStr)}
                  />
                </div>
              )}

              {subTab === 'list' && (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-500 text-xs md:text-sm bg-slate-50">
                        <th className="py-2.5 px-3">픽업일시</th>
                        <th className="py-2.5 px-3">접수일시</th>
                        <th className="py-2.5 px-3">고객명</th>
                        <th className="py-2.5 px-3">연락처</th>
                        <th className="py-2.5 px-3">상품명</th>
                        <th className="py-2.5 px-3">금액</th>
                        <th className="py-2.5 px-3">결제수단</th>
                        <th className="py-2.5 px-3">관리</th>
                      </tr>
                    </thead>
                    <tbody>
                      {orders.map(o => (
                        <tr key={o.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors text-xs md:text-sm">
                          <td className="py-2.5 px-3 text-slate-600">{o.pickup_datetime?.replace('T', ' ').slice(0, 16) || '-'}</td>
                          <td className="py-2.5 px-3 text-xs text-slate-400">{o.created_at?.replace('T', ' ').slice(0, 16) || '-'}</td>
                          <td className="py-2.5 px-3 font-bold text-slate-900">{o.customers?.name || '-'}</td>
                          <td className="py-2.5 px-3 text-slate-600">{o.customers?.phone || '-'}</td>
                          <td className="py-2.5 px-3 font-semibold text-slate-800">{o.product_name}</td>
                          <td className="py-2.5 px-3 font-bold text-rose-600">{o.amount?.toLocaleString()}원</td>
                          <td className="py-2.5 px-3"><span className="px-2 py-0.5 bg-slate-100 rounded text-xs font-medium">{o.payment_method}</span></td>
                          <td className="py-2.5 px-3">
                            <button onClick={() => startEditOrder(o)} className="text-xs bg-slate-200 text-black px-2 py-1 rounded hover:bg-slate-300 font-bold cursor-pointer">
                              수정하기
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* 선택한 날짜 리스트 */}
            {subTab === 'calendar' && selectedDate && (
              <div className="bg-white p-3 md:p-6 rounded-xl border border-slate-200 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm md:text-lg font-bold text-slate-800 flex items-center gap-2">
                    <span>📅</span> <span className="text-rose-600">{selectedDate}</span> 픽업 주문 ({selectedDayOrders.length}건)
                  </h3>
                  <span className="text-xs text-slate-400">* 클릭하여 수정 가능</span>
                </div>

                {selectedDayOrders.length === 0 ? (
                  <div className="bg-slate-50 text-slate-500 p-3 rounded-xl text-xs md:text-sm text-center border border-slate-100">
                    해당 날짜에 예정된 픽업 주문이 없습니다.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                    {selectedDayOrders.map(o => (
                      <div
                        key={o.id}
                        onClick={() => startEditOrder(o)}
                        className="p-3 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-rose-50/50 hover:border-rose-300 transition-all cursor-pointer flex flex-col justify-between gap-1.5 shadow-2xs group"
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="font-bold text-slate-900 text-sm md:text-base group-hover:text-rose-600 transition-colors">
                              {o.customers?.name || '익명'}
                            </span>
                            <span className="text-xs text-slate-500 ml-2">{o.customers?.phone || ''}</span>
                            <p className="text-xs md:text-sm font-semibold text-rose-600 mt-0.5">{o.product_name}</p>
                          </div>
                          <span className="px-2 py-0.5 bg-white border border-slate-200 rounded text-xs font-bold text-slate-700">
                            {o.payment_method}
                          </span>
                        </div>
                        {o.memo && <p className="text-xs text-slate-600 bg-white p-1.5 rounded-lg border border-slate-100">💬 {o.memo}</p>}
                        
                        <div className="flex justify-between items-center pt-2 border-t border-slate-200/80">
                          <span className="font-bold text-slate-800 text-xs md:text-sm">{o.amount?.toLocaleString()}원</span>
                          
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              startEditOrder(o);
                            }}
                            className="inline-flex items-center gap-1 text-xs bg-slate-200 hover:bg-rose-500 hover:text-white text-slate-900 font-extrabold px-2.5 py-1 rounded-lg border border-slate-300 transition-colors shadow-2xs cursor-pointer"
                          >
                            <span>✏️</span>
                            <span>수정하기</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* 3. 고객 관리 */}
        {activeMenu === 'customers' && (
          <div className="bg-white p-4 md:p-8 rounded-xl border border-slate-200 shadow-sm">
            <h2 className="text-lg md:text-xl font-bold text-slate-800 mb-4 md:mb-6 flex items-center gap-2">
              <span>🎂</span> 고객 목록 ({customers.length}명)
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 text-xs md:text-sm bg-slate-50">
                    <th className="py-2.5 px-3">고객 ID</th>
                    <th className="py-2.5 px-3">성명</th>
                    <th className="py-2.5 px-3">연락처</th>
                  </tr>
                </thead>
                <tbody>
                  {customers.map(c => (
                    <tr key={c.id} className="border-b border-slate-100 hover:bg-slate-50 text-xs md:text-sm">
                      <td className="py-2.5 px-3 text-slate-400">{c.id}</td>
                      <td className="py-2.5 px-3 font-bold text-slate-800">{c.name}</td>
                      <td className="py-2.5 px-3 text-slate-600">{c.phone}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 4. 알림 센터 */}
        {activeMenu === 'notifications' && (
          <div className="bg-white p-4 md:p-8 rounded-xl border border-slate-200 shadow-sm">
            <h2 className="text-lg md:text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
              <span>🔔</span> 알림 센터
            </h2>
            <p className="text-xs md:text-sm text-slate-500">
              오늘 이후 예정된 주요 픽업 주문 알림이 이곳에 등록됩니다.
            </p>
          </div>
        )}

        {/* 5. 백업 및 복원 */}
        {activeMenu === 'backup' && (
          <div className="bg-white p-4 md:p-8 rounded-xl border border-slate-200 shadow-sm space-y-6">
            <h2 className="text-lg md:text-xl font-bold text-slate-800 flex items-center gap-2">
              <span>💾</span> 데이터 백업 및 복원
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 border rounded-xl bg-slate-50 space-y-2">
                <h3 className="font-bold text-slate-800 text-sm md:text-base">📤 데이터 내보내기 (CSV)</h3>
                <p className="text-xs text-slate-500">현재 등록된 모든 주문과 고객 데이터를 CSV 파일로 다운로드합니다.</p>
                <div className="flex gap-2 pt-2">
                  <button onClick={exportOrdersCSV} className="bg-rose-500 text-white text-xs md:text-sm px-3 py-2 rounded-lg font-bold hover:bg-rose-600 transition-colors cursor-pointer">
                    주문목록 내보내기
                  </button>
                  <button onClick={exportCustomersCSV} className="bg-slate-700 text-white text-xs md:text-sm px-3 py-2 rounded-lg font-bold hover:bg-slate-800 transition-colors cursor-pointer">
                    고객목록 내보내기
                  </button>
                </div>
              </div>

              <div className="p-4 border rounded-xl bg-slate-50 space-y-2">
                <h3 className="font-bold text-slate-800 text-sm md:text-base">📥 데이터 복원하기 (CSV)</h3>
                <p className="text-xs text-slate-500">백업했던 CSV 파일을 선택하여 Supabase 데이터베이스에 등록합니다.</p>
                <div className="flex flex-col gap-2 pt-2">
                  <label className="text-xs font-bold text-slate-600">주문목록 복원:</label>
                  <input type="file" accept=".csv" onChange={(e) => handleImportCSV(e, 'orders')} className="text-xs text-slate-500 cursor-pointer" />
                  <label className="text-xs font-bold text-slate-600 mt-1">고객목록 복원:</label>
                  <input type="file" accept=".csv" onChange={(e) => handleImportCSV(e, 'customers')} className="text-xs text-slate-500 cursor-pointer" />
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* 주문 수정 Modal (팝업) */}
      {editingOrder && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-3 z-50">
          <div className="bg-white rounded-2xl max-w-lg w-full p-4 md:p-6 border border-slate-200 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="text-base md:text-lg font-bold text-slate-800">✏️ 주문 수정하기</h3>
              <button onClick={() => setEditingOrder(null)} className="text-slate-400 hover:text-slate-600 text-lg font-bold">✕</button>
            </div>

            <form onSubmit={handleUpdateOrder} className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-bold text-slate-600">고객 성명</label>
                  <input
                    type="text"
                    value={editingOrder.customer_name}
                    onChange={e => setEditingOrder({...editingOrder, customer_name: e.target.value})}
                    className="w-full p-2 border rounded-xl mt-1 text-xs md:text-sm bg-slate-50"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-600">휴대폰 번호</label>
                  <input
                    type="text"
                    value={editingOrder.phone}
                    onChange={e => setEditingOrder({...editingOrder, phone: formatPhone(e.target.value)})}
                    className="w-full p-2 border rounded-xl mt-1 text-xs md:text-sm bg-slate-50"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-bold text-slate-600">상품종류</label>
                  <select
                    value={editingOrder.product_name}
                    onChange={e => setEditingOrder({...editingOrder, product_name: e.target.value})}
                    className="w-full p-2 border rounded-xl mt-1 text-xs md:text-sm bg-slate-50"
                  >
                    {PRODUCT_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-600">결제 금액 (원)</label>
                  <input
                    type="number"
                    value={editingOrder.amount}
                    onChange={e => setEditingOrder({...editingOrder, amount: e.target.value})}
                    className="w-full p-2 border rounded-xl mt-1 text-xs md:text-sm bg-slate-50"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-bold text-slate-600">픽업 날짜</label>
                  <input
                    type="date"
                    value={editingOrder.pickup_date}
                    onChange={e => setEditingOrder({...editingOrder, pickup_date: e.target.value})}
                    className="w-full p-2 border rounded-xl mt-1 text-xs md:text-sm bg-slate-50"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-600">픽업 시간</label>
                  <TimePickerCustom
                    value={editingOrder.pickup_time}
                    onChange={val => setEditingOrder({...editingOrder, pickup_time: val})}
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-600">결제 방식</label>
                <select
                  value={editingOrder.payment_method}
                  onChange={e => setEditingOrder({...editingOrder, payment_method: e.target.value})}
                  className="w-full p-2 border rounded-xl mt-1 text-xs md:text-sm bg-slate-50"
                >
                  {PAYMENT_OPTIONS.map(pm => <option key={pm} value={pm}>{pm}</option>)}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-600">메모</label>
                <textarea
                  value={editingOrder.memo}
                  onChange={e => setEditingOrder({...editingOrder, memo: e.target.value})}
                  className="w-full p-2 border rounded-xl mt-1 text-xs md:text-sm bg-slate-50"
                  rows={2}
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingOrder(null)}
                  className="flex-1 py-2.5 border border-slate-300 rounded-xl font-bold text-xs md:text-sm hover:bg-slate-100 cursor-pointer"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-rose-500 text-white rounded-xl font-bold text-xs md:text-sm hover:bg-rose-600 cursor-pointer"
                >
                  수정 완료
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
