// Friendly copy for Firebase Auth error codes (see AuthContext.tsx's
// errorCode()/setError calls). Lives in auth/, not lib/ or the Login page,
// because this mapping is auth-domain knowledge — the generic `errorCode`/
// `errorMessage` narrowing helpers in lib/errors.ts stay generic (shared by
// non-auth error UIs too).
const AUTH_ERROR_MESSAGES: Record<string, string> = {
  'auth/invalid-credential': 'Wrong email or password.',
  'auth/invalid-email': 'That doesn’t look like a valid email.',
  'auth/user-not-found': 'Wrong email or password.',
  'auth/wrong-password': 'Wrong email or password.',
  'auth/email-already-in-use': 'That email already has an account — try signing in instead.',
  'auth/weak-password': 'Use at least 6 characters.',
  'auth/missing-password': 'Enter a password.',
  'auth/not-configured': 'Firebase isn’t configured yet.',
  'not-configured': 'Firebase isn’t configured yet.',
};

export const authErrorText = (code: string): string =>
  AUTH_ERROR_MESSAGES[code] || 'Something went wrong. Please try again.';
