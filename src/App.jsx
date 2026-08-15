import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';

const SUPABASE_URL = 'https://zthuqzzholyjolteuvty.supabase.co';
const SUPABASE_KEY = 'sb_publishable_xkg9ULmNiqKrCcESytGbmw_u1Z12_gG';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const DEFAULT_APP_PASSWORD = "8005"; 

const PAYMENT_OPTIONS = ["신용카드", "현금", "계좌이체", "전화예약입금", "네이버", "인스타", "미결제"];
const PRODUCT_OPTIONS = ["꽃다발", "꽃바구니", "햇살콘플라워", "꽃묶음", "식물", "용품", "시즌한정", "기타"];
const AMPM_OPTIONS = ["오전", "오후"];
const HOUR_OPTIONS = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'));
const MINUTE_OPTIONS = ["00", "15", "30", "45"];

const formatShortDateTime = (datetimeStr) => {
  if (!datetimeStr) return '-';
  const cleanStr = datetimeStr.replace(' ', 'T');
  const [datePart, timePart] = cleanStr.split('T');
  if (!datePart) return '-';
  const dateComponents = datePart.split('-');
  if (dateComponents.length !== 3) return datetimeStr;
  const yy = dateComponents[0].slice(-2);
  const mm = dateComponents[1];
  const dd = dateComponents[2];
  const time = timePart ? timePart.slice(0, 5) : '00:00';
  return `${yy}-${mm}-${dd} ${time}`;
};

const parseTimeToParts = (timeStr) => {
  if (!timeStr) return { ampm: "오후", hour: "02", minute: "00" };
  const [hStr, mStr] = timeStr.split(':');
  let h = parseInt(hStr, 10);
  let m = parseInt(mStr, 10);
  m = Math.round(m / 15) * 15;
  if (m === 60) { m = 0; h = (h + 1) % 24; }
  const ampm = h >= 12 ? "오후" : "오전";
  let h12 = h % 12;
  if (h12 === 0) h12 = 12;
  return { ampm, hour: String(h12).padStart(2, '0'), minute: String(m).padStart(2, '0') };
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
  const hours = String(kst.getHours()).padStart(2, '0');
  const minutes = String(kst.getMinutes()).padStart(2, '0');
  const timeStr = `${hours}:${minutes}`;
  const dayOfWeek = kst.getDay();
  const currentHour = kst.getHours();
  return { date: dateStr, time: timeStr, dayOfWeek, currentHour };
};

const downloadCSV = (headers, rows, filename) => {
  const escapeCSV = (val) => {
    if (val === null || val === undefined) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };
  const csvContent = [headers.map(escapeCSV).join(','), ...rows.map(row => row.map(escapeCSV).join(','))].join('\r\n');
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

const parseCSVText = (text) => {
  const lines = text.split(/\r\n|\n/);
  const result = [];
  for (let line of lines) {
    line = line.trim();
    if (!line) continue;
    const row = [];
    let insideQuote = false;
    let entry = '';
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (insideQuote && line[i + 1] === '"') { entry += '"'; i++; }
        else { insideQuote = !insideQuote; }
      } else if (char === ',' && !insideQuote) {
        row.push(entry.trim()); entry = '';
      } else { entry += char; }
    }
    row.push(entry.trim());
    result.push(row);
  }
  if (result.length < 2) return [];
  const headers = result[0].map(h => h.replace(/^"|"$/g, ''));
  const rows = result.slice(1);
  return rows.map(r => {
    const obj = {};
    headers.forEach((h, idx) => {
      let val = r[idx] || '';
      if (val.startsWith('"') && val.endsWith('"')) { val = val.slice(1, -1).replace(/""/g, '"'); }
      obj[h] = val;
    });
    return obj;
  });
};

