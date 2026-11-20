// The notification list (liveworkspace/docs/specs/016-notifications/toasts.md "The notification list"): every toast a
// page raised, kept in this browser per document (a list per scope, the page's path unless the top provider names
// one), the last TOAST_HISTORY_LIMIT of each, at most TOAST_HISTORY_SCOPES lists. A module store, so the footer's bell
// reads it without sitting inside the toast provider (the Explorer's bottom bar is the page's, not the Explorer's).
// The list in memory is the truth; each change writes the scope's list through to localStorage, a few KB at most.

import type { ToastTone } from './toast-queue';

/** `live`: still on screen. `missed`: left unseen (timed out, retired, or never shown with notifications off).
 *  `seen`: closed, answered, or in the list when it was opened. */
export type ToastRecordState = 'live' | 'missed' | 'seen';

export type ToastRecord = {
  id: string;
  tone: ToastTone;
  message: string;
  // When it first arrived, in ms since the epoch.
  at: number;
  state: ToastRecordState;
  // The action toast's key it came from, so a burst under one key is one record.
  key?: string;
};

export const TOAST_HISTORY_LIMIT = 50;
export const TOAST_HISTORY_SCOPES = 20;
/** A muted keyed toast (never shown) updates its record rather than adding one while it is this recent. */
export const TOAST_HISTORY_MERGE_MS = 10_000;

const PREFIX = 'liveworkspace:toasts:';
const INDEX_KEY = `${PREFIX}index`;
const EMPTY: readonly ToastRecord[] = Object.freeze([]);
const TONES: ReadonlySet<string> = new Set(['info', 'success', 'warning', 'error']);
const STATES: ReadonlySet<string> = new Set(['live', 'missed', 'seen']);

// Ids unique across reloads: this page's start, then the toast's own number.
const SESSION = Date.now().toString(36);

const memory = new Map<string, readonly ToastRecord[]>();
const listeners = new Set<() => void>();

const pathScope = () => (typeof location === 'undefined' ? '' : location.pathname);
let scopeOf: () => string = pathScope;

/** Name the list this page writes to and reads (the top toast provider's `historyScope`); null for the path. */
export function setToastHistoryScope(resolve: (() => string) | null): void {
  scopeOf = resolve ?? pathScope;
  emit();
}

export function currentToastHistoryScope(): string {
  return scopeOf();
}

/** Said on `window` when the notification list opens: the toast stack sends its passing toasts into the bell. */
export const TOAST_LIST_OPENED_EVENT = 'lvd:toast-list-opened';

export function announceToastListOpened(): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(TOAST_LIST_OPENED_EVENT));
}

export function toastRecordId(toastId: number): string {
  return `${SESSION}-${toastId}`;
}

export function subscribeToastHistory(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function emit(): void {
  for (const listener of listeners) listener();
}

function storage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

/** What is kept of a stored list: well-formed records only, the newest TOAST_HISTORY_LIMIT. Pure, for the test. */
export function parseToastRecords(raw: string | null): readonly ToastRecord[] {
  if (!raw) return EMPTY;
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return EMPTY;
  }
  if (!Array.isArray(value)) return EMPTY;
  const records = (value as unknown[]).filter((v): v is ToastRecord => {
    if (typeof v !== 'object' || v === null) return false;
    const r = v as Record<string, unknown>;
    return (
      typeof r.id === 'string' &&
      typeof r.message === 'string' &&
      typeof r.at === 'number' &&
      typeof r.tone === 'string' &&
      TONES.has(r.tone) &&
      typeof r.state === 'string' &&
      STATES.has(r.state) &&
      (r.key === undefined || typeof r.key === 'string')
    );
  });
  return records.slice(-TOAST_HISTORY_LIMIT);
}

/** The list for a scope, oldest first; the same array until it changes. */
export function readToastHistory(scope: string = scopeOf()): readonly ToastRecord[] {
  const held = memory.get(scope);
  if (held) return held;
  let records = EMPTY;
  try {
    records = parseToastRecords(storage()?.getItem(PREFIX + scope) ?? null);
  } catch {
    // Blocked storage: an empty list for this page.
  }
  // A record still `live` from an earlier page is no longer on screen: it left unseen.
  if (records.some((r) => r.state === 'live')) {
    records = records.map((r) => (r.state === 'live' ? { ...r, state: 'missed' } : r));
  }
  memory.set(scope, records);
  return records;
}

