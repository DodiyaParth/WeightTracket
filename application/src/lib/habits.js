// Habit completion + forgiving streaks (REQUIREMENTS §5, §6.4 forgiving streaks).
// A completion log is a map { 'YYYY-MM-DD': 1 } per (habit, person).
// Value 1 = done, 2 = grace/repair day (counts toward streak, shown distinctly).
import { addDays, todayISO } from './date.js';

export const DONE = 1;
export const GRACE = 2;

// Current consecutive streak counting back from `endIso`. Done and grace days
// continue the streak; a missed day ends it (forgiving = grace days don't break).
export function currentStreak(log, endIso = todayISO()) {
  let streak = 0;
  let day = endIso;
  // allow today to be un-logged without zeroing yesterday's streak
  if (!log[day]) day = addDays(day, -1);
  while (log[day]) {
    streak += 1;
    day = addDays(day, -1);
  }
  return streak;
}

export const wasRepaired = (log, endIso = todayISO(), lookback = 28) => {
  for (let i = 0; i < lookback; i++) {
    if (log[addDays(endIso, -i)] === GRACE) return true;
  }
  return false;
};

// Forgiving streaks (DEV-20): marking `date` done auto-repairs a single
// missed day right before it — if the day before that WAS done, the gap is
// forgiven (marked GRACE) instead of breaking the streak. Two or more missed
// days in a row are never auto-forgiven — grace covers a slip, not a break.
export function applyAutoGrace(log, date) {
  const prevDay = addDays(date, -1);
  const dayBefore = addDays(date, -2);
  if (!log[prevDay] && log[dayBefore]) {
    return { ...log, [prevDay]: GRACE };
  }
  return log;
}

// Build an array of the last `n` days (oldest→newest) for a grid view.
export function gridDays(n, endIso = todayISO()) {
  return Array.from({ length: n }, (_, i) => addDays(endIso, -(n - 1 - i)));
}
