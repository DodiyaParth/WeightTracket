// Mutation hooks: one per repo write, each shaped exactly like the old
// useAsyncAction ({ run, busy, error }) so call sites barely change, but now
// `run` also invalidates exactly the query-key groups that write can affect —
// replacing the old change-bus's "refetch literally everything mounted" with
// targeted, still-simple invalidation. This is also the last layer that
// touches `repo` directly: components call these hooks, never `repo.*`.
import { useCallback } from 'react';
import { useMutation, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { repo } from '../data/repo.js';

interface MutationResult<TArgs extends unknown[], TResult> {
  run: (...args: TArgs) => Promise<TResult>;
  busy: boolean;
  error: string | null;
}

function useRepoMutation<TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => Promise<TResult>,
  invalidateKeys: QueryKey[]
): MutationResult<TArgs, TResult> {
  const queryClient = useQueryClient();
  const mutation = useMutation<TResult, Error, TArgs>({
    mutationFn: (args) => fn(...args),
    onSuccess: () => {
      invalidateKeys.forEach((key) => { void queryClient.invalidateQueries({ queryKey: key }); });
    },
  });
  const run = useCallback(
    (...args: TArgs): Promise<TResult> => mutation.mutateAsync(args),
    [mutation.mutateAsync]
  );
  const error = mutation.error ? (mutation.error.message || 'Something went wrong. Please try again.') : null;
  return { run, busy: mutation.isPending, error };
}

// Entity-level key groups — invalidating by the first queryKey segment (see
// hooks/useData.ts) hits every cached id/uid for that entity at once, so a
// write still refreshes every open view showing it (same guarantee the old
// bus gave), without touching entities the write can't affect.
const K = {
  profile: ['profile'] as QueryKey,
  profiles: ['profiles'] as QueryKey,
  weights: ['weights'] as QueryKey,
  dashboards: ['dashboards'] as QueryKey,
  dashboard: ['dashboard'] as QueryKey,
  series: ['series'] as QueryKey,
  habitLogs: ['habitLogs'] as QueryKey,
  nsv: ['nsv'] as QueryKey,
  invites: ['invites'] as QueryKey,
  outgoingInvites: ['outgoingInvites'] as QueryKey,
  notifications: ['notifications'] as QueryKey,
  publicView: ['publicView'] as QueryKey,
};

// ---- profile --------------------------------------------------------------
export const useUpdateProfile = () => useRepoMutation(repo.updateProfile, [K.profile, K.profiles]);

// ---- weights ---------------------------------------------------------------
// Weight fan-out bumps every tracking dashboard's series + updatedAt (sidebar
// recents sort) and, if public sharing is on, the public snapshot too.
const WEIGHT_KEYS = [K.weights, K.series, K.dashboards, K.publicView];
export const useAddWeight = () => useRepoMutation(repo.addWeight, WEIGHT_KEYS);
export const useAddWeights = () => useRepoMutation(repo.addWeights, WEIGHT_KEYS);
export const useUpdateWeight = () => useRepoMutation(repo.updateWeight, WEIGHT_KEYS);
export const useDeleteWeight = () => useRepoMutation(repo.deleteWeight, WEIGHT_KEYS);

// ---- dashboards -------------------------------------------------------------
export const useCreateDashboard = () => useRepoMutation(repo.createDashboard, [K.dashboards]);
export const useUpdateDashboard = () => useRepoMutation(repo.updateDashboard, [K.dashboard, K.dashboards, K.publicView]);
export const useUpdateMemberRole = () => useRepoMutation(repo.updateMemberRole, [K.dashboard, K.dashboards, K.publicView]);
export const useRemoveMember = () => useRepoMutation(repo.removeMember, [K.dashboard, K.dashboards, K.series, K.publicView]);
export const useDeleteDashboard = () =>
  useRepoMutation(repo.deleteDashboard, [K.dashboard, K.dashboards, K.series, K.habitLogs, K.nsv, K.publicView]);

// ---- habits -------------------------------------------------------------------
export const useSetHabitMark = () => useRepoMutation(repo.setHabitMark, [K.habitLogs, K.dashboard, K.dashboards, K.publicView]);

// ---- NSV ------------------------------------------------------------------------
const NSV_KEYS = [K.nsv, K.dashboard, K.dashboards, K.publicView];
export const useAddNsv = () => useRepoMutation(repo.addNsv, NSV_KEYS);
export const useDeleteNsv = () => useRepoMutation(repo.deleteNsv, NSV_KEYS);

// ---- invites --------------------------------------------------------------------
export const useCreateInvite = () => useRepoMutation(repo.createInvite, [K.outgoingInvites, K.invites, K.notifications]);
export const useAcceptInvite = () =>
  useRepoMutation(repo.acceptInvite, [K.invites, K.dashboards, K.dashboard, K.series, K.notifications, K.outgoingInvites]);
export const useDeclineInvite = () => useRepoMutation(repo.declineInvite, [K.invites, K.notifications, K.outgoingInvites]);
export const useCancelInvite = () => useRepoMutation(repo.cancelInvite, [K.outgoingInvites, K.invites, K.notifications]);

// ---- sharing / public -----------------------------------------------------------
export const useSetPublicLink = () => useRepoMutation(repo.setPublicLink, [K.dashboard, K.dashboards, K.publicView]);
