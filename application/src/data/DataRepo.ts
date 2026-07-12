// The explicit contract every data backend must satisfy. `firestore.ts` is the
// production implementation; `memory.ts` mirrors it for tests/demo mode. This
// interface makes that mirroring a compile-time guarantee instead of an
// informal comment — either backend drifting from the other's shape now fails
// `tsc`, not a runtime bug report.
import type {
  AuthUser, Dashboard, HabitLog, HabitMark, Invite, Notification, Nsv, Profile,
  PublicLink, PublicView, Role, SeriesPoint, WeightEntry,
} from '../types.js';

export interface DataRepo {
  // ---- profile ------------------------------------------------------------
  getProfile(uid: string): Promise<Profile | null>;
  getProfiles(uids?: string[] | null): Promise<Record<string, Profile>>;
  ensureProfile(authUser: AuthUser): Promise<Profile>;
  updateProfile(uid: string, patch: Partial<Profile>): Promise<void>;

  // ---- weights (self-only) -------------------------------------------------
  listWeights(uid: string): Promise<WeightEntry[]>;
  addWeight(uid: string, entry: { date: string; kg: number; note?: string }): Promise<void>;
  addWeights(uid: string, entries: Array<{ date: string; kg: number; note?: string }>): Promise<number>;
  updateWeight(uid: string, id: string, patch: Partial<WeightEntry>): Promise<void>;
  deleteWeight(uid: string, id: string): Promise<void>;

  // ---- dashboards -----------------------------------------------------------
  listDashboards(uid: string): Promise<Dashboard[]>;
  getDashboard(id: string): Promise<Dashboard | null>;
  createDashboard(
    uid: string,
    opts: { name?: string; teamGoalLabel?: string | null; teamGoalTarget?: number | string }
  ): Promise<Dashboard>;
  updateDashboard(id: string, patch: Partial<Dashboard>): Promise<void>;
  updateMemberRole(id: string, uid: string, role: Role): Promise<void>;
  removeMember(id: string, uid: string): Promise<void>;
  deleteDashboard(id: string): Promise<void>;
  getDashboardSeries(id: string): Promise<Record<string, SeriesPoint[]>>;

  // ---- habits ---------------------------------------------------------------
  getHabitLogs(id: string): Promise<Record<string, Record<string, HabitLog>>>;
  setHabitMark(id: string, uid: string, habitId: string, date: string, value: HabitMark | 0 | null | undefined): Promise<void>;

  // ---- NSV --------------------------------------------------------------------
  listNsv(id: string): Promise<Record<string, Nsv[]>>;
  addNsv(id: string, uid: string, note: { date?: string | null; text: string }): Promise<void>;
  deleteNsv(dashboardId: string, noteId: string): Promise<void>;

  // ---- invites ----------------------------------------------------------------
  listInvites(email: string): Promise<Invite[]>;
  listOutgoing(dashboardId: string): Promise<Invite[]>;
  createInvite(
    dashboardId: string,
    opts: { fromUid: string; fromName: string; toEmail: string; role?: Role }
  ): Promise<Invite>;
  acceptInvite(inviteId: string, authUser: AuthUser): Promise<void>;
  declineInvite(inviteId: string): Promise<void>;
  cancelInvite(inviteId: string): Promise<void>;

  // ---- sharing / public ---------------------------------------------------------
  setPublicLink(dashboardId: string, enabled: boolean): Promise<PublicLink>;
  getPublicView(token: string): Promise<PublicView | null>;

  // ---- notifications --------------------------------------------------------------
  listNotifications(uid: string): Promise<Notification[]>;
}