export default function App() {
  const appPassword = DEFAULT_APP_PASSWORD;

  const [isAuthenticated, setIsAuthenticated] = useState(() => sessionStorage.getItem('app_authenticated') === 'true');
  const [inputPin, setInputPin] = useState('');
  const [pinError, setPinError] = useState(false);

  const [activeMenu, setActiveMenu] = useState('orders');
  const [subTab, setSubTab] = useState('calendar');
  
  const [orders, setOrders] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [selectedDate, setSelectedDate] = useState(getKoreaNowFormatted().date);
  const [editingOrder, setEditingOrder] = useState(null);

  const [selectedOrderIds, setSelectedOrderIds] = useState([]);
  const [selectedCustomerIds, setSelectedCustomerIds] = useState([]);

  const [orderSearch, setOrderSearch] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [matchedCustomerList, setMatchedCustomerList] = useState([]);

  const [showBackupAlertModal, setShowBackupAlertModal] = useState(false);
  const [isMemoAutofilled, setIsMemoAutofilled] = useState(false);

  const handlePinSubmit = (e) => {
    e.preventDefault();
    if (inputPin === appPassword) {
      setIsAuthenticated(true);
      sessionStorage.setItem('app_authenticated', 'true');
      setPinError(false);
    } else {
      setPinError(true);
      setInputPin('');
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem('app_authenticated');
    setIsAuthenticated(false);
  };

  const parseDateTime = (datetimeStr, fallbackDate = '', fallbackTime = '14:00') => {
    if (!datetimeStr) return { date: fallbackDate, time: fallbackTime };
    const cleanStr = datetimeStr.replace(' ', 'T');
    const parts = cleanStr.split('T');
    const date = parts[0] || fallbackDate;
    let time = fallbackTime;
    if (parts[1]) { time = parts[1].slice(0, 5); }
    return { date, time };
  };

  const initialKst = getKoreaNowFormatted();
  const [newOrder, setNewOrder] = useState({
    customer_name: '', phone: '010-', product_name: '꽃다발', amount_thousands: '55',
    pickup_date: initialKst.date, pickup_time: '14:00',
    receipt_date: initialKst.date, receipt_time: initialKst.time,
    payment_method: '신용카드', memo: ''
  });

  const fetchData = useCallback(async () => {
    const { data: orderData } = await supabase.from('orders').select('*, customers(id, name, phone)').order('id', { ascending: false });
    if (orderData) setOrders(orderData);
    const { data: customerData } = await supabase.from('customers').select('*').order('id', { ascending: false });
    if (customerData) setCustomers(customerData);
  }, []);

  useEffect(() => {
    if (isAuthenticated) fetchData();
  }, [isAuthenticated, fetchData]);

  useEffect(() => {
    const checkBackupSchedule = () => {
      const nowInfo = getKoreaNowFormatted();
      if (nowInfo.dayOfWeek === 1 && nowInfo.currentHour >= 12) {
        if (localStorage.getItem('last_backup_notice_date') !== nowInfo.date) {
          setShowBackupAlertModal(true);
        }
      }
    };
    checkBackupSchedule();
    const interval = setInterval(checkBackupSchedule, 60000);
    return () => clearInterval(interval);
  }, []);

  const handleCloseBackupModal = () => {
    localStorage.setItem('last_backup_notice_date', getKoreaNowFormatted().date);
    setShowBackupAlertModal(false);
  };

  const handleMenuChange = (menuId) => {
    setActiveMenu(menuId);
    if (menuId === 'new') {
      const kstNow = getKoreaNowFormatted();
      setNewOrder({
        customer_name: '', phone: '010-', product_name: '꽃다발', amount_thousands: '55',
        pickup_date: kstNow.date, pickup_time: '14:00',
        receipt_date: kstNow.date, receipt_time: kstNow.time,
        payment_method: '신용카드', memo: ''
      });
      setIsMemoAutofilled(false);
      setMatchedCustomerList([]);
    }
  };

  const formatPhone = (val) => {
    if (!val) return '';
    const nums = val.replace(/[^0-9]/g, '');
    if (nums.length === 11) return `${nums.slice(0, 3)}-${nums.slice(3, 7)}-${nums.slice(7)}`;
    if (nums.length === 10) return nums.startsWith('02') ? `${nums.slice(0, 2)}-${nums.slice(2, 6)}-${nums.slice(6)}` : `${nums.slice(0, 3)}-${nums.slice(3, 6)}-${nums.slice(6)}`;
    if (nums.length > 7) return `${nums.slice(0, 3)}-${nums.slice(3, 7)}-${nums.slice(7, 11)}`;
    if (nums.length > 3) return `${nums.slice(0, 3)}-${nums.slice(3)}`;
    return nums;
  };

  const handleCustomerSearchChange = (val) => setCustomerSearch(val.replace(/[^0-9]/g, '') ? formatPhone(val) : val);
  const handleOrderSearchChange = (val) => setOrderSearch(val.replace(/[^0-9]/g, '') ? formatPhone(val) : val);

  const handleCustomerNameChange = (nameInput) => {
    setNewOrder(prev => ({ ...prev, customer_name: nameInput }));
    if (!nameInput.trim()) { setMatchedCustomerList([]); return; }
    const cleanInput = nameInput.trim().toLowerCase();
    const allKnownCustomers = [...customers];
    orders.forEach(o => { if (o.customers && !allKnownCustomers.some(c => c.id === o.customers.id)) allKnownCustomers.push(o.customers); });
    setMatchedCustomerList(allKnownCustomers.filter(c => c?.name?.toLowerCase().includes(cleanInput)));
  };

  const selectCustomerForNewOrder = (cust) => {
    let hasAutofilledMemo = false;
    setNewOrder(prev => {
      const updated = { ...prev, customer_name: cust.name, phone: cust.phone || '010-' };
      const recentOrder = orders.filter(o => o.customer_id === cust.id || o.customers?.name === cust.name).sort((a, b) => b.id - a.id)[0];
      if (recentOrder) {
        if (recentOrder.product_name) updated.product_name = recentOrder.product_name;
        if (recentOrder.amount) updated.amount_thousands = String(Math.floor(recentOrder.amount / 1000));
        if (recentOrder.payment_method) updated.payment_method = recentOrder.payment_method;
        if (recentOrder.memo) { updated.memo = recentOrder.memo; hasAutofilledMemo = true; }
      }
      return updated;
    });
    setIsMemoAutofilled(hasAutofilledMemo);
    setMatchedCustomerList([]);
  };

  const handleCreateOrder = async (e) => {
    e.preventDefault();
    if (!newOrder.customer_name) return alert('고객 성명을 입력해주세요.');
    if (!newOrder.phone || newOrder.phone.replace(/[^0-9]/g, '').length < 10) return alert('올바른 휴대폰 번호를 입력해주세요.');

    let customerId;
    let finalCustomerName = newOrder.customer_name.trim();
    const { data: custByPhone } = await supabase.from('customers').select('id, name').eq('phone', newOrder.phone).maybeSingle();

    if (custByPhone) {
      customerId = custByPhone.id;
      finalCustomerName = custByPhone.name;
    } else {
      const baseName = finalCustomerName.replace(/[0-9]/g, '');
      const sameNameCusts = customers.filter(c => c.name.replace(/[0-9]/g, '') === baseName);
      if (sameNameCusts.length > 0) finalCustomerName = `${baseName}${sameNameCusts.length + 1}`;

      const { data: newCust, error: custErr } = await supabase.from('customers').insert([{ name: finalCustomerName, phone: newOrder.phone }]).select().single();
      if (custErr) { alert('고객 정보 저장 실패: ' + custErr.message); return; }
      customerId = newCust?.id;
    }

    const { error: orderErr } = await supabase.from('orders').insert([{
      customer_id: customerId,
      product_name: newOrder.product_name,
      product: newOrder.product_name,
      amount: (Number(newOrder.amount_thousands) || 0) * 1000,
      pickup_datetime: `${newOrder.pickup_date}T${newOrder.pickup_time}:00`,
      created_at: `${newOrder.receipt_date}T${newOrder.receipt_time}:00`,
      payment_method: newOrder.payment_method,
      status: newOrder.payment_method,
      memo: newOrder.memo
    }]);

    if (orderErr) { alert('주문 저장 실패: ' + orderErr.message); return; }
    alert(`주문이 성공적으로 등록되었습니다! (고객명: ${finalCustomerName})`);
    setActiveMenu('orders');
    fetchData();
  };

  const startEditOrder = (order) => {
    const kstNow = getKoreaNowFormatted();
    const pickup = parseDateTime(order.pickup_datetime, kstNow.date, '14:00');
    const receipt = parseDateTime(order.created_at, kstNow.date, kstNow.time);
    setEditingOrder({
      id: order.id, customer_id: order.customer_id,
      customer_name: order.customers?.name || '', phone: order.customers?.phone || '',
      product_name: order.product_name || '꽃다발', amount_thousands: String(Math.floor((order.amount || 0) / 1000)),
      pickup_date: pickup.date, pickup_time: pickup.time,
      receipt_date: receipt.date, receipt_time: receipt.time,
      payment_method: order.payment_method || '신용카드', memo: order.memo || ''
    });
  };

  const handleUpdateOrder = async (e) => {
    e.preventDefault();
    if (!editingOrder.phone || editingOrder.phone.replace(/[^0-9]/g, '').length < 10) return alert('올바른 휴대폰 번호를 입력해주세요.');

    if (editingOrder.customer_id) {
      await supabase.from('customers').update({ name: editingOrder.customer_name, phone: editingOrder.phone }).eq('id', editingOrder.customer_id);
    }

    await supabase.from('orders').update({
      product_name: editingOrder.product_name, product: editingOrder.product_name,
      amount: (Number(editingOrder.amount_thousands) || 0) * 1000,
      pickup_datetime: `${editingOrder.pickup_date}T${editingOrder.pickup_time}:00`,
      created_at: `${editingOrder.receipt_date}T${editingOrder.receipt_time}:00`,
      payment_method: editingOrder.payment_method, status: editingOrder.payment_method, memo: editingOrder.memo
    }).eq('id', editingOrder.id);

    alert('✅ 모든 수정사항이 저장되었습니다!');
    setEditingOrder(null);
    fetchData();
  };

  const handleDeleteSelectedOrders = async () => {
    if (selectedOrderIds.length === 0 || !window.confirm(`선택한 ${selectedOrderIds.length}개의 주문을 삭제하시겠습니까?`)) return;
    const { error } = await supabase.from('orders').delete().in('id', selectedOrderIds);
    if (error) alert('주문 삭제 실패: ' + error.message);
    else { alert('선택한 주문이 삭제되었습니다.'); setSelectedOrderIds([]); fetchData(); }
  };

  const handleDeleteSelectedCustomers = async () => {
    if (selectedCustomerIds.length === 0 || !window.confirm(`선택한 ${selectedCustomerIds.length}명의 고객 정보를 삭제하시겠습니까?`)) return;
    const { error } = await supabase.from('customers').delete().in('id', selectedCustomerIds);
    if (error) alert('고객 삭제 실패: ' + error.message);
    else { alert('선택한 고객 정보가 삭제되었습니다.'); setSelectedCustomerIds([]); fetchData(); }
  };

  const handleExportCSV = () => {
    const today = getKoreaNowFormatted().date;
    downloadCSV(['주문ID', '고객명', '연락처', '상품명', '금액', '픽업일시', '접수일시', '결제수단', '메모'], orders.map(o => [o.id, o.customers?.name || '', o.customers?.phone || '', o.product_name || '', o.amount || 0, o.pickup_datetime || '', o.created_at || '', o.payment_method || '', o.memo || '']), `export_orders_${today}.csv`);
    setTimeout(() => {
      downloadCSV(['ID', '이름', '연락처', '등록일'], customers.map(c => [c.id, c.name || '', c.phone || '', c.created_at || '']), `export_customers_${today}.csv`);
    }, 300);
    alert('CSV 백업 파일 다운로드가 시작되었습니다.');
    handleCloseBackupModal();
  };

  const handleImportCSV = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0 || !window.confirm(`선택한 ${files.length}개 CSV 파일 데이터를 추가 등록하시겠습니까?`)) return;
    try {
      let cCount = 0, oCount = 0;
      for (const file of files) {
        const text = await file.text();
        const parsedRows = parseCSVText(text);
        if (parsedRows.length === 0) continue;
        const keys = Object.keys(parsedRows[0]);
        if (keys.includes('이름') && keys.includes('연락처')) {
          for (const row of parsedRows) {
            if (row['이름'] && row['연락처']) {
              await supabase.from('customers').upsert([{ name: row['이름'], phone: row['연락처'] }], { onConflict: 'phone' });
              cCount++;
            }
          }
        } else if (keys.includes('주문ID') || keys.includes('상품명')) {
          const { data: updatedCustomers } = await supabase.from('customers').select('*');
          for (const row of parsedRows) {
            let custId = updatedCustomers?.find(c => c.phone === row['연락처'])?.id || null;
            await supabase.from('orders').insert([{
              customer_id: custId, product_name: row['상품명'] || '꽃다발', product: row['상품명'] || '꽃다발',
              amount: Number(row['금액']) || 0, pickup_datetime: row['픽업일시'] || null, created_at: row['접수일시'] || null,
              payment_method: row['결제수단'] || '신용카드', status: row['결제수단'] || '신용카드', memo: row['메모'] || ''
            }]);
            oCount++;
          }
        }
      }
      alert(`복원 완료: 고객 (${cCount}건), 주문 (${oCount}건)`);
      fetchData();
    } catch (err) { alert('CSV 복원 중 오류가 발생했습니다.'); } finally { e.target.value = ''; }
  };

  const todayDateStr = getKoreaNowFormatted().date;

  const sortedAndFilteredOrders = [...orders].filter(o => {
    const q = orderSearch.trim().toLowerCase();
    if (!q) return true;
    return (o.customers?.name?.toLowerCase().includes(q)) || (o.customers?.phone?.replace(/[^0-9]/g, '').includes(q.replace(/[^0-9]/g, '')));
  });

  const filteredCustomers = customers.filter(c => {
    const q = customerSearch.trim().toLowerCase();
    if (!q) return true;
    return (c.name?.toLowerCase().includes(q)) || (c.phone?.replace(/[^0-9]/g, '').includes(q.replace(/[^0-9]/g, '')));
  });

  const TimePickerCustom = ({ value, onChange }) => {
    const { ampm, hour, minute } = parseTimeToParts(value);
    return (
      <div className="flex items-center gap-1 p-2 border rounded-xl mt-1 bg-white border-slate-200">
        <select value={ampm} onChange={e => onChange(formatPartsToTime(e.target.value, hour, minute))} className="bg-white text-xs font-semibold focus:outline-none">
          {AMPM_OPTIONS.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <select value={hour} onChange={e => onChange(formatPartsToTime(ampm, e.target.value, minute))} className="bg-white text-xs font-semibold focus:outline-none flex-1 text-center">
          {HOUR_OPTIONS.map(h => <option key={h} value={h}>{h}시</option>)}
        </select>
        <span>:</span>
        <select value={minute} onChange={e => onChange(formatPartsToTime(ampm, hour, e.target.value))} className="bg-white text-xs font-semibold focus:outline-none flex-1 text-center">
          {MINUTE_OPTIONS.map(m => <option key={m} value={m}>{m}분</option>)}
        </select>
      </div>
    );
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-800 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-sm text-center border-2 border-slate-400">
          <div className="text-4xl mb-3">🔒</div>
          <h2 className="text-xl font-bold mb-1">시스템 접속 잠금</h2>
          <form onSubmit={handlePinSubmit} className="space-y-4 mt-4">
            <input
              type="text" inputMode="numeric" maxLength={4} value={inputPin}
              onChange={e => setInputPin(e.target.value.replace(/[^0-9]/g, ''))}
              placeholder="• • • •" className="w-full text-center text-2xl font-bold tracking-[1em] p-3 border-2 rounded-xl"
              style={{ WebkitTextSecurity: 'disc' }} autoFocus
            />
            {pinError && <p className="text-rose-600 text-xs font-bold">⚠️ 비밀번호가 올바르지 않습니다.</p>}
            <button type="submit" className="w-full py-3 bg-slate-900 text-white font-extrabold rounded-xl text-sm">확인 및 접속</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100/70 flex flex-col md:flex-row">
      {showBackupAlertModal && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full text-center space-y-4">
            <div className="text-4xl">📢</div>
            <h3 className="text-lg font-bold">주간 CSV 백업 알림</h3>
            <p className="text-xs text-slate-600">매주 월요일 낮 12시 정기 백업 시간입니다.</p>
            <div className="flex gap-2">
              <button onClick={handleExportCSV} className="flex-1 py-2.5 bg-rose-500 text-white rounded-xl text-xs font-bold">백업 다운로드</button>
              <button onClick={handleCloseBackupModal} className="px-4 py-2.5 bg-slate-100 rounded-xl text-xs font-bold">닫기</button>
            </div>
          </div>
        </div>
      )}

      <aside className="bg-slate-50 border-r w-full md:w-28 p-2 flex flex-col shrink-0">
        <nav className="flex md:flex-col gap-1 w-full text-xs">
          {[
            { id: 'new', label: '📝 신규주문' },
            { id: 'orders', label: '📋 주문/달력' },
            { id: 'customers', label: '🎂 고객' },
            { id: 'notifications', label: '🔔 알림' },
            { id: 'backup', label: '💾 백업' }
          ].map(m => (
            <button key={m.id} onClick={() => handleMenuChange(m.id)} className={`p-2 rounded-lg font-bold flex-1 md:flex-none text-center ${activeMenu === m.id ? 'bg-rose-100 text-rose-900 border-2 border-rose-600' : 'text-slate-700'}`}>
              {m.label}
            </button>
          ))}
          <button onClick={handleLogout} className="py-1 px-2 bg-slate-200 rounded-lg text-xs font-extrabold">🔒 잠금</button>
        </nav>
      </aside>

      <main className="flex-1 p-2 md:p-5 max-w-6xl mx-auto w-full">
        {editingOrder && (
          <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center p-3 z-50">
            <div className="bg-white rounded-2xl p-6 w-full max-w-xl max-h-[90vh] overflow-y-auto">
              <h3 className="text-lg font-bold mb-4">✏️ 주문 수정</h3>
              <form onSubmit={handleUpdateOrder} className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <input type="text" value={editingOrder.customer_name} onChange={e => setEditingOrder({ ...editingOrder, customer_name: e.target.value })} className="p-2 border rounded-xl text-xs" required />
                  <input type="text" value={editingOrder.phone} onChange={e => setEditingOrder({ ...editingOrder, phone: formatPhone(e.target.value) })} className="p-2 border rounded-xl text-xs" required />
                </div>
                <div className="flex gap-2 pt-2">
                  <button type="submit" className="flex-1 py-2 bg-black text-white font-extrabold rounded-xl text-xs">저장하기</button>
                  <button type="button" onClick={() => setEditingOrder(null)} className="px-4 py-2 bg-slate-100 rounded-xl text-xs">취소</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {activeMenu === 'new' && (
          <div className="max-w-2xl mx-auto bg-white p-6 rounded-2xl border shadow-sm">
            <h2 className="text-xl font-bold mb-4">📝 신규 주문 및 고객 등록</h2>
            <form onSubmit={handleCreateOrder} className="space-y-4">
              <div className="grid grid-cols-2 gap-4 relative">
                <div>
                  <label className="text-xs font-bold">고객 성명 *</label>
                  <input type="text" value={newOrder.customer_name} onChange={e => handleCustomerNameChange(e.target.value)} className="w-full p-2 border rounded-xl text-sm mt-1" required />
                  {matchedCustomerList.length > 0 && (
                    <div className="absolute left-0 right-0 top-full bg-white border rounded-xl shadow-lg z-20">
                      {matchedCustomerList.map(c => (
                        <div key={c.id} onClick={() => selectCustomerForNewOrder(c)} className="p-2 text-xs hover:bg-rose-50 cursor-pointer flex justify-between">
                          <span>{c.name}</span><span>{c.phone}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <label className="text-xs font-bold">휴대폰 번호 *</label>
                  <input type="text" value={newOrder.phone} onChange={e => setNewOrder({...newOrder, phone: formatPhone(e.target.value)})} className="w-full p-2 border rounded-xl text-sm mt-1" required />
                </div>
              </div>
              <button type="submit" className="w-full py-3 bg-black text-white font-extrabold rounded-xl text-sm">주문 저장하기</button>
            </form>
          </div>
        )}

        {activeMenu === 'orders' && (
          <div className="space-y-4">
            <div className="bg-white p-4 rounded-xl border shadow-sm">
              <div className="flex gap-4 mb-4">
                <button onClick={() => setSubTab('calendar')} className={`font-bold text-sm ${subTab === 'calendar' ? 'text-rose-600' : 'text-slate-500'}`}>📅 픽업 달력</button>
                <button onClick={() => setSubTab('list')} className={`font-bold text-sm ${subTab === 'list' ? 'text-rose-600' : 'text-slate-500'}`}>📊 전체 주문 목록</button>
              </div>
              {subTab === 'calendar' ? (
                <FullCalendar plugins={[dayGridPlugin, interactionPlugin]} initialView="dayGridMonth" locale="ko" events={orders.map(o => ({ start: o.pickup_datetime?.split('T')[0], title: '1건' }))} dateClick={info => setSelectedDate(info.dateStr)} />
              ) : (
                <div className="space-y-3">
                  <input type="text" value={orderSearch} onChange={e => handleOrderSearchChange(e.target.value)} placeholder="🔍 주문 검색" className="w-full p-2 border rounded-xl text-sm" />
                  <div className="overflow-x-auto border rounded-xl">
                    <table className="w-full text-left text-sm">
                      <tr className="bg-slate-100 font-bold">
                        <th className="p-2">픽업일시</th><th className="p-2">고객명</th><th className="p-2">연락처</th><th className="p-2">상품</th><th className="p-2">금액</th><th className="p-2">메모</th>
                      </tr>
                      {sortedAndFilteredOrders.map(o => (
                        <tr key={o.id} className="border-b">
                          <td className="p-2">{formatShortDateTime(o.pickup_datetime)}</td>
                          <td className="p-2">{o.customers?.name}</td>
                          <td className="p-2">{o.customers?.phone}</td>
                          <td className="p-2">{o.product_name}</td>
                          <td className="p-2">{o.amount?.toLocaleString()}원</td>
                          <td className="p-2">{o.memo}</td>
                        </tr>
                      ))}
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {activeMenu === 'customers' && (
          <div className="bg-white p-6 rounded-2xl border shadow-sm space-y-4">
            <h2 className="text-xl font-bold">🎂 고객 목록</h2>
            <input type="text" value={customerSearch} onChange={e => handleCustomerSearchChange(e.target.value)} placeholder="🔍 고객 검색" className="w-full p-2 border rounded-xl text-sm" />
            <div className="overflow-x-auto border rounded-xl">
              <table className="w-full text-left text-sm">
                <tr className="bg-slate-100 font-bold"><th className="p-2">이름</th><th className="p-2">연락처</th></tr>
                {filteredCustomers.map(c => (
                  <tr key={c.id} className="border-b"><td className="p-2">{c.name}</td><td className="p-2">{c.phone}</td></tr>
                ))}
              </table>
            </div>
          </div>
        )}

        {activeMenu === 'backup' && (
          <div className="bg-white p-8 rounded-2xl border shadow-sm max-w-xl mx-auto space-y-6">
            <h2 className="text-xl font-bold">💾 CSV 백업 및 복원</h2>
            <button onClick={handleExportCSV} className="w-full py-3 bg-rose-600 text-white font-bold rounded-xl text-sm">📥 CSV 백업 파일 다운로드</button>
            <input type="file" accept=".csv" multiple onChange={handleImportCSV} className="w-full text-xs" />
          </div>
        )}
      </main>
    </div>
  );
}
