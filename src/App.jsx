import React, { useState, useEffect } from 'react';
import { createClient } from '@supabasesupabase-js';
import FullCalendar from '@fullcalendarreact';
import dayGridPlugin from '@fullcalendardaygrid';
import interactionPlugin from '@fullcalendarinteraction';

 Supabase 연동
const SUPABASE_URL = 'httpszthuqzzholyjolteuvty.supabase.co';
const SUPABASE_KEY = 'sb_publishable_xkg9ULmNiqKrCcESytGbmw_u1Z12_gG';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

 옵션 목록
const PAYMENT_OPTIONS = [신용카드, 현금, 계좌이체, 전화예약입금, 네이버, 인스타, 미결제];
const PRODUCT_OPTIONS = [꽃다발, 꽃바구니, 햇살콘플라워, 꽃묶음, 식물, 용품, 시즌한정, 기타];

const AMPM_OPTIONS = [오전, 오후];
const HOUR_OPTIONS = Array.from({ length 12 }, (_, i) = String(i + 1).padStart(2, '0'));
const MINUTE_OPTIONS = [00, 15, 30, 45];

const parseTimeToParts = (timeStr) = {
  if (!timeStr) return { ampm 오후, hour 02, minute 00 };
  const [hStr, mStr] = timeStr.split('');
  let h = parseInt(hStr, 10);
  let m = parseInt(mStr, 10);

  m = Math.round(m  15)  15;
  if (m === 60) {
    m = 0;
    h = (h + 1) % 24;
  }

  const ampm = h = 12  오후  오전;
  let h12 = h % 12;
  if (h12 === 0) h12 = 12;

  return {
    ampm,
    hour String(h12).padStart(2, '0'),
    minute String(m).padStart(2, '0')
  };
};

const formatPartsToTime = (ampm, hour, minute) = {
  let h = parseInt(hour, 10);
  if (ampm === 오후 && h  12) h += 12;
  if (ampm === 오전 && h === 12) h = 0;
  return `${String(h).padStart(2, '0')}${minute}`;
};

const getKoreaNowFormatted = () = {
  const now = new Date();
  const utc = now.getTime() + (now.getTimezoneOffset()  60000);
  const kst = new Date(utc + (9  60  60  1000));

  const year = kst.getFullYear();
  const month = String(kst.getMonth() + 1).padStart(2, '0');
  const day = String(kst.getDate()).padStart(2, '0');
  const dateStr = `${year}-${month}-${day}`;

  let hours = kst.getHours();
  let minutes = Math.round(kst.getMinutes()  15)  15;
  if (minutes === 60) {
    minutes = 0;
    hours = (hours + 1) % 24;
  }

  const timeStr = `${String(hours).padStart(2, '0')}${String(minutes).padStart(2, '0')}`;
  return { date dateStr, time timeStr };
};

