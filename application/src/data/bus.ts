// Tiny change bus. Backends emit after a mutation; data hooks subscribe and
// refetch. Keeps the same hooks working for both the memory and Firestore
// backends without wiring realtime listeners everywhere.
//
// emit() is debounced (DEV-16): a single write often triggers several emits
// in quick succession (e.g. a bulk import's per-dashboard fan-out), which
// would otherwise refetch every mounted hook once per emit. Coalescing them
// into one microtask-scale tick means every hook still refetches exactly
// once per burst of writes, not once per individual write.
type Listener = () => void;

const listeners = new Set<Listener>();
let pending = false;

export const bus = {
  emit(): void {
    if (pending) return;
    pending = true;
    setTimeout(() => {
      pending = false;
      listeners.forEach((l) => {
        try { l(); } catch { /* ignore listener errors */ }
      });
    }, 30);
  },
  subscribe(cb: Listener): () => void {
    listeners.add(cb);
    return () => listeners.delete(cb);
  },
};
