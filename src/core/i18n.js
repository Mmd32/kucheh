import { getSettings } from './store.js';

const FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹';

export function faNum(value) {
  const text = String(value);
  if (getSettings().numerals !== 'fa') return text;
  return text.replace(/\d/g, (d) => FA_DIGITS[Number(d)]);
}

export function faList(items, { conjunction = 'و' } = {}) {
  const clean = items.filter(Boolean);
  if (clean.length <= 1) return clean[0] || '';
  return `${clean.slice(0, -1).join('، ')} ${conjunction} ${clean[clean.length - 1]}`;
}

export function faScore(n) {
  return faNum(n);
}
