import React, { useState, useEffect } from 'react';

export default function App() {
  // 3. PC 메뉴 - 콤보박스 선택 상태
  const [selectedMenu, setSelectedMenu] = useState('new-order');

  // 2. 모바일/클라이언트 비밀번호 상태 관리
  const [appPassword, setAppPassword] = useState('1234');
  const [isLocked, setIsLocked] = useState(false);

  // 폼 입력 데이터 상태
  const [formData, setFormData] = useState({
    customerName: '',
    phone: '010-',
    productType: '꽃다발',
    price: '55', // 천원 단위 (55 = 55,000원)
    pickupDate: '2026-08-15',
    pickupAmpm: '오후',
    pickupHour: '02',
    pickupMinute: '00',
    receiptDate: '2026-08-15',
    receiptTime: '오후 07:04',
    paymentMethod: '신용카드',
    memo: ''
  });

  // 2. 비밀번호 실시간 동기화 (앱 재설치 없이 로컬 스토리지로 반영)
  useEffect(() => {
    const savedPw = localStorage.getItem('app_password');
    if (savedPw) {
      setAppPassword(savedPw);
    }

    // 다른 탭이나 모바일 웹뷰 간 실시간 비번 동기화
    const handleStorageChange = (e) => {
      if (e.key === 'app_password' && e.newValue) {
        setAppPassword(e.newValue);
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // 입력값 변경 핸들러
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // 저장 버튼 클릭 시
  const handleSubmit = (e) => {
    e.preventDefault();
    alert(`신규 주문이 성공적으로 저장되었습니다!\n고객명: ${formData.customerName}\n결제금액: ${Number(formData.price || 0) * 1000}원`);
  };

  // 계산된 금액 (천원 단위 -> 원화 표시)
  const formattedPrice = (Number(formData.price || 0) * 1000).toLocaleString();

  return (
    <div className="min-h-screen bg-gray-100 font-sans text-gray-800 flex flex-col">
      {/* ------------------------------------------------------------- */}
      {/* 3. PC 상단 콤보박스 메뉴 바 & 4. 독립된 잠금 버튼 */}
      {/* ------------------------------------------------------------- */}
      <header className="bg-white border-b border-gray-200 px-6 py-3.5 flex items-center justify-between shadow-sm sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <label htmlFor="menu-select" className="font-bold text-gray-700 text-sm md:text-base flex items-center gap-1">
            <span>📌</span> 메뉴 선택 :
          </label>
          
          {/* 3. 콤보박스(Select) 형식 메뉴 */}
          <select
            id="menu-select"
            value={selectedMenu}
            onChange={(e) => setSelectedMenu(e.target.value)}
            className="border-2 border-pink-400 bg-pink-50 rounded-lg px-4 py-2 font-bold text-gray-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-pink-500 cursor-pointer text-sm md:text-base"
          >
            <option value="new-order">📝 신규주문</option>
            <option value="orders">📅 주문/달력</option>
            <option value="customers">🎂 고객</option>
            <option value="notice">🔔 알림</option>
            <option value="backup">💾 백업/복원</option>
          </select>
        </div>

        {/* 4. 잠금 버튼 (기본 메뉴와 확실히 분리된 우측 상단/하단 배치) */}
        <button
          onClick={() => {
            setIsLocked(!isLocked);
            alert(isLocked ? '잠금이 해제되었습니다.' : '앱이 잠겼습니다.');
          }}
          className="flex items-center gap-1.5 bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold px-4 py-2 rounded-lg border border-gray-300 transition-colors shadow-sm text-sm"
        >
          <span>🔒</span>
          <span>{isLocked ? '잠금 해제' : '잠금'}</span>
        </button>
      </header>

      {/* ------------------------------------------------------------- */}
      {/* 메인 콘텐츠 영역 */}
      {/* ------------------------------------------------------------- */}
      <main className="flex-1 p-4 md:p-8 flex justify-center items-start">
        {selectedMenu === 'new-order' && (
          <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6 md:p-8 w-full max-w-3xl">
            {/* 타이틀 */}
            <h1 className="text-xl md:text-2xl font-bold text-gray-800 mb-6 flex items-center gap-2 border-b pb-4">
              <span>📝</span> 신규 주문 및 고객 등록
            </h1>

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* 고객 성명 & 휴대폰 번호 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs md:text-sm font-bold text-gray-700 mb-1">
                    고객 성명 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="customerName"
                    value={formData.customerName}
                    onChange={handleChange}
                    placeholder="홍길동 (입력시 동명이인 목록 표시)"
                    className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-pink-400 focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs md:text-sm font-bold text-gray-700 mb-1">
                    휴대폰 번호 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    placeholder="010-"
                    className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-pink-400 focus:outline-none"
                    required
                  />
                </div>
              </div>

              {/* 상품종류 & 결제 금액 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs md:text-sm font-bold text-gray-700 mb-1">
                    상품종류 <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="productType"
                    value={formData.productType}
                    onChange={handleChange}
                    className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-pink-400 focus:outline-none bg-white"
                  >
                    <option value="꽃다발">꽃다발</option>
                    <option value="꽃바구니">꽃바구니</option>
                    <option value="화분">화분</option>
                    <option value="기타">기타</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs md:text-sm font-bold text-gray-700 mb-1">
                    결제 금액 (천원 단위)
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      name="price"
                      value={formData.price}
                      onChange={handleChange}
                      placeholder="55"
                      className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-pink-400 focus:outline-none"
                    />
                    <span className="text-sm font-bold text-gray-600 shrink-0">
                      = {formattedPrice}원
                    </span>
                  </div>
                </div>
              </div>

              {/* 픽업 날짜 & 픽업 시간 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs md:text-sm font-bold text-gray-700 mb-1">
                    픽업 날짜 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    name="pickupDate"
                    value={formData.pickupDate}
                    onChange={handleChange}
                    className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-pink-400 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs md:text-sm font-bold text-gray-700 mb-1">
                    픽업 시간 * (15분 단위)
                  </label>
                  <div className="flex items-center gap-2">
                    <select
                      name="pickupAmpm"
                      value={formData.pickupAmpm}
                      onChange={handleChange}
                      className="border border-gray-300 rounded-lg p-2.5 text-sm bg-white focus:ring-2 focus:ring-pink-400 focus:outline-none"
                    >
                      <option value="오전">오전</option>
                      <option value="오후">오후</option>
                    </select>
                    <select
                      name="pickupHour"
                      value={formData.pickupHour}
                      onChange={handleChange}
                      className="border border-gray-300 rounded-lg p-2.5 text-sm bg-white focus:ring-2 focus:ring-pink-400 focus:outline-none"
                    >
                      {['01','02','03','04','05','06','07','08','09','10','11','12'].map((h) => (
                        <option key={h} value={h}>{h}시</option>
                      ))}
                    </select>
                    <span className="font-bold">:</span>
                    <select
                      name="pickupMinute"
                      value={formData.pickupMinute}
                      onChange={handleChange}
                      className="border border-gray-300 rounded-lg p-2.5 text-sm bg-white focus:ring-2 focus:ring-pink-400 focus:outline-none"
                    >
                      {['00','15','30','45'].map((m) => (
                        <option key={m} value={m}>{m}분</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* 접수 날짜 & 접수 시간 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs md:text-sm font-bold text-gray-700 mb-1">
                    접수 날짜 (현재 시각)
                  </label>
                  <input
                    type="date"
                    name="receiptDate"
                    value={formData.receiptDate}
                    onChange={handleChange}
                    className="w-full border border-gray-300 rounded-lg p-2.5 text-sm bg-gray-50 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs md:text-sm font-bold text-gray-700 mb-1">
                    접수 시간 (실시간 HH:mm)
                  </label>
                  <input
                    type="text"
                    name="receiptTime"
                    value={formData.receiptTime}
                    onChange={handleChange}
                    className="w-full border border-gray-300 rounded-lg p-2.5 text-sm bg-gray-50 focus:outline-none"
                  />
                </div>
              </div>

              {/* 결제 방식 */}
              <div>
                <label className="block text-xs md:text-sm font-bold text-gray-700 mb-1">
                  결제 방식 <span className="text-red-500">*</span>
                </label>
                <select
                  name="paymentMethod"
                  value={formData.paymentMethod}
                  onChange={handleChange}
                  className="w-full border border-gray-300 rounded-lg p-2.5 text-sm bg-white focus:ring-2 focus:ring-pink-400 focus:outline-none"
                >
                  <option value="신용카드">신용카드</option>
                  <option value="계좌이체">계좌이체</option>
                  <option value="현금">현금</option>
                  <option value="미수금">미수금</option>
                </select>
              </div>

              {/* 메모 */}
              <div>
                <label className="block text-xs md:text-sm font-bold text-gray-700 mb-1">
                  고객 요구사항 / 메모
                </label>
                <textarea
                  name="memo"
                  rows="3"
                  value={formData.memo}
                  onChange={handleChange}
                  placeholder="요청사항이나 특이사항을 적어주세요."
                  className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-pink-400 focus:outline-none"
                ></textarea>
              </div>

              {/* ------------------------------------------------------------- */}
              {/* 1. 하단 신규주문 저장하기 버튼 색상 및 글씨 시인성 개선 */}
              {/* ------------------------------------------------------------- */}
              <div className="pt-6 border-t flex justify-end">
                <button
                  type="submit"
                  className="w-full sm:w-auto bg-pink-600 hover:bg-pink-700 active:bg-pink-800 text-white font-bold text-base md:text-lg px-8 py-3.5 rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>💾</span>
                  <span>신규주문 저장하기</span>
                </button>
              </div>
            </form>
          </div>
        )}

        {selectedMenu !== 'new-order' && (
          <div className="bg-white rounded-2xl shadow p-8 text-center text-gray-500 w-full max-w-xl">
            선택하신 [<span className="font-bold text-pink-600">{selectedMenu}</span>] 메뉴 화면입니다.
          </div>
        )}
      </main>
    </div>
  );
}
