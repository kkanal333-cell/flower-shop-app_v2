import React, { useEffect, useState } from 'react';
import { supabase, RIBBON_FONT_OPTIONS, RIBBON_GOOGLE_FONTS_URL } from './shared.js';

function RibbonEditor({
  ribbonText, setRibbonText,
  ribbonFontFamily, setRibbonFontFamily,
  ribbonFontSize, setRibbonFontSize,
  ribbonLetterSpacing, setRibbonLetterSpacing,
  ribbonWordSpacingEm, setRibbonWordSpacingEm,
  ribbonLineGap, setRibbonLineGap,
  ribbonPaperWidth, setRibbonPaperWidth,
  ribbonMarginLeft, setRibbonMarginLeft,
  ribbonMarginRight, setRibbonMarginRight,
  ribbonMarginTop, setRibbonMarginTop,
  ribbonMarginSync, setRibbonMarginSync,
  ribbonBold, setRibbonBold,
  ribbonShowGuide, setRibbonShowGuide,
  ribbonCopies, setRibbonCopies,
  ribbonTemplates,
  selectedRibbonTemplateId, setSelectedRibbonTemplateId,
  ribbonTemplateLoading, setRibbonTemplateLoading,
  fetchRibbonTemplates,
  applyRibbonTemplate,
}) {
  // 리본 편집기 화면에서만 구글 폰트(나눔명조/나눔고딕 등)를 불러와 미리보기에 그대로 반영
  useEffect(() => {
    if (document.getElementById('ribbon-google-fonts')) return;
    const link = document.createElement('link');
    link.id = 'ribbon-google-fonts';
    link.rel = 'stylesheet';
    link.href = RIBBON_GOOGLE_FONTS_URL;
    document.head.appendChild(link);
  }, []);

  const ribbonMarginMax = Math.min(38, Math.max(0, Math.floor((Number(ribbonPaperWidth) - 2) / 2)));
  const ribbonContentWidthMm = Math.max(0, Number(ribbonPaperWidth) - (Number(ribbonMarginLeft) || 0) - (Number(ribbonMarginRight) || 0));
  // 정중앙을 기준으로 반으로 잘랐을 때 한쪽 리본의 폭 (좌우 여백을 동일하게 맞춰두면 양쪽이 똑같이 나뉩니다)
  const ribbonHalfWidthMm = Number(ribbonPaperWidth) / 2;
  // 줄 사이 절단선의 굵기(mm). 화면/기기별로 저장되는 값이 아니라 이 편집기 화면 안에서만 쓰는 설정입니다.
  const [ribbonGuideWidthMm, setRibbonGuideWidthMm] = useState(0.4);
  // 공백(스페이스)만 있는 줄도 여백 용도로 그대로 유지합니다. 완전히 빈 줄(엔터만 두 번 누른 경우)만 걸러냅니다.
  const ribbonLines = ribbonText.split('\n').filter(line => line.length > 0);

  // 용지 폭을 바꾸면 기존의 30mm 리본 폭을 최대한 유지하도록 좌우 여백을 자동 조정합니다.
  useEffect(() => {
    const targetRibbonWidth = 30;
    const autoMargin = Math.max(0, (Number(ribbonPaperWidth) - targetRibbonWidth) / 2);
    setRibbonMarginLeft(Math.min(ribbonMarginMax, autoMargin));
    setRibbonMarginRight(Math.min(ribbonMarginMax, autoMargin));
  }, [ribbonPaperWidth]);

  const handleSaveRibbonTemplate = async () => {
    const defaultName = selectedRibbonTemplateId
      ? (ribbonTemplates.find(t => String(t.id) === String(selectedRibbonTemplateId))?.name || '')
      : '';
    const name = window.prompt('저장할 리본 양식 이름을 입력하세요.', defaultName || '기본 리본 양식');
    if (!name || !name.trim()) return;

    const config = {
      ribbonText, ribbonFontFamily, ribbonFontSize, ribbonLetterSpacing, ribbonWordSpacingEm, ribbonLineGap,
      ribbonPaperWidth, ribbonMarginLeft, ribbonMarginRight, ribbonMarginTop, ribbonMarginSync,
      ribbonBold, ribbonShowGuide, ribbonCopies
    };
    setRibbonTemplateLoading(true);
    try {
      const selectedTemplate = selectedRibbonTemplateId
        ? ribbonTemplates.find(t => String(t.id) === String(selectedRibbonTemplateId))
        : null;
      const isOverwritingSameTemplate = !!(selectedTemplate && selectedTemplate.name === name.trim());
      const row = {
        ...(isOverwritingSameTemplate ? { id: selectedRibbonTemplateId } : {}),
        name: name.trim(),
        config,
        // 기존 양식을 덮어쓰는 경우엔 기본 양식 지정 여부를 그대로 유지하고, 새 양식은 기본값 false로 저장합니다.
        is_default: isOverwritingSameTemplate ? !!selectedTemplate.is_default : false,
        updated_at: new Date().toISOString()
      };
      const { data, error } = await supabase
        .from('ribbon_templates')
        .upsert([row], { onConflict: 'name' })
        .select()
        .single();
      if (error) throw error;
      setSelectedRibbonTemplateId(String(data.id));
      await fetchRibbonTemplates();
      alert('리본 양식이 Supabase에 저장되었습니다.');
    } catch (err) {
      console.error(err);
      alert('리본 양식 저장 실패: ' + err.message);
    } finally {
      setRibbonTemplateLoading(false);
    }
  };

  const handleLoadRibbonTemplate = () => {
    if (!selectedRibbonTemplateId) return alert('불러올 양식을 선택해주세요.');
    const template = ribbonTemplates.find(t => String(t.id) === String(selectedRibbonTemplateId));
    if (template) applyRibbonTemplate(template, true);
  };

  // 선택한 양식을 "기본 양식"으로 지정합니다. 기본 양식은 새로고침하거나 리본편집기를 처음 열 때 자동으로 불러와집니다.
  const handleSetDefaultRibbonTemplate = async () => {
    if (!selectedRibbonTemplateId) return alert('기본으로 지정할 양식을 먼저 선택해주세요.');
    const template = ribbonTemplates.find(t => String(t.id) === String(selectedRibbonTemplateId));
    if (!template) return;
    if (template.is_default) {
      alert(`'${template.name}' 양식은 이미 기본 양식입니다.`);
      return;
    }
    try {
      const { error: clearError } = await supabase
        .from('ribbon_templates')
        .update({ is_default: false })
        .neq('id', selectedRibbonTemplateId);
      if (clearError) throw clearError;
      const { error: setError } = await supabase
        .from('ribbon_templates')
        .update({ is_default: true })
        .eq('id', selectedRibbonTemplateId);
      if (setError) throw setError;
      await fetchRibbonTemplates();
      alert(`'${template.name}' 양식을 기본 양식으로 지정했습니다. 새로고침하거나 리본편집기를 열면 이 양식이 자동으로 불러와집니다.`);
    } catch (err) {
      console.error(err);
      alert('기본 양식 지정 실패: ' + err.message);
    }
  };

  const handleDeleteRibbonTemplate = async () => {
    if (!selectedRibbonTemplateId) return alert('삭제할 양식을 먼저 선택해주세요.');
    const template = ribbonTemplates.find(t => String(t.id) === String(selectedRibbonTemplateId));
    if (!window.confirm(`'${template?.name || '선택한 양식'}'을(를) 삭제하시겠습니까?`)) return;
    try {
      const { error } = await supabase.from('ribbon_templates').delete().eq('id', selectedRibbonTemplateId);
      if (error) throw error;
      setSelectedRibbonTemplateId('');
      await fetchRibbonTemplates();
      alert('양식이 삭제되었습니다.');
    } catch (err) {
      alert('양식 삭제 실패: ' + err.message);
    }
  };

  // 리본 인쇄 함수 - 빅솔론 SRP-330III(80mm 감열지)에 세로 리본 문구를 인쇄
  // 좌우 여백을 조절해 실제 사용할 리본 폭(예: 30mm)에 맞춰 인쇄한 뒤, 안내 점선을 따라 세로로 잘라 사용
  const handlePrintRibbon = () => {
    if (ribbonLines.length === 0) {
      alert('인쇄할 리본 문구를 입력해주세요.');
      return;
    }
    if (ribbonContentWidthMm <= 0) {
      alert(`좌우 여백의 합이 용지 폭(${ribbonPaperWidth}mm)을 넘어 인쇄 영역이 없습니다. 여백을 줄여주세요.`);
      return;
    }

    const printWindow = window.open('', '_blank', 'width=420,height=700');
    if (!printWindow) {
      alert('팝업 차단이 설정되어 있습니다. 팝업을 허용해주세요.');
      return;
    }

    const escapeHtml = (str) => String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    const linesHtml = ribbonLines
      .map(line => `<div class="rline">${escapeHtml(line) || '&nbsp;'}</div>`)
      .join('');

    // 줄이 2개 이상일 때만, 두 줄 사이 한가운데에 절단 안내 점선을 별도 요소로 그립니다.
    // (좌우 여백이나 줄 간격이 0이어도 항상 컨테이너 정중앙에 표시되도록 절대좌표로 배치합니다)
    const guideHtml = (ribbonShowGuide && ribbonLines.length >= 2)
      ? `<div class="rguide" style="width:${ribbonGuideWidthMm}mm;"></div>`
      : '';

    // 상단 여백은 padding이 아니라 실제 높이를 가진 빈 칸(스페이서)으로 만듭니다.
    // (하단 여백은 프린터 드라이버 쪽에서 잘려나가 의미가 없어 제거했습니다 - 필요하면 빅솔론 드라이버의
    //  "문서 설정 > 용지 공급 > 인쇄 후에 용지 공급" 값으로 조절하세요.)
    const oneRibbonHtml = `
      <div class="ribbon-outer">
        <div class="ribbon-guide">
          <div class="ribbon-spacer" style="height:${ribbonMarginTop}mm;">&nbsp;</div>
          <div class="ribbon-flex">${linesHtml}${guideHtml}</div>
        </div>
      </div>
    `;

    const ribbonsHtml = Array.from({ length: Number(ribbonCopies) || 1 }).map(() => oneRibbonHtml).join('');

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>리본 문구 인쇄</title>
        <link rel="stylesheet" href="${RIBBON_GOOGLE_FONTS_URL}">
        <style>
          * { box-sizing: border-box; }
          body { margin: 0; padding: 0; color: #000; }
          .ribbon-outer {
            width: ${ribbonPaperWidth}mm;
            page-break-after: always;
            break-after: page;
          }
          .ribbon-outer:last-child {
            page-break-after: avoid;
            break-after: avoid;
          }
          .ribbon-guide {
            margin-left: ${ribbonMarginLeft}mm;
            margin-right: ${ribbonMarginRight}mm;
          }
          .ribbon-spacer {
            width: 100%;
            font-size: 1px;
            line-height: 1;
            overflow: hidden;
          }
          .ribbon-flex {
            display: flex;
            flex-direction: row;
            align-items: flex-start;
            justify-content: center;
            gap: ${ribbonLineGap}mm;
            position: relative;
          }
          .rline {
            writing-mode: vertical-rl;
            text-orientation: upright;
            white-space: pre;
            font-family: ${ribbonFontFamily};
            font-size: ${ribbonFontSize}px;
            font-weight: ${ribbonBold ? 800 : 400};
            letter-spacing: ${ribbonLetterSpacing}px;
            word-spacing: ${ribbonWordSpacingEm}em;
          }
          .rguide {
            position: absolute;
            left: 50%;
            top: 0;
            bottom: 0;
            transform: translateX(-50%);
            /* 줄 간격(gap)이 0이어도, 감열지 프린터에서 흐릿한 회색이 통째로 안 찍혀 사라지지 않도록
               다소 진하게(65% 불투명) 하되, 선은 가늘고 점선 간격은 성기게(1.5mm 선 + 5mm 간격) 유지합니다. */
            background-image: repeating-linear-gradient(
              to bottom,
              rgba(0,0,0,0.65) 0mm,
              rgba(0,0,0,0.65) 1.5mm,
              transparent 1.5mm,
              transparent 6.5mm
            );
            pointer-events: none;
          }
          .no-print { text-align: center; padding: 10px; background: #eee; }
          @media print {
            @page { size: ${ribbonPaperWidth}mm auto; margin: 0; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="no-print">
          <button onclick="window.print()" style="padding: 10px 20px; font-size: 16px; cursor: pointer; font-weight: bold;">리본 인쇄하기</button>
          <p style="font-size:11px;color:#555;">폰트 로딩 후 인쇄 버튼을 눌러주세요. (점선은 실제로 인쇄되며, 그 선을 따라 세로로 잘라 리본으로 사용하세요)</p>
        </div>
        ${ribbonsHtml}
      </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  return (
          <div className="bg-white p-4 md:p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
            <div>
              <h2 className="text-base md:text-xl font-bold text-slate-900 flex items-center gap-2 mb-1">
                <span>🎀</span> 리본편집기
              </h2>
              <p className="text-xs text-slate-500 leading-relaxed">
                빅솔론 SRP-330III(감열지, 용지폭 80mm)로 세로형 리본 문구를 인쇄합니다. 좌우 여백을 조절해 실제 사용할 리본 폭(예: 30mm)에 맞춰 인쇄한 뒤, 점선 재단선을 따라 세로로 길게 잘라 사용하세요.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* 왼쪽: 입력/설정 */}
              <div className="space-y-3">
                <div>
                  <label className="text-[11px] md:text-xs font-bold text-slate-700">리본 문구 (줄바꿈하면 리본 위에 여러 줄로 배치됩니다)</label>
                  <textarea
                    value={ribbonText}
                    onChange={e => setRibbonText(e.target.value)}
                    rows={4}
                    className="w-full p-2 md:p-3 border border-slate-300 rounded-xl mt-1 text-sm bg-white text-slate-900 font-medium"
                    style={{ backgroundColor: '#ffffff' }}
                    placeholder={'예) 축 개업\n화사한 하루 올림'}
                  />
                </div>

                <div>
                  <label className="text-[11px] md:text-xs font-bold text-slate-700">글꼴</label>
                  <select
                    value={ribbonFontFamily}
                    onChange={e => setRibbonFontFamily(e.target.value)}
                    className="w-full p-2 md:p-3 border border-slate-300 rounded-xl mt-1 text-sm bg-white text-slate-900 font-medium cursor-pointer"
                    style={{ backgroundColor: '#ffffff', fontFamily: ribbonFontFamily }}
                  >
                    {RIBBON_FONT_OPTIONS.map(f => (
                      <option key={f.value} value={f.value} style={{ fontFamily: f.value }}>{f.label}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] md:text-xs font-bold text-slate-700">글자 크기 ({ribbonFontSize}px, 최대 240px)</label>
                    <div className="flex items-center gap-2 mt-2">
                      <input
                        type="range" min="12" max="240" value={Math.min(ribbonFontSize, 240)}
                        onChange={e => setRibbonFontSize(Math.min(240, Number(e.target.value)))}
                        className="w-full cursor-pointer accent-rose-500"
                      />
                      <input
                        type="number" min="12" max="240"
                        value={ribbonFontSize}
                        onChange={e => setRibbonFontSize(Math.min(240, Math.max(12, Number(e.target.value))))}
                        className="w-16 p-1.5 border border-slate-300 rounded-lg text-xs bg-white text-slate-900 font-medium shrink-0"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-[11px] md:text-xs font-bold text-slate-700">자간 ({ribbonLetterSpacing}px)</label>
                    <input
                      type="range" min="-4" max="30" value={ribbonLetterSpacing}
                      onChange={e => setRibbonLetterSpacing(Number(e.target.value))}
                      className="w-full mt-2 cursor-pointer accent-rose-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] md:text-xs font-bold text-slate-700">
                    공백(스페이스) 폭 조정 ({ribbonWordSpacingEm >= 0 ? '+' : ''}{ribbonWordSpacingEm}em)
                  </label>
                  <input
                    type="range" min="-1" max="1" step="0.05" value={ribbonWordSpacingEm}
                    onChange={e => setRibbonWordSpacingEm(Number(e.target.value))}
                    className="w-full mt-2 cursor-pointer accent-rose-500"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">스페이스 글자가 자간에 비해 너무 넓어 보이면 음수(-) 쪽으로 줄여보세요. (글자 크기에 비례해 함께 커지고 작아집니다)</p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] md:text-xs font-bold text-slate-700">행간 · 줄 사이 간격 ({ribbonLineGap}mm)</label>
                    <input
                      type="range" min="0" max="30" value={ribbonLineGap}
                      onChange={e => setRibbonLineGap(Number(e.target.value))}
                      className="w-full mt-2 cursor-pointer accent-rose-500"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] md:text-xs font-bold text-slate-700">인쇄 매수</label>
                    <input
                      type="number" min="1" max="20"
                      value={ribbonCopies}
                      onChange={e => setRibbonCopies(e.target.value)}
                      className="w-full p-2 md:p-3 border border-slate-300 rounded-xl mt-1 text-sm bg-white text-slate-900 font-medium"
                      style={{ backgroundColor: '#ffffff' }}
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] md:text-xs font-bold text-slate-700">용지 폭</label>
                  <select
                    value={ribbonPaperWidth}
                    onChange={e => setRibbonPaperWidth(Number(e.target.value))}
                    className="w-full p-2 md:p-3 border border-slate-300 rounded-xl mt-1 text-sm bg-white text-slate-900 font-medium cursor-pointer"
                  >
                    <option value={80}>80mm</option>
                    <option value={58}>58mm</option>
                  </select>
                  <p className="text-[10px] text-slate-500 mt-1">용지 변경 시 30mm 리본 기준으로 좌우 여백을 자동 조정합니다.</p>
                </div>

                <div>
                  <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 cursor-pointer">
                    <input
                      type="checkbox" checked={ribbonMarginSync}
                      onChange={e => {
                        const sync = e.target.checked;
                        setRibbonMarginSync(sync);
                        if (sync) setRibbonMarginRight(ribbonMarginLeft);
                      }}
                      className="accent-rose-500 cursor-pointer w-3.5 h-3.5"
                    />
                    좌우 여백 동일하게 유지 (정중앙 기준으로 반으로 잘라도 양쪽이 똑같이 나뉩니다)
                  </label>
                </div>

                {ribbonMarginSync ? (
                  <div>
                    <label className="text-[11px] md:text-xs font-bold text-slate-700">좌우 여백 ({ribbonMarginLeft}mm)</label>
                    <input
                      type="range" min="0" max={ribbonMarginMax} value={Math.min(ribbonMarginLeft, ribbonMarginMax)}
                      onChange={e => {
                        const v = Number(e.target.value);
                        setRibbonMarginLeft(v);
                        setRibbonMarginRight(v);
                      }}
                      className="w-full mt-2 cursor-pointer accent-rose-500"
                    />
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] md:text-xs font-bold text-slate-700">좌측 여백 ({ribbonMarginLeft}mm)</label>
                      <input
                        type="range" min="0" max={ribbonMarginMax} value={Math.min(ribbonMarginLeft, ribbonMarginMax)}
                        onChange={e => setRibbonMarginLeft(Number(e.target.value))}
                        className="w-full mt-2 cursor-pointer accent-rose-500"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] md:text-xs font-bold text-slate-700">우측 여백 ({ribbonMarginRight}mm)</label>
                      <input
                        type="range" min="0" max={ribbonMarginMax} value={Math.min(ribbonMarginRight, ribbonMarginMax)}
                        onChange={e => setRibbonMarginRight(Number(e.target.value))}
                        className="w-full mt-2 cursor-pointer accent-rose-500"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label className="text-[11px] md:text-xs font-bold text-slate-700">상단 여백 (mm, 최대 300)</label>
                  <div className="flex items-center gap-2 mt-1">
                    <input
                      type="range" min="0" max="300" value={Math.min(ribbonMarginTop, 300)}
                      onChange={e => setRibbonMarginTop(Number(e.target.value))}
                      className="w-full cursor-pointer accent-rose-500"
                    />
                    <input
                      type="number" min="0" max="300"
                      value={ribbonMarginTop}
                      onChange={e => setRibbonMarginTop(Math.min(300, Math.max(0, Number(e.target.value))))}
                      className="w-16 p-1.5 border border-slate-300 rounded-lg text-xs bg-white text-slate-900 font-medium shrink-0"
                    />
                  </div>
                </div>

                <div className={`text-xs font-bold rounded-lg px-3 py-2 ${ribbonContentWidthMm > 0 ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'bg-red-50 text-red-700 border border-red-300'}`}>
                  현재 인쇄 폭(용지 {ribbonPaperWidth}mm 기준): 약 {ribbonContentWidthMm.toFixed(0)}mm
                  {ribbonContentWidthMm <= 0 && ' — 여백 합이 너무 커서 인쇄 영역이 없습니다.'}
                  {ribbonContentWidthMm > 0 && ribbonMarginSync && (
                    <span className="font-normal"> · 정중앙에서 반으로 자르면 한쪽 폭 약 {ribbonHalfWidthMm.toFixed(0)}mm</span>
                  )}
                </div>

                <div className="flex items-center gap-4 pt-1">
                  <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 cursor-pointer">
                    <input
                      type="checkbox" checked={ribbonBold}
                      onChange={e => setRibbonBold(e.target.checked)}
                      className="accent-rose-500 cursor-pointer w-3.5 h-3.5"
                    />
                    굵게 (진하게 인쇄)
                  </label>
                  <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 cursor-pointer">
                    <input
                      type="checkbox" checked={ribbonShowGuide}
                      onChange={e => setRibbonShowGuide(e.target.checked)}
                      className="accent-rose-500 cursor-pointer w-3.5 h-3.5"
                    />
                    줄 사이 절단선(점선) 표시
                  </label>
                </div>
                {ribbonShowGuide && (
                  <div>
                    <label className="text-[11px] md:text-xs font-bold text-slate-700">절단선 굵기 ({ribbonGuideWidthMm.toFixed(1)}mm)</label>
                    <input
                      type="range" min="0.1" max="1.5" step="0.1" value={ribbonGuideWidthMm}
                      onChange={e => setRibbonGuideWidthMm(Number(e.target.value))}
                      className="w-full mt-2 cursor-pointer accent-rose-500"
                    />
                  </div>
                )}

                <div className="border-t border-slate-200 pt-3 mt-2 space-y-2">
                  <div className="text-[11px] md:text-xs font-bold text-slate-700">☁️ Supabase 양식 저장 / 불러오기</div>
                  <select
                    value={selectedRibbonTemplateId}
                    onChange={e => setSelectedRibbonTemplateId(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded-xl text-xs bg-white text-slate-900"
                  >
                    <option value="">저장된 양식 선택</option>
                    {ribbonTemplates.map(t => (
                      <option key={t.id} value={t.id}>{t.name}{t.is_default ? ' ★기본' : ''}</option>
                    ))}
                  </select>
                  <p className="text-[10px] text-slate-500">글꼴·크기·자간·행간·용지폭·여백·굵기·가이드선·인쇄매수를 한꺼번에 저장합니다. ★기본 양식은 새로고침하거나 리본편집기를 열 때 자동으로 불러와집니다.</p>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <button
                      onClick={handleSaveRibbonTemplate}
                      disabled={ribbonTemplateLoading}
                      className="flex-1 min-w-[70px] px-3 py-2 rounded-xl bg-slate-900 border border-slate-900 text-white text-xs font-bold cursor-pointer whitespace-nowrap"
                    >
                      {ribbonTemplateLoading ? '저장 중…' : '현재 양식 저장'}
                    </button>
                    <button
                      onClick={handleLoadRibbonTemplate}
                      className="flex-1 min-w-[70px] px-3 py-2 rounded-xl bg-white border border-slate-400 text-slate-800 text-xs font-bold cursor-pointer whitespace-nowrap"
                    >
                      불러오기
                    </button>
                    <button
                      onClick={handleSetDefaultRibbonTemplate}
                      className="flex-1 min-w-[70px] px-3 py-2 rounded-xl bg-amber-50 border border-amber-400 text-amber-700 text-xs font-bold cursor-pointer whitespace-nowrap"
                    >
                      ⭐ 기본 지정
                    </button>
                    <button
                      onClick={handleDeleteRibbonTemplate}
                      className="flex-1 min-w-[70px] px-3 py-2 rounded-xl bg-white border border-rose-400 text-rose-700 text-xs font-bold cursor-pointer whitespace-nowrap"
                    >
                      삭제
                    </button>
                    <button
                      onClick={handlePrintRibbon}
                      className="flex-1 min-w-[120px] px-3 py-2 rounded-xl bg-rose-600 border border-rose-600 hover:bg-rose-700 text-white text-xs font-bold cursor-pointer whitespace-nowrap"
                    >
                      🖨️ 리본 인쇄하기
                    </button>
                  </div>
                </div>
              </div>

              {/* 오른쪽: 미리보기 */}
              <div>
                <label className="text-[11px] md:text-xs font-bold text-slate-700 mb-1 block">미리보기 (실제 인쇄물과 비율이 다소 다를 수 있습니다)</label>
                <div className="border border-slate-300 rounded-xl bg-slate-50 p-3 overflow-x-auto flex justify-center">
                  <div
                    style={{ width: `${ribbonPaperWidth}mm`, minHeight: '60mm', background: '#fff', boxSizing: 'border-box' }}
                    className="shadow-sm"
                  >
                    <div
                      style={{
                        marginLeft: `${ribbonMarginLeft}mm`,
                        marginRight: `${ribbonMarginRight}mm`,
                        minHeight: '48mm',
                      }}
                    >
                      <div style={{ height: `${ribbonMarginTop}mm` }} />
                      {ribbonLines.length === 0 ? (
                        <div className="text-slate-300 text-xs text-center pt-10">문구를 입력하면 여기에 미리보기가 표시됩니다.</div>
                      ) : (
                        <div
                          style={{
                            display: 'flex',
                            flexDirection: 'row',
                            alignItems: 'flex-start',
                            justifyContent: 'center',
                            gap: `${ribbonLineGap}mm`,
                            position: 'relative',
                          }}
                        >
                          {ribbonLines.map((line, idx) => (
                            <div
                              key={idx}
                              style={{
                                writingMode: 'vertical-rl',
                                textOrientation: 'upright',
                                whiteSpace: 'pre',
                                fontFamily: ribbonFontFamily,
                                fontSize: `${ribbonFontSize}px`,
                                fontWeight: ribbonBold ? 800 : 400,
                                letterSpacing: `${ribbonLetterSpacing}px`,
                                wordSpacing: `${ribbonWordSpacingEm}em`,
                                color: '#000',
                              }}
                            >
                              {line}
                            </div>
                          ))}
                          {ribbonShowGuide && ribbonLines.length >= 2 && (
                            <div
                              style={{
                                position: 'absolute',
                                left: '50%',
                                top: 0,
                                bottom: 0,
                                width: `${ribbonGuideWidthMm}mm`,
                                transform: 'translateX(-50%)',
                                backgroundImage: 'repeating-linear-gradient(to bottom, rgba(0,0,0,0.65) 0mm, rgba(0,0,0,0.65) 1.5mm, transparent 1.5mm, transparent 6.5mm)',
                                pointerEvents: 'none',
                              }}
                            />
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <p className="text-[11px] text-slate-400 mt-2 leading-relaxed">
                  문구는 줄바꿈으로 구분되며, 첫 줄이 왼쪽에 오고 그 다음 줄이 오른쪽으로 이어서 세로로 나란히 배치됩니다. 인쇄 버튼을 누르면 새 창에서 실제 인쇄 미리보기가 열립니다.
                </p>
              </div>
            </div>
          </div>
  );
}

export default RibbonEditor;
