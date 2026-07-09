// Classifies incoming weight entries against a person's existing history so the
// UI can prompt before silently overwriting a same-date entry (DEV-11 / user
// spec: info popup when the weight is unchanged, confirm-to-overwrite when it
// differs; new dates always save straight through).
import { WEIGHT_DP } from './format.js';
import type { SeriesPoint } from '../types.js';

const sameKg = (a: number, b: number): boolean =>
  Number(a).toFixed(WEIGHT_DP) === Number(b).toFixed(WEIGHT_DP);

export interface ClassifiedEntries<T extends SeriesPoint> {
  fresh: T[];
  unchanged: Array<T & { prevKg: number }>;
  conflicting: Array<T & { prevKg: number }>;
}

// existing: [{date, kg}]; incoming: [{date, kg, ...}]
// Returns { fresh, unchanged, conflicting } — unchanged/conflicting entries are
// annotated with prevKg (the existing value) for messaging.
export function classifyEntries<T extends SeriesPoint>(
  incoming?: T[] | null,
  existing?: SeriesPoint[] | null,
): ClassifiedEntries<T> {
  const byDate = new Map<string, SeriesPoint>((existing || []).map((e): [string, SeriesPoint] => [e.date, e]));
  const fresh: T[] = [];
  const unchanged: Array<T & { prevKg: number }> = [];
  const conflicting: Array<T & { prevKg: number }> = [];
  for (const e of incoming || []) {
    const prev = byDate.get(e.date);
    if (!prev) fresh.push(e);
    else if (sameKg(prev.kg, e.kg)) unchanged.push({ ...e, prevKg: prev.kg });
    else conflicting.push({ ...e, prevKg: prev.kg });
  }
  return { fresh, unchanged, conflicting };
}
