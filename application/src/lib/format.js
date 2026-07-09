// Shared display formatting: weight precision + intent-carrying change formatting.
// Pure, no React/Firebase — see ../../documents/app-feedback-action-plan.md S-B / DEV-19 / F2.

export const WEIGHT_DP = 2;

// Format a weight in kg to fixed display precision.
export const fmtKg = (kg) => (kg == null || Number.isNaN(Number(kg)) ? '—' : Number(kg).toFixed(WEIGHT_DP));

// Format a change/delta value with a direction glyph, a semantic tone, and an
// accessible word — never rely on color/sign alone.
//   goalDirection: 'down' (weight loss, default) | 'up' (weight gain is the goal)
//   atOrBelowGoal: true when a small gain while maintaining should read neutral, not bad
export function formatChange(value, { unit = 'kg', goalDirection = 'down', atOrBelowGoal = false } = {}) {
  const v = Number(value);
  if (value == null || Number.isNaN(v) || Math.abs(v) < 0.005) {
    return { glyph: '—', tone: 'neutral', text: 'No change', aria: 'no change' };
  }
  const losing = v < 0; // weight went down
  const good = goalDirection === 'down' ? losing : !losing;
  const glyph = losing ? '↓' : '↑';
  const word = losing ? 'lost' : 'gained';
  const tone = atOrBelowGoal && !losing ? 'neutral' : good ? 'good' : 'bad';
  const text = `${Math.abs(v).toFixed(WEIGHT_DP)} ${unit}`;
  return { glyph, tone, text, aria: `${word} ${text}` };
}
