// A Session tab's state (docs/specs/026-plan/session-tabs.md, blueprint session-tabs.md "Data and persistence"): what
// the session picks, where it is, what it decided and who runs it, kept whole on the tab as `Tab.session` so it rides
// the tab's sync, persistence and late-joiner replay. Written only by the facilitator (an Editor). Pure: the caller
// passes `now`. Not the session TOOLS (timer, dot vote: ./session.ts), which every tab keeps, a Session tab's too.
import {
  SESSION_FOLLOW_UPS_MAX,
  SESSION_KIND_OUTCOMES,
  SESSION_QUEUE_MAX,
  isItemPerson,
  isSessionKindId,
  itemAssignee,
  isSessionOutcome,
  normaliseBoardSort,
  sessionReason,
  type BoardSortLevel,
  type Item,
  type ItemPerson,
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
  // A card type id -> the stage a kind's closing outcome (Bug Triage's Closed) moves its cards to; absent: the type's
  // close stage.
  closeTargets?: Record<string, string>;
  // Per card; absent: no timebox.
  timeboxMs?: number;
  // A kind with a tally (Sprint Planning): the estimate points the committed cards are tallied against; absent: none.
  capacity?: number;
  // Sprint Review's done range: the cards that entered a picked stage from `since` and up to `until` (ms epochs);
  // absent: open on that side.
  since?: number;
  until?: number;
  // Sprint Review's presenter: absent, each card's assignee (changeable per card); 'none', no presenter shown.
  presenter?: 'none';
};

export type SessionFacilitator = { id: string; name: string; color: string };

export type SessionDecision = {
  outcome: SessionOutcome;
  at: number;
  by: string;
  // The move the outcome made, so Undo can take the card back: from its stage, to the one it was moved to.
  from?: string;
  to?: string;
  // The card's rank in its stage before the move, so Undo puts it back in its own place, not at the column's end.
  fromRank?: string;
  // The outcome set the card's flag (Flag on a card not flagged yet).
  flagSet?: true;
  // A Close's reason and the card it duplicates (an id), and the Card field the duplicate was linked through.
  reason?: string;
  duplicateOf?: string;
  linked?: string;
};

// What an outcome did beyond deciding, kept on its decision.
export type SessionDecisionDetail = Omit<SessionDecision, 'outcome' | 'at' | 'by'>;

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
  // Sprint Review: a card id -> the presenter the facilitator named for it (null: no one), over its assignee.
  presenters?: Record<string, ItemPerson | null>;
  // Sprint Review: a reviewed card id -> the follow-up cards made from it, oldest first.
  followUps?: Record<string, string[]>;
};

// What each session kind is (docs/specs/026-plan/session-tabs.md "Designed to grow"): its name, the outcomes its
// action bar offers, its completing outcome (the fill button, which moves the card to its target stage), how its
// sidebar groups, and what it tallies (Sprint Planning: the committed estimates against a capacity). The editor's
// session-kinds.tsx adds its wording and set-up defaults.
export type SessionKindInfo = {
  label: string;
  outcomes: readonly SessionOutcome[];
  completes: SessionOutcome;
  // Its closing outcome (Bug Triage's Closed): asked its reason in the Close dialog, it moves the card to its close
  // stage; absent: the kind has none.
  closes?: SessionOutcome;
  // Its completing outcome leaves the card where it is (Sprint Review's Reviewed: the work is finished already).
  stays?: true;
  // Its queue reads archived cards too, and its set-up takes a done range (Sprint Review).
  archived?: true;
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
  triage: {
    label: 'Bug Triage',
    outcomes: SESSION_KIND_OUTCOMES.triage,
    completes: 'accepted',
    closes: 'closed',
    grouping: 'none',
    tally: 'none',
  },
  review: {
    label: 'Sprint Review',
    outcomes: SESSION_KIND_OUTCOMES.review,
    completes: 'reviewed',
    stays: true,
    archived: true,
    grouping: 'none',
    tally: 'none',
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

// A type id -> stage map as kept: string pairs only, else none.
function stringPairs(raw: unknown): Record<string, string> | undefined {
  if (!isObj(raw)) return undefined;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) if (k && typeof v === 'string' && v) out[k] = v;
  return Object.keys(out).length ? out : undefined;
}

function readSetup(raw: unknown): SessionSetup {
  const r = isObj(raw) ? raw : {};
  const setup: SessionSetup = {
    typeIds: strings(r['typeIds'], SESSION_TYPES_MAX),
    statuses: strings(r['statuses'], SESSION_STAGES_MAX),
  };
  const sortBy = normaliseBoardSort(r['sortBy']);
  if (sortBy) setup.sortBy = sortBy;
  const targets = stringPairs(r['targets']);
  if (targets) setup.targets = targets;
  const closeTargets = stringPairs(r['closeTargets']);
  if (closeTargets) setup.closeTargets = closeTargets;
  const box = r['timeboxMs'];
  if (typeof box === 'number' && Number.isFinite(box) && box > 0)
    setup.timeboxMs = Math.min(SESSION_TIMEBOX_MAX_MS, Math.max(SESSION_TIMEBOX_MIN_MS, box));
  const capacity = sessionCapacity(r['capacity']);
  if (capacity) setup.capacity = capacity;
  const since = moment(r['since']);
  const until = moment(r['until']);
  if (since !== undefined) setup.since = since;
  if (until !== undefined && (since === undefined || until >= since)) setup.until = until;
  if (r['presenter'] === 'none') setup.presenter = 'none';
  return setup;
}

// A range edge as kept: a finite moment, not negative.
const moment = (v: unknown): number | undefined =>
  typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : undefined;

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
      ...readDetail(d),
    };
    if (++n === SESSION_QUEUE_MAX) break;
  }
  return n ? out : undefined;
}

