// Data hooks. Each fetches via the repo and auto-refetches when the change bus
// fires (after any mutation), so logging a weigh-in updates every open view.
import { useState, useEffect, useCallback, useRef } from 'react';
import { repo, bus } from '../data/repo.js';

export function useAsync(fn, deps = []) {
  const [state, setState] = useState({ data: undefined, loading: true, error: null });
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

export const useProfile = (uid) => useAsync(() => (uid ? repo.getProfile(uid) : Promise.resolve(null)), [uid]);
// Batch-fetches profiles for a set of uids — how dashboard-membership UI joins
// live name/email/photoURL/heightM against the (deliberately un-denormalized)
// members map. Keyed by a joined string since arrays are reference-unstable.
export const useProfiles = (uids) => {
  const key = (uids || []).join(',');
  return useAsync(() => (uids && uids.length ? repo.getProfiles(uids) : Promise.resolve({})), [key]);
};
export const useWeights = (uid) => useAsync(() => (uid ? repo.listWeights(uid) : Promise.resolve([])), [uid]);
export const useDashboards = (uid) => useAsync(() => (uid ? repo.listDashboards(uid) : Promise.resolve([])), [uid]);
export const useDashboard = (id) => useAsync(() => (id ? repo.getDashboard(id) : Promise.resolve(null)), [id]);
export const useDashboardSeries = (id) => useAsync(() => (id ? repo.getDashboardSeries(id) : Promise.resolve({})), [id]);
export const useHabitLogs = (id) => useAsync(() => (id ? repo.getHabitLogs(id) : Promise.resolve({})), [id]);
export const useNsv = (id) => useAsync(() => (id ? repo.listNsv(id) : Promise.resolve({})), [id]);
export const useInvites = (email) => useAsync(() => (email ? repo.listInvites(email) : Promise.resolve([])), [email]);
export const useNotifications = (uid) => useAsync(() => (uid ? repo.listNotifications(uid) : Promise.resolve([])), [uid]);
