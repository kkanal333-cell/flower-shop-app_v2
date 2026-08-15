import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';

// Supabase 연동
const SUPABASE_URL = 'https://zthuqzzholyjolteuvty.supabase.co';
const SUPABASE_KEY = 'sb_publishable_xkg9ULmNiqKrCcESytGbmw_u1Z12_gG';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// 🔒 최초 접속 비밀번호 (원하는 4자리 숫자로 변경 가능)
const APP_PASSWORD = "1234"; 

// 옵션 목록
const PAYMENT_OPTIONS = ["신용카드", "현금", "계좌이체", "전화예약입금", "네이버", "인스타", "미결제"];
const PRODUCT_OPTIONS = ["꽃다발", "꽃바구니", "햇살콘플라워", "꽃묶음", "식물", "용품", "시즌한정", "기타"];

const AMPM_OPTIONS = ["오전", "오후"];
const HOUR_OPTIONS = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'));
const MINUTE_OPTIONS = ["00", "15", "30", "45"];

// 15분 단위 픽업 시간 파싱 함수
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

// KST 실시간 일시 구하기
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

  const dayOfWeek = kst.getDay(); // 0:일, 1:월, ...
  const currentHour = kst.getHours();

  return { date: dateStr, time: timeStr, dayOfWeek, currentHour };
};

// CSV 변환 헬퍼 (배열 -> CSV 파일 다운로드)
const downloadCSV = (headers, rows, filename) => {
  const escapeCSV = (val) => {
    if (val === null || val === undefined) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  const csvContent = [
    headers.map(escapeCSV).join(','),
    ...rows.map(row => row.map(escapeCSV).join(','))
  ].join('\r\n');

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

// CSV 텍스트 파싱 헬퍼
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
        if (insideQuote && line[i + 1] === '"') {
          entry += '"';
          i++;
        } else {
          insideQuote = !insideQuote;
        }
      } else if (char === ',' && !insideQuote) {
        row.push(entry.trim());
        entry = '';
      } else {
        entry += char;
      }
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
      if (val.startsWith('"') && val.endsWith('"')) {
        val = val.slice(1, -1).replace(/""/g, '"');
      }
      obj[h] = val;
    });
    return obj;
  });
};

