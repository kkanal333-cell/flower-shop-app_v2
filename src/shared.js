import { createClient } from '@supabase/supabase-js';

// Supabase 연동
export const SUPABASE_URL = 'https://zthuqzzholyjolteuvty.supabase.co';
export const SUPABASE_KEY = 'sb_publishable_xkg9ULmNiqKrCcESytGbmw_u1Z12_gG';
export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// 매입 거래방식
export const PURCHASE_PAYMENT_OPTIONS = ["입금", "현금", "신용카드", "체크카드"];

// KST 실시간 일시 구하기
export const getKoreaNowFormatted = () => {
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

  return { date: dateStr, time: timeStr, dayOfWeek, currentHour, kstDateObj: kst };
};

// 리본편집기 - 세로 리본 문구에 어울리는 글꼴 목록 (Google Fonts)
export const RIBBON_FONT_OPTIONS = [
  { label: "나눔명조 (전통/단정)", value: "'Nanum Myeongjo', serif" },
  { label: "나눔고딕 (깔끔한 고딕)", value: "'Nanum Gothic', sans-serif" },
  { label: "Noto Serif KR (명조)", value: "'Noto Serif KR', serif" },
  { label: "Noto Sans KR (고딕)", value: "'Noto Sans KR', sans-serif" },
  { label: "나눔손글씨 붓 (캘리그라피)", value: "'Nanum Brush Script', cursive" },
  { label: "나눔손글씨 펜 (손글씨체)", value: "'Nanum Pen Script', cursive" },
  // 케리스 배움체 B: 구글 폰트가 아니라 이 PC에 설치된 로컬(윈도우) 글꼴이라, 브라우저가 이름으로 찾아서 씁니다.
  // 실제 등록된 이름이 아래 후보와 다르면 적용되지 않을 수 있어, 흔히 쓰이는 표기를 여러 개 순서대로 넣어뒀습니다.
  // (제어판 > 글꼴에서 해당 글꼴 파일을 더블클릭했을 때 위쪽에 뜨는 이름이 가장 정확합니다.)
  { label: "케리스 배움체 B (Windows 설치 글꼴)", value: "'케리스 배움체 B', '케리스배움체B', '케리스 배움체B', 'KerisBaeumB', 'Keris Baeum B', sans-serif" },
  { label: "Noto Sans KR Black", value: "'Noto Sans KR', sans-serif" },
  { label: "Noto Serif KR Black", value: "'Noto Serif KR', serif" },
  { label: "나눔스퀘어", value: "'Nanum Gothic', sans-serif" },
  { label: "Arial", value: "Arial, sans-serif" },
  { label: "Verdana", value: "Verdana, sans-serif" },
  { label: "Tahoma", value: "Tahoma, sans-serif" },
  { label: "Georgia", value: "Georgia, serif" },
  { label: "Times New Roman", value: "'Times New Roman', serif" },
  { label: "Courier New", value: "'Courier New', monospace" },
];

// 리본편집기 인쇄/미리보기에서 공통으로 사용할 Google Fonts 주소
export const RIBBON_GOOGLE_FONTS_URL =
  "https://fonts.googleapis.com/css2?family=Nanum+Myeongjo:wght@400;700&family=Nanum+Gothic:wght@400;700;800&family=Nanum+Pen+Script&family=Nanum+Brush+Script&family=Noto+Serif+KR:wght@400;500;700;900&family=Noto+Sans+KR:wght@400;500;700;900&display=swap";
