/** Local calendar day helpers — never construct dates via UTC parsing of YYYY-MM-DD. */

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function isLeap(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function todayLocal(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function parseLocalDate(date: string): { year: number; month: number; day: number } {
  const [y, m, d] = date.split('-').map(Number);
  return { year: y!, month: m!, day: d! };
}

export function formatDisplayDate(date: string): string {
  const { year, month, day } = parseLocalDate(date);
  const weekday = new Date(year, month - 1, day).toLocaleDateString(undefined, {
    weekday: 'long',
  });
  const monthName = new Date(year, month - 1, day).toLocaleDateString(undefined, {
    month: 'long',
  });
  return `${weekday}, ${monthName} ${day}, ${year}`;
}

function dayOrdinal(day: number): string {
  const mod100 = day % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${day}th`;
  switch (day % 10) {
    case 1:
      return `${day}st`;
    case 2:
      return `${day}nd`;
    case 3:
      return `${day}rd`;
    default:
      return `${day}th`;
  }
}

/** e.g. "10th August 26" */
export function formatShortDisplayDate(date: string): string {
  const { year, month, day } = parseLocalDate(date);
  const monthName = new Date(year, month - 1, day).toLocaleDateString('en-GB', {
    month: 'long',
  });
  const shortYear = String(year).slice(-2);
  return `${dayOrdinal(day)} ${monthName} ${shortYear}`;
}

export function addDays(date: string, delta: number): string {
  const { year, month, day } = parseLocalDate(date);
  const next = new Date(year, month - 1, day + delta);
  const y = next.getFullYear();
  const m = String(next.getMonth() + 1).padStart(2, '0');
  const d = String(next.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function daysAgo(n: number, from = todayLocal()): string {
  return addDays(from, -n);
}

export function isValidCalendarDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1) return false;
  const maxDay = month === 2 && isLeap(year) ? 29 : (DAYS_IN_MONTH[month - 1] as number);
  return day <= maxDay;
}