export default function App() {
  // 비밀번호 인증 상태 (세션 스토리지 기억)
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return sessionStorage.getItem('app_authenticated') === 'true';
  });
  const [inputPin, setInputPin] = useState('');
  const [pinError, setPinError] = useState(false);

  const [activeMenu, setActiveMenu] = useState('orders');
  const [subTab, setSubTab] = useState('calendar');
  
  const [orders, setOrders] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [selectedDate, setSelectedDate] = useState(getKoreaNowFormatted().date);
  const [editingOrder, setEditingOrder] = useState(null);

  // 선택 삭제용 state
  const [selectedOrderIds, setSelectedOrderIds] = useState([]);
  const [selectedCustomerIds, setSelectedCustomerIds] = useState([]);

  // 검색 키워드 state (주문 목록 검색 & 고객 목록 검색)
  const [orderSearch, setOrderSearch] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [matchedCustomerList, setMatchedCustomerList] = useState([]);

  // 주간 백업 알림 팝업 모달 상태
  const [showBackupAlertModal, setShowBackupAlertModal] = useState(false);

  // 비밀번호 확인 핸들러
  const handlePinSubmit = (e) => {
    e.preventDefault();
    if (inputPin === APP_PASSWORD) {
      setIsAuthenticated(true);
      sessionStorage.setItem('app_authenticated', 'true');
      setPinError(false);
    } else {
      setPinError(true);
      setInputPin('');
    }
  };

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
    phone: '010-',
    product_name: '꽃다발',
    amount_thousands: '55',
    pickup_date: initialKst.date,
    pickup_time: '14:00',
    receipt_date: initialKst.date,
    receipt_time: initialKst.time,
    payment_method: '신용카드',
    memo: ''
  });

  // 월요일 12시 백업 알림 체크 로직
  useEffect(() => {
    const checkBackupSchedule = () => {
      const nowInfo = getKoreaNowFormatted();
      // 매주 월요일(1) 12시 이후
      if (nowInfo.dayOfWeek === 1 && nowInfo.currentHour >= 12) {
        const lastNotified = localStorage.getItem('last_backup_notice_date');
        if (lastNotified !== nowInfo.date) {
          setShowBackupAlertModal(true);
        }
      }
    };

    checkBackupSchedule();
    const interval = setInterval(checkBackupSchedule, 60000); // 1분마다 주기적 감지
    return () => clearInterval(interval);
  }, []);

  const handleCloseBackupModal = () => {
    const nowInfo = getKoreaNowFormatted();
    localStorage.setItem('last_backup_notice_date', nowInfo.date);
    setShowBackupAlertModal(false);
  };

  const handleMenuChange = (menuId) => {
    setActiveMenu(menuId);
    if (menuId === 'new') {
      const kstNow = getKoreaNowFormatted();
      setNewOrder(prev => ({
        ...prev,
        phone: prev.phone || '010-',
        pickup_date: kstNow.date,
        receipt_date: kstNow.date,
        receipt_time: kstNow.time
      }));
      setMatchedCustomerList([]);
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
    if (isAuthenticated) {
      fetchData();
    }
  }, [isAuthenticated]);

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

  const handleCustomerSearchChange = (val) => {
    const rawNums = val.replace(/[^0-9]/g, '');
    if (rawNums.length > 0) {
      setCustomerSearch(formatPhone(val));
    } else {
      setCustomerSearch(val);
    }
  };

  const handleOrderSearchChange = (val) => {
    const rawNums = val.replace(/[^0-9]/g, '');
    if (rawNums.length > 0) {
      setOrderSearch(formatPhone(val));
    } else {
      setOrderSearch(val);
    }
  };

  // 신규 주문시 고객명 입력 반응 함수 (동명이인 리스트 추출)
  const handleCustomerNameChange = (nameInput) => {
    setNewOrder(prev => ({ ...prev, customer_name: nameInput }));

    if (!nameInput.trim()) {
      setMatchedCustomerList([]);
      return;
    }

    const cleanInput = nameInput.trim();
    const matches = customers.filter(c => 
      c.name === cleanInput || 
      c.name.replace(/[0-9]/g, '') === cleanInput ||
      c.name.includes(cleanInput)
    );

    setMatchedCustomerList(matches);

    if (matches.length === 1) {
      selectCustomerForNewOrder(matches[0]);
    }
  };

  const selectCustomerForNewOrder = (cust) => {
    setNewOrder(prev => {
      const updated = { 
        ...prev, 
        customer_name: cust.name,
        phone: cust.phone || '010-' 
      };

      const recentOrder = orders.find(o => o.customer_id === cust.id || o.customers?.name === cust.name);
      if (recentOrder) {
        if (recentOrder.product_name) updated.product_name = recentOrder.product_name;
        if (recentOrder.amount) updated.amount_thousands = String(Math.floor(recentOrder.amount / 1000));
        if (recentOrder.payment_method) updated.payment_method = recentOrder.payment_method;
      }
      return updated;
    });
    setMatchedCustomerList([]);
  };

  const handleCreateOrder = async (e) => {
    e.preventDefault();
    if (!newOrder.customer_name) return alert('고객 성명을 입력해주세요.');
    
    const rawNums = newOrder.phone.replace(/[^0-9]/g, '');
    if (!newOrder.phone || rawNums.length < 10) {
      return alert('올바른 휴대폰 번호를 입력해주세요. (최소 10자리 이상)');
    }

    let customerId;
    let finalCustomerName = newOrder.customer_name.trim();

    const { data: custByPhone } = await supabase
      .from('customers')
      .select('id, name')
      .eq('phone', newOrder.phone)
      .maybeSingle();

    if (custByPhone) {
      customerId = custByPhone.id;
      finalCustomerName = custByPhone.name;
    } else {
      const baseName = finalCustomerName.replace(/[0-9]/g, '');
      const sameNameCusts = customers.filter(c => c.name.replace(/[0-9]/g, '') === baseName);

      if (sameNameCusts.length > 0) {
        const nextNum = sameNameCusts.length + 1;
        finalCustomerName = `${baseName}${nextNum}`;
      }

      const { data: newCust, error: custErr } = await supabase
        .from('customers')
        .insert([{ name: finalCustomerName, phone: newOrder.phone }])
        .select()
        .single();
      
      if (custErr) {
        alert('고객 정보 저장 실패: ' + custErr.message);
        return;
      }
      customerId = newCust?.id;
    }

    const actualAmount = (Number(newOrder.amount_thousands) || 0) * 1000;
    const pickupDatetime = `${newOrder.pickup_date}T${newOrder.pickup_time}:00`;
    const receiptDatetime = `${newOrder.receipt_date}T${newOrder.receipt_time}:00`;

    const { error: orderErr } = await supabase.from('orders').insert([{
      customer_id: customerId,
      product_name: newOrder.product_name,
      product: newOrder.product_name,
      amount: actualAmount,
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

    alert(`주문이 성공적으로 등록되었습니다! (고객명: ${finalCustomerName})`);
    
    const kstNow = getKoreaNowFormatted();
    setNewOrder({
      customer_name: '',
      phone: '010-',
      product_name: '꽃다발',
      amount_thousands: '55',
      pickup_date: kstNow.date,
      pickup_time: '14:00',
      receipt_date: kstNow.date,
      receipt_time: kstNow.time,
      payment_method: '신용카드',
      memo: ''
    });
    setMatchedCustomerList([]);
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
      amount_thousands: String(Math.floor((order.amount || 0) / 1000)),
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

    const actualAmount = (Number(editingOrder.amount_thousands) || 0) * 1000;
    const pickupDatetime = `${editingOrder.pickup_date}T${editingOrder.pickup_time}:00`;
    const receiptDatetime = `${editingOrder.receipt_date}T${editingOrder.receipt_time}:00`;

    await supabase.from('orders').update({
      product_name: editingOrder.product_name,
      product: editingOrder.product_name,
      amount: actualAmount,
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

  // --- 주문 삭제 관련 핸들러 ---
  const handleToggleSelectAllOrders = (e) => {
    if (e.target.checked) {
      setSelectedOrderIds(filteredOrders.map(o => o.id));
    } else {
      setSelectedOrderIds([]);
    }
  };

  const handleToggleSelectOrder = (id) => {
    setSelectedOrderIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleDeleteSelectedOrders = async () => {
    if (selectedOrderIds.length === 0) return alert('삭제할 주문을 선택해주세요.');
    if (!window.confirm(`선택한 ${selectedOrderIds.length}개의 주문을 삭제하시겠습니까?`)) return;

    const { error } = await supabase.from('orders').delete().in('id', selectedOrderIds);
    if (error) {
      alert('주문 삭제 실패: ' + error.message);
    } else {
      alert('선택한 주문이 삭제되었습니다.');
      setSelectedOrderIds([]);
      fetchData();
    }
  };

  // --- 고객 삭제 관련 핸들러 ---
  const handleToggleSelectAllCustomers = (e) => {
    if (e.target.checked) {
      setSelectedCustomerIds(filteredCustomers.map(c => c.id));
    } else {
      setSelectedCustomerIds([]);
    }
  };

  const handleToggleSelectCustomer = (id) => {
    setSelectedCustomerIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleDeleteSelectedCustomers = async () => {
    if (selectedCustomerIds.length === 0) return alert('삭제할 고객을 선택해주세요.');
    if (!window.confirm(`선택한 ${selectedCustomerIds.length}명의 고객 정보를 삭제하시겠습니까?\n(관련 주문 내역의 고객정보도 함께 초기화될 수 있습니다)`)) return;

    const { error } = await supabase.from('customers').delete().in('id', selectedCustomerIds);
    if (error) {
      alert('고객 삭제 실패: ' + error.message);
    } else {
      alert('선택한 고객 정보가 삭제되었습니다.');
      setSelectedCustomerIds([]);
      fetchData();
    }
  };

  // CSV 데이터 백업 내보내기
  const handleExportCSV = () => {
    try {
      const today = getKoreaNowFormatted().date;

      const orderHeaders = ['주문ID', '고객명', '연락처', '상품명', '금액', '픽업일시', '접수일시', '결제수단', '메모'];
      const orderRows = orders.map(o => [
        o.id,
        o.customers?.name || '',
        o.customers?.phone || '',
        o.product_name || '',
        o.amount || 0,
        o.pickup_datetime || '',
        o.created_at || '',
        o.payment_method || '',
        o.memo || ''
      ]);
      downloadCSV(orderHeaders, orderRows, `export_orders_${today}.csv`);

      setTimeout(() => {
        const custHeaders = ['ID', '이름', '연락처', '등록일'];
        const custRows = customers.map(c => [
          c.id,
          c.name || '',
          c.phone || '',
          c.created_at || ''
        ]);
        downloadCSV(custHeaders, custRows, `export_customers_${today}.csv`);
      }, 300);

      alert(`주문정보(export_orders_${today}.csv) 및 고객정보(export_customers_${today}.csv) 파일 다운로드가 시작되었습니다.`);
      handleCloseBackupModal();
    } catch (err) {
      console.error(err);
      alert('CSV 백업 중 오류가 발생했습니다.');
    }
  };

  // CSV 파일 복원
  const handleImportCSV = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    if (!window.confirm(`선택한 ${files.length}개 CSV 파일 데이터를 Supabase 데이터베이스에 추가 등록하시겠습니까?`)) {
      e.target.value = '';
      return;
    }

    try {
      let importedCustCount = 0;
      let importedOrderCount = 0;

      for (const file of files) {
        const text = await file.text();
        const parsedRows = parseCSVText(text);

        if (parsedRows.length === 0) continue;

        const sampleKeys = Object.keys(parsedRows[0]);

        if (sampleKeys.includes('이름') && sampleKeys.includes('연락처') && !sampleKeys.includes('주문ID')) {
          for (const row of parsedRows) {
            if (row['이름'] && row['연락처']) {
              await supabase.from('customers').upsert([{ name: row['이름'], phone: row['연락처'] }], { onConflict: 'phone' });
              importedCustCount++;
            }
          }
        } 
        else if (sampleKeys.includes('주문ID') || sampleKeys.includes('상품명')) {
          const { data: updatedCustomers } = await supabase.from('customers').select('*');

          for (const row of parsedRows) {
            let custId = null;
            if (row['연락처'] && updatedCustomers) {
              const matched = updatedCustomers.find(c => c.phone === row['연락처']);
              if (matched) custId = matched.id;
            }

            await supabase.from('orders').insert([{
              customer_id: custId,
              product_name: row['상품명'] || '꽃다발',
              product: row['상품명'] || '꽃다발',
              amount: Number(row['금액']) || 0,
              pickup_datetime: row['픽업일시'] || null,
              created_at: row['접수일시'] || null,
              payment_method: row['결제수단'] || '신용카드',
              status: row['결제수단'] || '신용카드',
              memo: row['메모'] || ''
            }]);
            importedOrderCount++;
          }
        }
      }

      alert(`복원 완료: 고객 (${importedCustCount}건), 주문 (${importedOrderCount}건)`);
      fetchData();
    } catch (err) {
      console.error(err);
      alert('CSV 복원 중 오류가 발생했습니다. CSV 형식을 확인해주세요.');
    } finally {
      e.target.value = '';
    }
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
      backgroundColor: '#fbe7e8',
      textColor: '#be123c',
      borderColor: '#fda4af'
    }));
  };

  const selectedDayOrders = selectedDate
    ? orders
        .filter(o => o.pickup_datetime && o.pickup_datetime.startsWith(selectedDate))
        .sort((a, b) => {
          const timeA = a.pickup_datetime?.split('T')[1] || '00:00';
          const timeB = b.pickup_datetime?.split('T')[1] || '00:00';
          return timeA.localeCompare(timeB);
        })
    : [];

  // 주문 목록 검색 필터
  const filteredOrders = orders.filter(o => {
    const q = orderSearch.trim().toLowerCase();
    if (!q) return true;

    const nameMatch = o.customers?.name && o.customers.name.toLowerCase().includes(q);
    const cleanSearchPhone = q.replace(/[^0-9]/g, '');
    const cleanOrderPhone = (o.customers?.phone || '').replace(/[^0-9]/g, '');
    const phoneMatch = cleanSearchPhone !== '' && cleanOrderPhone.includes(cleanSearchPhone);

    return nameMatch || phoneMatch;
  });

  // 고객 목록 검색 필터
  const filteredCustomers = customers.filter(c => {
    const q = customerSearch.trim().toLowerCase();
    if (!q) return true;

    const nameMatch = c.name && c.name.toLowerCase().includes(q);
    const cleanSearchPhone = q.replace(/[^0-9]/g, '');
    const cleanCustomerPhone = (c.phone || '').replace(/[^0-9]/g, '');
    const phoneMatch = cleanSearchPhone !== '' && cleanCustomerPhone.includes(cleanSearchPhone);

    return nameMatch || phoneMatch;
  });

  const menuList = [
    { id: 'new', label: '📝 신규주문' },
    { id: 'orders', label: '📋 주문/달력' },
    { id: 'customers', label: '🎂 고객' },
    { id: 'notifications', label: '🔔 알림' },
    { id: 'backup', label: '💾 백업/복원' },
  ];

  const getCustomerPickupDate = (customerId, customerName) => {
    const match = orders.find(o => o.customer_id === customerId || o.customers?.name === customerName);
    if (match && match.pickup_datetime) {
      return match.pickup_datetime.split('T')[0];
    }
    return '-';
  };

  const TimePickerCustom = ({ value, onChange, bgClass = "bg-white" }) => {
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
      <div className={`flex items-center gap-1 p-2 md:p-3 border rounded-xl mt-1 ${bgClass} border-slate-200`} style={{ backgroundColor: '#ffffff' }}>
        <select
          value={ampm}
          onChange={handleAmpmChange}
          className="bg-white text-xs md:text-sm font-semibold focus:outline-none cursor-pointer text-slate-900"
          style={{ backgroundColor: '#ffffff' }}
        >
          {AMPM_OPTIONS.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <select
          value={hour}
          onChange={handleHourChange}
          className="bg-white text-xs md:text-sm font-semibold focus:outline-none cursor-pointer flex-1 text-center text-slate-900"
          style={{ backgroundColor: '#ffffff' }}
        >
          {HOUR_OPTIONS.map(h => <option key={h} value={h}>{h}시</option>)}
        </select>
        <span className="text-xs text-slate-400 font-bold">:</span>
        <select
          value={minute}
          onChange={handleMinuteChange}
          className="bg-white text-xs md:text-sm font-semibold focus:outline-none cursor-pointer flex-1 text-center text-slate-900"
          style={{ backgroundColor: '#ffffff' }}
        >
          {MINUTE_OPTIONS.map(m => <option key={m} value={m}>{m}분</option>)}
        </select>
      </div>
    );
  };

  // 🔒 4단계: 비밀번호 잠금 화면
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-800 flex items-center justify-center p-4">
        <div className="bg-white p-6 md:p-8 rounded-2xl shadow-2xl w-full max-w-sm text-center border border-slate-200">
          <div className="text-4xl mb-3">🔒</div>
          <h2 className="text-xl font-bold text-slate-900 mb-1">시스템 접속 잠금</h2>
          <p className="text-xs text-slate-500 mb-6">4자리 비밀번호를 입력해주세요.</p>

          <form onSubmit={handlePinSubmit} className="space-y-4">
            <div>
              <input
                type="password"
                maxLength={4}
                value={inputPin}
                onChange={e => setInputPin(e.target.value.replace(/[^0-9]/g, ''))}
                placeholder="• • • •"
                className="w-full text-center text-2xl font-bold tracking-[1em] p-3 border-2 border-slate-300 rounded-xl focus:border-rose-500 focus:outline-none text-slate-900 bg-slate-50"
                autoFocus
              />
              {pinError && (
                <p className="text-rose-500 text-xs mt-2 font-bold">⚠️ 비밀번호가 올바르지 않습니다.</p>
              )}
            </div>

            <button
              type="submit"
              className="w-full py-3 bg-slate-900 hover:bg-black text-white font-bold rounded-xl shadow-md transition-all text-sm cursor-pointer"
            >
              확인 및 접속
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100/70 flex flex-col md:flex-row pb-12 md:pb-0">
      <style>{`
        .fc .fc-daygrid-body-unbalanced .fc-daygrid-day-events {
          min-height: 0.8em !important;
        }
        .fc-theme-standard td, .fc-theme-standard th {
          padding: 0px !important;
        }
        .fc .fc-daygrid-day-frame {
          min-height: 36px !important;
        }
        @media (max-width: 768px) {
          .fc .fc-daygrid-day-frame {
            min-height: 22px !important;
          }
          .fc .fc-toolbar-title {
            font-size: 0.95rem !important;
          }
          .fc .fc-button {
            padding: 0.15rem 0.35rem !important;
            font-size: 0.7rem !important;
          }
        }
        ${selectedDate ? `
          td[data-date="${selectedDate}"] {
            background-color: #e0f2fe !important;
          }
        ` : ''}
      `}</style>

      {/* 📢 주간 백업 팝업 알림 모달 */}
      {showBackupAlertModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border-2 border-rose-400 text-center space-y-4">
            <div className="text-4xl animate-bounce">📢</div>
            <h3 className="text-lg font-bold text-slate-900">주간 CSV 백업 알림</h3>
            <p className="text-xs md:text-sm text-slate-600 leading-relaxed">
              매주 <strong>월요일 낮 12시 정기 백업 시간</strong>입니다.<br />
              소중한 주문 및 고객 데이터를 안전하게 저장해주세요!
            </p>
            <div className="flex gap-2 pt-2">
              <button
                onClick={handleExportCSV}
                className="flex-1 py-2.5 bg-rose-500 hover:bg-rose-600 text-white rounded-xl text-xs font-bold shadow-md cursor-pointer"
              >
                📥 지금 바로 백업 다운로드
              </button>
              <button
                onClick={handleCloseBackupModal}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold border border-slate-300 cursor-pointer"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 사이드바 메뉴 */}
      <aside className="bg-slate-50 border-b md:border-b-0 md:border-r border-slate-200 w-full md:w-28 p-1 md:p-2 flex flex-col shrink-0 shadow-xs">
        <div className="hidden md:flex items-center justify-between text-rose-500 font-extrabold text-sm mb-1 px-1">
          <span className="flex items-center gap-1">📌 메뉴</span>
        </div>

        <nav className="flex md:flex-col justify-between md:justify-start gap-1 w-full text-xs py-0.5 md:py-0">
          {menuList.map(menu => (
            <label
              key={menu.id}
              onClick={() => handleMenuChange(menu.id)}
              className={`flex items-center justify-center md:justify-start gap-1 px-1 md:px-2 py-1.5 rounded-lg cursor-pointer whitespace-nowrap transition-all flex-1 md:flex-none text-center ${
                activeMenu === menu.id
                  ? 'bg-rose-100/70 text-rose-800 font-bold border-b-2 md:border-b-0 md:border-l-4 border-rose-400 shadow-2xs'
                  : 'text-slate-700 hover:bg-slate-200/50'
              }`}
            >
              <input
                type="radio"
                name="sidebar-menu"
                checked={activeMenu === menu.id}
                onChange={() => {}}
                className="w-3 h-3 accent-rose-500 cursor-pointer hidden md:inline"
              />
              <span className="text-[10px] sm:text-xs font-semibold">{menu.label}</span>
            </label>
          ))}
        </nav>

        <button
          onClick={() => {
            sessionStorage.removeItem('app_authenticated');
            setIsAuthenticated(false);
          }}
          className="hidden md:block mt-auto py-1.5 px-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-[11px] font-bold border border-slate-300 text-center cursor-pointer"
        >
          🔒 잠금
        </button>
      </aside>

      {/* 메인 콘텐츠 영역 */}
      <main className="flex-1 p-2 md:p-5 max-w-6xl mx-auto w-full">
        {/* 주문 수정 모달 */}
        {editingOrder && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-3 z-50">
            <div className="bg-white rounded-2xl p-4 md:p-6 w-full max-w-xl max-h-[90vh] overflow-y-auto shadow-xl border border-slate-200">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-base md:text-lg font-bold text-slate-900">✏️ 주문 수정</h3>
                <button onClick={() => setEditingOrder(null)} className="text-slate-400 hover:text-slate-600 text-lg font-bold">✕</button>
              </div>

              <form onSubmit={handleUpdateOrder} className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] font-semibold text-slate-700">고객명</label>
                    <input
                      type="text"
                      value={editingOrder.customer_name}
                      onChange={e => setEditingOrder({ ...editingOrder, customer_name: e.target.value })}
                      className="w-full p-2 border border-slate-300 rounded-xl text-xs bg-white text-slate-900"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-slate-700">연락처</label>
                    <input
                      type="text"
                      value={editingOrder.phone}
                      onChange={e => setEditingOrder({ ...editingOrder, phone: formatPhone(e.target.value) })}
                      className="w-full p-2 border border-slate-300 rounded-xl text-xs bg-white text-slate-900"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] font-semibold text-slate-700">상품종류</label>
                    <select
                      value={editingOrder.product_name}
                      onChange={e => setEditingOrder({ ...editingOrder, product_name: e.target.value })}
                      className="w-full p-2 border border-slate-300 rounded-xl text-xs bg-white text-slate-900"
                    >
                      {PRODUCT_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-slate-700">금액 (천원 단위)</label>
                    <input
                      type="number"
                      value={editingOrder.amount_thousands}
                      onChange={e => setEditingOrder({ ...editingOrder, amount_thousands: e.target.value })}
                      className="w-full p-2 border border-slate-300 rounded-xl text-xs bg-white text-slate-900"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] font-semibold text-slate-700">픽업 날짜</label>
                    <input
                      type="date"
                      value={editingOrder.pickup_date}
                      onChange={e => setEditingOrder({ ...editingOrder, pickup_date: e.target.value })}
                      className="w-full p-2 border border-slate-300 rounded-xl text-xs bg-white text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-slate-700">픽업 시간</label>
                    <TimePickerCustom
                      value={editingOrder.pickup_time}
                      onChange={val => setEditingOrder({ ...editingOrder, pickup_time: val })}
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-700">결제 방식</label>
                  <select
                    value={editingOrder.payment_method}
                    onChange={e => setEditingOrder({ ...editingOrder, payment_method: e.target.value })}
                    className="w-full p-2 border border-slate-300 rounded-xl text-xs bg-white text-slate-900"
                  >
                    {PAYMENT_OPTIONS.map(pm => <option key={pm} value={pm}>{pm}</option>)}
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-700">메모</label>
                  <textarea
                    value={editingOrder.memo}
                    onChange={e => setEditingOrder({ ...editingOrder, memo: e.target.value })}
                    className="w-full p-2 border border-slate-300 rounded-xl text-xs bg-white text-slate-900"
                    rows={2}
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <button type="submit" className="flex-1 py-2 bg-slate-900 hover:bg-black text-white rounded-xl text-xs font-bold cursor-pointer">저장하기</button>
                  <button type="button" onClick={() => setEditingOrder(null)} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs border border-slate-300 font-bold cursor-pointer">취소</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* 1. 신규주문 */}
        {activeMenu === 'new' && (
          <div className="max-w-2xl mx-auto bg-white p-3 md:p-8 rounded-2xl border border-slate-200 shadow-sm">
            <h2 className="text-base md:text-xl font-bold text-slate-900 mb-4 md:mb-6 flex items-center gap-2">
              <span>📝</span> 신규 주문 및 고객 등록
            </h2>

            <form onSubmit={handleCreateOrder} className="space-y-3 md:space-y-4">
              <div className="grid grid-cols-2 gap-2 md:gap-4 relative">
                <div className="relative">
                  <label className="text-[11px] md:text-xs font-semibold text-slate-700">고객 성명 *</label>
                  <input
                    type="text"
                    value={newOrder.customer_name}
                    onChange={e => handleCustomerNameChange(e.target.value)}
                    className="w-full p-2 md:p-3 border border-slate-300 rounded-xl mt-1 text-xs md:text-sm bg-white text-slate-900 font-medium"
                    style={{ backgroundColor: '#ffffff' }}
                    placeholder="홍길동 (입력시 동명이인 목록 표시)"
                    required
                  />

                  {matchedCustomerList.length > 1 && (
                    <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-rose-300 rounded-xl shadow-lg z-20 max-h-48 overflow-y-auto p-1">
                      <div className="text-[11px] text-rose-600 font-bold px-2 py-1 bg-rose-50 rounded-t-lg">
                        ⚠️ 동명이인이 존재합니다. 아래에서 클릭하세요:
                      </div>
                      {matchedCustomerList.map(c => (
                        <div
                          key={c.id}
                          onClick={() => selectCustomerForNewOrder(c)}
                          className="p-2 text-xs hover:bg-rose-50 rounded-lg cursor-pointer flex justify-between items-center"
                        >
                          <span className="font-bold text-slate-900">{c.name}</span>
                          <span className="text-slate-600 text-[11px]">{c.phone}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <label className="text-[11px] md:text-xs font-semibold text-slate-700">휴대폰 번호 *</label>
                  <input
                    type="text"
                    value={newOrder.phone}
                    onChange={e => setNewOrder({...newOrder, phone: formatPhone(e.target.value)})}
                    className="w-full p-2 md:p-3 border border-slate-300 rounded-xl mt-1 text-xs md:text-sm bg-white text-slate-900 font-medium"
                    style={{ backgroundColor: '#ffffff' }}
                    placeholder="010-0000-0000"
                    maxLength={13}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 md:gap-4">
                <div>
                  <label className="text-[11px] md:text-xs font-semibold text-slate-700">상품종류 *</label>
                  <select
                    value={newOrder.product_name}
                    onChange={e => setNewOrder({...newOrder, product_name: e.target.value})}
                    className="w-full p-2 md:p-3 border border-slate-300 rounded-xl mt-1 text-xs md:text-sm bg-white text-slate-900 font-medium"
                    style={{ backgroundColor: '#ffffff' }}
                  >
                    {PRODUCT_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] md:text-xs font-semibold text-slate-700">
                    결제 금액 (천원 단위)
                  </label>
                  <div className="relative mt-1">
                    <input
                      type="number"
                      value={newOrder.amount_thousands}
                      onChange={e => setNewOrder({...newOrder, amount_thousands: e.target.value})}
                      className="w-full p-2 md:p-3 border border-slate-300 rounded-xl text-xs md:text-sm bg-white text-slate-900 font-medium pr-16"
                      style={{ backgroundColor: '#ffffff' }}
                      placeholder="예: 55"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-rose-600 pointer-events-none">
                      = {((Number(newOrder.amount_thousands) || 0) * 1000).toLocaleString()}원
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 md:gap-4">
                <div>
                  <label className="text-[11px] md:text-xs font-semibold text-slate-700">픽업 날짜 *</label>
                  <input
                    type="date"
                    value={newOrder.pickup_date}
                    onChange={e => setNewOrder({...newOrder, pickup_date: e.target.value})}
                    className="w-full p-2 md:p-3 border border-slate-300 rounded-xl mt-1 text-xs md:text-sm bg-white text-slate-900 font-medium"
                    style={{ backgroundColor: '#ffffff' }}
                  />
                </div>
                <div>
                  <label className="text-[11px] md:text-xs font-semibold text-slate-700">픽업 시간 * (15분 단위)</label>
                  <TimePickerCustom
                    value={newOrder.pickup_time}
                    onChange={val => setNewOrder({...newOrder, pickup_time: val})}
                    bgClass="bg-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 md:gap-4">
                <div>
                  <label className="text-[11px] md:text-xs font-semibold text-slate-700">접수 날짜 (현재 시각)</label>
                  <input
                    type="date"
                    value={newOrder.receipt_date}
                    onChange={e => setNewOrder({...newOrder, receipt_date: e.target.value})}
                    className="w-full p-2 md:p-3 border border-slate-300 rounded-xl mt-1 text-xs md:text-sm text-slate-800 font-medium"
                    style={{ backgroundColor: '#f1f5f9' }}
                  />
                </div>
                <div>
                  <label className="text-[11px] md:text-xs font-semibold text-slate-700">접수 시간 (실시간 HH:mm)</label>
                  <input
                    type="time"
                    value={newOrder.receipt_time}
                    onChange={e => setNewOrder({...newOrder, receipt_time: e.target.value})}
                    className="w-full p-2 md:p-3 border border-slate-300 rounded-xl mt-1 text-xs md:text-sm text-slate-800 font-medium"
                    style={{ backgroundColor: '#f1f5f9' }}
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] md:text-xs font-semibold text-slate-700">결제 방식 *</label>
                <select
                  value={newOrder.payment_method}
                  onChange={e => setNewOrder({...newOrder, payment_method: e.target.value})}
                  className="w-full p-2 md:p-3 border border-slate-300 rounded-xl mt-1 text-xs md:text-sm bg-white text-slate-900 font-medium"
                  style={{ backgroundColor: '#ffffff' }}
                >
                  {PAYMENT_OPTIONS.map(pm => <option key={pm} value={pm}>{pm}</option>)}
                </select>
              </div>

              <div>
                <label className="text-[11px] md:text-xs font-semibold text-slate-700">고객 요구사항 / 메모</label>
                <textarea
                  value={newOrder.memo}
                  onChange={e => setNewOrder({...newOrder, memo: e.target.value})}
                  className="w-full p-2 md:p-3 border border-slate-300 rounded-xl mt-1 text-xs md:text-sm bg-white text-slate-900 font-medium"
                  style={{ backgroundColor: '#ffffff' }}
                  rows={3}
                  placeholder="요청사항이나 특이사항을 적어주세요."
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 px-4 bg-slate-900 hover:bg-black text-white font-bold rounded-xl shadow-md transition-all text-sm md:text-base mt-4 cursor-pointer text-center block"
              >
                주문 저장하기
              </button>
            </form>
          </div>
        )}

        {/* 2. 주문 & 달력 */}
        {activeMenu === 'orders' && (
          <div className="space-y-3 md:space-y-6">
            <div className="bg-white p-2 sm:p-3 md:p-5 rounded-xl border border-slate-200 shadow-sm">
              <div className="flex border-b border-slate-200 mb-2 md:mb-4 gap-6">
                <button
                  onClick={() => setSubTab('calendar')}
                  className={`pb-2 text-xs md:text-sm font-bold flex items-center gap-1.5 relative transition-colors ${
                    subTab === 'calendar' ? 'text-rose-600' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <span>📅</span> 픽업 달력
                  {subTab === 'calendar' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-rose-500 rounded-full" />}
                </button>

                <button
                  onClick={() => setSubTab('list')}
                  className={`pb-2 text-xs md:text-sm font-bold flex items-center gap-1.5 relative transition-colors ${
                    subTab === 'list' ? 'text-rose-600' : 'text-slate-500 hover:text-slate-800'
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
                    aspectRatio={1.8}
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
                <div className="space-y-3">
                  {/* 🔍 주문 검색창 추가 */}
                  <div className="flex flex-col md:flex-row gap-2 justify-between items-stretch md:items-center">
                    <input
                      type="text"
                      value={orderSearch}
                      onChange={e => handleOrderSearchChange(e.target.value)}
                      placeholder="🔍 주문 검색 (고객 이름 또는 전화번호)"
                      className="flex-1 p-2.5 border border-slate-300 rounded-xl text-xs md:text-sm bg-white text-slate-900 focus:outline-none focus:border-rose-500"
                    />

                    {selectedOrderIds.length > 0 && (
                      <button
                        onClick={handleDeleteSelectedOrders}
                        className="px-3 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer border border-rose-800 shadow-xs flex items-center justify-center gap-1"
                      >
                        🗑️ 선택 항목 ({selectedOrderIds.length}개) 삭제
                      </button>
                    )}
                  </div>

                  <div className="text-xs text-slate-600 font-medium">
                    검색 결과: 총 <strong className="text-rose-600">{filteredOrders.length}</strong>건
                  </div>

                  <div className="overflow-x-auto border border-slate-200 rounded-xl">
                    <table className="w-full text-left border-collapse whitespace-nowrap">
                      <thead>
                        <tr className="border-b border-slate-200 text-slate-700 text-xs md:text-sm bg-slate-100 font-bold">
                          <th className="py-2.5 px-3">픽업일시</th>
                          <th className="py-2.5 px-3">접수일시</th>
                          <th className="py-2.5 px-3">고객명</th>
                          <th className="py-2.5 px-3">연락처</th>
                          <th className="py-2.5 px-3">상품명</th>
                          <th className="py-2.5 px-3">금액</th>
                          <th className="py-2.5 px-3">결제수단</th>
                          <th className="py-2.5 px-3 text-center">관리</th>
                          <th className="py-2.5 px-3 text-center">
                            <input
                              type="checkbox"
                              onChange={handleToggleSelectAllOrders}
                              checked={filteredOrders.length > 0 && selectedOrderIds.length === filteredOrders.length}
                              className="accent-rose-600 cursor-pointer w-4 h-4"
                            />
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredOrders.length === 0 ? (
                          <tr>
                            <td colSpan={9} className="py-6 text-center text-slate-500 text-xs md:text-sm">
                              검색 결과가 없습니다.
                            </td>
                          </tr>
                        ) : (
                          filteredOrders.map(o => (
                            <tr key={o.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors text-xs md:text-sm">
                              <td className="py-2.5 px-3 text-slate-700 font-medium">{o.pickup_datetime?.replace('T', ' ').slice(0, 16) || '-'}</td>
                              <td className="py-2.5 px-3 text-xs text-slate-500">{o.created_at?.replace('T', ' ').slice(0, 16) || '-'}</td>
                              <td className="py-2.5 px-3 font-bold text-slate-900 whitespace-nowrap">{o.customers?.name || '-'}</td>
                              <td className="py-2.5 px-3 text-slate-700 font-medium whitespace-nowrap">{o.customers?.phone || '-'}</td>
                              <td className="py-2.5 px-3 font-bold text-slate-800 whitespace-nowrap">{o.product_name}</td>
                              <td className="py-2.5 px-3 font-extrabold text-rose-600 whitespace-nowrap">{o.amount?.toLocaleString()}원</td>
                              <td className="py-2.5 px-3"><span className="px-2 py-0.5 bg-slate-100 border border-slate-300 rounded text-xs font-semibold text-slate-800 whitespace-nowrap">{o.payment_method}</span></td>
                              
                              {/* 1번: 선명한 버튼 스타일 수정 (검정 글자 + 테두리) */}
                              <td className="py-2.5 px-3 text-center">
                                <button
                                  onClick={() => startEditOrder(o)}
                                  className="text-xs bg-white hover:bg-slate-100 border-2 border-slate-700 text-slate-900 font-bold px-3 py-1 rounded-lg cursor-pointer whitespace-nowrap shadow-2xs"
                                >
                                  수정하기
                                </button>
                              </td>

                              <td className="py-2.5 px-3 text-center">
                                <input
                                  type="checkbox"
                                  checked={selectedOrderIds.includes(o.id)}
                                  onChange={() => handleToggleSelectOrder(o.id)}
                                  className="accent-rose-600 cursor-pointer w-4 h-4"
                                />
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* 달력 하단 선택 날짜 상세 주문 목록 */}
            {subTab === 'calendar' && selectedDate && (
              <div className="bg-white p-3 md:p-5 rounded-xl border border-slate-200 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm md:text-lg font-bold text-slate-900 flex items-center gap-2">
                    <span>📅</span> <span className="text-sky-600">{selectedDate}</span> 픽업 주문 ({selectedDayOrders.length}건)
                  </h3>
                </div>

                {selectedDayOrders.length === 0 ? (
                  <div className="bg-slate-50 text-slate-500 p-3 rounded-xl text-xs md:text-sm text-center border border-slate-200">
                    해당 날짜에 예정된 픽업 주문이 없습니다.
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    {selectedDayOrders.map(o => {
                      const timeOnly = o.pickup_datetime ? o.pickup_datetime.split('T')[1]?.slice(0, 5) : '--:--';
                      return (
                        <div
                          key={o.id}
                          className="p-2.5 md:p-3 rounded-xl border border-slate-200 bg-white flex flex-col gap-1.5 shadow-2xs"
                        >
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 bg-sky-100 text-sky-900 font-extrabold text-xs rounded-md whitespace-nowrap border border-sky-300">
                              ⏰ {timeOnly}
                            </span>
                            <span className="font-bold text-slate-900 text-sm md:text-base">
                              {o.customers?.name || '익명'}
                            </span>
                            <span className="text-xs text-slate-600 font-medium">
                              {o.customers?.phone || ''}
                            </span>
                          </div>

                          <div className="flex items-center justify-between gap-1 text-xs">
                            <div className="flex items-center gap-1.5 overflow-hidden flex-1 min-w-0">
                              <span className="font-bold text-slate-800 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 shrink-0">
                                {o.product_name}
                              </span>
                              <span className="px-1.5 py-0.5 bg-slate-50 border border-slate-300 rounded text-slate-700 font-semibold shrink-0">
                                {o.payment_method}
                              </span>
                              {o.memo && (
                                <span className="text-slate-600 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200 truncate font-medium">
                                  💬 {o.memo}
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-2 shrink-0 ml-1">
                              <span className="font-extrabold text-slate-900 text-xs md:text-sm">
                                {o.amount?.toLocaleString()}원
                              </span>
                              
                              {/* 선명한 수정 버튼 */}
                              <button
                                onClick={() => startEditOrder(o)}
                                className="text-xs bg-white hover:bg-slate-100 border-2 border-slate-700 text-slate-900 font-bold px-2 py-0.5 rounded cursor-pointer"
                              >
                                수정
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* 3. 고객 관리 */}
        {activeMenu === 'customers' && (
          <div className="bg-white p-3 md:p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-base md:text-xl font-bold text-slate-900 flex items-center gap-2">
                <span>🎂</span> 고객 목록 (총 <span className="text-rose-600">{filteredCustomers.length}</span>명)
              </h2>
              {selectedCustomerIds.length > 0 && (
                <button
                  onClick={handleDeleteSelectedCustomers}
                  className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer border border-rose-800 shadow-xs"
                >
                  🗑️ 선택 고객 ({selectedCustomerIds.length}명) 삭제
                </button>
              )}
            </div>

            <input
              type="text"
              value={customerSearch}
              onChange={e => handleCustomerSearchChange(e.target.value)}
              placeholder="🔍 고객 이름 또는 전화번호 검색"
              className="w-full p-2.5 md:p-3 border border-slate-300 rounded-xl text-xs md:text-sm bg-white text-slate-900 focus:outline-none focus:border-rose-500"
            />

            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-left border-collapse whitespace-nowrap">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-700 text-xs md:text-sm bg-slate-100 font-bold">
                    <th className="py-2.5 px-3 w-16 text-center">No.</th>
                    <th className="py-2.5 px-3">이름</th>
                    <th className="py-2.5 px-3">연락처</th>
                    <th className="py-2.5 px-3">최근 픽업일</th>
                    <th className="py-2.5 px-3 text-center">
                      <input
                        type="checkbox"
                        onChange={handleToggleSelectAllCustomers}
                        checked={filteredCustomers.length > 0 && selectedCustomerIds.length === filteredCustomers.length}
                        className="accent-rose-600 cursor-pointer w-4 h-4"
                      />
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCustomers.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-slate-500 text-xs md:text-sm">
                        검색 결과가 없습니다.
                      </td>
                    </tr>
                  ) : (
                    filteredCustomers.map((c, idx) => (
                      <tr key={c.id} className="border-b border-slate-100 text-xs md:text-sm hover:bg-slate-50">
                        <td className="py-2.5 px-3 text-center text-slate-500 font-bold">{filteredCustomers.length - idx}</td>
                        <td className="py-2.5 px-3 font-bold text-slate-900">{c.name}</td>
                        <td className="py-2.5 px-3 text-slate-700 font-medium">{c.phone || '-'}</td>
                        <td className="py-2.5 px-3 text-slate-600 font-medium">{getCustomerPickupDate(c.id, c.name)}</td>
                        <td className="py-2.5 px-3 text-center">
                          <input
                            type="checkbox"
                            checked={selectedCustomerIds.includes(c.id)}
                            onChange={() => handleToggleSelectCustomer(c.id)}
                            className="accent-rose-600 cursor-pointer w-4 h-4"
                          />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 4. 알림 */}
        {activeMenu === 'notifications' && (
          <div className="bg-white p-4 md:p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <h2 className="text-base md:text-xl font-bold text-slate-900">🔔 알림 및 주간 백업 관리</h2>
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl space-y-2">
              <h3 className="font-bold text-sm text-rose-800">📅 주간 백업 자동 안내 시스템</h3>
              <p className="text-xs text-rose-700 leading-relaxed">
                매주 월요일 낮 12시 이후 앱에 접속하시거나 화면을 켜두시면 백업 팝업 알림창이 자동으로 작동합니다.
              </p>
            </div>
          </div>
        )}

        {/* 5. CSV 백업/복원 */}
        {activeMenu === 'backup' && (
          <div className="bg-white p-4 md:p-8 rounded-2xl border border-slate-200 shadow-sm max-w-xl mx-auto space-y-6">
            <div>
              <h2 className="text-base md:text-xl font-bold text-slate-900 flex items-center gap-2 mb-1">
                <span>💾</span> CSV 백업 및 복원
              </h2>
              <p className="text-xs text-slate-500">
                주문정보와 고객정보를 2개의 CSV 파일로 내보내거나 가져올 수 있습니다.
              </p>
            </div>

            <div className="p-4 border border-slate-200 rounded-xl bg-slate-50 space-y-3">
              <h3 className="font-bold text-xs md:text-sm text-slate-800">1. CSV 파일로 내보내기 (Export)</h3>
              <p className="text-xs text-slate-500">
                클릭 시 오늘 날짜가 포함된 2개의 파일이 자동으로 다운로드됩니다.<br />
                - <code className="text-rose-600 font-bold">export_orders_{getKoreaNowFormatted().date}.csv</code><br />
                - <code className="text-rose-600 font-bold">export_customers_{getKoreaNowFormatted().date}.csv</code>
              </p>
              <button
                onClick={handleExportCSV}
                className="w-full py-2.5 px-4 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs md:text-sm shadow-xs transition-colors cursor-pointer border border-rose-800"
              >
                📥 CSV 백업 파일 2개 다운로드
              </button>
            </div>

            <div className="p-4 border border-slate-200 rounded-xl bg-slate-50 space-y-3">
              <h3 className="font-bold text-xs md:text-sm text-slate-800">2. CSV 파일 가져오기 (Import)</h3>
              <p className="text-xs text-slate-500">
                백업했던 CSV 파일 2개를 <strong>Ctrl 키(또는 Shift 키)를 누른 채 동시에 선택</strong>하여 한번에 올려주세요.
              </p>
              <input
                type="file"
                accept=".csv"
                multiple
                onChange={handleImportCSV}
                className="w-full text-xs text-slate-700 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border file:border-slate-300 file:text-xs file:font-bold file:bg-white file:text-slate-800 hover:file:bg-slate-100 cursor-pointer"
              />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
