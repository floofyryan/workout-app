const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** "1:05:09" / "5:09" style clock for elapsed time and timers. */
export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = h > 0 ? String(m).padStart(2, '0') : String(m);
  return `${h > 0 ? `${h}:` : ''}${mm}:${String(sec).padStart(2, '0')}`;
}

/** "1h 5m" / "45m" style duration for workout lengths. */
export function formatDuration(totalSeconds: number): string {
  const mins = Math.max(0, Math.round(totalSeconds / 60));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

/** Parses "mm:ss", "h:mm:ss" or plain seconds. Returns null when invalid. */
export function parseClock(text: string): number | null {
  const t = text.trim();
  if (!t) return null;
  const parts = t.split(':');
  if (parts.length > 3 || parts.some((p) => !/^\d+$/.test(p))) return null;
  return parts.reduce((acc, p) => acc * 60 + Number(p), 0);
}

export function formatDate(ts: number): string {
  const d = new Date(ts);
  return `${DAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

export function formatShortDate(ts: number): string {
  const d = new Date(ts);
  return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

export function formatMonth(ts: number): string {
  const d = new Date(ts);
  return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export function formatTime(ts: number): string {
  const d = new Date(ts);
  const h = d.getHours();
  return `${h % 12 === 0 ? 12 : h % 12}:${String(d.getMinutes()).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}

/** Default workout name based on the time of day, e.g. "Morning Workout". */
export function defaultWorkoutName(ts: number): string {
  const h = new Date(ts).getHours();
  if (h < 5) return 'Night Workout';
  if (h < 12) return 'Morning Workout';
  if (h < 17) return 'Afternoon Workout';
  if (h < 21) return 'Evening Workout';
  return 'Night Workout';
}

/** Start of the week (Monday 00:00 local time) containing ts. */
export function startOfWeek(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  const diff = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - diff);
  return d.getTime();
}

export function startOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function formatNumber(n: number, decimals = 0): string {
  const fixed = n.toFixed(decimals);
  const [int, frac] = fixed.split('.');
  const withCommas = int.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return frac ? `${withCommas}.${frac}` : withCommas;
}

export function parseNumber(text: string): number | null {
  const t = text.trim().replace(',', '.');
  if (!t || t === '.' || t === '-') return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}
