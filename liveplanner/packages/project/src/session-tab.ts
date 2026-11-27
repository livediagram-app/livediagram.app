// A Session tab's state (docs/specs/026-plan/session-tabs.md, blueprint session-tabs.md "Data and persistence"): what
// the session picks, where it is, what it decided and who runs it, kept whole on the tab as `Tab.session` so it rides
// the tab's sync, persistence and late-joiner replay. Written only by the facilitator (an Editor). Pure: the caller
// passes `now`. Not the session TOOLS (timer, dot vote: ./session.ts), which every tab keeps, a Session tab's too.
import {
  SESSION_KIND_OUTCOMES,
  SESSION_QUEUE_MAX,
  isSessionKindId,
  isSessionOutcome,
  normaliseBoardSort,
  type BoardSortLevel,
  type SessionKindId,
  type SessionOutcome,
} from '@liveplanner/items';

export const SESSION_TYPES_MAX = 50;
export const SESSION_STAGES_MAX = 100;
export const SESSION_TIMEBOX_MIN_MS = 60_000;
export const SESSION_TIMEBOX_MAX_MS = 30 * 60_000;
// The most estimate points a Sprint Planning capacity holds.
export const SESSION_CAPACITY_MAX = 9_999;
// How long this screen must not see the facilitator in the room before Take Over shows: a refresh comes back sooner.
export const FACILITATOR_GRACE_MS = 10_000;

export type SessionSetup = {
  typeIds: string[];
  statuses: string[];
  // As a board's Sort Cards; absent keeps the hand order (rank).
  sortBy?: BoardSortLevel[];
  // A card type id -> the stage the kind's completing outcome (Refined, Committed) moves its cards to; absent: the
  // next stage in the type's order.
  targets?: Record<string, string>;
  // Per card; absent: no timebox.
  timeboxMs?: number;
  // A kind with a tally (Sprint Planning): the estimate points the committed cards are tallied against; absent: none.
  capacity?: number;
};

export type SessionFacilitator = { id: string; name: string; color: string };

export type SessionDecision = { outcome: SessionOutcome; at: number; by: string };

export type SessionTabState = {
  v: 1;
  sessionKind: SessionKindId;
  setup: SessionSetup;
  facilitator?: SessionFacilitator;
  // The card the room is on; absent or no longer queued: the first still to go.
  currentId?: string;
  // When the current card became current: the timebox counts from it.
  cardStartedAt?: number;
  // Card id -> what the session decided for it.
  decided?: Record<string, SessionDecision>;
};

// What each session kind is (docs/specs/026-plan/session-tabs.md "Designed to grow"): its name, the outcomes its
// action bar offers, its completing outcome (the fill button, which moves the card to its target stage), how its
// sidebar groups, and what it tallies (Sprint Planning: the committed estimates against a capacity). The editor's
// session-kinds.tsx adds its wording and set-up defaults.
export type SessionKindInfo = {
  label: string;
  outcomes: readonly SessionOutcome[];
  completes: SessionOutcome;
  grouping: 'none';
  tally: 'none' | 'estimate';
};

export const SESSION_KINDS: Readonly<Record<SessionKindId, SessionKindInfo>> = {
  refinement: {
    label: 'Refinement',
    outcomes: SESSION_KIND_OUTCOMES.refinement,
    completes: 'refined',
    grouping: 'none',
    tally: 'none',
  },
  planning: {
    label: 'Sprint Planning',
    outcomes: SESSION_KIND_OUTCOMES.planning,
    completes: 'committed',
    grouping: 'none',
    tally: 'estimate',
  },
};

const isObj = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);

const strings = (v: unknown, max: number): string[] => {
  if (!Array.isArray(v)) return [];
  const out: string[] = [];
  for (const s of v) {
    if (typeof s !== 'string' || !s || out.includes(s)) continue;
    out.push(s);
    if (out.length === max) break;
  }
  return out;
};

function readSetup(raw: unknown): SessionSetup {
  const r = isObj(raw) ? raw : {};
  const setup: SessionSetup = {
    typeIds: strings(r['typeIds'], SESSION_TYPES_MAX),
    statuses: strings(r['statuses'], SESSION_STAGES_MAX),
  };
  const sortBy = normaliseBoardSort(r['sortBy']);
  if (sortBy) setup.sortBy = sortBy;
  if (isObj(r['targets'])) {
    const targets: Record<string, string> = {};
    for (const [k, v] of Object.entries(r['targets']))
      if (k && typeof v === 'string' && v) targets[k] = v;
    if (Object.keys(targets).length) setup.targets = targets;
  }
  const box = r['timeboxMs'];
  if (typeof box === 'number' && Number.isFinite(box) && box > 0)
    setup.timeboxMs = Math.min(SESSION_TIMEBOX_MAX_MS, Math.max(SESSION_TIMEBOX_MIN_MS, box));
  const capacity = sessionCapacity(r['capacity']);
  if (capacity) setup.capacity = capacity;
  return setup;
}

