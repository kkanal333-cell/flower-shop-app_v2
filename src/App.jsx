import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';

// Supabase 연동
const SUPABASE_URL = 'https://zthuqzzholyjolteuvty.supabase.co';
const SUPABASE_KEY = 'sb_publishable_xkg9ULmNiqKrCcESytGbmw_u1Z12_gG';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// 기본 비밀번호 (저장된 비밀번호가 없을 경우 사용)
const DEFAULT_APP_PASSWORD = "1234"; 

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
  // 비밀번호 상태 관리 (localStorage에 저장)
  const [appPassword, setAppPassword] = useState(() => {
    return localStorage.getItem('app_password') || DEFAULT_APP_PASSWORD;
  });

  // 비밀번호 인증 상태 (세션 스토리지 기억)
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return sessionStorage.getItem('app_authenticated') === 'true';
  });
  const [inputPin, setInputPin] = useState('');
  const [pinError, setPinError] = useState(false);

  // 비밀번호 변경 모달 상태
  const [showPasswordChangeModal, setShowPasswordChangeModal] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

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
    if (inputPin === appPassword) {
      setIsAuthenticated(true);
      sessionStorage.setItem('app_authenticated', 'true');
      setPinError(false);
    } else {
      setPinError(true);
      setInputPin('');
    }
  };

  // 비밀번호 변경 핸들러
  const handlePasswordChange = (e) => {
    e.preventDefault();
    if (newPassword.length !== 4) {
      return alert('비밀번호는 숫자 4자리여야 합니다.');
    }
    if (newPassword !== confirmPassword) {
      return alert('새 비밀번호와 비밀번호 확인이 일치하지 않습니다.');
    }

    localStorage.setItem('app_password', newPassword);
    setAppPassword(newPassword);
    alert('🔑 비밀번호가 성공적으로 변경되었습니다!');
    setShowPasswordChangeModal(false);
    setNewPassword('');
    setConfirmPassword('');
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
      if (nowInfo.dayOfWeek === 1 && nowInfo.currentHour >= 12) {
        const lastNotified = localStorage.getItem('last_backup_notice_date');
        if (lastNotified !== nowInfo.date) {
          setShowBackupAlertModal(true);
        }
      }
    };

    checkBackupSchedule();
    const interval = setInterval(checkBackupSchedule, 60000);
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

  // --- 주문 삭제 핸들러 ---
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

  // --- 고객 삭제 핸들러 ---
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

  const filteredOrders = orders.filter(o => {
    const q = orderSearch.trim().toLowerCase();
    if (!q) return true;

    const nameMatch = o.customers?.name && o.customers.name.toLowerCase().includes(q);
    const cleanSearchPhone = q.replace(/[^0-9]/g, '');
    const cleanOrderPhone = (o.customers?.phone || '').replace(/[^0-9]/g, '');
    const phoneMatch = cleanSearchPhone !== '' && cleanOrderPhone.includes(cleanSearchPhone);

    return nameMatch || phoneMatch;
  });

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

  // 1. 비밀번호 접속 화면 (버튼 색상/테두리 완벽 개선)
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-800 flex items-center justify-center p-4">
        <div className="bg-white p-6 md:p-8 rounded-2xl shadow-2xl w-full max-w-sm text-center border-2 border-slate-400">
          <div className="text-4xl mb-3">🔒</div>
          <h2 className="text-xl font-bold text-slate-900 mb-1">시스템 접속 잠금</h2>
          <p className="text-xs text-slate-600 mb-6">4자리 비밀번호를 입력해주세요.</p>

          <form onSubmit={handlePinSubmit} className="space-y-4">
            <div>
              <input
                type="password"
                maxLength={4}
                value={inputPin}
                onChange={e => setInputPin(e.target.value.replace(/[^0-9]/g, ''))}
                placeholder="• • • •"
                className="w-full text-center text-2xl font-bold tracking-[1em] p-3 border-2 border-slate-400 rounded-xl focus:border-rose-500 focus:outline-none text-slate-900 bg-slate-50"
                autoFocus
              />
              {pinError && (
                <p className="text-rose-600 text-xs mt-2 font-bold">⚠️ 비밀번호가 올바르지 않습니다.</p>
              )}
            </div>

            {/* 비밀번호 확인 버튼: 흰색 배경, 검정 글자, 또렷한 테두리 */}
            <button
              type="submit"
              className="w-full py-3 bg-white hover:bg-slate-100 text-slate-900 font-extrabold rounded-xl border-2 border-slate-900 shadow-md transition-all text-sm cursor-pointer"
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

      {/* 3. 비밀번호 변경 모달 */}
      {showPasswordChangeModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl border-2 border-slate-800 text-center space-y-4">
            <h3 className="text-lg font-bold text-slate-900">🔑 비밀번호 변경</h3>
            <p className="text-xs text-slate-600">접속할 새 숫자 4자리를 입력해주세요.</p>
            
            <form onSubmit={handlePasswordChange} className="space-y-3 text-left">
              <div>
                <label className="text-xs font-bold text-slate-700">새 비밀번호 (숫자 4자리)</label>
                <input
                  type="password"
                  maxLength={4}
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value.replace(/[^0-9]/g, ''))}
                  placeholder="예: 5678"
                  className="w-full p-2.5 border-2 border-slate-300 rounded-xl mt-1 text-center text-lg font-bold text-slate-900"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700">비밀번호 확인</label>
                <input
                  type="password"
                  maxLength={4}
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value.replace(/[^0-9]/g, ''))}
                  placeholder="다시 한번 입력"
                  className="w-full p-2.5 border-2 border-slate-300 rounded-xl mt-1 text-center text-lg font-bold text-slate-900"
                  required
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-slate-900 hover:bg-black text-white rounded-xl text-xs font-bold cursor-pointer"
                >
                  변경 저장
                </button>
                <button
                  type="button"
                  onClick={() => setShowPasswordChangeModal(false)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold border border-slate-300 cursor-pointer"
                >
                  취소
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
          {menuList.map(item => (
            <button
              key={item.id}
              onClick={() => handleMenuChange(item.id)}
              className={`flex-1 md:flex-none px-2 py-2 rounded-xl text-center md:text-left transition-all font-semibold ${
                activeMenu === item.id
                  ? 'bg-rose-500 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-200/60'
              }`}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className="hidden md:block mt-auto pt-4 border-t border-slate-200">
          <button
            onClick={() => setShowPasswordChangeModal(true)}
            className="w-full py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl text-[11px] font-bold transition-all text-center cursor-pointer"
          >
            🔑 암호 변경
          </button>
        </div>
      </aside>

      {/* 메인 콘텐츠 영역 */}
      <main className="flex-1 p-2 md:p-4 max-w-6xl mx-auto w-full overflow-y-auto">
        {/* 모바일 화면 상단 암호 변경 버튼 */}
        <div className="md:hidden flex justify-end mb-2">
          <button
            onClick={() => setShowPasswordChangeModal(true)}
            className="px-3 py-1 bg-slate-200 text-slate-700 rounded-lg text-xs font-bold"
          >
            🔑 암호 변경
          </button>
        </div>

        {/* 1. 신규 주문 입력 메뉴 */}
        {activeMenu === 'new' && (
          <div className="bg-white p-4 md:p-6 rounded-2xl shadow-xs border border-slate-200 max-w-xl mx-auto space-y-4">
            <h2 className="text-base md:text-lg font-bold text-slate-900 border-b pb-2 flex items-center justify-between">
              <span>📝 신규 주문 등록</span>
            </h2>

            <form onSubmit={handleCreateOrder} className="space-y-4 text-xs md:text-sm">
              <div className="relative">
                <label className="block text-slate-700 font-bold mb-1">고객 성명 *</label>
                <input
                  type="text"
                  value={newOrder.customer_name}
                  onChange={e => handleCustomerNameChange(e.target.value)}
                  placeholder="예: 홍길동"
                  className="w-full p-2.5 md:p-3 border rounded-xl border-slate-300 focus:border-rose-500 focus:outline-none bg-slate-50 text-slate-900 font-medium"
                  required
                />
                
                {/* 매칭된 고객 선택 옵션 드롭다운 */}
                {matchedCustomerList.length > 0 && (
                  <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-20 max-h-40 overflow-y-auto">
                    <div className="p-2 text-[11px] text-slate-400 font-bold bg-slate-50 border-b">
                      🔍 기존 동일 이름 고객 선택:
                    </div>
                    {matchedCustomerList.map(c => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => selectCustomerForNewOrder(c)}
                        className="w-full text-left p-2 hover:bg-rose-50 transition-colors flex justify-between items-center text-xs border-b last:border-b-0"
                      >
                        <span className="font-bold text-slate-800">{c.name}</span>
                        <span className="text-slate-500">{c.phone}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">연락처 *</label>
                <input
                  type="tel"
                  value={newOrder.phone}
                  onChange={e => setNewOrder(prev => ({ ...prev, phone: formatPhone(e.target.value) }))}
                  placeholder="010-0000-0000"
                  className="w-full p-2.5 md:p-3 border rounded-xl border-slate-300 focus:border-rose-500 focus:outline-none bg-slate-50 text-slate-900 font-medium"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">상품 구분</label>
                  <select
                    value={newOrder.product_name}
                    onChange={e => setNewOrder(prev => ({ ...prev, product_name: e.target.value }))}
                    className="w-full p-2.5 md:p-3 border rounded-xl border-slate-300 focus:border-rose-500 focus:outline-none bg-slate-50 text-slate-900 font-medium"
                  >
                    {PRODUCT_OPTIONS.map(opt => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">금액 (천원 단위)</label>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      value={newOrder.amount_thousands}
                      onChange={e => setNewOrder(prev => ({ ...prev, amount_thousands: e.target.value }))}
                      placeholder="55"
                      className="w-full p-2.5 md:p-3 border rounded-xl border-slate-300 focus:border-rose-500 focus:outline-none bg-slate-50 text-slate-900 font-medium text-right"
                    />
                    <span className="text-xs md:text-sm font-bold text-slate-600 shrink-0">천원</span>
                  </div>
                </div>
              </div>

              <div className="p-3 bg-rose-50/50 rounded-xl border border-rose-100 space-y-3">
                <label className="block text-rose-900 font-bold">🗓️ 픽업 예약 일시</label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <input
                    type="date"
                    value={newOrder.pickup_date}
                    onChange={e => setNewOrder(prev => ({ ...prev, pickup_date: e.target.value }))}
                    className="w-full p-2.5 md:p-3 border rounded-xl border-slate-300 focus:border-rose-500 focus:outline-none bg-white text-slate-900 font-medium"
                  />
                  <TimePickerCustom
                    value={newOrder.pickup_time}
                    onChange={val => setNewOrder(prev => ({ ...prev, pickup_time: val }))}
                  />
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                <label className="block text-slate-700 font-bold">📝 접수 일시</label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <input
                    type="date"
                    value={newOrder.receipt_date}
                    onChange={e => setNewOrder(prev => ({ ...prev, receipt_date: e.target.value }))}
                    className="w-full p-2.5 md:p-3 border rounded-xl border-slate-300 focus:border-rose-500 focus:outline-none bg-white text-slate-900 font-medium"
                  />
                  <TimePickerCustom
                    value={newOrder.receipt_time}
                    onChange={val => setNewOrder(prev => ({ ...prev, receipt_time: val }))}
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">결제 수단</label>
                <select
                  value={newOrder.payment_method}
                  onChange={e => setNewOrder(prev => ({ ...prev, payment_method: e.target.value }))}
                  className="w-full p-2.5 md:p-3 border rounded-xl border-slate-300 focus:border-rose-500 focus:outline-none bg-slate-50 text-slate-900 font-medium"
                >
                  {PAYMENT_OPTIONS.map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">요청 사항 및 메모</label>
                <textarea
                  rows={3}
                  value={newOrder.memo}
                  onChange={e => setNewOrder(prev => ({ ...prev, memo: e.target.value }))}
                  placeholder="특이사항이나 요청사항을 입력하세요."
                  className="w-full p-2.5 md:p-3 border rounded-xl border-slate-300 focus:border-rose-500 focus:outline-none bg-slate-50 text-slate-900 font-medium"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 md:py-3.5 bg-rose-500 hover:bg-rose-600 text-white font-bold rounded-xl shadow-md transition-all text-sm cursor-pointer"
              >
                주문 저장하기
              </button>
            </form>
          </div>
        )}

        {/* 2. 주문/달력 메뉴 */}
        {activeMenu === 'orders' && (
          <div className="space-y-4">
            {/* 서브 탭 스위처 */}
            <div className="flex bg-slate-200/80 p-1 rounded-xl max-w-xs text-xs md:text-sm font-bold">
              <button
                onClick={() => setSubTab('calendar')}
                className={`flex-1 py-1.5 rounded-lg text-center transition-all ${
                  subTab === 'calendar' ? 'bg-white text-rose-600 shadow-xs' : 'text-slate-600'
                }`}
              >
                📅 달력 보기
              </button>
              <button
                onClick={() => setSubTab('list')}
                className={`flex-1 py-1.5 rounded-lg text-center transition-all ${
                  subTab === 'list' ? 'bg-white text-rose-600 shadow-xs' : 'text-slate-600'
                }`}
              >
                📋 목록 보기
              </button>
            </div>

            {/* 서브탭 1: 달력 뷰 */}
            {subTab === 'calendar' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="lg:col-span-2 bg-white p-3 md:p-4 rounded-2xl shadow-xs border border-slate-200">
                  <FullCalendar
                    plugins={[dayGridPlugin, interactionPlugin]}
                    initialView="dayGridMonth"
                    locale="ko"
                    headerToolbar={{
                      left: 'prev,next today',
                      center: 'title',
                      right: ''
                    }}
                    events={getCalendarEvents()}
                    dateClick={(info) => setSelectedDate(info.dateStr)}
                    height="auto"
                  />
                </div>

                <div className="bg-white p-4 rounded-2xl shadow-xs border border-slate-200 flex flex-col h-full">
                  <h3 className="text-sm font-bold text-slate-800 border-b pb-2 mb-3 flex items-center justify-between">
                    <span>📌 {selectedDate || '날짜선택'} 픽업 건</span>
                    <span className="text-xs bg-rose-100 text-rose-600 px-2 py-0.5 rounded-full">
                      총 {selectedDayOrders.length}건
                    </span>
                  </h3>

                  {selectedDayOrders.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center py-8 text-slate-400 text-xs">
                      <span>🍃 선택한 날짜에 픽업예약이 없습니다.</span>
                    </div>
                  ) : (
                    <div className="space-y-2.5 overflow-y-auto max-h-[500px] pr-1">
                      {selectedDayOrders.map(order => {
                        const { time } = parseDateTime(order.pickup_datetime);
                        return (
                          <div
                            key={order.id}
                            className="p-3 rounded-xl bg-slate-50 border border-slate-200 hover:border-rose-300 transition-all text-xs space-y-1 relative"
                          >
                            <div className="flex justify-between items-start">
                              <span className="font-bold text-slate-900 text-sm">
                                {order.customers?.name || '익명'}
                              </span>
                              <span className="font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200">
                                ⏰ {time}
                              </span>
                            </div>

                            <div className="text-slate-600 flex justify-between pt-1">
                              <span>{order.product_name}</span>
                              <span className="font-semibold">{((order.amount || 0) / 1000).toLocaleString()}천원</span>
                            </div>

                            <div className="text-[11px] text-slate-500">
                              📞 {order.customers?.phone || '-'}
                            </div>

                            {order.memo && (
                              <div className="mt-1 pt-1 border-t border-slate-200/60 text-[11px] text-slate-500 italic">
                                💡 {order.memo}
                              </div>
                            )}

                            <div className="pt-1 flex justify-end gap-1">
                              <button
                                onClick={() => startEditOrder(order)}
                                className="px-2 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg text-[11px] font-bold cursor-pointer"
                              >
                                수정
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 서브탭 2: 전체 목록 뷰 */}
            {subTab === 'list' && (
              <div className="bg-white p-4 rounded-2xl shadow-xs border border-slate-200 space-y-3">
                <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center gap-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={orderSearch}
                      onChange={e => handleOrderSearchChange(e.target.value)}
                      placeholder="🔍 고객명 또는 연락처 검색..."
                      className="p-2 border border-slate-300 rounded-xl text-xs md:text-sm focus:outline-none focus:border-rose-500 w-full md:w-64"
                    />
                  </div>

                  {selectedOrderIds.length > 0 && (
                    <button
                      onClick={handleDeleteSelectedOrders}
                      className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
                    >
                      🗑️ 선택한 {selectedOrderIds.length}개 주문 삭제
                    </button>
                  )}
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs md:text-sm">
                    <thead>
                      <tr className="bg-slate-100 border-b border-slate-200 text-slate-700">
                        <th className="p-2.5 text-center w-8">
                          <input
                            type="checkbox"
                            onChange={handleToggleSelectAllOrders}
                            checked={filteredOrders.length > 0 && selectedOrderIds.length === filteredOrders.length}
                          />
                        </th>
                        <th className="p-2.5">고객명</th>
                        <th className="p-2.5">연락처</th>
                        <th className="p-2.5">상품명</th>
                        <th className="p-2.5">금액</th>
                        <th className="p-2.5">픽업일시</th>
                        <th className="p-2.5">결제수단</th>
                        <th className="p-2.5 text-center">관리</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredOrders.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="text-center py-8 text-slate-400">
                            주문 내역이 없습니다.
                          </td>
                        </tr>
                      ) : (
                        filteredOrders.map(order => {
                          const { date, time } = parseDateTime(order.pickup_datetime);
                          return (
                            <tr key={order.id} className="hover:bg-slate-50/80">
                              <td className="p-2.5 text-center">
                                <input
                                  type="checkbox"
                                  checked={selectedOrderIds.includes(order.id)}
                                  onChange={() => handleToggleSelectOrder(order.id)}
                                />
                              </td>
                              <td className="p-2.5 font-bold text-slate-900">
                                {order.customers?.name || '익명'}
                              </td>
                              <td className="p-2.5 text-slate-600">{order.customers?.phone || '-'}</td>
                              <td className="p-2.5 font-medium">{order.product_name}</td>
                              <td className="p-2.5 font-semibold text-rose-600">
                                {((order.amount || 0) / 1000).toLocaleString()}천원
                              </td>
                              <td className="p-2.5 text-slate-700">{date} {time}</td>
                              <td className="p-2.5">
                                <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md text-xs font-semibold">
                                  {order.payment_method || '신용카드'}
                                </span>
                              </td>
                              <td className="p-2.5 text-center">
                                <button
                                  onClick={() => startEditOrder(order)}
                                  className="px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 rounded-lg text-xs font-bold cursor-pointer"
                                >
                                  수정
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 3. 고객 관리 메뉴 */}
        {activeMenu === 'customers' && (
          <div className="bg-white p-4 md:p-6 rounded-2xl shadow-xs border border-slate-200 space-y-4">
            <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center gap-2 border-b pb-3">
              <h2 className="text-base md:text-lg font-bold text-slate-900">🎂 고객 목록 관리</h2>

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={customerSearch}
                  onChange={e => handleCustomerSearchChange(e.target.value)}
                  placeholder="🔍 이름 또는 전화번호 검색..."
                  className="p-2 border border-slate-300 rounded-xl text-xs md:text-sm focus:outline-none focus:border-rose-500 w-full md:w-64"
                />

                {selectedCustomerIds.length > 0 && (
                  <button
                    onClick={handleDeleteSelectedCustomers}
                    className="px-3 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer"
                  >
                    🗑️ 선택 삭제 ({selectedCustomerIds.length})
                  </button>
                )}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs md:text-sm">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-200 text-slate-700">
                    <th className="p-2.5 text-center w-8">
                      <input
                        type="checkbox"
                        onChange={handleToggleSelectAllCustomers}
                        checked={filteredCustomers.length > 0 && selectedCustomerIds.length === filteredCustomers.length}
                      />
                    </th>
                    <th className="p-2.5">고객명</th>
                    <th className="p-2.5">연락처</th>
                    <th className="p-2.5">최근 픽업일</th>
                    <th className="p-2.5">등록일</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredCustomers.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center py-8 text-slate-400">
                        등록된 고객이 없습니다.
                      </td>
                    </tr>
                  ) : (
                    filteredCustomers.map(cust => (
                      <tr key={cust.id} className="hover:bg-slate-50/80">
                        <td className="p-2.5 text-center">
                          <input
                            type="checkbox"
                            checked={selectedCustomerIds.includes(cust.id)}
                            onChange={() => handleToggleSelectCustomer(cust.id)}
                          />
                        </td>
                        <td className="p-2.5 font-bold text-slate-900">{cust.name}</td>
                        <td className="p-2.5 text-slate-600">{cust.phone || '-'}</td>
                        <td className="p-2.5 text-slate-700 font-medium">
                          {getCustomerPickupDate(cust.id, cust.name)}
                        </td>
                        <td className="p-2.5 text-slate-400 text-xs">
                          {cust.created_at ? cust.created_at.split('T')[0] : '-'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 4. 알림 메뉴 */}
        {activeMenu === 'notifications' && (
          <div className="bg-white p-4 md:p-6 rounded-2xl shadow-xs border border-slate-200 max-w-xl mx-auto space-y-4">
            <h2 className="text-base md:text-lg font-bold text-slate-900 border-b pb-2">🔔 시스템 알림 설정</h2>
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs md:text-sm text-slate-700 space-y-2">
              <p className="font-bold text-slate-900">📌 자동 정기 백업 알림 안내</p>
              <p className="leading-relaxed text-slate-600">
                매주 <strong>월요일 정오(12:00 PM)</strong>에 접속 시 백업 다운로드 팝업 알림이 활성화됩니다.
              </p>
            </div>
          </div>
        )}

        {/* 5. 백업 / 복원 메뉴 */}
        {activeMenu === 'backup' && (
          <div className="bg-white p-4 md:p-6 rounded-2xl shadow-xs border border-slate-200 max-w-xl mx-auto space-y-6">
            <h2 className="text-base md:text-lg font-bold text-slate-900 border-b pb-2">💾 데이터 백업 및 복원</h2>

            <div className="space-y-3">
              <h3 className="font-bold text-slate-800 text-xs md:text-sm">📥 데이터 백업 (내보내기)</h3>
              <p className="text-xs text-slate-500">
                현재 데이터베이스에 저장된 주문 내역과 고객 정보를 CSV 파일로 다운로드합니다.
              </p>
              <button
                onClick={handleExportCSV}
                className="w-full py-3 bg-slate-900 hover:bg-black text-white font-bold rounded-xl text-xs md:text-sm transition-all cursor-pointer shadow-md"
              >
                💾 CSV 데이터 백업 다운로드
              </button>
            </div>

            <hr className="border-slate-200" />

            <div className="space-y-3">
              <h3 className="font-bold text-slate-800 text-xs md:text-sm">📤 데이터 복원 (가져오기)</h3>
              <p className="text-xs text-slate-500">
                백업한 CSV 파일을 선택하여 데이터베이스에 복원 및 업로드합니다.
              </p>
              <label className="block w-full py-3 bg-white hover:bg-slate-50 text-slate-800 border-2 border-dashed border-slate-300 rounded-xl text-center font-bold text-xs md:text-sm cursor-pointer transition-all">
                📁 CSV 파일 선택 및 복원
                <input
                  type="file"
                  accept=".csv"
                  multiple
                  onChange={handleImportCSV}
                  className="hidden"
                />
              </label>
            </div>
          </div>
        )}

        {/* 주문 수정 모달 */}
        {editingOrder && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
            <div className="bg-white rounded-2xl p-6 max-w-lg w-full shadow-2xl border border-slate-300 my-8 space-y-4">
              <div className="flex justify-between items-center border-b pb-2">
                <h3 className="text-base md:text-lg font-bold text-slate-900">✏️ 주문 정보 수정</h3>
                <button
                  onClick={() => setEditingOrder(null)}
                  className="text-slate-400 hover:text-slate-600 font-bold text-lg"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleUpdateOrder} className="space-y-3 text-xs md:text-sm">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">고객 성명</label>
                  <input
                    type="text"
                    value={editingOrder.customer_name}
                    onChange={e => setEditingOrder(prev => ({ ...prev, customer_name: e.target.value }))}
                    className="w-full p-2.5 border rounded-xl border-slate-300 bg-slate-50 font-medium"
                    required
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">연락처</label>
                  <input
                    type="tel"
                    value={editingOrder.phone}
                    onChange={e => setEditingOrder(prev => ({ ...prev, phone: formatPhone(e.target.value) }))}
                    className="w-full p-2.5 border rounded-xl border-slate-300 bg-slate-50 font-medium"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">상품 구분</label>
                    <select
                      value={editingOrder.product_name}
                      onChange={e => setEditingOrder(prev => ({ ...prev, product_name: e.target.value }))}
                      className="w-full p-2.5 border rounded-xl border-slate-300 bg-slate-50 font-medium"
                    >
                      {PRODUCT_OPTIONS.map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-700 font-bold mb-1">금액 (천원 단위)</label>
                    <input
                      type="number"
                      value={editingOrder.amount_thousands}
                      onChange={e => setEditingOrder(prev => ({ ...prev, amount_thousands: e.target.value }))}
                      className="w-full p-2.5 border rounded-xl border-slate-300 bg-slate-50 font-medium text-right"
                    />
                  </div>
                </div>

                <div className="p-3 bg-rose-50/50 rounded-xl border border-rose-100 space-y-2">
                  <label className="block text-rose-900 font-bold">🗓️ 픽업 예약 일시</label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <input
                      type="date"
                      value={editingOrder.pickup_date}
                      onChange={e => setEditingOrder(prev => ({ ...prev, pickup_date: e.target.value }))}
                      className="w-full p-2.5 border rounded-xl border-slate-300 bg-white font-medium"
                    />
                    <TimePickerCustom
                      value={editingOrder.pickup_time}
                      onChange={val => setEditingOrder(prev => ({ ...prev, pickup_time: val }))}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">결제 수단</label>
                  <select
                    value={editingOrder.payment_method}
                    onChange={e => setEditingOrder(prev => ({ ...prev, payment_method: e.target.value }))}
                    className="w-full p-2.5 border rounded-xl border-slate-300 bg-slate-50 font-medium"
                  >
                    {PAYMENT_OPTIONS.map(opt => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">요청 사항 및 메모</label>
                  <textarea
                    rows={3}
                    value={editingOrder.memo}
                    onChange={e => setEditingOrder(prev => ({ ...prev, memo: e.target.value }))}
                    className="w-full p-2.5 border rounded-xl border-slate-300 bg-slate-50 font-medium"
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="submit"
                    className="flex-1 py-3 bg-rose-500 hover:bg-rose-600 text-white font-bold rounded-xl shadow-md cursor-pointer"
                  >
                    수정사항 저장
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingOrder(null)}
                    className="px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl border border-slate-300 cursor-pointer"
                  >
                    취소
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
