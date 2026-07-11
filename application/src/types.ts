// Shared domain model for the WeightTracker app. These interfaces describe the
// shapes the data layer (see data/repo.ts, data/seed.ts, data/firestore.ts)
// produces and the UI consumes. Pure types only — no runtime code.

export type Role = 'owner' | 'editor' | 'viewer';

export interface Profile {
  uid: string;
  name: string;
  email: string;
  photoURL?: string | null;
  heightM: number | null;
  // Not stored on the profile doc (membership color is derived per-dashboard),
  // but the UI reads it defensively with a fallback — keep it optional.
  color?: string | null;
}

// A person's canonical, self-logged weigh-in.
export interface WeightEntry {
  id: string;
  date: string; // 'YYYY-MM-DD'
  kg: number;
  note: string;
}

// A derived chart point (date + kg only).
export interface SeriesPoint {
  date: string;
  kg: number;
}

// Non-derivable membership facts stored on a dashboard.
export interface Member {
  uid: string;
  role: Role;
  joinedAt: number;
}

// A display-ready member: membership facts joined with derived profile bits
// (see lib/dashboards.ts memberList).
export interface EnrichedMember extends Member {
  name: string;
  email: string;
  photoURL: string | null;
  heightM: number | null;
  color: string;
  initial: string;
}

export interface Goal {
  startKg?: number | null;
  targetKg?: number | null;
  targetISO?: string | null;
}

export interface TeamGoal {
  label: string;
  target: number;
}

export interface Habit {
  id: string;
  label: string;
  emoji: string;
}

// Habit completion mark: 1 = done, 2 = grace/repair day (see lib/habits.ts).
export type HabitMark = 1 | 2;

// Per-(habit, person) completion log: { 'YYYY-MM-DD': HabitMark }.
export type HabitLog = Record<string, HabitMark>;
// habitLogs[dashboardId][uid][habitId] = HabitLog
export type HabitLogs = Record<string, Record<string, Record<string, HabitLog>>>;

export interface Nsv {
  id: string;
  date: string;
  text: string;
}
// nsv[dashboardId][uid] = Nsv[]
export type NsvMap = Record<string, Record<string, Nsv[]>>;

export interface Invite {
  id: string;
  dashboardId: string;
  dashboardName: string;
  fromUid: string;
  fromName: string;
  fromInitial?: string;
  toEmail: string;
  role: Role;
  status: 'pending' | 'accepted' | 'declined';
  createdAt: number;
  members?: number;
}

export interface Notification {
  id: string;
  text: string;
  sub: string;
  when: number;
  unread: boolean;
}

export interface PublicLink {
  enabled: boolean;
  token: string | null;
}

// Per-dashboard view preferences (default chart layers + which people show).
// Keyed by layer name / uid so the shapes stay open to future additions.
export interface DashboardSettings {
  layers?: Record<string, boolean>;
  shown?: Record<string, boolean>;
}

export interface Dashboard {
  id: string;
  name: string;
  ownerUid: string;
  createdAt: number;
  updatedAt: number;
  members: Record<string, Member>;
  // Denormalized member-uid array Firestore queries with array-contains; the
  // in-memory backend derives membership from `members`, so treat it as optional.
  memberUids?: string[];
  trackedUids: string[];
  goals: Record<string, Goal>;
  teamGoal: TeamGoal | null;
  habits: Habit[];
  public: PublicLink;
  settings?: DashboardSettings;
}

// The subset of a Firebase user we read across the app. The provider is stored
// verbatim from onAuthStateChanged, so the full Firebase `User` fields are
// present at runtime; we surface only the ones the app actually reads.
export interface AuthUser {
  uid: string;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
  providerData?: ReadonlyArray<{ providerId: string }>;
}

// A stored public-snapshot member: an EnrichedMember minus email, which is
// never exposed on the world-readable public link (DEV-6).
export type PublicMember = Omit<EnrichedMember, 'email'>;

// The world-readable snapshot behind a public share link. Assembled by the
// data layer (memory.getPublicView / firestore.rebuildPublic); `id` is used by
// the in-memory backend and `dashboardId` by the Firestore document.
export interface PublicView {
  id?: string;
  dashboardId?: string;
  name: string;
  members: Record<string, PublicMember>;
  trackedUids: string[];
  goals: Record<string, Goal>;
  teamGoal: TeamGoal | null;
  habits: Habit[];
  series: Record<string, SeriesPoint[]>;
  habitLogs: Record<string, Record<string, HabitLog>>;
  nsv: Record<string, Nsv[]>;
  enabled?: boolean;
  updatedAt?: number;
}

// The in-memory / demo backend store (see data/memory.ts, data/seed.ts).
export interface Store {
  profiles: Record<string, Profile>;
  weights: Record<string, WeightEntry[]>;
  dashboards: Dashboard[];
  habitLogs: HabitLogs;
  nsv: NsvMap;
  invites: Invite[];
}
