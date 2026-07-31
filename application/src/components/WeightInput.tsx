import { forwardRef } from 'react';
import Icon from './Icon.jsx';

// The big number + ∓0.1 steppers + kg suffix, extracted verbatim from QuickLog
// so the goal wizard's start/target-weight steps reuse the exact same control
// (handover §H component-reuse map). Presentational only: the caller owns the
// value, parsing, focus, and Enter handling — this just renders and reports
// changes, so QuickLog's existing behavior (focus-and-select, collision
// classify on save) is unchanged.
interface WeightInputProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  onEnter?: () => void;
  ariaLabel?: string;
}

const WeightInput = forwardRef<HTMLInputElement, WeightInputProps>(function WeightInput(
  { value, onChange, disabled = false, onEnter, ariaLabel = 'Weight in kg' }, ref,
) {
  const step = (d: number) => onChange(Math.max(0, (parseFloat(value) || 0) + d).toFixed(2));
  return (
    <div className="weigh-input">
      <button className="step" onClick={() => step(-0.1)} disabled={disabled} aria-label="minus 0.1"><Icon name="minus" size={20} color="var(--text-2)" /></button>
      <div className="weigh-field">
        <input
          ref={ref} inputMode="decimal" value={value} disabled={disabled} aria-label={ariaLabel}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !disabled) onEnter?.(); }}
          onBlur={() => onChange((+value || 0).toFixed(2))}
        />
        <span className="unit">kg</span>
      </div>
      <button className="step" onClick={() => step(0.1)} disabled={disabled} aria-label="plus 0.1"><Icon name="plus" size={20} color="var(--text-2)" /></button>
    </div>
  );
});

export default WeightInput;
