import React, { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';

// --- Supabase 설정 ---
const SUPABASE_URL = 'https://zthuqzzholyjolteuvty.supabase.co';
const SUPABASE_KEY = 'sb_publishable_xkg9ULmNiqKrCcESytGbmw_u1Z12_gG';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const DEFAULT_APP_PASSWORD = "8005"; 
const PAYMENT_OPTIONS = ["신용카드", "현금", "계좌이체", "전화예약입금", "네이버", "인스타", "미결제"];
const PRODUCT_OPTIONS = ["꽃다발", "꽃바구니", "햇살콘플라워", "꽃묶음", "식물", "용품", "시즌한정", "기타"];
const AMPM_OPTIONS = ["오전", "오후"];
const HOUR_OPTIONS = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'));
const MINUTE_OPTIONS = ["00", "15", "30", "45"];

// --- 시간 및 유틸리티 함수 ---
const formatShortDateTime = (isoString) => {
  if (!isoString) return '';
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return isoString;
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${mm}/${dd} ${hh}:${min}`;
};

const parseTimeToParts = (timeStr) => {
  if (!timeStr) return { ampm: "오후", hour: "12", minute: "00" };
  const parts = timeStr.trim().split(' ');
  if (parts.length < 2) return { ampm: "오후", hour: "12", minute: "00" };
  const ampm = parts[0];
  const hm = parts[1].split(':');
  return { ampm, hour: hm[0] || "12", minute: hm[1] || "00" };
};

const formatPartsToTime = (ampm, hour, minute) => {
  return `${ampm} ${hour}:${minute}`;
};

const getKoreaNowFormatted = () => {
  const now = new Date();
  const kstOffset = 9 * 60 * 60 * 1000;
  const kst = new Date(now.getTime() + kstOffset);
  const date = kst.toISOString().split('T')[0];
  const time = kst.toTimeString().split(' ')[0].substring(0, 5);
  return { date, time };
};

// [요구사항 1] 현재 시간 직후 15분 단위 올림 계산 함수
const getNextPickupTimeParts = () => {
  const now = new Date();
  const kstOffset = 9 * 60 * 60 * 1000;
  const kst = new Date(now.getTime() + kstOffset);
  let h = kst.getHours();
  let m = kst.getMinutes();

  m = Math.ceil((m + 1) / 15) * 15;
  if (m >= 60) {
    m = 0;
    h = (h + 1) % 24;
  }
  const ampm = h >= 12 ? "오후" : "오전";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return {
    ampm,
    hour: String(h12).padStart(2, '0'),
    minute: String(m).padStart(2, '0')
  };
};

// CSV 다운로드 및 파싱 유틸
const downloadCSV = (content, fileName) => {
  const blob = new Blob(["\uFEFF" + content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", fileName);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

const parseCSVText = (text) => {
  const lines = text.split(/\r\n|\n/);
  const result = [];
  if (lines.length === 0) return result;
  
  const parseRow = (rowStr) => {
    const res = [];
    let inside = false;
    let entry = "";
    for (let i = 0; i < rowStr.length; i++) {
      const c = rowStr[i];
      if (c === '"') {
        if (inside && rowStr[i + 1] === '"') {
          entry += '"';
          i++;
        } else {
          inside = !inside;
        }
      } else if (c === ',' && !inside) {
        res.push(entry);
        entry = "";
      } else {
        entry += c;
      }
    }
    res.push(entry);
    return res;
  };

  const headers = parseRow(lines[0]);
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const vals = parseRow(lines[i]);
    const obj = {};
    for (let j = 0; j < headers.length; j++) {
      obj[headers[j].trim()] = vals[j] !== undefined ? vals[j].trim() : "";
    }
    result.push(obj);
  }
  return result;
};

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  
  const [activeMenu, setActiveMenu] = useState('list');
  const [orders, setOrders] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(false);
  
  // 검색 및 필터 상태
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [filterPayment, setFilterPayment] = useState('');
  const [filterProduct, setFilterProduct] = useState('');
  const [sortOrder, setSortOrder] = useState('asc'); // 'asc': 픽업 임박순, 'desc': 최신 등록순
  
  // 달력 상태
  const [selectedDate, setSelectedDate] = useState(getKoreaNowFormatted().date);
  const [calendarView, setCalendarView] = useState('dayGridMonth');
  
  // 신규 주문 상태
  const [newOrder, setNewOrder] = useState({
    customer_name: '',
    phone: '010-',
    product_name: '꽃다발',
    amount_thousands: '55',
    pickup_date: getKoreaNowFormatted().date,
    pickup_time: '오후 12:00',
    receipt_date: getKoreaNowFormatted().date,
    receipt_time: '12:00',
    payment_method: '신용카드',
    memo: ''
  });
  const [matchedCustomerList, setMatchedCustomerList] = useState([]);
  const [isMemoAutofilled, setIsMemoAutofilled] = useState(false);

  // 수정 모달 상태
  const [editingOrder, setEditingOrder] = useState(null);

  // [요구사항 3] 모바일 뒤로가기 종료 확인 팝업
  useEffect(() => {
    const handlePopState = (e) => {
      e.preventDefault();
      if (window.confirm("앱을 종료하시겠습니까?")) {
        window.close();
      } else {
        window.history.pushState(null, '', window.location.href);
      }
    };
    window.history.pushState(null, '', window.location.href);
    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  // [요구사항 5] 개별 주문 출력 함수
  const handlePrintOrder = (order) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('팝업 차단이 설정되어 있어 인쇄 창을 열 수 없습니다.');
      return;
    }
    
    const customerName = order.customers ? order.customers.name : '고객명 없음';
    const customerPhone = order.customers ? order.customers.phone : '-';

    printWindow.document.write(`
      <html>
        <head>
          <title>주문서 출력</title>
          <style>
            body { font-family: 'Malgun Gothic', sans-serif; padding: 20px; color: #111; }
            .print-box { max-width: 400px; margin: 0 auto; border: 2px solid #333; padding: 20px; border-radius: 8px; }
            h2 { text-align: center; border-bottom: 2px solid #333; padding-bottom: 10px; margin-top: 0; }
            .row { margin-bottom: 12px; font-size: 16px; display: flex; justify-content: space-between; }
            .label { font-weight: bold; color: #555; width: 100px; }
            .value { flex: 1; text-align: right; font-weight: bold; }
            .memo-box { margin-top: 15px; border-top: 1px dashed #aaa; padding-top: 10px; font-size: 15px; }
            @media print {
              button { display: none; }
            }
          </style>
        </head>
        <body>
          <div class="print-box">
            <h2>🌸 햇살콘플라워 주문서</h2>
            <div class="row"><span class="label">고객명:</span><span class="value">${customerName}</span></div>
            <div class="row"><span class="label">연락처:</span><span class="value">${customerPhone}</span></div>
            <div class="row"><span class="label">상품명:</span><span class="value">${order.product_name || '-'}</span></div>
            <div class="row"><span class="label">픽업일시:</span><span class="value">${order.pickup_datetime || '-'}</span></div>
            <div class="row"><span class="label">결제금액:</span><span class="value">${order.amount ? Number(order.amount).toLocaleString() + '원' : '-'}</span></div>
            <div class="row"><span class="label">결제수단:</span><span class="value">${order.payment_method || '-'}</span></div>
            <div class="memo-box">
              <strong>요청사항 / 메모:</strong><br/>
              <div style="margin-top: 5px; white-space: pre-wrap; font-weight: normal;">${order.memo || '없음'}</div>
            </div>
            <div style="text-align: center; margin-top: 25px;">
              <button onclick="window.print()" style="padding: 10px 20px; font-size: 16px; cursor: pointer; background: #e11d48; color: white; border: none; border-radius: 5px;">인쇄하기</button>
            </div>
          </div>
          <script>
            window.onload = function() {
              window.print();
            }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  // 데이터 로드
  useEffect(() => {
    if (isAuthenticated) {
      fetchData();
    }
  }, [isAuthenticated]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: customerData, error: custError } = await supabase.from('customers').select('*');
      if (custError) throw custError;
      setCustomers(customerData || []);

      const { data: orderData, error: ordError } = await supabase
        .from('orders')
        .select(`*, customers(name, phone)`);
      if (ordError) throw ordError;
      setOrders(orderData || []);
    } catch (err) {
      console.error('데이터 조회 오류:', err.message);
    } finally {
      setLoading(false);
    }
  };

  // 로그인 처리
  const handleLogin = (e) => {
    e.preventDefault();
    if (passwordInput === DEFAULT_APP_PASSWORD) {
      setIsAuthenticated(true);
    } else {
      alert("비밀번호가 틀렸습니다.");
      setPasswordInput('');
    }
  };

  // [요구사항 1] 신규 주문 메뉴 진입 시 현재 시간 직후 15분 단위 세팅
  const handleMenuChange = (menuId, prefilledDate = null) => {
    setActiveMenu(menuId);
    if (menuId === 'new') {
      const kstNow = getKoreaNowFormatted();
      const nextTime = getNextPickupTimeParts();
      const targetDate = prefilledDate || kstNow.date;
      
      setNewOrder({
        customer_name: '',
        phone: '010-',
        product_name: '꽃다발',
        amount_thousands: '55',
        pickup_date: targetDate,
        pickup_time: formatPartsToTime(nextTime.ampm, nextTime.hour, nextTime.minute),
        receipt_date: kstNow.date,
        receipt_time: kstNow.time,
        payment_method: '신용카드',
        memo: ''
      });
      setIsMemoAutofilled(false);
      setMatchedCustomerList([]);
    }
  };

  // 고객 이름 입력 시 자동완성 및 메모 불러오기
  const handleCustomerNameChange = (val) => {
    setNewOrder(prev => ({ ...prev, customer_name: val }));
    if (!val.trim()) {
      setMatchedCustomerList([]);
      return;
    }
    const matched = customers.filter(c => c.name.includes(val.trim()));
    setMatchedCustomerList(matched);

    const exactMatch = customers.find(c => c.name === val.trim());
    if (exactMatch && !isMemoAutofilled) {
      setNewOrder(prev => ({
        ...prev,
        phone: exactMatch.phone || '010-',
        memo: exactMatch.memo || prev.memo
      }));
      setIsMemoAutofilled(true);
    }
  };

  const selectCustomerFromDropdown = (cust) => {
    setNewOrder(prev => ({
      ...prev,
      customer_name: cust.name,
      phone: cust.phone || '010-',
      memo: cust.memo || prev.memo
    }));
    setMatchedCustomerList([]);
    setIsMemoAutofilled(true);
  };

  // 신규 주문 저장
  const handleCreateOrder = async (e) => {
    e.preventDefault();
    if (!newOrder.customer_name.trim()) {
      alert("고객명을 입력해주세요.");
      return;
    }

    setLoading(true);
    try {
      let customerId;
      const existingCust = customers.find(c => c.name === newOrder.customer_name.trim() && c.phone === newOrder.phone.trim());

      if (existingCust) {
        customerId = existingCust.id;
        await supabase.from('customers').update({ memo: newOrder.memo }).eq('id', customerId);
      } else {
        const { data: newCustData, error: newCustErr } = await supabase
          .from('customers')
          .insert([{ name: newOrder.customer_name.trim(), phone: newOrder.phone.trim(), memo: newOrder.memo }])
          .select();
        if (newCustErr) throw newCustErr;
        customerId = newCustData[0].id;
      }

      const amountVal = Number(newOrder.amount_thousands) * 1000;
      const pickupDatetimeStr = `${newOrder.pickup_date} ${newOrder.pickup_time}`;
      const receiptDatetimeStr = `${newOrder.receipt_date} ${newOrder.receipt_time}`;

      const { error: ordErr } = await supabase.from('orders').insert([{
        customer_id: customerId,
        product_name: `${newOrder.product_name} (${Number(newOrder.amount_thousands).toLocaleString()}천원)`,
        amount: amountVal,
        pickup_datetime: pickupDatetimeStr,
        receipt_datetime: receiptDatetimeStr,
        payment_method: newOrder.payment_method,
        memo: newOrder.memo
      }]);
      if (ordErr) throw ordErr;

      alert("주문이 성공적으로 등록되었습니다.");
      await fetchData();
      setActiveMenu('list');
    } catch (err) {
      alert("주문 등록 실패: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // 주문 삭제
  const handleDeleteOrder = async (orderId) => {
    if (!window.confirm("정말 이 주문을 삭제하시겠습니까?")) return;
    setLoading(true);
    try {
      const { error } = await supabase.from('orders').delete().eq('id', orderId);
      if (error) throw error;
      alert("삭제되었습니다.");
      await fetchData();
    } catch (err) {
      alert("삭제 실패: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // 수정 저장
  const handleUpdateOrder = async (e) => {
    e.preventDefault();
    if (!editingOrder) return;
    setLoading(true);
    try {
      const { error } = await supabase.from('orders').update({
        product_name: editingOrder.product_name,
        amount: editingOrder.amount,
        pickup_datetime: editingOrder.pickup_datetime,
        payment_method: editingOrder.payment_method,
        memo: editingOrder.memo
      }).eq('id', editingOrder.id);

      if (error) throw error;
      alert("수정되었습니다.");
      setEditingOrder(null);
      await fetchData();
    } catch (err) {
      alert("수정 실패: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // 필터링 및 정렬된 목록
  const filteredOrders = orders.filter(o => {
    const custName = o.customers?.name || '';
    const custPhone = o.customers?.phone || '';
    const matchSearch = custName.includes(searchTerm) || custPhone.includes(searchTerm) || (o.memo && o.memo.includes(searchTerm));
    
    let matchDate = true;
    if (filterDate) {
      matchDate = o.pickup_datetime && o.pickup_datetime.startsWith(filterDate);
    }
    
    let matchPayment = true;
    if (filterPayment) {
      matchPayment = o.payment_method === filterPayment;
    }

    let matchProduct = true;
    if (filterProduct) {
      matchProduct = o.product_name && o.product_name.includes(filterProduct);
    }

    return matchSearch && matchDate && matchPayment && matchProduct;
  }).sort((a, b) => {
    if (sortOrder === 'asc') {
      return (a.pickup_datetime || '').localeCompare(b.pickup_datetime || '');
    } else {
      return new Date(b.created_at || 0) - new Date(a.created_at || 0);
    }
  });

  // 달력 날짜별 주문 매핑
  const calendarEvents = orders.map(o => {
    const datePart = o.pickup_datetime ? o.pickup_datetime.split(' ')[0] : '';
    const custName = o.customers?.name || '고객';
    return {
      title: `${custName} - ${o.product_name}`,
      date: datePart,
      extendedProps: { order: o }
    };
  });

  // 선택된 날짜의 상세 주문 리스트
  const selectedDayOrders = orders.filter(o => o.pickup_datetime && o.pickup_datetime.startsWith(selectedDate));

  // CSV 백업 내보내기/가져오기 함수
  const exportBackupCSV = () => {
    const csvHeader = "id,customer_name,phone,product_name,amount,pickup_datetime,receipt_datetime,payment_method,memo\n";
    const csvRows = orders.map(o => {
      const name = `"${(o.customers?.name || '').replace(/"/g, '""')}"`;
      const phone = `"${(o.customers?.phone || '').replace(/"/g, '""')}"`;
      const prod = `"${(o.product_name || '').replace(/"/g, '""')}"`;
      const amt = o.amount || 0;
      const pickup = `"${(o.pickup_datetime || '').replace(/"/g, '""')}"`;
      const receipt = `"${(o.receipt_datetime || '').replace(/"/g, '""')}"`;
      const pay = `"${(o.payment_method || '').replace(/"/g, '""')}"`;
      const memo = `"${(o.memo || '').replace(/"/g, '""')}"`;
      return `${o.id},${name},${phone},${prod},${amt},${pickup},${receipt},${pay},${memo}`;
    });
    const csvContent = csvHeader + csvRows.join("\n");
    downloadCSV(csvContent, `sunflower_orders_backup_${getKoreaNowFormatted().date}.csv`);
  };

  const importBackupCSV = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target.result;
        const rows = parseCSVText(text);
        if (rows.length === 0) {
          alert("가져올 데이터가 없습니다.");
          return;
        }
        if (!window.confirm(`총 ${rows.length개의 데이터를 가져오시겠습니까? 기존 데이터에 추가됩니다.`)) return;

        setLoading(true);
        for (let r of rows) {
          if (!r.customer_name) continue;
          let custId;
          const found = customers.find(c => c.name === r.customer_name && c.phone === r.phone);
          if (found) {
            custId = found.id;
          } else {
            const { data: newC, error: errC } = await supabase
              .from('customers')
              .insert([{ name: r.customer_name, phone: r.phone || '010-', memo: r.memo }])
              .select();
            if (!errC && newC) custId = newC[0].id;
          }

          if (custId) {
            await supabase.from('orders').insert([{
              customer_id: custId,
              product_name: r.product_name || '꽃다발',
              amount: Number(r.amount) || 0,
              pickup_datetime: r.pickup_datetime,
              receipt_datetime: r.receipt_datetime,
              payment_method: r.payment_method || '신용카드',
              memo: r.memo
            }]);
          }
        }
        alert("백업 복원이 완료되었습니다.");
        await fetchData();
      } catch (err) {
        alert("백업 복원 중 오류 발생: " + err.message);
      } finally {
        setLoading(false);
        e.target.value = null;
      }
    };
    reader.readAsText(file, 'utf-8');
  };

  // --- 로그인 화면 ---
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-rose-50 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-sm border border-rose-100">
          <div className="text-center mb-6">
            <span className="text-4xl">🌸</span>
            <h1 className="text-2xl font-bold text-gray-800 mt-2">햇살콘플라워</h1>
            <p className="text-sm text-gray-500 mt-1">주문 관리 시스템</p>
          </div>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">비밀번호</label>
              <input
                type="password"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                placeholder="비밀번호를 입력하세요"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-rose-400 text-center text-lg"
                autoFocus
              />
            </div>
            <button
              type="submit"
              className="w-full bg-rose-500 hover:bg-rose-600 text-white font-semibold py-3 rounded-xl transition duration-200 shadow-md"
            >
              로그인
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800 pb-12">
      {/* 상단 네비게이션 헤더 */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-30 shadow-xs">
        <div className="max-w-6xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => handleMenuChange('list')}>
            <span className="text-2xl">🌸</span>
            <span className="font-bold text-lg text-gray-800">햇살콘플라워 주문관리</span>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto">
            <button
              onClick={() => handleMenuChange('list')}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition ${activeMenu === 'list' ? 'bg-rose-500 text-white shadow-sm' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              📋 주문목록
            </button>
            <button
              onClick={() => handleMenuChange('calendar')}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition ${activeMenu === 'calendar' ? 'bg-rose-500 text-white shadow-sm' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              📅 캘린더
            </button>
            <button
              onClick={() => handleMenuChange('new')}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition ${activeMenu === 'new' ? 'bg-rose-500 text-white shadow-sm' : 'bg-rose-50 text-rose-600 hover:bg-rose-100'}`}
            >
              ✨ 신규주문
            </button>
            <button
              onClick={() => handleMenuChange('customers')}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition ${activeMenu === 'customers' ? 'bg-rose-500 text-white shadow-sm' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              👥 고객관리
            </button>

            {/* [요구사항 4] 백업 메뉴 글자색을 명확히 검은색(text-black)으로 지정 */}
            <div className="flex items-center gap-1 border-l pl-2 ml-1 border-gray-200">
              <button
                onClick={exportBackupCSV}
                className="px-3 py-2 rounded-xl text-xs font-semibold bg-gray-100 hover:bg-gray-200 text-black border border-gray-300"
                title="모든 주문 데이터를 CSV 파일로 백업"
              >
                📥 백업다운
              </button>
              <label className="px-3 py-2 rounded-xl text-xs font-semibold bg-gray-100 hover:bg-gray-200 text-black border border-gray-300 cursor-pointer">
                📤 백업복원
                <input type="file" accept=".csv" onChange={importBackupCSV} className="hidden" />
              </label>
            </div>
          </div>
        </div>
      </header>

      {/* 로딩 바 */}
      {loading && (
        <div className="bg-rose-500 text-white text-center py-1 text-xs font-medium animate-pulse">
          처리 중...
        </div>
      )}

      {/* 메인 컨텐츠 영역 */}
      <main className="max-w-6xl mx-auto px-4 py-6">
        
        {/* ================= 1. 주문 목록 화면 ================= */}
        {activeMenu === 'list' && (
          <div className="space-y-4">
            {/* 검색 및 필터 바 */}
            <div className="bg-white p-4 rounded-2xl shadow-xs border border-gray-200 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">통합 검색</label>
                <input
                  type="text"
                  placeholder="고객명, 연락처, 메모"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full px-3 py-2 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-rose-400"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">픽업일자 필터</label>
                <div className="flex gap-1">
                  <input
                    type="date"
                    value={filterDate}
                    onChange={(e) => setFilterDate(e.target.value)}
                    className="w-full px-3 py-2 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-rose-400"
                  />
                  {filterDate && (
                    <button onClick={() => setFilterDate('')} className="px-2 py-1 text-xs bg-gray-200 rounded-xl">전체</button>
                  )}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">결제수단 필터</label>
                <select
                  value={filterPayment}
                  onChange={(e) => setFilterPayment(e.target.value)}
                  className="w-full px-3 py-2 border rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-rose-400"
                >
                  <option value="">모든 결제수단</option>
                  {PAYMENT_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">상품 필터</label>
                <select
                  value={filterProduct}
                  onChange={(e) => setFilterProduct(e.target.value)}
                  className="w-full px-3 py-2 border rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-rose-400"
                >
                  <option value="">모든 상품</option>
                  {PRODUCT_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">정렬 기준</label>
                <select
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value)}
                  className="w-full px-3 py-2 border rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-rose-400"
                >
                  <option value="asc">픽업 임박순</option>
                  <option value="desc">최신 등록순</option>
                </select>
              </div>
            </div>

            {/* 목록 카운트 */}
            <div className="flex justify-between items-center px-1">
              <span className="text-sm text-gray-500">총 <strong className="text-gray-800">{filteredOrders.length}</strong>개의 주문이 있습니다.</span>
            </div>

            {/* 주문 카드 리스트 */}
            {filteredOrders.length === 0 ? (
              <div className="bg-white rounded-2xl p-12 text-center text-gray-400 border border-gray-200">
                조건에 일치하는 주문 내역이 없습니다.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredOrders.map(order => (
                  <div key={order.id} className="bg-white p-5 rounded-2xl shadow-xs border border-gray-200 hover:shadow-md transition flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <span className="text-xs bg-rose-50 text-rose-600 font-semibold px-2.5 py-1 rounded-full border border-rose-100">
                            {order.payment_method || '미결제'}
                          </span>
                          <h3 className="text-lg font-bold text-gray-800 mt-2">
                            {order.customers?.name || '비회원'} 
                            <span className="text-sm font-normal text-gray-500 ml-2">{order.customers?.phone}</span>
                          </h3>
                        </div>
                        <div className="text-right">
                          <span className="text-lg font-extrabold text-rose-600">{order.amount ? order.amount.toLocaleString() + '원' : '-'}</span>
                        </div>
                      </div>

                      <div className="my-3 py-2 border-t border-b border-gray-100 text-sm space-y-1">
                        <div className="flex justify-between">
                          <span className="text-gray-500">상품명:</span>
                          <span className="font-medium text-gray-800">{order.product_name}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">픽업일시:</span>
                          <span className="font-bold text-rose-700">{order.pickup_datetime}</span>
                        </div>
                        <div className="flex justify-between text-xs text-gray-400">
                          <span>접수일시:</span>
                          <span>{order.receipt_datetime}</span>
                        </div>
                      </div>

                      {order.memo && (
                        <div className="bg-amber-50 text-amber-900 p-3 rounded-xl text-sm mb-3 border border-amber-100">
                          <span className="font-bold">메모: </span>{order.memo}
                        </div>
                      )}
                    </div>

                    <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
                      {/* [요구사항 5] 개별 주문 출력 버튼 */}
                      <button
                        onClick={() => handlePrintOrder(order)}
                        className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold rounded-lg transition"
                      >
                        🖨️ 출력
                      </button>
                      <button
                        onClick={() => setEditingOrder(order)}
                        className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-600 text-xs font-semibold rounded-lg transition"
                      >
                        수정
                      </button>
                      <button
                        onClick={() => handleDeleteOrder(order.id)}
                        className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 text-xs font-semibold rounded-lg transition"
                      >
                        삭제
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ================= 2. 캘린더 화면 ================= */}
        {activeMenu === 'calendar' && (
          <div className="space-y-6">
            <div className="bg-white p-4 rounded-2xl shadow-xs border border-gray-200">
              <FullCalendar
                plugins={[dayGridPlugin, interactionPlugin]}
                initialView={calendarView}
                headerToolbar={{
                  left: 'prev,next today',
                  center: 'title',
                  right: 'dayGridMonth,dayGridWeek'
                }}
                locale="ko"
                events={calendarEvents}
                dateClick={(info) => {
                  setSelectedDate(info.dateStr);
                }}
                eventClick={(info) => {
                  if (info.event.extendedProps && info.event.extendedProps.order) {
                    setEditingOrder(info.event.extendedProps.order);
                  }
                }}
                height="auto"
              />
            </div>

            {/* 선택된 날짜 상세 내역 */}
            <div className="bg-white p-6 rounded-2xl shadow-xs border border-gray-200">
              <div className="flex flex-wrap justify-between items-center mb-4 pb-2 border-b">
                <h3 className="text-lg font-bold text-gray-800">
                  📅 <span className="text-rose-600">{selectedDate}</span> 픽업 예정 주문 ({selectedDayOrders.length}건)
                </h3>
                {/* [요구사항 2] 달력 날짜별 선택 시 신규 주문 입력하기 버튼 */}
                <button
                  onClick={() => handleMenuChange('new', selectedDate)}
                  className="px-4 py-2 bg-rose-500 hover:bg-rose-600 text-white text-sm font-semibold rounded-xl shadow-sm transition"
                >
                  + 해당 날짜 신규 주문 입력하기
                </button>
              </div>

              {selectedDayOrders.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  선택한 날짜에 예정된 주문이 없습니다. 위 버튼을 눌러 새 주문을 추가해보세요.
                </div>
              ) : (
                <div className="space-y-3">
                  {selectedDayOrders.map(order => (
                    <div key={order.id} className="p-4 rounded-xl border border-gray-100 bg-gray-50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-gray-800 text-base">{order.customers?.name || '비회원'}</span>
                          <span className="text-xs text-gray-500">{order.customers?.phone}</span>
                          <span className="text-xs bg-rose-100 text-rose-700 px-2 py-0.5 rounded-full font-medium">{order.payment_method}</span>
                        </div>
                        <div className="text-sm text-gray-600 mt-1">
                          <strong className="text-rose-600">{order.pickup_datetime}</strong> | {order.product_name} ({order.amount?.toLocaleString()}원)
                        </div>
                        {order.memo && <div className="text-xs text-amber-800 bg-amber-50 p-1.5 rounded mt-1">메모: {order.memo}</div>}
                      </div>
                      <div className="flex items-center gap-2 self-end sm:self-center">
                        {/* [요구사항 5] 개별 주문 출력 버튼 */}
                        <button
                          onClick={() => handlePrintOrder(order)}
                          className="px-3 py-1.5 bg-white border border-gray-200 hover:bg-gray-100 text-gray-700 text-xs font-semibold rounded-lg transition"
                        >
                          🖨️ 출력
                        </button>
                        <button
                          onClick={() => setEditingOrder(order)}
                          className="px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white text-xs font-semibold rounded-lg transition"
                        >
                          수정
                        </button>
                        <button
                          onClick={() => handleDeleteOrder(order.id)}
                          className="px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white text-xs font-semibold rounded-lg transition"
                        >
                          삭제
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ================= 3. 신규 주문 등록 화면 ================= */}
        {activeMenu === 'new' && (
          <div className="max-w-2xl mx-auto bg-white p-6 sm:p-8 rounded-2xl shadow-xs border border-gray-200">
            <h2 className="text-xl font-bold text-gray-800 mb-6 pb-2 border-b">✨ 신규 주문 등록</h2>
            
            <form onSubmit={handleCreateOrder} className="space-y-5">
              {/* 고객명 & 연락처 */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 relative">
                <div className="relative">
                  <label className="block text-xs font-medium text-gray-600 mb-1">고객명 *</label>
                  <input
                    type="text"
                    value={newOrder.customer_name}
                    onChange={(e) => handleCustomerNameChange(e.target.value)}
                    placeholder="고객 성함 입력"
                    required
                    className="w-full px-4 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-rose-400"
                    autoComplete="off"
                  />
                  {/* 자동완성 드롭다운 */}
                  {matchedCustomerList.length > 0 && (
                    <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-40 overflow-y-auto">
                      {matchedCustomerList.map(c => (
                        <div
                          key={c.id}
                          onClick={() => selectCustomerFromDropdown(c)}
                          className="px-4 py-2 hover:bg-rose-50 cursor-pointer text-sm flex justify-between items-center border-b last:border-b-0"
                        >
                          <span className="font-semibold text-gray-800">{c.name}</span>
                          <span className="text-gray-500 text-xs">{c.phone}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">연락처</label>
                  <input
                    type="text"
                    value={newOrder.phone}
                    onChange={(e) => setNewOrder({...newOrder, phone: e.target.value})}
                    placeholder="010-0000-0000"
                    className="w-full px-4 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-rose-400"
                  />
                </div>
              </div>

              {/* 상품 종류 & 금액 */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">상품 종류</label>
                  <select
                    value={newOrder.product_name}
                    onChange={(e) => setNewOrder({...newOrder, product_name: e.target.value})}
                    className="w-full px-4 py-2.5 border rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-rose-400"
                  >
                    {PRODUCT_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">금액 (천원 단위)</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={newOrder.amount_thousands}
                      onChange={(e) => setNewOrder({...newOrder, amount_thousands: e.target.value})}
                      placeholder="55"
                      className="w-full px-4 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-rose-400"
                    />
                    <span className="text-sm font-bold text-gray-600 whitespace-nowrap">천 원</span>
                  </div>
                  <p className="text-xs text-rose-600 mt-1 font-medium">
                    총액: {(Number(newOrder.amount_thousands || 0) * 1000).toLocaleString()}원
                  </p>
                </div>
              </div>

              {/* 픽업 일시 */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">픽업 날짜</label>
                  <input
                    type="date"
                    value={newOrder.pickup_date}
                    onChange={(e) => setNewOrder({...newOrder, pickup_date: e.target.value})}
                    className="w-full px-4 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-rose-400"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">픽업 시간</label>
                  <div className="flex gap-1">
                    {(() => {
                      const parts = parseTimeToParts(newOrder.pickup_time);
                      return (
                        <>
                          <select
                            value={parts.ampm}
                            onChange={(e) => {
                              const newTime = formatPartsToTime(e.target.value, parts.hour, parts.minute);
                              setNewOrder({...newOrder, pickup_time: newTime});
                            }}
                            className="px-2 py-2.5 border rounded-xl text-sm bg-white focus:outline-none"
                          >
                            {AMPM_OPTIONS.map(a => <option key={a} value={a}>{a}</option>)}
                          </select>
                          <select
                            value={parts.hour}
                            onChange={(e) => {
                              const newTime = formatPartsToTime(parts.ampm, e.target.value, parts.minute);
                              setNewOrder({...newOrder, pickup_time: newTime});
                            }}
                            className="px-2 py-2.5 border rounded-xl text-sm bg-white focus:outline-none"
                          >
                            {HOUR_OPTIONS.map(h => <option key={h} value={h}>{h}시</option>)}
                          </select>
                          <select
                            value={parts.minute}
                            onChange={(e) => {
                              const newTime = formatPartsToTime(parts.ampm, parts.hour, e.target.value);
                              setNewOrder({...newOrder, pickup_time: newTime});
                            }}
                            className="px-2 py-2.5 border rounded-xl text-sm bg-white focus:outline-none"
                          >
                            {MINUTE_OPTIONS.map(m => <option key={m} value={m}>{m}분</option>)}
                          </select>
                        </>
                      );
                    })()}
                  </div>
                </div>
              </div>

              {/* 접수 일시 (자동기록) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-gray-50 p-3 rounded-xl border border-gray-200">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">접수 날짜 (자동)</label>
                  <input
                    type="date"
                    value={newOrder.receipt_date}
                    onChange={(e) => setNewOrder({...newOrder, receipt_date: e.target.value})}
                    className="w-full px-3 py-2 border rounded-xl text-sm bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">접수 시간 (자동)</label>
                  <input
                    type="text"
                    value={newOrder.receipt_time}
                    onChange={(e) => setNewOrder({...newOrder, receipt_time: e.target.value})}
                    className="w-full px-3 py-2 border rounded-xl text-sm bg-white"
                  />
                </div>
              </div>

              {/* 결제 수단 */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-2">결제 수단</label>
                <div className="flex flex-wrap gap-2">
                  {PAYMENT_OPTIONS.map(opt => (
                    <button
                      type="button"
                      key={opt}
                      onClick={() => setNewOrder({...newOrder, payment_method: opt})}
                      className={`px-4 py-2 rounded-xl text-sm font-semibold transition border ${newOrder.payment_method === opt ? 'bg-rose-500 text-white border-rose-500 shadow-sm' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'}`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>

              {/* 메모/요청사항 */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">요청사항 / 메모</label>
                <textarea
                  value={newOrder.memo}
                  onChange={(e) => setNewOrder({...newOrder, memo: e.target.value})}
                  rows="3"
                  placeholder="색상, 문구 등 요청사항을 입력하세요."
                  className="w-full px-4 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-rose-400"
                ></textarea>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => handleMenuChange('list')}
                  className="w-1/3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-3 rounded-xl transition"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="w-2/3 bg-rose-500 hover:bg-rose-600 text-white font-semibold py-3 rounded-xl shadow-md transition"
                >
                  주문 등록 완료
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ================= 4. 고객 관리 화면 ================= */}
        {activeMenu === 'customers' && (
          <div className="space-y-4 max-w-4xl mx-auto">
            <h2 className="text-xl font-bold text-gray-800 mb-2">👥 전체 고객 목록 ({customers.length}명)</h2>
            <div className="bg-white rounded-2xl shadow-xs border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200 text-xs text-gray-500 uppercase">
                      <th className="p-4">고객명</th>
                      <th className="p-4">연락처</th>
                      <th className="p-4">메모 / 특이사항</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-sm">
                    {customers.length === 0 ? (
                      <tr>
                        <td colSpan="3" className="p-8 text-center text-gray-400">등록된 고객 정보가 없습니다.</td>
                      </tr>
                    ) : (
                      customers.map(c => (
                        <tr key={c.id} className="hover:bg-gray-50">
                          <td className="p-4 font-bold text-gray-800">{c.name}</td>
                          <td className="p-4 text-gray-600">{c.phone || '-'}</td>
                          <td className="p-4 text-gray-600">{c.memo || '-'}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

      </main>

      {/* ================= 주문 수정 모달 ================= */}
      {editingOrder && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 sm:p-8 max-w-lg w-full shadow-2xl border border-gray-100 max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold text-gray-800 mb-4 pb-2 border-b">주문 수정</h3>
            
            <form onSubmit={handleUpdateOrder} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">고객명</label>
                <input
                  type="text"
                  disabled
                  value={editingOrder.customers?.name || '비회원'}
                  className="w-full px-4 py-2 border rounded-xl text-sm bg-gray-100 text-gray-500 cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">상품명</label>
                <input
                  type="text"
                  value={editingOrder.product_name}
                  onChange={(e) => setEditingOrder({...editingOrder, product_name: e.target.value})}
                  className="w-full px-4 py-2 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-rose-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">금액 (원)</label>
                  <input
                    type="number"
                    value={editingOrder.amount}
                    onChange={(e) => setEditingOrder({...editingOrder, amount: Number(e.target.value)})}
                    className="w-full px-4 py-2 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-rose-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">결제수단</label>
                  <select
                    value={editingOrder.payment_method}
                    onChange={(e) => setEditingOrder({...editingOrder, payment_method: e.target.value})}
                    className="w-full px-4 py-2 border rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-rose-400"
                  >
                    {PAYMENT_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">픽업일시 (예: YYYY-MM-DD 오후 HH:MM)</label>
                <input
                  type="text"
                  value={editingOrder.pickup_datetime}
                  onChange={(e) => setEditingOrder({...editingOrder, pickup_datetime: e.target.value})}
                  className="w-full px-4 py-2 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-rose-400"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">메모</label>
                <textarea
                  value={editingOrder.memo || ''}
                  onChange={(e) => setEditingOrder({...editingOrder, memo: e.target.value})}
                  rows="3"
                  className="w-full px-4 py-2 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-rose-400"
                ></textarea>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t">
                {/* [요구사항 5] 수정 모달 내부에서도 개별 출력 가능 */}
                <button
                  type="button"
                  onClick={() => handlePrintOrder(editingOrder)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-semibold rounded-xl transition mr-auto"
                >
                  🖨️ 출력
                </button>
                <button
                  type="button"
                  onClick={() => setEditingOrder(null)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-semibold rounded-xl transition"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-rose-500 hover:bg-rose-600 text-white text-sm font-semibold rounded-xl shadow-md transition"
                >
                  저장하기
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