/** The scopes kept, most recently written first, at most TOAST_HISTORY_SCOPES (pure, for the test). */
export function touchScopeIndex(index: readonly string[], scope: string): string[] {
  return [scope, ...index.filter((s) => s !== scope)];
}

function write(scope: string, records: readonly ToastRecord[]): void {
  memory.set(scope, records);
  emit();
  const store = storage();
  if (!store) return;
  try {
    if (records.length === 0) store.removeItem(PREFIX + scope);
    else store.setItem(PREFIX + scope, JSON.stringify(records));
    let index: string[] = [];
    try {
      const parsed: unknown = JSON.parse(store.getItem(INDEX_KEY) ?? '[]');
      if (Array.isArray(parsed)) index = parsed.filter((s): s is string => typeof s === 'string');
    } catch {
      index = [];
    }
    const next = touchScopeIndex(index, scope);
    for (const gone of next.slice(TOAST_HISTORY_SCOPES)) {
      store.removeItem(PREFIX + gone);
      memory.delete(gone);
    }
    store.setItem(INDEX_KEY, JSON.stringify(next.slice(0, TOAST_HISTORY_SCOPES)));
  } catch {
    // Full or blocked storage: the list still holds for this page.
  }
}

/**
 * Write a toast to the current list: a new record, or the one with the same id updated in its final words (an action
 * toast replaced in place). A muted toast (`state` missed) under a key updates that key's record while it is recent,
 * so a burst it never showed is one record.
 */
export function recordToast(
  input: { id: string; tone: ToastTone; message: string; key?: string },
  state: 'live' | 'missed',
  now = Date.now(),
  scope = scopeOf(),
): void {
  const list = readToastHistory(scope);
  let at = list.findIndex((r) => r.id === input.id);
  if (at === -1 && state === 'missed' && input.key !== undefined) {
    const last = list.findLastIndex((r) => r.key === input.key);
    const prior = list[last];
    if (prior && prior.state === 'missed' && now - prior.at < TOAST_HISTORY_MERGE_MS) at = last;
  }
  if (at !== -1) {
    const prior = list[at]!;
    if (prior.message === input.message && prior.tone === input.tone) return;
    const next = list.slice();
    next[at] = { ...prior, message: input.message, tone: input.tone };
    write(scope, next);
    return;
  }
  const record: ToastRecord = {
    id: input.id,
    tone: input.tone,
    message: input.message,
    at: now,
    state,
    ...(input.key === undefined ? {} : { key: input.key }),
  };
  write(scope, [...list, record].slice(-TOAST_HISTORY_LIMIT));
}

/**
 * A toast left: answered (`seen`), timed out or retired (`missed`), or closed by the person (`closed`: it leaves the
 * list too). Only a live record changes.
 */
export function settleToast(
  id: string,
  state: 'missed' | 'seen' | 'closed',
  scope = scopeOf(),
): void {
  const list = readToastHistory(scope);
  const at = list.findIndex((r) => r.id === id);
  if (at === -1 || list[at]!.state !== 'live') return;
  const next = list.slice();
  if (state === 'closed') next.splice(at, 1);
  else next[at] = { ...list[at]!, state };
  write(scope, next);
}

/** The list was opened: everything missed in it is seen. */
export function markToastHistorySeen(): void {
  const scope = scopeOf();
  const list = readToastHistory(scope);
  if (!list.some((r) => r.state === 'missed')) return;
  write(
    scope,
    list.map((r) => (r.state === 'missed' ? { ...r, state: 'seen' } : r)),
  );
}

export function clearToastHistory(): void {
  const scope = scopeOf();
  if (readToastHistory(scope).length === 0) return;
  write(scope, EMPTY);
}

/** Whether the list holds a toast the person has not seen (the bell's dot). */
export function hasMissedToast(records: readonly ToastRecord[]): boolean {
  return records.some((r) => r.state === 'missed');
}

/** Forget every list in memory (tests). */
export function resetToastHistoryForTests(): void {
  memory.clear();
  scopeOf = pathScope;
}
