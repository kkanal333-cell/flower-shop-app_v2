import React, { useState, useEffect } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import { getKoreaNowFormatted } from './shared.js';

function StatsTab({ orders, purchases }) {
  const todayStr = getKoreaNowFormatted().date;
  const [selectedDate, setSelectedDate] = useState(todayStr);
  // 새로고침 시에도 이전 탭 상태 유지
  const [trendGranularity, setTrendGranularity] = useState(() => {
    return localStorage.getItem('stats_trend_granularity') || 'daily';
  }); // daily | weekly | monthly | yearly
  const [trendOffset, setTrendOffset] = useState(0); // 0=현재 구간, 1=한 구간 전, ... (‹ › 화살표로 이동)
  const [period, setPeriod] = useState(() => {
    return localStorage.getItem('stats_period') || 'today';
  }); // today | week | month | year

  useEffect(() => {
    localStorage.setItem('stats_trend_granularity', trendGranularity);
  }, [trendGranularity]);

  useEffect(() => {
    localStorage.setItem('stats_period', period);
  }, [period]);

  const nowDate = getKoreaNowFormatted().kstDateObj;
  const dayOfWeek = nowDate.getDay();
  const sunday = new Date(nowDate);
  sunday.setDate(nowDate.getDate() - dayOfWeek);
  const sundayStr = `${sunday.getFullYear()}-${String(sunday.getMonth() + 1).padStart(2, '0')}-${String(sunday.getDate()).padStart(2, '0')}`;
  const monthStr = todayStr.slice(0, 7);
  const yearStr = todayStr.slice(0, 4);

  const inPeriod = (d) => {
    if (period === 'today') return d === todayStr;
    if (period === 'week') return d >= sundayStr;
    if (period === 'month') return d.slice(0, 7) === monthStr;
    if (period === 'year') return d.slice(0, 4) === yearStr;
    return true;
  };

  // 날짜별 매출 합계 (삭제된 주문 제외)
  const salesByDate = {};
  (orders || []).filter(o => !o.deleted_at).forEach(o => {
    const d = (o.created_at || '').replace(' ', 'T').split('T')[0];
    if (!d) return;
    salesByDate[d] = (salesByDate[d] || 0) + (Number(o.amount) || 0);
  });

  // 날짜별 매입 합계
  const purchByDate = {};
  (purchases || []).forEach(p => {
    if (!p.date) return;
    purchByDate[p.date] = (purchByDate[p.date] || 0) + (Number(p.amount) || 0);
  });

  const allDates = Array.from(new Set([...Object.keys(salesByDate), ...Object.keys(purchByDate)]));

  const periodSales = allDates.filter(inPeriod).reduce((s, d) => s + (salesByDate[d] || 0), 0);
  const periodPurch = allDates.filter(inPeriod).reduce((s, d) => s + (purchByDate[d] || 0), 0);
  const periodProfit = periodSales - periodPurch;

  // 수익 달력 이벤트: 한 날짜에 매출/매입/수익 3줄
  const getProfitCalendarEvents = () => {
    const events = [];
    allDates.forEach(d => {
      const sales = salesByDate[d] || 0;
      const purch = purchByDate[d] || 0;
      const profit = sales - purch;
      if (sales === 0 && purch === 0) return;

      // 매출/매입/수익 항상 1·2·3번 자리를 유지합니다 (해당 항목이 없는 날은 투명한 빈 줄로 채워서 높이를 유지 - 수익 위치가 오르내리지 않도록)
      events.push({
        id: d + '-sales', start: d, allDay: true,
        title: sales > 0 ? sales.toLocaleString() : '\u00A0',
        backgroundColor: sales > 0 ? '#fbe7e8' : 'transparent',
        textColor: '#be123c',
        borderColor: 'transparent',
        extendedProps: { order: 1 }
      });
      events.push({
        id: d + '-purch', start: d, allDay: true,
        title: purch > 0 ? purch.toLocaleString() : '\u00A0',
        backgroundColor: purch > 0 ? '#e0f2fe' : 'transparent',
        textColor: '#0369a1',
        borderColor: 'transparent',
        extendedProps: { order: 2 }
      });
      events.push({
        id: d + '-profit', start: d, allDay: true, title: (profit >= 0 ? '+' : '') + profit.toLocaleString(),
        backgroundColor: '#dcfce7', // 수익 박스는 +/- 상관없이 항상 연두톤 배경
        textColor: profit >= 0 ? '#15803d' : '#b91c1c', // 숫자 색만 +면 초록, -면 빨강
        borderColor: 'transparent',
        extendedProps: { order: 3 }
      });
    });
    return events;
  };

  const selectedSales = salesByDate[selectedDate] || 0;
  const selectedPurch = purchByDate[selectedDate] || 0;
  const selectedProfit = selectedSales - selectedPurch;

  // 수익 추이 (일/주/월/년, 화살표로 이전/다음 구간 이동 가능)
  const pad = n => String(n).padStart(2, '0');
  const fmtDate = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  const trendRefDate = new Date(nowDate);
  if (trendGranularity === 'daily') trendRefDate.setDate(nowDate.getDate() - trendOffset * 7);
  else if (trendGranularity === 'weekly') trendRefDate.setDate(nowDate.getDate() - trendOffset * 49);
  else if (trendGranularity === 'monthly') trendRefDate.setMonth(nowDate.getMonth() - trendOffset * 12);
  else if (trendGranularity === 'yearly') trendRefDate.setFullYear(nowDate.getFullYear() - trendOffset * 5);

  let trendPoints = [];
  if (trendGranularity === 'daily') {
    for (let i = 6; i >= 0; i--) {
      const dt = new Date(trendRefDate);
      dt.setDate(trendRefDate.getDate() - i);
      const dStr = fmtDate(dt);
      const profit = (salesByDate[dStr] || 0) - (purchByDate[dStr] || 0);
      trendPoints.push({ key: dStr, label: `${pad(dt.getMonth() + 1)}/${pad(dt.getDate())}`, amt: profit });
    }
  } else if (trendGranularity === 'weekly') {
    const thisSunday = new Date(trendRefDate);
    thisSunday.setDate(trendRefDate.getDate() - trendRefDate.getDay());
    for (let i = 6; i >= 0; i--) {
      const start = new Date(thisSunday);
      start.setDate(thisSunday.getDate() - i * 7);
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      const startStr = fmtDate(start);
      const endStr = fmtDate(end);
      let sum = 0;
      allDates.forEach(d => { if (d >= startStr && d <= endStr) sum += (salesByDate[d] || 0) - (purchByDate[d] || 0); });
      trendPoints.push({ key: startStr, label: `${pad(start.getMonth() + 1)}/${pad(start.getDate())}`, amt: sum });
    }
  } else if (trendGranularity === 'monthly') {
    for (let i = 11; i >= 0; i--) {
      const dt = new Date(trendRefDate.getFullYear(), trendRefDate.getMonth() - i, 1);
      const ymStr = `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}`;
      let sum = 0;
      allDates.forEach(d => { if (d.slice(0, 7) === ymStr) sum += (salesByDate[d] || 0) - (purchByDate[d] || 0); });
      trendPoints.push({ key: ymStr, label: `${String(dt.getFullYear()).slice(2)}/${pad(dt.getMonth() + 1)}`, amt: sum });
    }
  } else if (trendGranularity === 'yearly') {
    for (let i = 4; i >= 0; i--) {
      const y = trendRefDate.getFullYear() - i;
      let sum = 0;
      allDates.forEach(d => { if (d.slice(0, 4) === String(y)) sum += (salesByDate[d] || 0) - (purchByDate[d] || 0); });
      trendPoints.push({ key: String(y), label: `${y}`, amt: sum });
    }
  }
  const trendMaxAbs = trendPoints.reduce((m, p) => Math.max(m, Math.abs(p.amt)), 0) || 1;

  return (
    <div className="space-y-4">
      {/* 수익 통계 타이틀 */}
      <div className="bg-white p-4 md:p-6 rounded-2xl border border-slate-200 shadow-sm">
        <h2 className="text-base md:text-xl font-bold text-slate-900 flex items-center gap-2">
          <span>📈</span> 수익 통계
        </h2>

        <div className="flex gap-1.5 mb-4 mt-3 flex-wrap">
          {[
            { id: 'today', label: '오늘' },
            { id: 'week', label: '이번주' },
            { id: 'month', label: '이번달' },
            { id: 'year', label: '이번해' },
          ].map(p => (
            <button
              key={p.id}
              onClick={() => setPeriod(p.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer border-2 ${
                period === p.id ? 'bg-emerald-100 border-emerald-400 shadow-sm' : 'bg-white border-transparent hover:bg-slate-100'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="flex gap-2 flex-wrap">
          <div className="p-4 rounded-xl inline-block" style={{ backgroundColor: '#fbe7e8', border: '1px solid #f4b8bd' }}>
            <div className="text-[11px] font-bold" style={{ color: '#be123c' }}>총매출</div>
            <div className="text-lg md:text-2xl font-extrabold mt-1" style={{ color: '#be123c' }}>{periodSales.toLocaleString()}원</div>
          </div>
          <div className="p-4 rounded-xl inline-block" style={{ backgroundColor: '#e0f2fe', border: '1px solid #93c5fd' }}>
            <div className="text-[11px] font-bold" style={{ color: '#0369a1' }}>총매입</div>
            <div className="text-lg md:text-2xl font-extrabold mt-1" style={{ color: '#0369a1' }}>{periodPurch.toLocaleString()}원</div>
          </div>
          <div className="p-4 rounded-xl inline-block" style={{ backgroundColor: periodProfit >= 0 ? '#dcfce7' : '#fee2e2', border: periodProfit >= 0 ? '1px solid #86efac' : '1px solid #fca5a5' }}>
            <div className="text-[11px] font-bold" style={{ color: periodProfit >= 0 ? '#15803d' : '#b91c1c' }}>총수익</div>
            <div className="text-lg md:text-2xl font-extrabold mt-1" style={{ color: periodProfit >= 0 ? '#15803d' : '#b91c1c' }}>
              {periodProfit >= 0 ? '+' : ''}{periodProfit.toLocaleString()}원
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 mt-4 text-[11px] text-slate-500">
          <span className="inline-flex items-center gap-1"><span className="w-3 h-3 rounded" style={{ backgroundColor: '#fbe7e8' }}></span> 매출</span>
          <span className="inline-flex items-center gap-1"><span className="w-3 h-3 rounded" style={{ backgroundColor: '#e0f2fe' }}></span> 매입</span>
          <span className="inline-flex items-center gap-1"><span className="w-3 h-3 rounded" style={{ backgroundColor: '#dcfce7' }}></span> 수익</span>
        </div>
      </div>

      {/* 수익 달력 */}
      <div className="bg-white p-4 md:p-6 rounded-2xl border border-slate-200 shadow-sm">
        <h3 className="text-sm md:text-base font-bold text-slate-900 mb-3">🗓️ 수익 달력</h3>
        <div className="calendar-compact">
          <FullCalendar
            key={selectedDate}
            plugins={[dayGridPlugin, interactionPlugin]}
            initialView="dayGridMonth"
            initialDate={selectedDate}
            locale="ko"
            aspectRatio={1.5}
            fixedWeekCount={false}
            dayMaxEventRows={4}
            contentHeight="auto"
            events={getProfitCalendarEvents()}
            eventOrder="extendedProps.order"
            eventContent={(arg) => (
              <span style={{ fontSize: '9px', fontWeight: 700, color: arg.event.textColor }}>{arg.event.title}</span>
            )}
            dayCellDidMount={(arg) => {
              const cellDateStr = `${arg.date.getFullYear()}-${String(arg.date.getMonth() + 1).padStart(2, '0')}-${String(arg.date.getDate()).padStart(2, '0')}`;
              if (cellDateStr === selectedDate) {
                arg.el.style.backgroundColor = '#fef08a';
              }
            }}
            dateClick={(info) => setSelectedDate(info.dateStr)}
            eventClick={(info) => setSelectedDate(info.event.startStr)}
          />
        </div>
      </div>

      {/* 날짜별 수익 */}
      <div className="bg-white p-4 md:p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
          <h3 className="text-sm md:text-base font-bold text-slate-900">📆 날짜별 수익</h3>
          <input
            type="date"
            value={selectedDate}
            onChange={e => setSelectedDate(e.target.value)}
            className="p-1.5 border border-slate-300 rounded-lg text-xs bg-white text-slate-900"
          />
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div className="p-3 rounded-xl text-center" style={{ backgroundColor: '#fbe7e8', border: '1px solid #f4b8bd' }}>
            <div className="text-[11px] font-bold" style={{ color: '#be123c' }}>매출</div>
            <div className="text-sm md:text-lg font-extrabold mt-1" style={{ color: '#be123c' }}>{selectedSales.toLocaleString()}원</div>
          </div>
          <div className="p-3 rounded-xl text-center" style={{ backgroundColor: '#e0f2fe', border: '1px solid #93c5fd' }}>
            <div className="text-[11px] font-bold" style={{ color: '#0369a1' }}>매입</div>
            <div className="text-sm md:text-lg font-extrabold mt-1" style={{ color: '#0369a1' }}>{selectedPurch.toLocaleString()}원</div>
          </div>
          <div className="p-3 rounded-xl text-center" style={{ backgroundColor: selectedProfit >= 0 ? '#dcfce7' : '#fee2e2', border: selectedProfit >= 0 ? '1px solid #86efac' : '1px solid #fca5a5' }}>
            <div className="text-[11px] font-bold" style={{ color: selectedProfit >= 0 ? '#15803d' : '#b91c1c' }}>수익</div>
            <div className="text-sm md:text-lg font-extrabold mt-1" style={{ color: selectedProfit >= 0 ? '#15803d' : '#b91c1c' }}>
              {selectedProfit >= 0 ? '+' : ''}{selectedProfit.toLocaleString()}원
            </div>
          </div>
        </div>
      </div>

      {/* 수익 추이 */}
      <div className="bg-white p-4 md:p-6 rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
          <h3 className="text-sm md:text-base font-bold text-slate-900">📊 수익 추이</h3>
          <div className="flex gap-1 flex-wrap items-center">
            <button
              onClick={() => setTrendOffset(o => o + 1)}
              className="w-6 h-6 flex items-center justify-center rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold cursor-pointer"
              aria-label="이전 구간"
            >
              ‹
            </button>
            <button
              onClick={() => setTrendOffset(o => Math.max(0, o - 1))}
              disabled={trendOffset === 0}
              className={`w-6 h-6 flex items-center justify-center rounded-lg border text-xs font-bold ${
                trendOffset === 0
                  ? 'border-slate-200 bg-slate-50 text-slate-300 cursor-not-allowed'
                  : 'border-slate-300 bg-white hover:bg-slate-100 text-slate-700 cursor-pointer'
              }`}
              aria-label="다음 구간"
            >
              ›
            </button>
            {[
              { id: 'daily', label: '일간' },
              { id: 'weekly', label: '주간' },
              { id: 'monthly', label: '월간' },
              { id: 'yearly', label: '년간' },
            ].map(g => (
              <button
                key={g.id}
                onClick={() => { setTrendGranularity(g.id); setTrendOffset(0); }}
                className={`px-2.5 py-1 rounded-lg text-[11px] md:text-xs font-bold cursor-pointer border-2 whitespace-nowrap ${
                  trendGranularity === g.id ? 'bg-emerald-100 border-emerald-400 shadow-sm' : 'bg-white border-transparent hover:bg-slate-100'
                }`}
              >
                {g.label}
              </button>
            ))}
          </div>
        </div>

        {trendPoints.every(p => p.amt === 0) ? (
          <p className="text-xs text-slate-400 text-center py-6">표시할 데이터가 없습니다.</p>
        ) : (
          <div style={{ width: '100%' }}>
            <div style={{ display: 'flex', gap: '4px', width: '100%', height: '150px' }}>
              {trendPoints.map(p => {
                const barPx = Math.max(2, Math.round((Math.abs(p.amt) / trendMaxAbs) * 65));
                const isPos = p.amt >= 0;
                return (
                  <div
                    key={p.key}
                    style={{ flex: '1 1 0%', minWidth: 0, display: 'flex', flexDirection: 'column', height: '100%' }}
                  >
                    {/* 위쪽 절반: 양수 막대가 아래(0선)에서 위로 자람 */}
                    <div style={{ height: '75px', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center' }}>
                      {isPos && p.amt !== 0 && (
                        <div style={{ fontSize: '9px', color: '#15803d', fontWeight: 'bold', marginBottom: '2px', whiteSpace: 'nowrap' }}>
                          +{p.amt.toLocaleString()}
                        </div>
                      )}
                      {isPos && (
                        <div style={{ width: '66%', height: `${barPx}px`, backgroundColor: '#4ade80', borderRadius: '3px 3px 0 0' }} />
                      )}
                    </div>
                    {/* 0선 */}
                    <div style={{ height: '1px', backgroundColor: '#cbd5e1', width: '100%' }} />
                    {/* 아래쪽 절반: 음수 막대가 위(0선)에서 아래로 자람 */}
                    <div style={{ height: '75px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      {!isPos && (
                        <div style={{ width: '66%', height: `${barPx}px`, backgroundColor: '#f87171', borderRadius: '0 0 3px 3px' }} />
                      )}
                      {!isPos && (
                        <div style={{ fontSize: '9px', color: '#b91c1c', fontWeight: 'bold', marginTop: '2px', whiteSpace: 'nowrap' }}>
                          {p.amt.toLocaleString()}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={{ display: 'flex', gap: '4px', width: '100%', marginTop: '4px' }}>
              {trendPoints.map(p => {
                const [labelTop, labelBottom] = trendGranularity === 'monthly' ? p.label.split('/') : [null, null];
                return (
                  <div key={p.key} style={{ flex: '1 1 0%', minWidth: 0, textAlign: 'center' }}>
                    {trendGranularity === 'monthly' ? (
                      <div style={{ fontSize: '9px', color: '#94a3b8', lineHeight: '1.2' }}>
                        <div>{labelTop}</div>
                        <div>{labelBottom}</div>
                      </div>
                    ) : (
                      <div style={{ fontSize: '9px', color: '#94a3b8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {p.label}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default StatsTab;
