// Strict catch clauses type the caught value as `unknown`. These helpers narrow
// it to the bits the UI needs (a Firebase-style `.code`, or a message) without
// assuming a concrete Error subclass — behaviour matches the prior `e?.code` /
// `e?.message` access, just type-safe.
//
// Deliberately generic and code-agnostic: both auth (AuthContext.tsx) and
// non-auth data-mutation errors (e.g. DashboardDetail.tsx) narrow through
// here. Auth-specific code -> friendly-message mapping lives in
// auth/authErrors.ts, not here.

export function errorCode(e: unknown): string | undefined {
  if (typeof e === 'object' && e !== null && 'code' in e) {
    const code = (e as { code?: unknown }).code;
    return typeof code === 'string' ? code : undefined;
  }
  return undefined;
}

export function errorMessage(e: unknown): string | undefined {
  if (e instanceof Error) return e.message;
  if (typeof e === 'string') return e;
  if (typeof e === 'object' && e !== null && 'message' in e) {
    const msg = (e as { message?: unknown }).message;
    if (typeof msg === 'string') return msg;
  }
  return undefined;
}
