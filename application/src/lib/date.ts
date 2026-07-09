// Date helpers. Weight/habit dates are stored as plain calendar strings
// "YYYY-MM-DD". Arithmetic is done in UTC so it never drifts across DST.

export const DAY_MS = 86400000;

const pad2 = (n) => String(n).padStart(2, '0');

// Local calendar date of a JS Date / timestamp → "YYYY-MM-DD".
export function iso(d) {
  const t = d instanceof Date ? d : new Date(d);
  return `${t.getFullYear()}-${pad2(t.getMonth() + 1)}-${pad2(t.getDate())}`;
}

export const todayISO = () => iso(new Date());

// Treat an ISO date string as a UTC calendar instant (midnight UTC).
export function isoToMs(s) {
  const [y, m, d] = String(s).split('-').map(Number);
  return Date.UTC(y, (m || 1) - 1, d || 1);
}

export const msToISO = (ms) => new Date(ms).toISOString().slice(0, 10);
export const addDays = (s, n) => msToISO(isoToMs(s) + n * DAY_MS);
// Whole days from a → b (positive if b is later).
export const daysBetween = (a, b) => Math.round((isoToMs(b) - isoToMs(a)) / DAY_MS);

export function fmtDate(s) {
  const ms = typeof s === 'number' ? s : isoToMs(s);
  return new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}
export function fmtLong(s) {
  const ms = typeof s === 'number' ? s : isoToMs(s);
  return new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

// "late Sep", "mid Oct", "early Jan" — fuzzy month label for honest projections.
export function fuzzyMonth(s) {
  const ms = typeof s === 'number' ? s : isoToMs(s);
  const d = new Date(ms);
  const day = d.getUTCDate();
  const part = day <= 10 ? 'early' : day <= 20 ? 'mid' : 'late';
  const mon = d.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' });
  return `${part} ${mon}`;
}

// ---- Flexible date parsing for CSV import -------------------------------
const MONTHS = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4,
  may: 5, jun: 6, june: 6, jul: 7, july: 7, aug: 8, august: 8, sep: 9, sept: 9,
  september: 9, oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12,
};

export const DATE_FORMATS = [
  ['iso', 'YYYY-MM-DD'],
  ['dmy', 'DD/MM/YYYY'],
  ['mdy', 'MM/DD/YYYY'],
  ['named', 'Mon DD YYYY'],
];

const valid = (y, m, d) => {
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  const dim = new Date(Date.UTC(y, m, 0)).getUTCDate(); // days in month
  if (d > dim) return null;
  return `${y}-${pad2(m)}-${pad2(d)}`;
};

// Parse one value with an explicit format → ISO string or null.
export function parseDate(value, fmt) {
  if (value == null) return null;
  const s = String(value).trim();
  if (!s) return null;

  if (fmt === 'named') {
    const m = s.match(/([A-Za-z]+)\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})/) // Jun 30, 2026
      || s.match(/(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]+)\.?,?\s+(\d{4})/);    // 30 June 2026
    if (!m) return null;
    let mon, day, year;
    if (/[A-Za-z]/.test(m[1])) { mon = MONTHS[m[1].toLowerCase()]; day = +m[2]; year = +m[3]; }
    else { day = +m[1]; mon = MONTHS[m[2].toLowerCase()]; year = +m[3]; }
    if (!mon) return null;
    return valid(year, mon, day);
  }

  const parts = s.split(/[\/\-.\s]+/).map((x) => x.trim()).filter(Boolean);
  if (parts.length < 3) return null;
  const nums = parts.map(Number);
  if (nums.some((n) => Number.isNaN(n))) return null;

  if (fmt === 'iso') return valid(nums[0], nums[1], nums[2]);
  if (fmt === 'dmy') return valid(nums[2], nums[1], nums[0]);
  if (fmt === 'mdy') return valid(nums[2], nums[0], nums[1]);
  return null;
}

// Guess the format from a set of sample strings.
export function detectDateFormat(samples) {
  const vals = samples.map((s) => String(s ?? '').trim()).filter(Boolean);
  if (!vals.length) return 'iso';
  if (vals.some((v) => /[A-Za-z]/.test(v))) return 'named';
  if (vals.every((v) => /^\d{4}[\/\-.]\d{1,2}[\/\-.]\d{1,2}$/.test(v))) return 'iso';

  // numeric d/m/y — disambiguate by which field exceeds 12.
  let firstGt12 = false, secondGt12 = false;
  for (const v of vals) {
    const p = v.split(/[\/\-.]/).map(Number);
    if (p.length < 3) continue;
    if (p[0] > 12) firstGt12 = true;
    if (p[1] > 12) secondGt12 = true;
  }
  if (firstGt12 && !secondGt12) return 'dmy';
  if (secondGt12 && !firstGt12) return 'mdy';
  return 'dmy'; // ambiguous → default to day-first (user can override)
}
