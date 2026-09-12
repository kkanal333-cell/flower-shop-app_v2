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
