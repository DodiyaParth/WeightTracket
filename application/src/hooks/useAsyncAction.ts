import { useState, useCallback } from 'react';

// Standardizes a mutation call site: tracks busy/error and never lets a
// rejected write pass silently (see ../../documents/app-feedback-action-plan.md S-C / DEV-5).
// No Undo affordance by design — recoverability comes from collision/destructive
// confirms, not an undo action.
export function useAsyncAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async <T>(fn: () => T | Promise<T>): Promise<T> => {
    setBusy(true);
    setError(null);
    try {
      return await fn();
    } catch (e) {
      setError((e as { message?: string } | null)?.message || 'Something went wrong. Please try again.');
      throw e;
    } finally {
      setBusy(false);
    }
  }, []);

  return { run, busy, error, setError };
}