// A capacity as kept: a positive number rounded to a whole point, at most SESSION_CAPACITY_MAX; else none.
export function sessionCapacity(raw: unknown): number | undefined {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return undefined;
  const points = Math.min(SESSION_CAPACITY_MAX, Math.round(raw));
  return points > 0 ? points : undefined;
}

function readFacilitator(raw: unknown): SessionFacilitator | undefined {
  if (!isObj(raw)) return undefined;
  const { id, name, color } = raw;
  if (typeof id !== 'string' || !id || typeof name !== 'string') return undefined;
  return { id, name, color: typeof color === 'string' ? color : '#64748b' };
}

function readDecided(raw: unknown): Record<string, SessionDecision> | undefined {
  if (!isObj(raw)) return undefined;
  const out: Record<string, SessionDecision> = {};
  let n = 0;
  for (const [id, d] of Object.entries(raw)) {
    if (!isObj(d) || !isSessionOutcome(d['outcome']) || typeof d['at'] !== 'number') continue;
    out[id] = {
      outcome: d['outcome'],
      at: d['at'],
      by: typeof d['by'] === 'string' ? d['by'] : '',
    };
    if (++n === SESSION_QUEUE_MAX) break;
  }
  return n ? out : undefined;
}

// The tab's session as stored, or null when it holds none this build can run (absent, malformed, or a kind from a
// later release).
export function readSessionTab(raw: unknown): SessionTabState | null {
  if (!isObj(raw) || !isSessionKindId(raw['sessionKind'])) return null;
  const out: SessionTabState = {
    v: 1,
    sessionKind: raw['sessionKind'],
    setup: readSetup(raw['setup']),
  };
  const facilitator = readFacilitator(raw['facilitator']);
  if (facilitator) out.facilitator = facilitator;
  if (typeof raw['currentId'] === 'string' && raw['currentId']) out.currentId = raw['currentId'];
  if (typeof raw['cardStartedAt'] === 'number') out.cardStartedAt = raw['cardStartedAt'];
  const decided = readDecided(raw['decided']);
  if (decided) out.decided = decided;
  return out;
}

// A new session of `sessionKind` with `setup`, nobody facilitating yet.
export function newSessionTab(sessionKind: SessionKindId, setup: SessionSetup): SessionTabState {
  return { v: 1, sessionKind, setup };
}

// --- Facilitator -------------------------------------------------------------

export const isFacilitator = (s: SessionTabState, selfId: string): boolean =>
  s.facilitator?.id === selfId;

// The baton taken (on opening a session nobody runs, Facilitate, Take Over) or handed to someone.
export const withFacilitator = (
  s: SessionTabState,
  who: SessionFacilitator | undefined,
): SessionTabState => {
  const { facilitator: _gone, ...rest } = s;
  return who ? { ...rest, facilitator: who } : rest;
};

// Whether the facilitator has been gone long enough for Take Over: `lastSeenAt` is when this screen last saw them in
// the room (or when it opened, if it never has).
export const facilitatorAway = (lastSeenAt: number, now: number): boolean =>
  now - lastSeenAt >= FACILITATOR_GRACE_MS;

// --- Moving through the queue ------------------------------------------------

// The room moves to `itemId` (or to none), its clock starting again.
export function withCurrent(
  s: SessionTabState,
  itemId: string | null,
  now: number,
): SessionTabState {
  const { currentId: _c, cardStartedAt: _t, ...rest } = s;
  return itemId ? { ...rest, currentId: itemId, cardStartedAt: now } : rest;
}

// An outcome decided for `itemId` by `by` (a name), the room moving on to `nextId`.
export function withDecision(
  s: SessionTabState,
  itemId: string,
  outcome: SessionOutcome,
  by: string,
  now: number,
  nextId: string | null,
): SessionTabState {
  const decided = { ...s.decided, [itemId]: { outcome, at: now, by } };
  return withCurrent({ ...s, decided }, nextId, now);
}

// Undo Outcome: the card can be decided again; the room stays on it.
export function withoutDecision(s: SessionTabState, itemId: string): SessionTabState {
  if (!s.decided?.[itemId]) return s;
  const { [itemId]: _gone, ...decided } = s.decided;
  const { decided: _d, ...rest } = s;
  return Object.keys(decided).length ? { ...rest, decided } : rest;
}

// Start Again: every outcome cleared, the room back at the start.
export function withNoDecisions(s: SessionTabState): SessionTabState {
  const { decided: _d, currentId: _c, cardStartedAt: _t, ...rest } = s;
  return rest;
}

// --- Timebox -----------------------------------------------------------------

// The time left on the current card, or null when no timebox is on (or the card has no start yet).
export function timeboxLeftMs(s: SessionTabState, now: number): number | null {
  const box = s.setup.timeboxMs;
  if (!box || s.cardStartedAt === undefined) return null;
  return Math.max(0, box - (now - s.cardStartedAt));
}
