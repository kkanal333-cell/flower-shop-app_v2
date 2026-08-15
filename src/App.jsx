import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';

// Supabase 연동
const SUPABASE_URL = 'https://zthuqzzholyjolteuvty.supabase.co';
const SUPABASE_KEY = 'sb_publishable_xkg9ULmNiKrCcESytGbmw_u1Z12_gG';
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
    h += 1;
  }

  const ampm = h >= 12 ? "오후" : "오전";
  let displayHour = h % 12;
  if (displayHour === 0) displayHour = 12;

  return {
    ampm,
    hour: String(displayHour).padStart(2, '0'),
    minute: String(m).padStart(2, '0')
  };
};

const formatPartsToTime = (ampm, hour, minute) => {
  let h = parseInt(hour, 10);
  if (ampm === "오후" && h < 12) h += 12;
  if (ampm === "오전" && h === 12) h = 0;
  return `${String(h).padStart(2, '0')}:${minute}`;
};

// 현재 실시간 시간을 HH:mm 형식으로 반환 (1분 단위)
const getCurrentTimeString = () => {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
};

export default function App() {
  const [orders, setOrders] = useState([]);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [editingId, setEditingId] = useState(null);

  // 폼 상태
  const [customerName, setCustomerName] = useState('');
  const [phone, setPhone] = useState('010-');
  const [orderDate, setOrderDate] = useState(new Date().toISOString().split('T')[0]);
  const [orderTime, setOrderTime] = useState(getCurrentTimeString());
  const [pickupDate, setPickupDate] = useState(new Date().toISOString().split('T')[0]);
  
  // 픽업시간 (15분 단위)
  const [pickupTimeParts, setPickupTimeParts] = useState({ ampm: '오후', hour: '02', minute: '00' });
  
  const [productType, setProductType] = useState(PRODUCT_OPTIONS[0]);
  const [amountInThousands, setAmountInThousands] = useState(''); // 천원 단위 입력용 상태
  const [paymentMethod, setPaymentMethod] = useState(PAYMENT_OPTIONS[0]);
  const [requestDetails, setRequestDetails] = useState('');

  // 1분마다 현재 실시간 접수시간 업데이트 (새 주문 등록 모드일 때만)
  useEffect(() => {
    if (!editingId) {
      const timer = setInterval(() => {
        setOrderTime(getCurrentTimeString());
      }, 60000);
      return () => clearInterval(timer);
    }
  }, [editingId]);

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    const { data, error } = await supabase.from('orders').select('*').order('created_at', { ascending: false });
    if (error) console.error('Error fetching orders:', error);
    else setOrders(data || []);
  };

  const handleSaveOrder = async (e) => {
    e.preventDefault();
    if (!customerName.trim()) {
      alert('고객 성명을 입력해주세요.');
      return;
    }

    // 천원 단위 입력값을 실제 금액(원)으로 변환
    const actualAmount = (parseInt(amountInThousands, 10) || 0) * 1000;
    const pickupTimeStr = formatPartsToTime(pickupTimeParts.ampm, pickupTimeParts.hour, pickupTimeParts.minute);

    const orderData = {
      customer_name: customerName,
      phone,
      order_date: orderDate,
      order_time: orderTime,
      pickup_date: pickupDate,
      pickup_time: pickupTimeStr,
      product_type: productType,
      amount: actualAmount,
      payment_method: paymentMethod,
      request_details: requestDetails,
    };

    if (editingId) {
      const { error } = await supabase.from('orders').update(orderData).eq('id', editingId);
      if (error) alert('수정 중 오류가 발생했습니다.');
      else {
        alert('주문이 수정되었습니다.');
        resetForm();
        fetchOrders();
      }
    } else {
      const { error } = await supabase.from('orders').insert([orderData]);
      if (error) alert('저장 중 오류가 발생했습니다.');
      else {
        alert('주문이 저장되었습니다.');
        resetForm();
        fetchOrders();
      }
    }
  };

  const handleEdit = (order) => {
    setEditingId(order.id);
    setCustomerName(order.customer_name || '');
    setPhone(order.phone || '010-');
    setOrderDate(order.order_date || new Date().toISOString().split('T')[0]);
    setOrderTime(order.order_time || getCurrentTimeString());
    setPickupDate(order.pickup_date || new Date().toISOString().split('T')[0]);
    setPickupTimeParts(parseTimeToParts(order.pickup_time));
    setProductType(order.product_type || PRODUCT_OPTIONS[0]);
    
    // 실제 원 금액을 천원 단위로 변환하여 폼에 세팅
    setAmountInThousands(order.amount ? String(Math.floor(order.amount / 1000)) : '');
    
    setPaymentMethod(order.payment_method || PAYMENT_OPTIONS[0]);
    setRequestDetails(order.request_details || '');
  };

  const handleDelete = async (id) => {
    if (window.confirm('정말 삭제하시겠습니까?')) {
      const { error } = await supabase.from('orders').delete().eq('id', id);
      if (error) alert('삭제 중 오류가 발생했습니다.');
      else {
        alert('삭제되었습니다.');
        fetchOrders();
      }
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setCustomerName('');
    setPhone('010-');
    setOrderDate(new Date().toISOString().split('T')[0]);
    setOrderTime(getCurrentTimeString());
    setPickupDate(new Date().toISOString().split('T')[0]);
    setPickupTimeParts({ ampm: '오후', hour: '02', minute: '00' });
    setProductType(PRODUCT_OPTIONS[0]);
    setAmountInThousands('');
    setPaymentMethod(PAYMENT_OPTIONS[0]);
    setRequestDetails('');
  };

  // 계산된 실제 표시용 금액 (원)
  const calculatedRealAmount = (parseInt(amountInThousands, 10) || 0) * 1000;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 p-3 sm:p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* 상단 헤더 */}
        <header className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-slate-100">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-800">화사한하루 - 꽃집 주문/예약 관리</h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">주문 접수 및 픽업 예약을 손쉽게 관리하세요.</p>
          </div>
        </header>

        {/* 메인 콘텐츠 영역 */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* 입력 폼 (모바일 대응) */}
          <div className="lg:col-span-5 bg-white p-4 sm:p-5 rounded-xl shadow-sm border border-slate-100 space-y-4">
            <div className="flex justify-between items-center border-b pb-3 border-slate-100">
              <h2 className="text-base font-semibold text-slate-700">
                {editingId ? '📝 주문 수정하기' : '✨ 새 주문 접수'}
              </h2>
              {editingId && (
                <button
                  onClick={resetForm}
                  className="text-xs bg-slate-100 text-slate-600 px-2.5 py-1 rounded-md hover:bg-slate-200 transition"
                >
                  취소하고 새로 작성
                </button>
              )}
            </div>

            <form onSubmit={handleSaveOrder} className="space-y-3.5">
              
              {/* 고객 성명 */}
              <div>
                <label className="block text-xs text-slate-600 mb-1 font-normal">고객 성명 *</label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="성함을 입력하세요"
                  className="w-full text-sm p-2.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-300 transition"
                />
              </div>

              {/* 연락처 (기본값 010-) */}
              <div>
                <label className="block text-xs text-slate-600 mb-1 font-normal">휴대폰 번호</label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="010-0000-0000"
                  className="w-full text-sm p-2.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-300 transition"
                />
              </div>

              {/* 접수 날짜 & 시간 (박스 제거, 행 스타일 깔끔화) */}
              <div className="grid grid-cols-2 gap-3 py-1">
                <div>
                  <label className="block text-xs text-slate-600 mb-1 font-normal">접수 날짜</label>
                  <input
                    type="date"
                    value={orderDate}
                    readOnly
                    className="w-full text-sm p-2.5 bg-slate-100 border border-slate-200 rounded-lg text-slate-600 focus:outline-none cursor-not-allowed"
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-600 mb-1 font-normal">접수 시간 (실시간)</label>
                  <input
                    type="text"
                    value={orderTime}
                    readOnly
                    className="w-full text-sm p-2.5 bg-slate-100 border border-slate-200 rounded-lg text-slate-600 text-center focus:outline-none cursor-not-allowed"
                  />
                </div>
              </div>

              {/* 픽업 날짜 & 시간 */}
              <div className="grid grid-cols-1 gap-3 pt-1">
                <div>
                  <label className="block text-xs text-slate-600 mb-1 font-normal">픽업 날짜</label>
                  <input
                    type="date"
                    value={pickupDate}
                    onChange={(e) => setPickupDate(e.target.value)}
                    className="w-full text-sm p-2.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-300 transition"
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-600 mb-1 font-normal">픽업 시간 (15분 단위)</label>
                  <div className="flex gap-1.5">
                    <select
                      value={pickupTimeParts.ampm}
                      onChange={(e) => setPickupTimeParts({ ...pickupTimeParts, ampm: e.target.value })}
                      className="text-xs p-2.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-300"
                    >
                      {AMPM_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>

                    <select
                      value={pickupTimeParts.hour}
                      onChange={(e) => setPickupTimeParts({ ...pickupTimeParts, hour: e.target.value })}
                      className="w-full text-xs p-2.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-300"
                    >
                      {HOUR_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>{opt}시</option>
                      ))}
                    </select>

                    <select
                      value={pickupTimeParts.minute}
                      onChange={(e) => setPickupTimeParts({ ...pickupTimeParts, minute: e.target.value })}
                      className="w-full text-xs p-2.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-300"
                    >
                      {MINUTE_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>{opt}분</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* 상품 종류 */}
              <div>
                <label className="block text-xs text-slate-600 mb-1 font-normal">상품 종류</label>
                <select
                  value={productType}
                  onChange={(e) => setProductType(e.target.value)}
                  className="w-full text-sm p-2.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-300 transition"
                >
                  {PRODUCT_OPTIONS.map((item) => (
                    <option key={item} value={item}>{item}</option>
                  ))}
                </select>
              </div>

              {/* 결제 금액 (천원 단위 입력) */}
              <div>
                <label className="block text-xs text-slate-600 mb-1 font-normal">
                  결제 금액 <span className="text-rose-500 font-medium">(천원 단위 입력, 예: 10 입력 ➔ 1만원)</span>
                </label>
                <div className="relative flex items-center">
                  <input
                    type="number"
                    value={amountInThousands}
                    onChange={(e) => setAmountInThousands(e.target.value)}
                    placeholder="숫자만 입력 (예: 35)"
                    className="w-full text-sm p-2.5 pr-16 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-300 transition"
                  />
                  <span className="absolute right-3 text-xs text-slate-400">천원</span>
                </div>
                {amountInThousands !== '' && (
                  <p className="text-xs text-rose-600 font-medium mt-1 pl-1">
                    👉 실제 적용 금액: {calculatedRealAmount.toLocaleString()} 원
                  </p>
                )}
              </div>

              {/* 결제 수단 */}
              <div>
                <label className="block text-xs text-slate-600 mb-1 font-normal">결제 수단</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full text-sm p-2.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-300 transition"
                >
                  {PAYMENT_OPTIONS.map((item) => (
                    <option key={item} value={item}>{item}</option>
                  ))}
                </select>
              </div>

              {/* 요청 사항 */}
              <div>
                <label className="block text-xs text-slate-600 mb-1 font-normal">요청 사항</label>
                <textarea
                  rows="2"
                  value={requestDetails}
                  onChange={(e) => setRequestDetails(e.target.value)}
                  placeholder="특이사항이나 요청문구를 작성하세요"
                  className="w-full text-sm p-2.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-300 transition resize-none"
                ></textarea>
              </div>

              {/* 저장 버튼 (파스텔 로즈/핑크 톤) */}
              <button
                type="submit"
                className="w-full py-3 bg-rose-400 hover:bg-rose-500 active:bg-rose-600 text-white font-medium text-sm rounded-lg shadow-sm transition duration-150 ease-in-out"
              >
                {editingId ? '주문 수정 완료하기' : '주문 저장하기'}
              </button>

            </form>
          </div>

          {/* 우측: 캘린더 및 리스트 영역 */}
          <div className="lg:col-span-7 space-y-6">
            
            {/* 달력 */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100">
              <FullCalendar
                plugins={[dayGridPlugin, interactionPlugin]}
                initialView="dayGridMonth"
                locale="ko"
                headerToolbar={{
                  left: 'prev,next today',
                  center: 'title',
                  right: ''
                }}
                dateClick={(info) => setSelectedDate(info.dateStr)}
                height="auto"
              />
            </div>

            {/* 주문 목록 */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 space-y-3">
              <div className="flex justify-between items-center border-b pb-2.5 border-slate-100">
                <h3 className="text-sm font-semibold text-slate-700">
                  📋 전체 주문 목록 ({orders.length}건)
                </h3>
              </div>

              {orders.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-6">등록된 주문이 없습니다.</p>
              ) : (
                <div className="space-y-2.5 max-h-[400px] overflow-y-auto pr-1">
                  {orders.map((item) => (
                    <div
                      key={item.id}
                      className="p-3 bg-slate-50 border border-slate-200/80 rounded-lg flex justify-between items-center text-xs hover:border-rose-200 transition"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-800 text-sm">{item.customer_name}</span>
                          <span className="text-slate-500">({item.phone || '연락처 없음'})</span>
                          <span className="bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded text-[10px]">
                            {item.product_type}
                          </span>
                        </div>
                        <div className="text-slate-600">
                          <span>픽업: {item.pickup_date} {item.pickup_time}</span>
                          <span className="mx-1.5 text-slate-300">|</span>
                          <span>결제: {item.payment_method} ({(item.amount || 0).toLocaleString()}원)</span>
                        </div>
                        {item.request_details && (
                          <p className="text-slate-500 bg-white p-1.5 rounded border border-slate-100 mt-1">
                            요청: {item.request_details}
                          </p>
                        )}
                      </div>

                      <div className="flex gap-1.5 shrink-0 ml-2">
                        <button
                          onClick={() => handleEdit(item)}
                          className="px-2 py-1 bg-white border border-slate-200 text-slate-600 rounded hover:bg-slate-100"
                        >
                          수정
                        </button>
                        <button
                          onClick={() => handleDelete(item.id)}
                          className="px-2 py-1 bg-white border border-rose-200 text-rose-600 rounded hover:bg-rose-50"
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

        </div>

      </div>
    </div>
  );
}
