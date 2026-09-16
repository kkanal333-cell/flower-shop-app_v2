import React, { useState, useEffect } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import { supabase, PURCHASE_PAYMENT_OPTIONS, getKoreaNowFormatted } from './shared.js';

// Supabase에 아래 스키마로 'purchases' 테이블이 필요합니다:
//   id (uuid, pk, default gen_random_uuid())
//   date (date) - 매입 일자
//   payment_method (text) - 입금/현금/신용카드/체크카드
//   vendor (text) - 업체명
//   item_name (text) - 품목
//   quantity (numeric) - 수량
//   unit_price (numeric) - 단가
//   amount (numeric) - 금액 (수량*단가, 앱에서 계산해 저장)
//   created_at (timestamptz, default now())
function PurchaseTab({ purchases, fetchPurchases }) {
  const todayStr = getKoreaNowFormatted().date;

  // 새로고침 시에도 이전 탭 상태 유지
  const [period, setPeriod] = useState(() => {
    return localStorage.getItem('purchase_period') || 'today';
  }); // today | week | month | year
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [trendGranularity, setTrendGranularity] = useState(() => {
    return localStorage.getItem('purchase_trend_granularity') || 'daily';
  }); // daily | weekly | monthly | yearly
  const [trendOffset, setTrendOffset] = useState(0); // 0=현재 구간, 1=한 구간 전, ... (‹ › 화살표로 이동)
  const [saving, setSaving] = useState(false);
  const [editingPurchase, setEditingPurchase] = useState(null); // 매입 수정 팝업 - { id, date, payment_method, vendor, item_name, quantity, unit_price } | null

  useEffect(() => {
    localStorage.setItem('purchase_period', period);
  }, [period]);

  useEffect(() => {
    localStorage.setItem('purchase_trend_granularity', trendGranularity);
  }, [trendGranularity]);

  // 영수증 사진 인식
  const [receiptLoading, setReceiptLoading] = useState(false);
  const [receiptModalOpen, setReceiptModalOpen] = useState(false);
  const [receiptRawText, setReceiptRawText] = useState('');
  const [receiptForm, setReceiptForm] = useState({ date: todayStr, payment_method: '현금', vendor: '', item_name: '', quantity: '1', unit_price: '' });

  // 매입이력 (업체/거래방식/품목 클릭 시 고정 화면에 표시)
  const [historyFilter, setHistoryFilter] = useState(null); // { type: 'vendor'|'payment'|'item', value } | null
  const [historyPeriod, setHistoryPeriod] = useState('month'); // week | month | year | custom
  const [historyCustomStart, setHistoryCustomStart] = useState(todayStr);
  const [historyCustomEnd, setHistoryCustomEnd] = useState(todayStr);

  const [form, setForm] = useState({
    date: todayStr,
    payment_method: '현금',
    vendor: '',
    item_name: '',
    quantity: '',
    unit_price: ''
  });

  const computedAmount = (Number(form.quantity) || 0) * (Number(form.unit_price) || 0);

  const vendorList = [...new Set((purchases || []).map(p => p.vendor).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ko'));
  const itemNameList = [...new Set((purchases || []).map(p => p.item_name).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ko'));

  const handleAddPurchase = async () => {
    let vendorToUse = form.vendor.trim();
    let paymentToUse = form.payment_method;

    // 업체명이 비어있으면, 같은 날짜에 먼저 입력해둔 항목의 업체/거래방식을 그대로 사용합니다.
    // (엑셀에서 병합된 셀처럼 "위 칸과 동일"로 취급)
    if (!vendorToUse) {
      const sameDayEntries = (purchases || [])
        .filter(p => p.date === form.date)
        .sort((a, b) => (a.created_at || '').localeCompare(b.created_at || ''));
      if (sameDayEntries.length > 0) {
        vendorToUse = sameDayEntries[0].vendor;
        paymentToUse = sameDayEntries[0].payment_method;
      }
    }

    if (!vendorToUse) return alert('업체명을 입력해주세요. (해당 날짜의 첫 입력은 업체명이 필요합니다)');
    if (!form.item_name.trim()) return alert('품목을 입력해주세요.');
    const qty = Number(form.quantity);
    const price = Number(form.unit_price);
    if (!qty || qty <= 0) return alert('수량을 입력해주세요.');
    if (!price || price <= 0) return alert('단가를 입력해주세요.');

    setSaving(true);
    const { error } = await supabase.from('purchases').insert([{
      date: form.date,
      payment_method: paymentToUse,
      vendor: vendorToUse,
      item_name: form.item_name.trim(),
      quantity: qty,
      unit_price: price,
      amount: qty * price
    }]);
    setSaving(false);

    if (error) {
      alert('매입 저장 실패: ' + error.message);
      return;
    }

    setForm(prev => ({
      date: prev.date, // 날짜/거래방식/업체는 연속 입력 편의를 위해 유지
      payment_method: paymentToUse,
      vendor: vendorToUse,
      item_name: '',
      quantity: '',
      unit_price: ''
    }));
    fetchPurchases();
  };

  const handleDeletePurchase = async (id) => {
    if (!window.confirm('이 매입 내역을 삭제하시겠습니까?')) return;
    const { error } = await supabase.from('purchases').delete().eq('id', id);
    if (error) {
      alert('삭제 실패: ' + error.message);
      return;
    }
    fetchPurchases();
  };

  const startEditPurchase = (p) => {
    setEditingPurchase({
      id: p.id,
      date: p.date,
      payment_method: p.payment_method,
      vendor: p.vendor,
      item_name: p.item_name,
      quantity: String(p.quantity),
      unit_price: String(p.unit_price)
    });
  };

  const handleUpdatePurchase = async () => {
    if (!editingPurchase.vendor.trim()) return alert('업체명을 입력해주세요.');
    if (!editingPurchase.item_name.trim()) return alert('품목을 입력해주세요.');
    const qty = Number(editingPurchase.quantity);
    const price = Number(editingPurchase.unit_price);
    if (!qty || qty <= 0) return alert('수량을 입력해주세요.');
    if (!price || price <= 0) return alert('단가를 입력해주세요.');

    const { error } = await supabase.from('purchases').update({
      date: editingPurchase.date,
      payment_method: editingPurchase.payment_method,
      vendor: editingPurchase.vendor.trim(),
      item_name: editingPurchase.item_name.trim(),
      quantity: qty,
      unit_price: price,
      amount: qty * price
    }).eq('id', editingPurchase.id);

    if (error) {
      alert('매입 수정 실패: ' + error.message);
      return;
    }

    setEditingPurchase(null);
    fetchPurchases();
  };

  // 영수증 사진 선택 → 구글 Vision OCR로 텍스트 인식 → 대략적인 값 채워서 확인 화면 열기
  // (사진 자체는 저장하지 않고 인식에만 사용합니다)
  const handleReceiptFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setReceiptLoading(true);
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const base64 = reader.result;
        const { data, error } = await supabase.functions.invoke('receipt-ocr', { body: { image: base64 } });
        if (error) throw error;
        const text = data?.text || '';
        if (!text) {
          alert('영수증에서 글자를 인식하지 못했습니다. 다시 찍어보거나 직접 입력해주세요.');
          return;
        }

        setReceiptRawText(text);

        // 아주 단순한 휴리스틱으로 대략적인 값만 채워둡니다. (정확도는 낮을 수 있어 확인 후 수정 필요)
        const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

        // 금액 추정: 쉼표 포함 숫자 중 가장 큰 값
        const numberMatches = text.match(/[0-9]{1,3}(,[0-9]{3})+|[0-9]{4,}/g) || [];
        const numbers = numberMatches.map(n => Number(n.replace(/,/g, ''))).filter(n => n > 0 && n < 100000000);
        const guessedAmount = numbers.length > 0 ? Math.max(...numbers) : '';

        // 날짜 추정
        const dateMatch = text.match(/(20\d{2})[.\-\/]\s?(\d{1,2})[.\-\/]\s?(\d{1,2})/);
        let guessedDate = todayStr;
        if (dateMatch) {
          const y = dateMatch[1], m = String(dateMatch[2]).padStart(2, '0'), d = String(dateMatch[3]).padStart(2, '0');
          const candidate = `${y}-${m}-${d}`;
          if (!isNaN(new Date(candidate).getTime())) guessedDate = candidate;
        }

        // 업체명 추정: 숫자/기호 위주가 아닌 첫 줄
        const guessedVendor = lines.find(l => !/^[0-9,.\-:()\s원]+$/.test(l)) || '';

        setReceiptForm({
          date: guessedDate,
          payment_method: '현금',
          vendor: guessedVendor,
          item_name: '',
          quantity: '1',
          unit_price: guessedAmount ? String(guessedAmount) : ''
        });
        setReceiptModalOpen(true);
      } catch (err) {
        console.error(err);
        alert('영수증 인식 중 오류가 발생했습니다: ' + (err.message || err));
      } finally {
        setReceiptLoading(false);
        e.target.value = '';
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSaveReceiptPurchase = async () => {
    if (!receiptForm.vendor.trim()) return alert('업체명을 입력해주세요.');
    if (!receiptForm.item_name.trim()) return alert('품목을 입력해주세요.');
    const qty = Number(receiptForm.quantity);
    const price = Number(receiptForm.unit_price);
    if (!qty || qty <= 0) return alert('수량을 입력해주세요.');
    if (!price || price <= 0) return alert('단가를 입력해주세요.');

    const { error } = await supabase.from('purchases').insert([{
      date: receiptForm.date,
      payment_method: receiptForm.payment_method,
      vendor: receiptForm.vendor.trim(),
      item_name: receiptForm.item_name.trim(),
      quantity: qty,
      unit_price: price,
      amount: qty * price
    }]);

    if (error) {
      alert('저장 실패: ' + error.message);
      return;
    }

    setReceiptModalOpen(false);
    setReceiptRawText('');
    fetchPurchases();
  };

  // 기간별 필터링 (오늘/이번주(일~토)/이번달/이번해)
  const nowDate = getKoreaNowFormatted().kstDateObj;
  const dayOfWeek = nowDate.getDay();
  const sunday = new Date(nowDate);
  sunday.setDate(nowDate.getDate() - dayOfWeek);
  const sundayStr = `${sunday.getFullYear()}-${String(sunday.getMonth() + 1).padStart(2, '0')}-${String(sunday.getDate()).padStart(2, '0')}`;
  const monthStr = todayStr.slice(0, 7);
  const yearStr = todayStr.slice(0, 4);

  const periodFiltered = (purchases || []).filter(p => {
    if (period === 'today') return p.date === todayStr;
    if (period === 'week') return p.date >= sundayStr;
    if (period === 'month') return (p.date || '').slice(0, 7) === monthStr;
    if (period === 'year') return (p.date || '').slice(0, 4) === yearStr;
    return true;
  });
  const totalPurchaseAmount = periodFiltered.reduce((s, p) => s + (Number(p.amount) || 0), 0);

  // 결제수단별 매입 집계 (현재 선택된 기간 기준)
  const byPurchasePayment = {};
  periodFiltered.forEach(p => {
    const pm = p.payment_method || '미지정';
    byPurchasePayment[pm] = (byPurchasePayment[pm] || 0) + (Number(p.amount) || 0);
  });
  const purchasePaymentBreakdown = Object.entries(byPurchasePayment).sort((a, b) => b[1] - a[1]);
  const maxPurchasePayment = purchasePaymentBreakdown.reduce((m, [, v]) => Math.max(m, v), 0) || 1;

  // 매입 달력용: 날짜별 합계
  const purchaseByDateAll = {};
  (purchases || []).forEach(p => {
    if (p.date) purchaseByDateAll[p.date] = (purchaseByDateAll[p.date] || 0) + (Number(p.amount) || 0);
  });
  const getPurchaseCalendarEvents = () => {
    return Object.entries(purchaseByDateAll)
      .filter(([, amt]) => amt > 0)
      .map(([date, amt]) => {
        const isPast = date < todayStr;
        return {
          id: date,
          title: amt.toLocaleString(),
          start: date,
          allDay: true,
          backgroundColor: isPast ? '#f1f5f9' : '#e0f2fe',
          textColor: isPast ? '#94a3b8' : '#0369a1',
          borderColor: isPast ? '#e2e8f0' : '#7dd3fc'
        };
      });
  };

  // 선택한 날짜의 매입 리스트
  const selectedDateList = (purchases || [])
    .filter(p => p.date === selectedDate)
    .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));

  // 매입 추이 (일/주/월/년, 화살표로 이전/다음 구간 이동 가능)
  const pad = n => String(n).padStart(2, '0');
  const fmtDate = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const byDateAll = {};
  (purchases || []).forEach(p => { if (p.date) byDateAll[p.date] = (byDateAll[p.date] || 0) + (Number(p.amount) || 0); });
  const dateEntries = Object.entries(byDateAll);

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
      trendPoints.push({ key: dStr, label: `${pad(dt.getMonth() + 1)}/${pad(dt.getDate())}`, amt: byDateAll[dStr] || 0 });
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
      dateEntries.forEach(([d, v]) => { if (d >= startStr && d <= endStr) sum += v; });
      trendPoints.push({ key: startStr, label: `${pad(start.getMonth() + 1)}/${pad(start.getDate())}`, amt: sum });
    }
  } else if (trendGranularity === 'monthly') {
    for (let i = 11; i >= 0; i--) {
      const dt = new Date(trendRefDate.getFullYear(), trendRefDate.getMonth() - i, 1);
      const ymStr = `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}`;
      let sum = 0;
      dateEntries.forEach(([d, v]) => { if (d.slice(0, 7) === ymStr) sum += v; });
      trendPoints.push({ key: ymStr, label: `${String(dt.getFullYear()).slice(2)}/${pad(dt.getMonth() + 1)}`, amt: sum });
    }
  } else if (trendGranularity === 'yearly') {
    for (let i = 4; i >= 0; i--) {
      const y = trendRefDate.getFullYear() - i;
      let sum = 0;
      dateEntries.forEach(([d, v]) => { if (d.slice(0, 4) === String(y)) sum += v; });
      trendPoints.push({ key: String(y), label: `${y}`, amt: sum });
    }
  }
  const trendMaxAmt = trendPoints.reduce((m, p) => Math.max(m, p.amt), 0) || 1;

  // 매입이력 기간 범위 계산
  const historyRange = (() => {
    if (historyPeriod === 'custom') return { start: historyCustomStart, end: historyCustomEnd };
    const end = new Date(nowDate);
    const start = new Date(nowDate);
    if (historyPeriod === 'week') start.setDate(nowDate.getDate() - 7);
    else if (historyPeriod === 'month') start.setMonth(nowDate.getMonth() - 1);
    else if (historyPeriod === 'year') start.setFullYear(nowDate.getFullYear() - 1);
    return { start: fmtDate(start), end: fmtDate(end) };
  })();

  const historyList = historyFilter
    ? (purchases || [])
        .filter(p => {
          const field = historyFilter.type === 'vendor' ? p.vendor : historyFilter.type === 'item' ? p.item_name : p.payment_method;
          return field === historyFilter.value && p.date >= historyRange.start && p.date <= historyRange.end;
        })
        .sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.created_at || '').localeCompare(a.created_at || ''))
    : [];

  // 매입이력 표: 유형에 따라 표시할 컬럼이 달라집니다 (자기 자신과 같은 값인 컬럼은 생략)
  const HISTORY_COL_LABEL = { date: '일자', vendor: '업체', item: '품목', qty: '수량', price: '단가', amount: '금액' };
  const HISTORY_COL_WIDTH = { date: 88, vendor: 140, item: 150, qty: 56, price: 90, amount: 100 };
  const historyColumns = !historyFilter ? [] :
    historyFilter.type === 'vendor' ? ['date', 'item', 'qty', 'price', 'amount'] :
    historyFilter.type === 'item' ? ['date', 'vendor', 'qty', 'price', 'amount'] :
    ['date', 'vendor', 'item', 'qty', 'price', 'amount'];
  const historyTableWidth = historyColumns.reduce((s, c) => s + HISTORY_COL_WIDTH[c], 0);
  const historyCellValue = (p, col) => {
    if (col === 'date') return p.date;
    if (col === 'vendor') return p.vendor;
    if (col === 'item') return p.item_name;
    if (col === 'qty') return Number(p.quantity).toLocaleString();
    if (col === 'price') return Number(p.unit_price).toLocaleString() + '원';
    if (col === 'amount') return Number(p.amount).toLocaleString() + '원';
    return '';
  };
  const historyTitleIcon = historyFilter?.type === 'vendor' ? '🏭' : historyFilter?.type === 'item' ? '📦' : '💳';

  const inputCls = "p-2 border border-slate-300 rounded-lg text-xs bg-white text-slate-900";

  return (
    <div className="space-y-4">
      {receiptModalOpen && (
        <div
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 md:p-4"
          style={{ zIndex: 9999 }}
          onClick={() => setReceiptModalOpen(false)}
        >
          <div
            className="bg-white rounded-2xl p-4 md:p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200 space-y-3"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-between items-start">
              <h3 className="text-base md:text-lg font-bold text-slate-900">📷 영수증 인식 결과 확인</h3>
              <button onClick={() => setReceiptModalOpen(false)} className="text-slate-400 hover:text-slate-600 text-lg font-bold cursor-pointer">✕</button>
            </div>
            <p className="text-[11px] text-slate-500">
              손글씨 영수증은 인식이 완벽하지 않을 수 있어요. 아래 원문을 참고해서 항목을 확인·수정한 뒤 저장해주세요.
            </p>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl max-h-36 overflow-y-auto">
              <p className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed">{receiptRawText}</p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] font-bold text-slate-700">일자</label>
                <input
                  type="date"
                  value={receiptForm.date}
                  onChange={e => setReceiptForm({ ...receiptForm, date: e.target.value })}
                  className="w-full p-2.5 border border-slate-300 rounded-xl mt-1 text-sm bg-white text-slate-900"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-700">거래방식</label>
                <select
                  value={receiptForm.payment_method}
                  onChange={e => setReceiptForm({ ...receiptForm, payment_method: e.target.value })}
                  className="w-full p-2.5 border border-slate-300 rounded-xl mt-1 text-sm bg-white text-slate-900"
                >
                  {PURCHASE_PAYMENT_OPTIONS.map(pm => <option key={pm} value={pm}>{pm}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-700">업체 (인식된 값 - 확인 필요)</label>
              <input
                type="text"
                list="receipt-vendor-list"
                value={receiptForm.vendor}
                onChange={e => setReceiptForm({ ...receiptForm, vendor: e.target.value })}
                placeholder="업체명"
                className="w-full p-2.5 border border-slate-300 rounded-xl mt-1 text-sm bg-white text-slate-900"
              />
              <datalist id="receipt-vendor-list">
                {vendorList.map(v => <option key={v} value={v} />)}
              </datalist>
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-700">품목 (직접 입력해주세요)</label>
              <input
                type="text"
                list="receipt-item-list"
                value={receiptForm.item_name}
                onChange={e => setReceiptForm({ ...receiptForm, item_name: e.target.value })}
                placeholder="품목명"
                className="w-full p-2.5 border border-slate-300 rounded-xl mt-1 text-sm bg-white text-slate-900"
              />
              <datalist id="receipt-item-list">
                {itemNameList.map(v => <option key={v} value={v} />)}
              </datalist>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] font-bold text-slate-700">수량</label>
                <input
                  type="number"
                  value={receiptForm.quantity}
                  onChange={e => setReceiptForm({ ...receiptForm, quantity: e.target.value })}
                  className="w-full p-2.5 border border-slate-300 rounded-xl mt-1 text-sm bg-white text-slate-900"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-700">단가 (인식된 값 - 확인 필요)</label>
                <input
                  type="number"
                  value={receiptForm.unit_price}
                  onChange={e => setReceiptForm({ ...receiptForm, unit_price: e.target.value })}
                  className="w-full p-2.5 border border-slate-300 rounded-xl mt-1 text-sm bg-white text-slate-900"
                />
              </div>
            </div>

            <div className="text-xs text-slate-500 text-right">
              금액: <span className="font-bold text-slate-900">
                {((Number(receiptForm.quantity) || 0) * (Number(receiptForm.unit_price) || 0)).toLocaleString()}원
              </span>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setReceiptModalOpen(false)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold border border-slate-300 cursor-pointer"
              >
                취소
              </button>
              <button
                onClick={handleSaveReceiptPurchase}
                className="flex-1 py-2.5 bg-sky-500 hover:bg-sky-600 text-white rounded-xl text-xs font-bold shadow-md cursor-pointer"
              >
                매입에 추가
              </button>
            </div>
          </div>
        </div>
      )}

      {editingPurchase && (
        <div
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 md:p-4"
          style={{ zIndex: 9999 }}
          onClick={() => setEditingPurchase(null)}
        >
          <div
            className="bg-white rounded-2xl p-4 md:p-6 max-w-md w-full shadow-2xl border border-slate-200 space-y-3"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-between items-start">
              <h3 className="text-base md:text-lg font-bold text-slate-900">✏️ 매입 정보 수정</h3>
              <button onClick={() => setEditingPurchase(null)} className="text-slate-400 hover:text-slate-600 text-lg font-bold cursor-pointer">✕</button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] font-bold text-slate-700">일자</label>
                <input
                  type="date"
                  value={editingPurchase.date}
                  onChange={e => setEditingPurchase({ ...editingPurchase, date: e.target.value })}
                  className="w-full p-2.5 border border-slate-300 rounded-xl mt-1 text-sm bg-white text-slate-900"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-700">거래방식</label>
                <select
                  value={editingPurchase.payment_method}
                  onChange={e => setEditingPurchase({ ...editingPurchase, payment_method: e.target.value })}
                  className="w-full p-2.5 border border-slate-300 rounded-xl mt-1 text-sm bg-white text-slate-900"
                >
                  {PURCHASE_PAYMENT_OPTIONS.map(pm => <option key={pm} value={pm}>{pm}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-700">업체</label>
              <input
                type="text"
                list="edit-purchase-vendor-list"
                value={editingPurchase.vendor}
                onChange={e => setEditingPurchase({ ...editingPurchase, vendor: e.target.value })}
                className="w-full p-2.5 border border-slate-300 rounded-xl mt-1 text-sm bg-white text-slate-900"
              />
              <datalist id="edit-purchase-vendor-list">
                {vendorList.map(v => <option key={v} value={v} />)}
              </datalist>
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-700">품목</label>
              <input
                type="text"
                list="edit-purchase-item-list"
                value={editingPurchase.item_name}
                onChange={e => setEditingPurchase({ ...editingPurchase, item_name: e.target.value })}
                className="w-full p-2.5 border border-slate-300 rounded-xl mt-1 text-sm bg-white text-slate-900"
              />
              <datalist id="edit-purchase-item-list">
                {itemNameList.map(v => <option key={v} value={v} />)}
              </datalist>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] font-bold text-slate-700">수량</label>
                <input
                  type="number"
                  value={editingPurchase.quantity}
                  onChange={e => setEditingPurchase({ ...editingPurchase, quantity: e.target.value })}
                  className="w-full p-2.5 border border-slate-300 rounded-xl mt-1 text-sm bg-white text-slate-900"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-700">단가</label>
                <input
                  type="number"
                  value={editingPurchase.unit_price}
                  onChange={e => setEditingPurchase({ ...editingPurchase, unit_price: e.target.value })}
                  className="w-full p-2.5 border border-slate-300 rounded-xl mt-1 text-sm bg-white text-slate-900"
                />
              </div>
            </div>

            <div className="text-xs text-slate-500 text-right">
              금액: <span className="font-bold text-slate-900">
                {((Number(editingPurchase.quantity) || 0) * (Number(editingPurchase.unit_price) || 0)).toLocaleString()}원
              </span>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setEditingPurchase(null)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold border border-slate-300 cursor-pointer"
              >
                취소
              </button>
              <button
                onClick={handleUpdatePurchase}
                className="flex-1 py-2.5 bg-sky-500 hover:bg-sky-600 text-white rounded-xl text-xs font-bold shadow-md cursor-pointer"
              >
                저장
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 매입 관리 타이틀 + 기간 필터 + 총매입 */}
      <div className="bg-white p-4 md:p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
          <h2 className="text-base md:text-xl font-bold text-slate-900 flex items-center gap-2">
            <span>🧾</span> 매입 관리
          </h2>
        </div>

        <div className="flex gap-1.5 mb-4 flex-wrap">
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
                period === p.id ? 'bg-sky-100 border-sky-400 shadow-sm' : 'bg-white border-transparent hover:bg-slate-100'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="p-4 rounded-xl bg-sky-50 border border-sky-200 inline-block">
          <div className="text-[11px] font-bold text-sky-700">총매입 {periodFiltered.length}건</div>
          <div className="text-lg md:text-2xl font-extrabold text-sky-700 mt-1">{totalPurchaseAmount.toLocaleString()}원</div>
        </div>
      </div>

      {/* 매입 달력 */}
      <div className="bg-white p-4 md:p-6 rounded-2xl border border-slate-200 shadow-sm">
        <h3 className="text-sm md:text-base font-bold text-slate-900 mb-3">🗓️ 매입 달력</h3>
        <div className="calendar-compact">
          <FullCalendar
            key={selectedDate}
            plugins={[dayGridPlugin, interactionPlugin]}
            initialView="dayGridMonth"
            initialDate={selectedDate}
            locale="ko"
            aspectRatio={1.8}
            fixedWeekCount={false}
            dayMaxEventRows={true}
            contentHeight="auto"
            events={getPurchaseCalendarEvents()}
            eventContent={(arg) => (
              <span style={{ fontSize: '9px', fontWeight: 700 }}>{arg.event.title}</span>
            )}
            dayCellDidMount={(arg) => {
              const cellDateStr = `${arg.date.getFullYear()}-${String(arg.date.getMonth() + 1).padStart(2, '0')}-${String(arg.date.getDate()).padStart(2, '0')}`;
              if (cellDateStr === selectedDate) {
                arg.el.style.backgroundColor = '#bae6fd';
              }
            }}
            dateClick={(info) => setSelectedDate(info.dateStr)}
            eventClick={(info) => setSelectedDate(info.event.startStr)}
          />
        </div>
      </div>

      {/* 날짜별 매입 리스트 + 입력행 */}
      <div className="bg-white p-4 md:p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
          <h3 className="text-sm md:text-base font-bold text-slate-900">📆 날짜별 매입 리스트</h3>
          <div className="flex items-center gap-2">
            <label
              className={`text-xs font-bold border px-3 py-1.5 rounded-lg inline-flex items-center gap-1 ${
                receiptLoading
                  ? 'bg-slate-50 text-slate-300 border-slate-200 cursor-not-allowed'
                  : 'bg-white hover:bg-slate-100 border-slate-800 text-slate-900 cursor-pointer'
              }`}
            >
              {receiptLoading ? '인식 중...' : '📷 영수증으로 추가'}
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleReceiptFileSelect}
                disabled={receiptLoading}
                className="hidden"
              />
            </label>
            <input
              type="date"
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
              className="p-1.5 border border-slate-300 rounded-lg text-xs bg-white text-slate-900"
            />
          </div>
        </div>

        <div className="overflow-x-auto border border-slate-200 rounded-xl">
          <table className="w-full text-left border-collapse whitespace-nowrap">
            <thead>
              <tr className="bg-slate-100 text-slate-600 text-[11px] font-bold">
                <th className="py-2 px-2">일자</th>
                <th className="py-2 px-2">거래방식</th>
                <th className="py-2 px-2">업체</th>
                <th className="py-2 px-2">품목</th>
                <th className="py-2 px-2 text-right">수량</th>
                <th className="py-2 px-2 text-right">단가</th>
                <th className="py-2 px-2 text-right">금액</th>
                <th className="py-2 px-2"></th>
              </tr>
            </thead>
            <tbody>
              {/* 입력 행 - 새 매입을 한 행에서 바로 등록 */}
              <tr className="bg-sky-50/60 border-b border-sky-200">
                <td className="py-1.5 px-1">
                  <input
                    type="date"
                    value={form.date}
                    onChange={e => setForm({ ...form, date: e.target.value })}
                    className={inputCls}
                    style={{ width: '128px' }}
                  />
                </td>
                <td className="py-1.5 px-1">
                  <select
                    value={form.payment_method}
                    onChange={e => setForm({ ...form, payment_method: e.target.value })}
                    className={inputCls}
                    style={{ width: '88px' }}
                  >
                    {PURCHASE_PAYMENT_OPTIONS.map(pm => <option key={pm} value={pm}>{pm}</option>)}
                  </select>
                </td>
                <td className="py-1.5 px-1">
                  <input
                    type="text"
                    list="purchase-vendor-list"
                    value={form.vendor}
                    onChange={e => setForm({ ...form, vendor: e.target.value })}
                    placeholder="비우면 당일 첫값"
                    title="비워두면 같은 날짜에 먼저 입력한 업체명을 자동으로 사용합니다"
                    className={inputCls}
                    style={{ width: '110px' }}
                  />
                  <datalist id="purchase-vendor-list">
                    {vendorList.map(v => <option key={v} value={v} />)}
                  </datalist>
                </td>
                <td className="py-1.5 px-1">
                  <input
                    type="text"
                    list="purchase-item-list"
                    value={form.item_name}
                    onChange={e => setForm({ ...form, item_name: e.target.value })}
                    placeholder="품목명"
                    className={inputCls}
                    style={{ width: '120px' }}
                  />
                  <datalist id="purchase-item-list">
                    {itemNameList.map(v => <option key={v} value={v} />)}
                  </datalist>
                </td>
                <td className="py-1.5 px-1">
                  <input
                    type="number"
                    value={form.quantity}
                    onChange={e => setForm({ ...form, quantity: e.target.value })}
                    placeholder="0"
                    className={inputCls}
                    style={{ width: '68px', textAlign: 'right' }}
                  />
                </td>
                <td className="py-1.5 px-1">
                  <input
                    type="number"
                    value={form.unit_price}
                    onChange={e => setForm({ ...form, unit_price: e.target.value })}
                    placeholder="0"
                    className={inputCls}
                    style={{ width: '84px', textAlign: 'right' }}
                  />
                </td>
                <td className="py-1.5 px-1 text-right font-bold text-slate-800" style={{ minWidth: '90px' }}>
                  {computedAmount > 0 ? computedAmount.toLocaleString() + '원' : '-'}
                </td>
                <td className="py-1.5 px-1">
                  <button
                    onClick={handleAddPurchase}
                    disabled={saving}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap ${
                      saving ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-sky-500 hover:bg-sky-600 text-white cursor-pointer'
                    }`}
                  >
                    추가
                  </button>
                </td>
              </tr>

              {/* 선택한 날짜의 기존 매입 목록 */}
              {selectedDateList.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-6 text-center text-slate-400 text-xs">해당 날짜의 매입 내역이 없습니다.</td>
                </tr>
              ) : (
                selectedDateList.map(p => (
                  <tr key={p.id} className="border-b border-slate-100 text-xs">
                    <td className="py-2 px-2 text-slate-600">{p.date}</td>
                    <td
                      className="py-2 px-2 font-bold text-emerald-700 hover:underline cursor-pointer"
                      onClick={() => setHistoryFilter({ type: 'payment', value: p.payment_method })}
                    >
                      {p.payment_method}
                    </td>
                    <td
                      className="py-2 px-2 font-bold text-sky-700 hover:underline cursor-pointer"
                      onClick={() => setHistoryFilter({ type: 'vendor', value: p.vendor })}
                    >
                      {p.vendor}
                    </td>
                    <td
                      className="py-2 px-2 font-bold text-purple-700 hover:underline cursor-pointer"
                      onClick={() => setHistoryFilter({ type: 'item', value: p.item_name })}
                    >
                      {p.item_name}
                    </td>
                    <td className="py-2 px-2 text-right text-slate-600">{Number(p.quantity).toLocaleString()}</td>
                    <td className="py-2 px-2 text-right text-slate-600">{Number(p.unit_price).toLocaleString()}원</td>
                    <td className="py-2 px-2 text-right font-bold text-slate-900">{Number(p.amount).toLocaleString()}원</td>
                    <td className="py-2 px-2 text-center whitespace-nowrap">
                      <button
                        onClick={() => startEditPurchase(p)}
                        className="text-slate-400 hover:text-sky-600 font-bold cursor-pointer mr-2"
                        title="수정"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => handleDeletePurchase(p.id)}
                        className="text-slate-400 hover:text-rose-600 font-bold cursor-pointer"
                        title="삭제"
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <p className="text-[11px] text-slate-400 mt-2">💡 업체·거래방식·품목을 클릭하면 아래에 해당 이력이 표시됩니다.</p>
        <p className="text-[11px] text-slate-400 mt-1">💡 업체를 비워두고 추가하면, 같은 날짜에 먼저 입력한 업체(거래방식 포함)를 자동으로 사용합니다.</p>
      </div>

      {/* 매입이력 (고정 화면 - 업체/거래방식/품목 클릭 시 표시) */}
      {historyFilter && (
        <div className="bg-white p-4 md:p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
            <h3 className="text-sm md:text-base font-bold text-slate-900">{historyTitleIcon} {historyFilter.value} 매입 이력</h3>
            <button
              onClick={() => setHistoryFilter(null)}
              className="text-xs font-bold text-slate-500 hover:text-slate-700 cursor-pointer"
            >
              ✕ 닫기
            </button>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap mb-3">
            {[
              { id: 'week', label: '1주일' },
              { id: 'month', label: '1달' },
              { id: 'year', label: '1년' },
              { id: 'custom', label: '임의기간' },
            ].map(v => (
              <button
                key={v.id}
                onClick={() => setHistoryPeriod(v.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer border-2 ${
                  historyPeriod === v.id ? 'bg-sky-100 border-sky-400 shadow-sm' : 'bg-white border-transparent hover:bg-slate-100'
                }`}
              >
                {v.label}
              </button>
            ))}
            {historyPeriod === 'custom' && (
              <div className="flex items-center gap-1.5 ml-1">
                <input
                  type="date"
                  value={historyCustomStart}
                  onChange={e => setHistoryCustomStart(e.target.value)}
                  className="p-1.5 border border-slate-300 rounded-lg text-xs bg-white text-slate-900"
                />
                <span className="text-slate-400 text-xs">~</span>
                <input
                  type="date"
                  value={historyCustomEnd}
                  onChange={e => setHistoryCustomEnd(e.target.value)}
                  className="p-1.5 border border-slate-300 rounded-lg text-xs bg-white text-slate-900"
                />
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2 mb-4">
            <div className="p-2.5 rounded-xl bg-sky-50 border border-sky-200 text-center">
              <div className="text-[10px] font-bold text-sky-700">총 매입건수</div>
              <div className="text-sm md:text-base font-extrabold text-sky-700 mt-0.5">{historyList.length}건</div>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-center">
              <div className="text-[10px] font-bold text-slate-700">총 매입금액</div>
              <div className="text-sm md:text-base font-extrabold text-slate-700 mt-0.5">
                {historyList.reduce((s, p) => s + (Number(p.amount) || 0), 0).toLocaleString()}원
              </div>
            </div>
          </div>

          {historyList.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-6">선택한 기간에 매입 내역이 없습니다.</p>
          ) : (
            <div className="border border-slate-200 rounded-xl overflow-x-auto">
              <table className="text-left border-collapse" style={{ tableLayout: 'fixed', width: `${historyTableWidth}px` }}>
                <colgroup>
                  {historyColumns.map(c => <col key={c} style={{ width: `${HISTORY_COL_WIDTH[c]}px` }} />)}
                </colgroup>
                <thead>
                  <tr className="bg-slate-100 text-slate-600 text-[11px] font-bold">
                    {historyColumns.map(c => (
                      <th
                        key={c}
                        className={`py-2 px-2 whitespace-nowrap ${['qty', 'price', 'amount'].includes(c) ? 'text-right' : ''}`}
                      >
                        {HISTORY_COL_LABEL[c]}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {historyList.map(p => (
                    <tr key={p.id} className="border-t border-slate-100 text-xs">
                      {historyColumns.map(c => (
                        <td
                          key={c}
                          className={`py-2 px-2 whitespace-nowrap overflow-hidden text-ellipsis ${
                            ['qty', 'price', 'amount'].includes(c) ? 'text-right text-slate-600' : 'text-slate-800'
                          } ${c === 'amount' ? 'font-bold text-slate-900' : ''}`}
                        >
                          {historyCellValue(p, c)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="text-[11px] text-slate-400 mt-2">💡 좌우로 스크롤하면 금액까지 확인할 수 있습니다.</p>
        </div>
      )}

      {/* 매입 추이 */}
      <div className="bg-white p-4 md:p-6 rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
          <h3 className="text-sm md:text-base font-bold text-slate-900">📈 매입 추이</h3>
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
                  trendGranularity === g.id ? 'bg-sky-100 border-sky-400 shadow-sm' : 'bg-white border-transparent hover:bg-slate-100'
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
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '4px', width: '100%', height: '210px' }}>
            {trendPoints.map(p => {
              const barPx = Math.max(3, Math.round((p.amt / trendMaxAmt) * 90));
              const [labelTop, labelBottom] = trendGranularity === 'monthly' ? p.label.split('/') : [null, null];
              return (
                <div
                  key={p.key}
                  style={{ flex: '1 1 0%', minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}
                >
                  <div style={{ fontSize: '9px', color: '#64748b', fontWeight: 'bold', marginBottom: '2px', whiteSpace: 'nowrap' }}>
                    {p.amt > 0 ? p.amt.toLocaleString() : ''}
                  </div>
                  <div style={{ width: '66%', height: `${barPx}px`, backgroundColor: '#38bdf8', borderRadius: '3px 3px 0 0' }} />
                  {trendGranularity === 'monthly' ? (
                    <div style={{ fontSize: '9px', color: '#94a3b8', marginTop: '4px', textAlign: 'center', lineHeight: '1.2' }}>
                      <div>{labelTop}</div>
                      <div>{labelBottom}</div>
                    </div>
                  ) : (
                    <div style={{ fontSize: '9px', color: '#94a3b8', marginTop: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width: '100%', textAlign: 'center' }}>
                      {p.label}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 결제수단별 매입 */}
      <div className="bg-white p-4 md:p-6 rounded-2xl border border-slate-200 shadow-sm">
        <h3 className="text-sm md:text-base font-bold text-slate-900 mb-3">💳 결제수단별 매입</h3>
        {purchasePaymentBreakdown.length === 0 ? (
          <p className="text-xs text-slate-400 text-center py-6">표시할 데이터가 없습니다.</p>
        ) : (
          <div className="space-y-2">
            {purchasePaymentBreakdown.map(([pm, amt]) => (
              <div key={pm}>
                <div className="flex justify-between text-[11px] font-bold text-slate-700 mb-0.5">
                  <span>{pm}</span>
                  <span>{amt.toLocaleString()}원</span>
                </div>
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-sky-400 rounded-full"
                    style={{ width: `${(amt / maxPurchasePayment) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default PurchaseTab;
