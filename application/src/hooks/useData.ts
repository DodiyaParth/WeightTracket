// Data hooks. Each fetches via the repo through TanStack Query, which keys the
// cache per-argument (e.g. per uid/dashboard id) so two components asking for
// the same data share one request instead of double-fetching, and dedupes
// concurrent mounts for free. Cross-view refresh after a write comes from the
// mutation hooks in hooks/mutations.js, which invalidate the entity-level
// query keys each write can affect — so logging a weigh-in still updates
// every open view showing it, without every view re-fetching independently.
import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { repo } from '../data/repo.js';
import type {
  Profile, WeightEntry, Dashboard, SeriesPoint, HabitLog, Nsv, Invite, Notification, PublicView,
} from '../types.js';

interface AsyncResult<T> {
  data: T | undefined;
  loading: boolean;
  error: unknown;
  reload: () => void;
}

// Adapts a TanStack Query result back to the {data, loading, error, reload}
// shape every hook returned before this migration, so none of the ~10
// consuming components need to change. `empty` fills in for `undefined` when
// a query is simply disabled (missing uid/id) or hasn't resolved yet — but a
// genuine fetch error still surfaces `data: undefined` (never silently
// replaced by the empty default), matching the old useAsync contract that
// existing error-path tests rely on.
function toAsyncResult<T>(query: UseQueryResult<T, Error>, empty: T): AsyncResult<T> {
  return {
    data: query.isError ? undefined : (query.data ?? empty),
    loading: query.isLoading,
    error: query.error ?? null,
    reload: (): void => { void query.refetch(); },
  };
}

// Every hook below follows the same `enabled: !!param` + `param!` pairing:
// `enabled` guarantees the queryFn never runs while the argument is missing,
// so the `!` inside it asserts a boundary TanStack Query itself enforces —
// not an unchecked assumption — rather than a redundant `param ? … : …`
// fallback that would never be reachable.

export const useProfile = (uid?: string): AsyncResult<Profile | null> => {
  const query = useQuery<Profile | null>({
    queryKey: ['profile', uid],
    queryFn: () => repo.getProfile(uid!),
    enabled: !!uid,
  });
  return toAsyncResult(query, null);
};

// Batch-fetches profiles for a set of uids — how dashboard-membership UI joins
// live name/email/photoURL/heightM against the (deliberately un-denormalized)
// members map. Keyed by a joined string since arrays are reference-unstable.
export const useProfiles = (uids?: string[]): AsyncResult<Record<string, Profile>> => {
  const key = (uids || []).join(',');
  const query = useQuery<Record<string, Profile>>({
    queryKey: ['profiles', key],
    queryFn: () => repo.getProfiles(uids),
    enabled: !!(uids && uids.length),
  });
  return toAsyncResult(query, {});
};

export const useWeights = (uid?: string): AsyncResult<WeightEntry[]> => {
  const query = useQuery<WeightEntry[]>({
    queryKey: ['weights', uid],
    queryFn: () => repo.listWeights(uid!),
    enabled: !!uid,
  });
  return toAsyncResult(query, []);
};

export const useDashboards = (uid?: string): AsyncResult<Dashboard[]> => {
  const query = useQuery<Dashboard[]>({
    queryKey: ['dashboards', uid],
    queryFn: () => repo.listDashboards(uid!),
    enabled: !!uid,
  });
  return toAsyncResult(query, []);
};

export const useDashboard = (id?: string): AsyncResult<Dashboard | null> => {
  const query = useQuery<Dashboard | null>({
    queryKey: ['dashboard', id],
    queryFn: () => repo.getDashboard(id!),
    enabled: !!id,
  });
  return toAsyncResult(query, null);
};

export const useDashboardSeries = (id?: string): AsyncResult<Record<string, SeriesPoint[]>> => {
  const query = useQuery<Record<string, SeriesPoint[]>>({
    queryKey: ['series', id],
    queryFn: () => repo.getDashboardSeries(id!),
    enabled: !!id,
  });
  return toAsyncResult(query, {});
};

export const useHabitLogs = (id?: string): AsyncResult<Record<string, Record<string, HabitLog>>> => {
  const query = useQuery<Record<string, Record<string, HabitLog>>>({
    queryKey: ['habitLogs', id],
    queryFn: () => repo.getHabitLogs(id!),
    enabled: !!id,
  });
  return toAsyncResult(query, {});
};

export const useNsv = (id?: string): AsyncResult<Record<string, Nsv[]>> => {
  const query = useQuery<Record<string, Nsv[]>>({
    queryKey: ['nsv', id],
    queryFn: () => repo.listNsv(id!),
    enabled: !!id,
  });
  return toAsyncResult(query, {});
};

export const useInvites = (email?: string | null): AsyncResult<Invite[]> => {
  const query = useQuery<Invite[]>({
    queryKey: ['invites', email],
    queryFn: () => repo.listInvites(email!),
    enabled: !!email,
  });
  return toAsyncResult(query, []);
};

export const useNotifications = (uid?: string): AsyncResult<Notification[]> => {
  const query = useQuery<Notification[]>({
    queryKey: ['notifications', uid],
    queryFn: () => repo.listNotifications(uid!),
    enabled: !!uid,
  });
  return toAsyncResult(query, []);
};

// A dashboard owner's own outgoing invites (ShareModal's "pending" list) —
// distinct from useInvites, which lists invites addressed to the current user.
export const useOutgoingInvites = (dashboardId?: string): AsyncResult<Invite[]> => {
  const query = useQuery<Invite[]>({
    queryKey: ['outgoingInvites', dashboardId],
    queryFn: () => repo.listOutgoing(dashboardId!),
    enabled: !!dashboardId,
  });
  return toAsyncResult(query, []);
};

// The world-readable snapshot behind a public share link (see PublicView.jsx).
export const usePublicView = (token?: string): AsyncResult<PublicView | null> => {
  const query = useQuery<PublicView | null>({
    queryKey: ['publicView', token],
    queryFn: () => repo.getPublicView(token!),
    enabled: !!token,
  });
  return toAsyncResult(query, null);
};
