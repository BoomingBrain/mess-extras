// All dates are YYYY-MM-DD strings in IST (UTC+05:30, no DST).
const IST_OFFSET_MS = 330 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function istDate(now: Date): string {
  return new Date(now.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
}

/** The instant at which the IST wall clock reads `hhmm` on `date`. */
export function istAt(date: string, hhmm: string): Date {
  return new Date(Date.parse(`${date}T${hhmm}:00.000Z`) - IST_OFFSET_MS);
}

export const cutoffFor = (date: string): Date => istAt(date, '17:00');
export const reminderFor = (date: string): Date => istAt(date, '16:00');

export function weekdayOf(date: string): number {
  return new Date(`${date}T00:00:00.000Z`).getUTCDay();
}

export const weekdayName = (date: string): string => WEEKDAYS[weekdayOf(date)];

export function addDays(date: string, n: number): string {
  return new Date(Date.parse(`${date}T00:00:00.000Z`) + n * DAY_MS).toISOString().slice(0, 10);
}

/** "Thursday, 19 Nov" */
export function prettyDate(date: string): string {
  const d = new Date(`${date}T00:00:00.000Z`);
  return `${weekdayName(date)}, ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

/** "7:52 pm" in IST */
export function istClock(iso: string | Date): string {
  const d = new Date(new Date(iso).getTime() + IST_OFFSET_MS);
  const h = d.getUTCHours();
  const m = d.getUTCMinutes();
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`;
}

/** First day of the IST month, as YYYY-MM */
export const monthOf = (date: string): string => date.slice(0, 7);
