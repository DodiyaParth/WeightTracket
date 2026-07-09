import { useState, useCallback } from 'react';

// Standardizes a mutation call site: tracks busy/error and never lets a
// rejected write pass silently (see FEEDBACK-actionplan.md S-C / DEV-5).
// No Undo affordance by design — recoverability comes from collision/destructive
// confirms, not an undo action.
export function useAsyncAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const run = useCallback(async (fn) => {
    setBusy(true);
    setError(null);
    try {
      return await fn();
    } catch (e) {
      setError(e?.message || 'Something went wrong. Please try again.');
      throw e;
    } finally {
      setBusy(false);
    }
  }, []);

  return { run, busy, error, setError };
}
