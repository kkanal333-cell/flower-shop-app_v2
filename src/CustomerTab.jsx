import React from 'react';

export default function CustomerTab({
  filteredCustomers,
  selectedCustomerIds,
  handleDeleteSelectedCustomers,
  customerSearch,
  handleCustomerSearchChange,
  customerNameSort,
  setCustomerNameSort,
  handleToggleSelectAllCustomers,
  getCustomerOrderCount,
  getCustomerNameColor,
  setCustomerHistoryModal,
  getCustomerPickupDate,
  startEditCustomer,
  handleToggleSelectCustomer,
}) {
  return (
    <div className="bg-white p-3 md:p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-base md:text-xl font-bold text-slate-900 flex items-center gap-2">
          <span>🎂</span> 고객 목록 (총 <span className="text-rose-600">{filteredCustomers.length}</span>명)
        </h2>

        <button
          onClick={handleDeleteSelectedCustomers}
          disabled={selectedCustomerIds.length === 0}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold border-2 transition-all ${
            selectedCustomerIds.length > 0
              ? 'bg-white hover:bg-rose-50 text-slate-900 border-rose-600 cursor-pointer shadow-xs font-extrabold'
              : 'bg-slate-50 text-slate-300 border-slate-200 cursor-not-allowed opacity-60'
          }`}
        >
          🗑️ 선택 고객 ({selectedCustomerIds.length}명) 삭제
        </button>
      </div>

      <div className="flex items-center gap-2">
        <input
          type="text"
          value={customerSearch}
          onChange={e => handleCustomerSearchChange(e.target.value)}
          placeholder="🔍 고객 이름·전화번호·고객정보 검색"
          className="flex-1 min-w-0 p-2.5 md:p-3 border border-slate-300 rounded-xl text-xs md:text-sm bg-white text-slate-900 focus:outline-none focus:border-rose-500"
        />
        <div className="flex items-center gap-1 shrink-0" title="주문 횟수별 색상: 1회=검정, 2회=그린, 3회=블루, 4회 이상=퍼플">
          <span style={{ width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '4px', fontSize: '9px', fontWeight: 'bold', color: '#fff', backgroundColor: '#0f172a' }}>1</span>
          <span style={{ width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '4px', fontSize: '9px', fontWeight: 'bold', color: '#fff', backgroundColor: '#047857' }}>2</span>
          <span style={{ width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '4px', fontSize: '9px', fontWeight: 'bold', color: '#fff', backgroundColor: '#1d4ed8' }}>3</span>
          <span style={{ width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '4px', fontSize: '9px', fontWeight: 'bold', color: '#fff', backgroundColor: '#7e22ce' }}>4~</span>
        </div>
      </div>

      <div className="overflow-x-auto border border-slate-200 rounded-xl">
        <table className="w-full text-left border-collapse whitespace-nowrap">
          <thead>
            <tr className="border-b border-slate-200 text-slate-700 text-xs md:text-sm bg-slate-100 font-bold">
              <th className="py-2.5 px-3 w-16 text-center">No.</th>
              <th
                className="py-2.5 px-3 cursor-pointer select-none"
                onClick={() => setCustomerNameSort(prev => prev === 'asc' ? 'desc' : prev === 'desc' ? null : 'asc')}
                title="클릭하면 이름 가나다순으로 정렬됩니다"
              >
                <span className="inline-flex items-center gap-1">
                  이름
                  <span className={`text-[9px] leading-none ${customerNameSort ? 'text-rose-600' : 'text-slate-400'}`}>
                    {customerNameSort === 'desc' ? '▲' : '▼'}
                  </span>
                </span>
              </th>
              <th className="py-2.5 px-3">연락처</th>
              <th className="py-2.5 px-3">고객정보</th>
              <th className="py-2.5 px-3">최근 픽업일</th>
              <th className="py-2.5 px-3 text-center">관리</th>
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
                <td colSpan={7} className="py-6 text-center text-slate-500 text-xs md:text-sm">
                  검색 결과가 없습니다.
                </td>
              </tr>
            ) : (
              filteredCustomers.map((c, idx) => {
                const orderCount = getCustomerOrderCount(c.id, c.name);
                return (
                  <tr key={c.id} className="border-b border-slate-100 text-xs md:text-sm hover:bg-slate-50">
                    <td className="py-2.5 px-3 text-center text-slate-500 font-bold">{filteredCustomers.length - idx}</td>
                    <td
                      className="py-2.5 px-3 font-bold hover:underline cursor-pointer"
                      style={{ color: getCustomerNameColor(orderCount) }}
                      onClick={() => setCustomerHistoryModal(c)}
                    >
                      {c.name}
                    </td>
                    <td className="py-2.5 px-3 text-slate-700 font-medium">{c.phone || '-'}</td>
                    <td className="py-2.5 px-3 text-slate-600 font-medium max-w-[160px] truncate" title={c.notes || ''}>{c.notes || '-'}</td>
                    <td className="py-2.5 px-3 text-slate-600 font-medium">{getCustomerPickupDate(c.id, c.name)}</td>
                    <td className="py-2.5 px-3 text-center">
                      <button
                        onClick={() => startEditCustomer(c)}
                        className="text-slate-400 hover:text-rose-600 cursor-pointer"
                        title="고객 정보 수정"
                      >
                        ✏️
                      </button>
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <input
                        type="checkbox"
                        checked={selectedCustomerIds.includes(c.id)}
                        onChange={() => handleToggleSelectCustomer(c.id)}
                        className="accent-rose-600 cursor-pointer w-4 h-4"
                      />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
