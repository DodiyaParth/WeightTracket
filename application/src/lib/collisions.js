// Classifies incoming weight entries against a person's existing history so the
// UI can prompt before silently overwriting a same-date entry (DEV-11 / user
// spec: info popup when the weight is unchanged, confirm-to-overwrite when it
// differs; new dates always save straight through).
import { WEIGHT_DP } from './format.js';

const sameKg = (a, b) => Number(a).toFixed(WEIGHT_DP) === Number(b).toFixed(WEIGHT_DP);

// existing: [{date, kg}]; incoming: [{date, kg, ...}]
// Returns { fresh, unchanged, conflicting } — unchanged/conflicting entries are
// annotated with prevKg (the existing value) for messaging.
export function classifyEntries(incoming, existing) {
  const byDate = new Map((existing || []).map((e) => [e.date, e]));
  const fresh = [];
  const unchanged = [];
  const conflicting = [];
  for (const e of incoming || []) {
    const prev = byDate.get(e.date);
    if (!prev) fresh.push(e);
    else if (sameKg(prev.kg, e.kg)) unchanged.push({ ...e, prevKg: prev.kg });
    else conflicting.push({ ...e, prevKg: prev.kg });
  }
  return { fresh, unchanged, conflicting };
}
