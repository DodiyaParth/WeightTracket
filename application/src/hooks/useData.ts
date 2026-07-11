// Data hooks. Each fetches via the repo and auto-refetches when the change bus
// fires (after any mutation), so logging a weigh-in updates every open view.
import { useState, useEffect, useCallback, useRef, type DependencyList } from 'react';
import { repo, bus } from '../data/repo.js';
import type {
  Profile, WeightEntry, Dashboard, SeriesPoint, HabitLog, Nsv, Invite, Notification,
} from '../types.js';

interface AsyncState<T> {
  data: T | undefined;
  loading: boolean;
  error: unknown;
}

export function useAsync<T>(fn: () => Promise<T> | T, deps: DependencyList = []) {
  const [state, setState] = useState<AsyncState<T>>({ data: undefined, loading: true, error: null });
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const reqId = useRef(0);

  const run = useCallback(() => {
    const id = ++reqId.current;
    setState((s) => ({ ...s, loading: true }));
    Promise.resolve(fnRef.current())
      .then((data) => { if (id === reqId.current) setState({ data, loading: false, error: null }); })
      .catch((error) => { if (id === reqId.current) setState({ data: undefined, loading: false, error }); });
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    run();
    return bus.subscribe(run);
  }, [run]);

  return { ...state, reload: run };
}

export const useProfile = (uid?: string) =>
  useAsync<Profile | null>(() => (uid ? repo.getProfile(uid) : Promise.resolve(null)), [uid]);
// Batch-fetches profiles for a set of uids — how dashboard-membership UI joins
// live name/email/photoURL/heightM against the (deliberately un-denormalized)
// members map. Keyed by a joined string since arrays are reference-unstable.
export const useProfiles = (uids?: string[]) => {
  const key = (uids || []).join(',');
  return useAsync<Record<string, Profile>>(() => (uids && uids.length ? repo.getProfiles(uids) : Promise.resolve({})), [key]);
};
export const useWeights = (uid?: string) =>
  useAsync<WeightEntry[]>(() => (uid ? repo.listWeights(uid) : Promise.resolve([])), [uid]);
export const useDashboards = (uid?: string) =>
  useAsync<Dashboard[]>(() => (uid ? repo.listDashboards(uid) : Promise.resolve([])), [uid]);
export const useDashboard = (id?: string) =>
  useAsync<Dashboard | null>(() => (id ? repo.getDashboard(id) : Promise.resolve(null)), [id]);
export const useDashboardSeries = (id?: string) =>
  useAsync<Record<string, SeriesPoint[]>>(() => (id ? repo.getDashboardSeries(id) : Promise.resolve({})), [id]);
export const useHabitLogs = (id?: string) =>
  useAsync<Record<string, Record<string, HabitLog>>>(() => (id ? repo.getHabitLogs(id) : Promise.resolve({})), [id]);
export const useNsv = (id?: string) =>
  useAsync<Record<string, Nsv[]>>(() => (id ? repo.listNsv(id) : Promise.resolve({})), [id]);
export const useInvites = (email?: string | null) =>
  useAsync<Invite[]>(() => (email ? repo.listInvites(email) : Promise.resolve([])), [email]);
export const useNotifications = (uid?: string) =>
  useAsync<Notification[]>(() => (uid ? repo.listNotifications(uid) : Promise.resolve([])), [uid]);
