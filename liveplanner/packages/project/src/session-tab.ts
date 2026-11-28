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
  isStandupPersonOrder,
  itemAssignee,
  isSessionOutcome,
  normaliseBoardSort,
  sessionReason,
  type BoardSortLevel,
  type Item,
  type ItemPerson,
  type SessionKindId,
  type SessionOutcome,
  type StandupPersonOrder,
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
  // Stand-up's people order: absent, Board Order; else by name, or shuffled for the day.
  personOrder?: StandupPersonOrder;
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
  // Stand-up: the card's decision before this step (a Blocked, then a Stage move), so Undo takes back one step.
  prior?: SessionDecision;
};

// What an outcome did beyond deciding, kept on its decision.
export type SessionDecisionDetail = Omit<SessionDecision, 'outcome' | 'at' | 'by' | 'prior'>;

// How many steps on one card a decision keeps for Undo.
const PRIOR_MAX = 8;

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
  // Stand-up: a person's key (their id, or Unassigned's) -> when they were marked Done and by whom.
  peopleDone?: Record<string, SessionPersonDone>;
};

// A Stand-up person marked Done: when, and by whom (a name).
export type SessionPersonDone = { at: number; by: string };

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
  // How the sidebar groups the queue: not at all, or by person (Stand-up's, whose unit is then the person).
  grouping: 'none' | 'person';
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
  standup: {
    label: 'Stand-up',
    outcomes: SESSION_KIND_OUTCOMES.standup,
    completes: 'discussed',
    stays: true,
    grouping: 'person',
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
  if (isStandupPersonOrder(r['personOrder'])) setup.personOrder = r['personOrder'];
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
function readDetail(
  d: Record<string, unknown>,
  depth = 0,
): Omit<SessionDecision, 'outcome' | 'at' | 'by'> {
  const out: Omit<SessionDecision, 'outcome' | 'at' | 'by'> = {};
  const prior = d['prior'];
  if (
    depth < PRIOR_MAX &&
    isObj(prior) &&
    isSessionOutcome(prior['outcome']) &&
    typeof prior['at'] === 'number'
  )
    out.prior = {
      outcome: prior['outcome'],
      at: prior['at'],
      by: typeof prior['by'] === 'string' ? prior['by'] : '',
      ...readDetail(prior, depth + 1),
    };
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

// Stand-up's people Done as kept: a non-empty key with a numeric `at`, at most SESSION_QUEUE_MAX people.
function readPeopleDone(raw: unknown): Record<string, SessionPersonDone> | undefined {
  if (!isObj(raw)) return undefined;
  const out: Record<string, SessionPersonDone> = {};
  let n = 0;
  for (const [key, d] of Object.entries(raw)) {
    if (!key || !isObj(d) || typeof d['at'] !== 'number') continue;
    out[key] = { at: d['at'], by: typeof d['by'] === 'string' ? d['by'] : '' };
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
  const peopleDone = readPeopleDone(raw['peopleDone']);
  if (peopleDone) out.peopleDone = peopleDone;
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

// The room moves to `itemId` (or to none), its clock starting again; with `keepClock` (Stand-up moving between one
// person's cards) the clock keeps running.
export function withCurrent(
  s: SessionTabState,
  itemId: string | null,
  now: number,
  keepClock = false,
): SessionTabState {
  const { currentId: _c, cardStartedAt: _t, ...rest } = s;
  if (!itemId) return rest;
  const started = keepClock && s.cardStartedAt !== undefined ? s.cardStartedAt : now;
  return { ...rest, currentId: itemId, cardStartedAt: started };
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

// An outcome kept for `itemId` with the room staying where it is (Stand-up's Blocked and Stage): one step over the card's
// decision, which it keeps as `prior` (at most PRIOR_MAX deep), so Undo takes back this step alone.
export function withOutcome(
  s: SessionTabState,
  itemId: string,
  outcome: SessionOutcome,
  by: string,
  now: number,
  detail: SessionDecisionDetail = {},
): SessionTabState {
  const had = s.decided?.[itemId];
  const next: SessionDecision = { ...had, ...detail, outcome, at: now, by };
  delete next.prior;
  // A move's rank is its own: none given, none kept from an earlier move.
  if (detail.from && !detail.fromRank) delete next.fromRank;
  if (had) next.prior = trimPrior(had, PRIOR_MAX - 1);
  return { ...s, decided: { ...s.decided, [itemId]: next } };
}

// A decision with at most `left` earlier steps kept under it.
function trimPrior(d: SessionDecision, left: number): SessionDecision {
  if (!d.prior) return d;
  if (left <= 0) {
    const { prior: _p, ...rest } = d;
    return rest;
  }
  return { ...d, prior: trimPrior(d.prior, left - 1) };
}

// What a decision's own step did, beside the step before it: moved the card (its from, to and rank) and set the
// flag. A decision with no step before it did all it holds.
export function sessionStep(d: SessionDecision): SessionDecision {
  const p = d.prior;
  if (!p) return d;
  const { prior: _p, from, to, fromRank, flagSet, ...rest } = d;
  const moved = !!from && !!to && (p.from !== from || p.to !== to || p.fromRank !== fromRank);
  return {
    ...rest,
    ...(moved ? { from, to, ...(fromRank ? { fromRank } : {}) } : {}),
    ...(flagSet && !p.flagSet ? { flagSet } : {}),
  };
}

// Undo of the latest step on `itemId`: the decision before it back, else no decision.
export function withoutStep(s: SessionTabState, itemId: string): SessionTabState {
  const d = s.decided?.[itemId];
  if (!d?.prior) return withoutDecision(s, itemId);
  return { ...s, decided: { ...s.decided, [itemId]: d.prior } };
}

// Stand-up's Done: the person `key` marked Done, each of `cardIds` not decided yet recorded Discussed at the same
// moment, and the room moving on to `nextId` with its clock starting again.
export function withPersonDone(
  s: SessionTabState,
  key: string,
  by: string,
  now: number,
  cardIds: readonly string[],
  nextId: string | null,
): SessionTabState {
  const decided = { ...s.decided };
  for (const id of cardIds) if (!decided[id]) decided[id] = { outcome: 'discussed', at: now, by };
  const peopleDone = { ...s.peopleDone, [key]: { at: now, by } };
  const out: SessionTabState = { ...s, peopleDone };
  if (Object.keys(decided).length) out.decided = decided;
  return withCurrent(out, nextId, now);
}

// Undo of a Done: the person no longer Done, and the Discussed decisions their Done recorded (those at its moment
// with no move) cleared. Answers the state and the cards cleared.
export function withoutPersonDone(
  s: SessionTabState,
  key: string,
): { state: SessionTabState; cleared: string[] } {
  const done = s.peopleDone?.[key];
  if (!done) return { state: s, cleared: [] };
  const { [key]: _gone, ...peopleDone } = s.peopleDone!;
  const decided: Record<string, SessionDecision> = {};
  const cleared: string[] = [];
  for (const [id, d] of Object.entries(s.decided ?? {})) {
    if (d.outcome === 'discussed' && d.at === done.at && !d.from) cleared.push(id);
    else decided[id] = d;
  }
  const { peopleDone: _p, decided: _d, ...rest } = s;
  return {
    state: {
      ...rest,
      ...(Object.keys(peopleDone).length ? { peopleDone } : {}),
      ...(Object.keys(decided).length ? { decided } : {}),
    },
    cleared,
  };
}

// Stand-up's Undo Last: the newer of the latest person Done and the latest card decision (a Done wins a tie: its
// Discussed decisions share its moment), or null with neither.
export function lastStandupStep(
  s: SessionTabState,
):
  | { kind: 'person'; key: string; done: SessionPersonDone }
  | { kind: 'card'; itemId: string; decision: SessionDecision }
  | null {
  let person: { key: string; done: SessionPersonDone } | null = null;
  for (const [key, done] of Object.entries(s.peopleDone ?? {}))
    if (!person || done.at >= person.done.at) person = { key, done };
  const card = lastDecided(s);
  if (person && (!card || person.done.at >= card.decision.at)) return { kind: 'person', ...person };
  return card ? { kind: 'card', ...card } : null;
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
  const { decided: _d, currentId: _c, cardStartedAt: _t, peopleDone: _p, ...rest } = s;
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