const str = (v: unknown) => (typeof v === 'string' && v ? v : undefined);

// What a stored decision did beyond deciding, anything malformed left out.
function readDetail(d: Record<string, unknown>): SessionDecisionDetail {
  const out: SessionDecisionDetail = {};
  const from = str(d['from']);
  const to = str(d['to']);
  if (from && to) {
    Object.assign(out, { from, to });
    const fromRank = str(d['fromRank']);
    if (fromRank) out.fromRank = fromRank;
  }
  if (d['flagSet'] === true) out.flagSet = true;
  const reason = sessionReason(d['reason']);
  if (reason) out.reason = reason;
  const duplicateOf = str(d['duplicateOf']);
  if (duplicateOf) out.duplicateOf = duplicateOf;
  const linked = str(d['linked']);
  if (linked && duplicateOf) out.linked = linked;
  return out;
}

// Presenters as kept: a person or null per card, at most SESSION_QUEUE_MAX cards.
function readPresenters(raw: unknown): Record<string, ItemPerson | null> | undefined {
  if (!isObj(raw)) return undefined;
  const out: Record<string, ItemPerson | null> = {};
  let n = 0;
  for (const [id, p] of Object.entries(raw)) {
    if (!id || (p !== null && !isItemPerson(p))) continue;
    out[id] = p === null ? null : { id: p.id, name: p.name, color: p.color };
    if (++n === SESSION_QUEUE_MAX) break;
  }
  return n ? out : undefined;
}

// Follow-ups as kept: deduped card ids per reviewed card, at most SESSION_FOLLOW_UPS_MAX each.
function readFollowUps(raw: unknown): Record<string, string[]> | undefined {
  if (!isObj(raw)) return undefined;
  const out: Record<string, string[]> = {};
  let n = 0;
  for (const [id, list] of Object.entries(raw)) {
    const ids = strings(list, SESSION_FOLLOW_UPS_MAX);
    if (!id || !ids.length) continue;
    out[id] = ids;
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
  const presenters = readPresenters(raw['presenters']);
  if (presenters) out.presenters = presenters;
  const followUps = readFollowUps(raw['followUps']);
  if (followUps) out.followUps = followUps;
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

// An outcome decided for `itemId` by `by` (a name), the room moving on to `nextId`; `detail` what it did (its move,
// its flag, a Close's reason and duplicate), for Undo and the decided card's line.
export function withDecision(
  s: SessionTabState,
  itemId: string,
  outcome: SessionOutcome,
  by: string,
  now: number,
  nextId: string | null,
  detail: SessionDecisionDetail = {},
): SessionTabState {
  const decided = { ...s.decided, [itemId]: { ...detail, outcome, at: now, by } };
  return withCurrent({ ...s, decided }, nextId, now);
}

// Undo Outcome: the card can be decided again; the room stays on it.
export function withoutDecision(s: SessionTabState, itemId: string): SessionTabState {
  if (!s.decided?.[itemId]) return s;
  const { [itemId]: _gone, ...decided } = s.decided;
  const { decided: _d, ...rest } = s;
  return Object.keys(decided).length ? { ...rest, decided } : rest;
}

// The latest decision (Undo Last's), or null when nothing is decided.
export function lastDecided(
  s: SessionTabState,
): { itemId: string; decision: SessionDecision } | null {
  let out: { itemId: string; decision: SessionDecision } | null = null;
  for (const [itemId, decision] of Object.entries(s.decided ?? {}))
    if (!out || decision.at >= out.decision.at) out = { itemId, decision };
  return out;
}

// Start Again: every outcome cleared, the room back at the start.
export function withNoDecisions(s: SessionTabState): SessionTabState {
  const { decided: _d, currentId: _c, cardStartedAt: _t, ...rest } = s;
  return rest;
}

// --- Sprint Review ---------------------------------------------------------

// Who presents `item`: the person the facilitator named for it (null: no one), else its assignee; none at all with
// the set-up's presenter off.
export function presenterOf(
  s: SessionTabState,
  item: Pick<Item, 'id' | 'fields'>,
): ItemPerson | null {
  if (s.setup.presenter === 'none') return null;
  if (s.presenters && Object.hasOwn(s.presenters, item.id)) return s.presenters[item.id] ?? null;
  return itemAssignee(item) ?? null;
}

// The facilitator names `who` (null: no one) to present `itemId`.
export function withPresenter(
  s: SessionTabState,
  itemId: string,
  who: ItemPerson | null,
): SessionTabState {
  const person = who ? { id: who.id, name: who.name, color: who.color } : null;
  return { ...s, presenters: { ...s.presenters, [itemId]: person } };
}

// A follow-up card made from `itemId`, kept after the ones before (once each, at most SESSION_FOLLOW_UPS_MAX).
export function withFollowUp(
  s: SessionTabState,
  itemId: string,
  followUpId: string,
): SessionTabState {
  const had = s.followUps?.[itemId] ?? [];
  if (had.includes(followUpId) || had.length >= SESSION_FOLLOW_UPS_MAX) return s;
  return { ...s, followUps: { ...s.followUps, [itemId]: [...had, followUpId] } };
}

// --- Timebox -----------------------------------------------------------------

// The time left on the current card, or null when no timebox is on (or the card has no start yet).
export function timeboxLeftMs(s: SessionTabState, now: number): number | null {
  const box = s.setup.timeboxMs;
  if (!box || s.cardStartedAt === undefined) return null;
  return Math.max(0, box - (now - s.cardStartedAt));
}