export default function App() {
  const [activeMenu, setActiveMenu] = useState('orders');
  const [subTab, setSubTab] = useState('calendar');
  
  const [orders, setOrders] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [selectedDate, setSelectedDate] = useState(getKoreaNowFormatted().date);
  const [editingOrder, setEditingOrder] = useState(null);

  const parseDateTime = (datetimeStr, fallbackDate = '', fallbackTime = '1400') = {
    if (!datetimeStr) return { date fallbackDate, time fallbackTime };
    const cleanStr = datetimeStr.replace(' ', 'T');
    const parts = cleanStr.split('T');
    const date = parts[0]  fallbackDate;
    let time = fallbackTime;
    if (parts[1]) {
      time = parts[1].slice(0, 5);
    }
    return { date, time };
  };

  const initialKst = getKoreaNowFormatted();
  const [newOrder, setNewOrder] = useState({
    customer_name '',
    phone '',
    product_name '꽃다발',
    amount 55000,
    pickup_date initialKst.date,
    pickup_time '1400',
    receipt_date initialKst.date,
    receipt_time initialKst.time,
    payment_method '신용카드',
    memo ''
  });

  const handleMenuChange = (menuId) = {
    setActiveMenu(menuId);
    if (menuId === 'new') {
      const kstNow = getKoreaNowFormatted();
      setNewOrder(prev = ({
        ...prev,
        pickup_date kstNow.date,
        receipt_date kstNow.date,
        receipt_time kstNow.time
      }));
    }
  };

  const fetchData = async () = {
    const { data orderData } = await supabase
      .from('orders')
      .select(', customers(id, name, phone)')
      .order('id', { ascending false });

    if (orderData) setOrders(orderData);

    const { data customerData } = await supabase
      .from('customers')
      .select('')
      .order('id', { ascending false });

    if (customerData) setCustomers(customerData);
  };

  useEffect(() = {
    fetchData();
  }, []);

   💡 실시간 하이픈(-) 자동 추가 포맷터
  const formatPhone = (val) = {
    if (!val) return '';
    const nums = val.replace([^0-9]g, '');
    
    if (nums.length === 11) {
      return `${nums.slice(0, 3)}-${nums.slice(3, 7)}-${nums.slice(7)}`;
    }
    if (nums.length === 10) {
      if (nums.startsWith('02')) {
        return `${nums.slice(0, 2)}-${nums.slice(2, 6)}-${nums.slice(6)}`;
      }
      return `${nums.slice(0, 3)}-${nums.slice(3, 6)}-${nums.slice(6)}`;
    }
    if (nums.length  7) {
      return `${nums.slice(0, 3)}-${nums.slice(3, 7)}-${nums.slice(7, 11)}`;
    }
    if (nums.length  3) {
      return `${nums.slice(0, 3)}-${nums.slice(3)}`;
    }
    return nums;
  };

  const handleCreateOrder = async (e) = {
    e.preventDefault();
    if (!newOrder.customer_name) return alert('고객 성명을 입력해주세요.');
    
     유효성 검사 (숫자만 10자리 이상 필요)
    const rawNums = newOrder.phone.replace([^0-9]g, '');
    if (!newOrder.phone  rawNums.length  10) {
      return alert('올바른 휴대폰 번호를 입력해주세요. (최소 10자리 이상)');
    }

    let customerId;
    const { data custData } = await supabase
      .from('customers')
      .select('id')
      .eq('name', newOrder.customer_name)
      .eq('phone', newOrder.phone)
      .maybeSingle();

    if (custData) {
      customerId = custData.id;
    } else {
      const { data newCust } = await supabase
        .from('customers')
        .insert([{ name newOrder.customer_name, phone newOrder.phone }])
        .select()
        .single();
      customerId = newCust.id;
    }

    const pickupDatetime = `${newOrder.pickup_date}T${newOrder.pickup_time}00`;
    const receiptDatetime = `${newOrder.receipt_date}T${newOrder.receipt_time}00`;

    await supabase.from('orders').insert([{
      customer_id customerId,
      product_name newOrder.product_name,
      product newOrder.product_name,
      amount Number(newOrder.amount),
      pickup_datetime pickupDatetime,
      created_at receiptDatetime,
      payment_method newOrder.payment_method,
      status newOrder.payment_method,
      memo newOrder.memo
    }]);

    alert('주문이 성공적으로 등록되었습니다!');
    
    const kstNow = getKoreaNowFormatted();
    setNewOrder({
      customer_name '',
      phone '',
      product_name '꽃다발',
      amount 55000,
      pickup_date kstNow.date,
      pickup_time '1400',
      receipt_date kstNow.date,
      receipt_time kstNow.time,
      payment_method '신용카드',
      memo ''
    });
    setActiveMenu('orders');
    fetchData();
  };

  const startEditOrder = (order) = {
    const kstNow = getKoreaNowFormatted();
    const pickup = parseDateTime(order.pickup_datetime, kstNow.date, '1400');
    const receipt = parseDateTime(order.created_at, kstNow.date, kstNow.time);

    setEditingOrder({
      id order.id,
      customer_id order.customer_id,
      customer_name order.customers.name  '',
      phone order.customers.phone  '',
      product_name order.product_name  '꽃다발',
      amount order.amount  0,
      pickup_date pickup.date,
      pickup_time pickup.time,
      receipt_date receipt.date,
      receipt_time receipt.time,
      payment_method order.payment_method  '신용카드',
      memo order.memo  ''
    });
  };

  const handleUpdateOrder = async (e) = {
    e.preventDefault();
    
    const rawNums = editingOrder.phone.replace([^0-9]g, '');
    if (!editingOrder.phone  rawNums.length  10) {
      return alert('올바른 휴대폰 번호를 입력해주세요.');
    }

    if (editingOrder.customer_id) {
      await supabase.from('customers').update({
        name editingOrder.customer_name,
        phone editingOrder.phone
      }).eq('id', editingOrder.customer_id);
    }

    const pickupDatetime = `${editingOrder.pickup_date}T${editingOrder.pickup_time}00`;
    const receiptDatetime = `${editingOrder.receipt_date}T${editingOrder.receipt_time}00`;

    await supabase.from('orders').update({
      product_name editingOrder.product_name,
      product editingOrder.product_name,
      amount Number(editingOrder.amount),
      pickup_datetime pickupDatetime,
      created_at receiptDatetime,
      payment_method editingOrder.payment_method,
      status editingOrder.payment_method,
      memo editingOrder.memo
    }).eq('id', editingOrder.id);

    alert('✅ 모든 수정사항이 저장되었습니다!');
    setEditingOrder(null);
    fetchData();
  };

  const exportOrdersCSV = () = {
    if (orders.length === 0) return alert('다운로드할 주문 데이터가 없습니다.');
    let csvContent = datatextcsv;charset=utf-8,uFEFF;
    csvContent += ID,고객ID,상품명,금액,결제방식,픽업일시,접수일시,메모n;

    orders.forEach(o = {
      const row = [
        o.id,
        o.customer_id  '',
        `${o.product_name  ''}`,
        o.amount  0,
        `${o.payment_method  ''}`,
        `${o.pickup_datetime  ''}`,
        `${o.created_at  ''}`,
        `${(o.memo  '').replace(ng, ' ')}`
      ].join(,);
      csvContent += row + n;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement(a);
    link.setAttribute(href, encodedUri);
    link.setAttribute(download, `주문목록_${getKoreaNowFormatted().date}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportCustomersCSV = () = {
    if (customers.length === 0) return alert('다운로드할 고객 데이터가 없습니다.');
    let csvContent = datatextcsv;charset=utf-8,uFEFF;
    csvContent += ID,성명,연락처n;

    customers.forEach(c = {
      const row = [
        c.id,
        `${c.name  ''}`,
        `${c.phone  ''}`
      ].join(,);
      csvContent += row + n;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement(a);
    link.setAttribute(href, encodedUri);
    link.setAttribute(download, `고객목록_${getKoreaNowFormatted().date}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleImportCSV = async (e, type) = {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) = {
      const text = event.target.result;
      const lines = text.split('n').map(l = l.trim()).filter(l = l.length  0);
      if (lines.length = 1) return alert('올바른 CSV 파일이 아니거나 데이터가 없습니다.');

      const parseCSVLine = (line) = {
        const result = [];
        let cur = '';
        let inQuotes = false;
        for (let i = 0; i  line.length; i++) {
          const char = line[i];
          if (char === '') inQuotes = !inQuotes;
          else if (char === ',' && !inQuotes) {
            result.push(cur.trim().replace(^$g, ''));
            cur = '';
          } else {
            cur += char;
          }
        }
        result.push(cur.trim().replace(^$g, ''));
        return result;
      };

      if (type === 'customers') {
        const newCusts = [];
        for (let i = 1; i  lines.length; i++) {
          const cols = parseCSVLine(lines[i]);
          if (cols[1]) {
            newCusts.push({ name cols[1], phone cols[2]  '' });
          }
        }
        if (newCusts.length  0) {
          await supabase.from('customers').insert(newCusts);
          alert(`${newCusts.length}명의 고객 정보 복원이 완료되었습니다.`);
        }
      } else if (type === 'orders') {
        const newOrders = [];
        for (let i = 1; i  lines.length; i++) {
          const cols = parseCSVLine(lines[i]);
          if (cols[2]) {
            newOrders.push({
              customer_id cols[1]  Number(cols[1])  null,
              product_name cols[2],
              product cols[2],
              amount Number(cols[3])  0,
              payment_method cols[4]  '신용카드',
              status cols[4]  '신용카드',
              pickup_datetime cols[5]  null,
              created_at cols[6]  new Date().toISOString(),
              memo cols[7]  ''
            });
          }
        }
        if (newOrders.length  0) {
          await supabase.from('orders').insert(newOrders);
          alert(`${newOrders.length}건의 주문 정보 복원이 완료되었습니다.`);
        }
      }

      fetchData();
      e.target.value = '';
    };
    reader.readAsText(file, 'UTF-8');
  };

  const getCalendarEvents = () = {
    const countsByDate = {};

    orders.forEach(o = {
      if (o.pickup_datetime) {
        const dateStr = o.pickup_datetime.split('T')[0];
        countsByDate[dateStr] = (countsByDate[dateStr]  0) + 1;
      }
    });

    return Object.keys(countsByDate).map(date = ({
      id date,
      title `${countsByDate[date]}건`,
      start date,
      allDay true,
      backgroundColor '#ffe4e6',
      textColor '#9f1239',
      borderColor '#f43f5e'
    }));
  };

  const selectedDayOrders = selectedDate
     orders.filter(o = o.pickup_datetime && o.pickup_datetime.startsWith(selectedDate))
     [];

  const menuList = [
    { id 'new', label '📝 등록' },
    { id 'orders', label '📋 주문달력' },
    { id 'customers', label '🎂 고객' },
    { id 'notifications', label '🔔 알림' },
    { id 'backup', label '💾 백업복원' },
  ];

  const TimePickerCustom = ({ value, onChange, bgClass = bg-slate-50 }) = {
    const { ampm, hour, minute } = parseTimeToParts(value);

    const handleAmpmChange = (e) = {
      onChange(formatPartsToTime(e.target.value, hour, minute));
    };
    const handleHourChange = (e) = {
      onChange(formatPartsToTime(ampm, e.target.value, minute));
    };
    const handleMinuteChange = (e) = {
      onChange(formatPartsToTime(ampm, hour, e.target.value));
    };

    return (
      div className={`flex items-center gap-1 p-1 mdp-1.5 border rounded-xl mt-1 ${bgClass} border-slate-200`}
        select
          value={ampm}
          onChange={handleAmpmChange}
          className=bg-transparent text-xs mdtext-sm font-semibold p-1 focusoutline-none cursor-pointer
        
          {AMPM_OPTIONS.map(a = option key={a} value={a}{a}option)}
        select
        select
          value={hour}
          onChange={handleHourChange}
          className=bg-transparent text-xs mdtext-sm font-semibold p-1 focusoutline-none cursor-pointer flex-1 text-center
        
          {HOUR_OPTIONS.map(h = option key={h} value={h}{h}시option)}
        select
        span className=text-xs text-slate-400 font-boldspan
        select
          value={minute}
          onChange={handleMinuteChange}
          className=bg-transparent text-xs mdtext-sm font-semibold p-1 focusoutline-none cursor-pointer flex-1 text-center
        
          {MINUTE_OPTIONS.map(m = option key={m} value={m}{m}분option)}
        select
      div
    );
  };

  return (
    div className=min-h-screen bg-slate-10070 flex flex-col mdflex-row pb-12 mdpb-0
      { 사이드바 }
      aside className=bg-slate-50 border-b mdborder-b-0 mdborder-r border-slate-200 w-full mdw-56 p-1.5 mdp-5 flex flex-col shrink-0 shadow-xs
        div className=hidden mdflex items-center gap-2 text-rose-600 font-extrabold text-xl mb-1
          span className=text-2xl📌span
          span메뉴span
        div
        p className=hidden mdblock text-xs text-slate-400 mb-6 font-medium이동할 메뉴를 선택하세요p

        nav className=flex mdflex-col justify-between mdjustify-start gap-1 mdgap-2.5 w-full text-xs mdtext-sm py-1 mdpy-0
          {menuList.map(menu = (
            label
              key={menu.id}
              onClick={() = handleMenuChange(menu.id)}
              className={`flex items-center justify-center mdjustify-start gap-1 mdgap-3 px-1.5 mdpx-3 py-1.5 mdpy-2.5 rounded-lg cursor-pointer whitespace-nowrap transition-all flex-1 mdflex-none text-center ${
                activeMenu === menu.id
                   'bg-rose-50 text-rose-600 font-bold border-b-2 mdborder-b-0 mdborder-l-4 border-rose-500 shadow-2xs'
                   'text-slate-600 hoverbg-slate-20050'
              }`}
            
              input
                type=radio
                name=sidebar-menu
                checked={activeMenu === menu.id}
                onChange={() = {}}
                className=w-3.5 h-3.5 mdw-4 mdh-4 accent-rose-500 cursor-pointer hidden mdinline
              
              span className=text-[11px] smtext-xs mdtext-sm{menu.label}span
            label
          ))}
        nav
      aside

      { 메인 콘텐츠 영역 }
      main className=flex-1 p-2 mdp-8 max-w-6xl mx-auto w-full
        { 1. 신규 등록 }
        {activeMenu === 'new' && (
          div className=max-w-2xl mx-auto bg-white p-3 mdp-8 rounded-2xl border border-slate-200 shadow-sm
            h2 className=text-base mdtext-xl font-bold text-slate-800 mb-4 mdmb-6 flex items-center gap-2
              span📝span 신규 주문 및 고객 등록
            h2

            form onSubmit={handleCreateOrder} className=space-y-3 mdspace-y-4
              div className=grid grid-cols-2 gap-2 mdgap-4
                div
                  label className=text-[10px] mdtext-xs font-bold text-slate-600고객 성명 label
                  input
                    type=text
                    value={newOrder.customer_name}
                    onChange={e = setNewOrder({...newOrder, customer_name e.target.value})}
                    className=w-full p-2 mdp-3 border rounded-xl mt-1 text-xs mdtext-sm bg-slate-50 border-slate-200
                    placeholder=홍길동
                    required
                  
                div
                div
                  label className=text-[10px] mdtext-xs font-bold text-slate-600휴대폰 번호 label
                  input
                    type=text
                    value={newOrder.phone}
                    onChange={e = setNewOrder({...newOrder, phone formatPhone(e.target.value)})}
                    className=w-full p-2 mdp-3 border rounded-xl mt-1 text-xs mdtext-sm bg-slate-50 border-slate-200
                    placeholder=010-0000-0000
                    maxLength={13}
                    required
                  
                div
              div

              div className=grid grid-cols-2 gap-2 mdgap-4
                div
                  label className=text-[10px] mdtext-xs font-bold text-slate-600상품종류 label
                  select
                    value={newOrder.product_name}
                    onChange={e = setNewOrder({...newOrder, product_name e.target.value})}
                    className=w-full p-2 mdp-3 border rounded-xl mt-1 text-xs mdtext-sm bg-slate-50 border-slate-200
                  
                    {PRODUCT_OPTIONS.map(p = option key={p} value={p}{p}option)}
                  select
                div
                div
                  label className=text-[10px] mdtext-xs font-bold text-slate-600결제 금액 (원)label
                  input
                    type=number
                    value={newOrder.amount}
                    onChange={e = setNewOrder({...newOrder, amount e.target.value})}
                    className=w-full p-2 mdp-3 border rounded-xl mt-1 text-xs mdtext-sm bg-slate-50 border-slate-200
                  
                div
              div

              div className=grid grid-cols-2 gap-2 mdgap-4
                div
                  label className=text-[10px] mdtext-xs font-bold text-slate-600픽업 날짜 label
                  input
                    type=date
                    value={newOrder.pickup_date}
                    onChange={e = setNewOrder({...newOrder, pickup_date e.target.value})}
                    className=w-full p-2 mdp-3 border rounded-xl mt-1 text-xs mdtext-sm bg-slate-50 border-slate-200
                  
                div
                div
                  label className=text-[10px] mdtext-xs font-bold text-slate-600픽업 시간  (15분 단위)label
                  TimePickerCustom
                    value={newOrder.pickup_time}
                    onChange={val = setNewOrder({...newOrder, pickup_time val})}
                  
                div
              div

              div className=grid grid-cols-2 gap-2 mdgap-4 bg-slate-50 p-2.5 mdp-3 rounded-2xl border border-slate-200
                div
                  label className=text-[10px] mdtext-xs font-bold text-slate-700접수 날짜 (현재 시각)label
                  input
                    type=date
                    value={newOrder.receipt_date}
                    onChange={e = setNewOrder({...newOrder, receipt_date e.target.value})}
                    className=w-full p-2 border rounded-xl mt-1 text-xs mdtext-sm bg-white border-slate-200
                  
                div
                div
                  label className=text-[10px] mdtext-xs font-bold text-slate-700접수 시간 (현재 시각)label
                  TimePickerCustom
                    value={newOrder.receipt_time}
                    onChange={val = setNewOrder({...newOrder, receipt_time val})}
                    bgClass=bg-white
                  
                div
              div

              div
                label className=text-[10px] mdtext-xs font-bold text-slate-600결제 방식 label
                select
                  value={newOrder.payment_method}
                  onChange={e = setNewOrder({...newOrder, payment_method e.target.value})}
                  className=w-full p-2 mdp-3 border rounded-xl mt-1 text-xs mdtext-sm bg-slate-50 border-slate-200
                
                  {PAYMENT_OPTIONS.map(pm = option key={pm} value={pm}{pm}option)}
                select
              div

              div
                label className=text-[10px] mdtext-xs font-bold text-slate-600고객 요구사항  메모label
                textarea
                  value={newOrder.memo}
                  onChange={e = setNewOrder({...newOrder, memo e.target.value})}
                  className=w-full p-2 mdp-3 border rounded-xl mt-1 text-xs mdtext-sm bg-slate-50 border-slate-200
                  rows={3}
                  placeholder=요청사항이나 특이사항을 적어주세요.
                
              div

              button
                type=submit
                className=w-full py-3 mdpy-3.5 bg-rose-500 text-black font-extrabold rounded-xl shadow-md hoverbg-rose-600 transition-colors text-sm mdtext-base mt-2 cursor-pointer
              
                주문 저장하기
              button
            form
          div
        )}

        { 2. 주문 & 달력 }
        {activeMenu === 'orders' && (
          div className=space-y-3 mdspace-y-6
            div className=bg-white p-2 smp-3 mdp-6 rounded-xl border border-slate-200 shadow-sm
              div className=flex border-b border-slate-200 mb-2 mdmb-6 gap-6
                button
                  onClick={() = setSubTab('calendar')}
                  className={`pb-2 text-xs mdtext-sm font-bold flex items-center gap-1.5 relative transition-colors ${
                    subTab === 'calendar'  'text-rose-600'  'text-slate-400 hovertext-slate-600'
                  }`}
                
                  span📅span 픽업 달력
                  {subTab === 'calendar' && div className=absolute bottom-0 left-0 right-0 h-0.5 bg-rose-500 rounded-full }
                button

                button
                  onClick={() = setSubTab('list')}
                  className={`pb-2 text-xs mdtext-sm font-bold flex items-center gap-1.5 relative transition-colors ${
                    subTab === 'list'  'text-rose-600'  'text-slate-400 hovertext-slate-600'
                  }`}
                
                  span📊span 전체 주문 목록
                  {subTab === 'list' && div className=absolute bottom-0 left-0 right-0 h-0.5 bg-rose-500 rounded-full }
                button
              div

              {subTab === 'calendar' && (
                div className=calendar-compact
                  FullCalendar
                    plugins={[dayGridPlugin, interactionPlugin]}
                    initialView=dayGridMonth
                    locale=ko
                    aspectRatio={1.5}
                    fixedWeekCount={false}
                    dayMaxEventRows={true}
                    contentHeight=auto
                    events={getCalendarEvents()}
                    dateClick={(info) = setSelectedDate(info.dateStr)}
                    eventClick={(info) = setSelectedDate(info.event.startStr)}
                  
                div
              )}

              {subTab === 'list' && (
                div className=overflow-x-auto
                  table className=w-full text-left border-collapse
                    thead
                      tr className=border-b border-slate-200 text-slate-500 text-xs mdtext-sm bg-slate-50
                        th className=py-2.5 px-3픽업일시th
                        th className=py-2.5 px-3접수일시th
                        th className=py-2.5 px-3고객명th
                        th className=py-2.5 px-3연락처th
                        th className=py-2.5 px-3상품명th
                        th className=py-2.5 px-3금액th
                        th className=py-2.5 px-3결제수단th
                        th className=py-2.5 px-3관리th
                      tr
                    thead
                    tbody
                      {orders.map(o = (
                        tr key={o.id} className=border-b border-slate-100 hoverbg-slate-50 transition-colors text-xs mdtext-sm
                          td className=py-2.5 px-3 text-slate-600{o.pickup_datetime.replace('T', ' ').slice(0, 16)  '-'}td
                          td className=py-2.5 px-3 text-xs text-slate-400{o.created_at.replace('T', ' ').slice(0, 16)  '-'}td
                          td className=py-2.5 px-3 font-bold text-slate-900{o.customers.name  '-'}td
                          td className=py-2.5 px-3 text-slate-600{o.customers.phone  '-'}td
                          td className=py-2.5 px-3 font-semibold text-slate-800{o.product_name}td
                          td className=py-2.5 px-3 font-bold text-rose-600{o.amount.toLocaleString()}원td
                          td className=py-2.5 px-3span className=px-2 py-0.5 bg-slate-100 rounded text-xs font-medium{o.payment_method}spantd
                          td className=py-2.5 px-3
                            button onClick={() = startEditOrder(o)} className=text-xs bg-slate-200 text-black px-2 py-1 rounded hoverbg-slate-300 font-bold cursor-pointer
                              수정하기
                            button
                          td
                        tr
                      ))}
                    tbody
                  table
                div
              )}
            div

            { 선택한 날짜 리스트 }
            {subTab === 'calendar' && selectedDate && (
              div className=bg-white p-3 mdp-6 rounded-xl border border-slate-200 shadow-sm
                div className=flex items-center justify-between mb-3
                  h3 className=text-sm mdtext-lg font-bold text-slate-800 flex items-center gap-2
                    span📅span span className=text-rose-600{selectedDate}span 픽업 주문 ({selectedDayOrders.length}건)
                  h3
                  span className=text-xs text-slate-400 클릭하여 수정 가능span
                div

                {selectedDayOrders.length === 0  (
                  div className=bg-slate-50 text-slate-500 p-3 rounded-xl text-xs mdtext-sm text-center border border-slate-100
                    해당 날짜에 예정된 픽업 주문이 없습니다.
                  div
                )  (
                  div className=grid grid-cols-1 mdgrid-cols-2 gap-2.5
                    {selectedDayOrders.map(o = (
                      div
                        key={o.id}
                        onClick={() = startEditOrder(o)}
                        className=p-3 rounded-xl border border-slate-200 bg-slate-5070 hoverbg-rose-5050 hoverborder-rose-300 transition-all cursor-pointer flex flex-col justify-between gap-1.5 shadow-2xs group
                      
                        div className=flex justify-between items-start
                          div
                            span className=font-bold text-slate-900 text-sm mdtext-base group-hovertext-rose-600 transition-colors
                              {o.customers.name  '익명'}
                            span
                            span className=text-xs text-slate-500 ml-2{o.customers.phone  ''}span
                            p className=text-xs mdtext-sm font-semibold text-rose-600 mt-0.5{o.product_name}p
                          div
                          span className=px-2 py-0.5 bg-white border border-slate-200 rounded text-xs font-bold text-slate-700
                            {o.payment_method}
                          span
                        div
                        {o.memo && p className=text-xs text-slate-600 bg-white p-1.5 rounded-lg border border-slate-100💬 {o.memo}p}
                        
                        div className=flex justify-between items-center pt-2 border-t border-slate-20080
                          span className=font-bold text-slate-800 text-xs mdtext-sm{o.amount.toLocaleString()}원span
                          
                          button
                            type=button
                            onClick={(e) = {
                              e.stopPropagation();
                              startEditOrder(o);
                            }}
                            className=inline-flex items-center gap-1 text-xs bg-slate-200 hoverbg-rose-500 hovertext-white text-slate-900 font-extrabold px-2.5 py-1 rounded-lg border border-slate-300 transition-colors shadow-2xs cursor-pointer
                          
                            span✏️span
                            span수정하기span
                          button
                        div
                      div
                    ))}
                  div
                )}
              div
            )}
          div
        )}

        { 3. 고객 관리 }
        {activeMenu === 'customers' && (
          div className=bg-white p-4 mdp-8 rounded-xl border border-slate-200 shadow-sm
            h2 className=text-lg mdtext-xl font-bold text-slate-800 mb-4 mdmb-6 flex items-center gap-2
              span🎂span 고객 목록 ({customers.length}명)
            h2
            div className=overflow-x-auto
              table className=w-full text-left border-collapse
                thead
                  tr className=border-b border-slate-200 text-slate-500 text-xs mdtext-sm bg-slate-50
                    th className=py-2.5 px-3고객 IDth
                    th className=py-2.5 px-3성명th
                    th className=py-2.5 px-3연락처th
                  tr
                thead
                tbody
                  {customers.map(c = (
                    tr key={c.id} className=border-b border-slate-100 hoverbg-slate-50 transition-colors text-xs mdtext-sm
                      td className=py-2.5 px-3 text-slate-400#{c.id}td
                      td className=py-2.5 px-3 font-bold text-slate-900{c.name}td
                      td className=py-2.5 px-3 text-slate-600{c.phone  '-'}td
                    tr
                  ))}
                tbody
              table
            div
          div
        )}

        { 4. 알림 }
        {activeMenu === 'notifications' && (
          div className=bg-white p-6 mdp-8 rounded-xl border border-slate-200 shadow-sm text-center py-12
            span className=text-3xl mdtext-4xl mb-3 block🔔span
            h2 className=text-lg mdtext-xl font-bold text-slate-800 mb-2알림 발송 현황h2
            p className=text-xs mdtext-sm text-slate-500안내 문자 및 알림톡 내역이 표시되는 메뉴입니다.p
          div
        )}

        { 5. 백업복원 }
        {activeMenu === 'backup' && (
          div className=bg-white p-4 mdp-8 rounded-xl border border-slate-200 shadow-sm max-w-2xl mx-auto
            h2 className=text-lg mdtext-xl font-bold text-slate-800 mb-6 flex items-center gap-2
              span💾span 데이터 CSV 백업 및 복원
            h2

            div className=space-y-4 mb-8
              h3 className=text-sm font-bold text-slate-700 border-l-4 border-rose-500 pl-21. 데이터 CSV 백업 (다운로드)h3
              p className=text-xs text-slate-500원하시는 항목을 각각 클릭하여 CSV 파일로 저장하세요.p
              
              div className=grid grid-cols-1 mdgrid-cols-2 gap-3
                button
                  onClick={exportOrdersCSV}
                  className=p-4 bg-slate-50 border border-slate-200 rounded-xl hoverbg-rose-50 hoverborder-rose-300 font-bold text-slate-700 hovertext-rose-600 transition-all flex items-center justify-between text-xs mdtext-sm cursor-pointer shadow-xs
                
                  span📋 주문 데이터 백업span
                  span className=text-lg📥span
                button

                button
                  onClick={exportCustomersCSV}
                  className=p-4 bg-slate-50 border border-slate-200 rounded-xl hoverbg-rose-50 hoverborder-rose-300 font-bold text-slate-700 hovertext-rose-600 transition-all flex items-center justify-between text-xs mdtext-sm cursor-pointer shadow-xs
                
                  span🎂 고객 데이터 백업span
                  span className=text-lg📥span
                button
              div
            div

            hr className=my-6 border-slate-100 

            div className=space-y-4
              h3 className=text-sm font-bold text-slate-700 border-l-4 border-sky-500 pl-22. 데이터 CSV 복원 (업로드)h3
              p className=text-xs text-slate-500기존 백업된 CSV 파일을 선택하여 데이터베이스에 복원합니다.p

              div className=grid grid-cols-1 mdgrid-cols-2 gap-3
                label className=p-4 bg-slate-50 border border-dashed border-slate-300 rounded-xl hoverbg-sky-50 hoverborder-sky-300 font-bold text-slate-700 hovertext-sky-600 transition-all flex items-center justify-between text-xs mdtext-sm cursor-pointer
                  span📋 주문 데이터 파일 선택span
                  span className=text-lg📤span
                  input
                    type=file
                    accept=.csv
                    className=hidden
                    onChange={(e) = handleImportCSV(e, 'orders')}
                  
                label

                label className=p-4 bg-slate-50 border border-dashed border-slate-300 rounded-xl hoverbg-sky-50 hoverborder-sky-300 font-bold text-slate-700 hovertext-sky-600 transition-all flex items-center justify-between text-xs mdtext-sm cursor-pointer
                  span🎂 고객 데이터 파일 선택span
                  span className=text-lg📤span
                  input
                    type=file
                    accept=.csv
                    className=hidden
                    onChange={(e) = handleImportCSV(e, 'customers')}
                  
                label
              div
            div
          div
        )}

        { 수정 모달 }
        {editingOrder && (
          div className=fixed inset-0 bg-black40 flex items-center justify-center p-3 z-50 overflow-y-auto
            div className=bg-white p-4 mdp-7 rounded-2xl border border-slate-200 shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto my-auto
              h3 className=text-base mdtext-lg font-bold text-slate-900 mb-4 flex items-center gap-2 border-b pb-3
                span✏️span 주문 #{editingOrder.id} 전체 정보 수정
              h3

              form onSubmit={handleUpdateOrder} className=space-y-3 text-xs mdtext-sm
                div className=grid grid-cols-2 gap-2 mdgap-3
                  div
                    label className=text-[10px] mdtext-xs font-bold text-slate-600고객 성명 label
                    input
                      type=text
                      value={editingOrder.customer_name}
                      onChange={e = setEditingOrder({...editingOrder, customer_name e.target.value})}
                      className=w-full p-2 mdp-2.5 border rounded-xl mt-1 bg-slate-50 border-slate-200
                      required
                    
                  div
                  div
                    label className=text-[10px] mdtext-xs font-bold text-slate-600휴대폰 번호 label
                    input
                      type=text
                      value={editingOrder.phone}
                      onChange={e = setEditingOrder({...editingOrder, phone formatPhone(e.target.value)})}
                      className=w-full p-2 mdp-2.5 border rounded-xl mt-1 bg-slate-50 border-slate-200
                      maxLength={13}
                      required
                    
                  div
                div

                div className=grid grid-cols-2 gap-2 mdgap-3
                  div
                    label className=text-[10px] mdtext-xs font-bold text-slate-600상품종류 label
                    select
                      value={editingOrder.product_name}
                      onChange={e = setEditingOrder({...editingOrder, product_name e.target.value})}
                      className=w-full p-2 mdp-2.5 border rounded-xl mt-1 bg-slate-50 border-slate-200
                    
                      {PRODUCT_OPTIONS.map(p = option key={p} value={p}{p}option)}
                    select
                  div
                  div
                    label className=text-[10px] mdtext-xs font-bold text-slate-600금액 (원)label
                    input
                      type=number
                      value={editingOrder.amount}
                      onChange={e = setEditingOrder({...editingOrder, amount e.target.value})}
                      className=w-full p-2 mdp-2.5 border rounded-xl mt-1 bg-slate-50 border-slate-200
                    
                  div
                div

                div className=grid grid-cols-2 gap-2 mdgap-3
                  div
                    label className=text-[10px] mdtext-xs font-bold text-slate-600픽업 날짜 label
                    input
                      type=date
                      value={editingOrder.pickup_date}
                      onChange={e = setEditingOrder({...editingOrder, pickup_date e.target.value})}
                      className=w-full p-2 mdp-2.5 border rounded-xl mt-1 bg-slate-50 border-slate-200
                    
                  div
                  div
                    label className=text-[10px] mdtext-xs font-bold text-slate-600픽업 시간  (15분 단위)label
                    TimePickerCustom
                      value={editingOrder.pickup_time}
                      onChange={val = setEditingOrder({...editingOrder, pickup_time val})}
                    
                  div
                div

                div className=grid grid-cols-2 gap-2 mdgap-3 bg-slate-50 p-2.5 rounded-xl border border-slate-200
                  div
                    label className=text-[10px] mdtext-xs font-bold text-slate-600접수 날짜label
                    input
                      type=date
                      value={editingOrder.receipt_date}
                      onChange={e = setEditingOrder({...editingOrder, receipt_date e.target.value})}
                      className=w-full p-2 border rounded-lg mt-1 bg-white border-slate-200
                    
                  div
                  div
                    label className=text-[10px] mdtext-xs font-bold text-slate-600접수 시간 (15분 단위)label
                    TimePickerCustom
                      value={editingOrder.receipt_time}
                      onChange={val = setEditingOrder({...editingOrder, receipt_time val})}
                      bgClass=bg-white
                    
                  div
                div

                div
                  label className=text-[10px] mdtext-xs font-bold text-slate-600결제 방식 label
                  select
                    value={editingOrder.payment_method}
                    onChange={e = setEditingOrder({...editingOrder, payment_method e.target.value})}
                    className=w-full p-2 mdp-2.5 border rounded-xl mt-1 bg-slate-50 border-slate-200
                  
                    {PAYMENT_OPTIONS.map(pm = option key={pm} value={pm}{pm}option)}
                  select
                div

                div
                  label className=text-[10px] mdtext-xs font-bold text-slate-600요구사항  메모label
                  textarea
                    value={editingOrder.memo}
                    onChange={e = setEditingOrder({...editingOrder, memo e.target.value})}
                    className=w-full p-2 mdp-2.5 border rounded-xl mt-1 bg-slate-50 border-slate-200
                    rows={2}
                  
                div

                div className=flex justify-end gap-2 pt-3 border-t
                  button
                    type=button
                    onClick={() = setEditingOrder(null)}
                    className=px-4 py-2 border rounded-xl font-semibold text-slate-600 hoverbg-slate-100 cursor-pointer
                  
                    취소
                  button
                  button
                    type=submit
                    className=px-5 py-2 bg-rose-500 text-black font-extrabold rounded-xl shadow-md hoverbg-rose-600 cursor-pointer
                  
                    저장하기
                  button
                div
              form
            div
          div
        )}
      main
    div
  );
}
