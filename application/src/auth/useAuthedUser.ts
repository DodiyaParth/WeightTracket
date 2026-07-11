import { useAuth } from './AuthContext.js';
import type { AuthUser } from '../types.js';

// Access the signed-in user from inside a ProtectedRoute subtree, where auth has
// already resolved and a user is guaranteed. Centralising the invariant here lets
// protected pages read `user.uid` directly instead of sprinkling `user!`/`user?.`.
// The throw is unreachable in production (ProtectedRoute renders <Navigate/> before
// mounting children when there is no user) and only guards against misuse.
export function useAuthedUser(): AuthUser {
  const { user } = useAuth();
  if (!user) throw new Error('useAuthedUser must be used within a ProtectedRoute (no signed-in user)');
  return user;
}
