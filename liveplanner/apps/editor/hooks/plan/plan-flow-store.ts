// The flow charts' shared read (docs/specs/026-plan/plan-views.md "Flow charts", blueprint plan-views.md "Flow
// charts"): one read per range of the open plan, shared by every flow chart drawing that range, made when the first of
// them is drawn and again once the flow's cards change (flowVersionOf: a status, a type, a card coming or going):
// FLOW_REFETCH_MS after the last change, so a burst of moves reads once, and never sooner than FLOW_MIN_INTERVAL_MS
// after the last read, so a busy plan reads twice a minute at most and one that never goes quiet still reads. An entry
// lives while some chart shows it and is dropped with its last chart, so the store holds no more than the charts on
// screen.

import type { FlowResponse } from '@liveplanner/api-schema';
import { itemStatus, type Item } from '@liveplanner/items';
import { debugLog } from '@liveworkspace/workbench/lib/debug-log';
import { fetchFlow } from '@/lib/api/flow';
import type { ItemsScope } from '@/lib/api/items';

// A burst of card writes (a drag, a run of moves) reads the flow once, this long after the last.
export const FLOW_REFETCH_MS = 2000;
// The least time between two reads of a range: on a plan where cards keep moving, the flow is read about this often.
export const FLOW_MIN_INTERVAL_MS = 30_000;

export type FlowStatus = 'loading' | 'ready' | 'error' | 'offline';
export type FlowState = { status: FlowStatus; data: FlowResponse | null };

type Entry = {
  state: FlowState;
  subs: Set<() => void>;
  // The cards as last seen (flowVersionOf), to know when to read again.
  version: unknown;
  timer: ReturnType<typeof setTimeout> | null;
  // When the last read went out, and when the oldest change not yet read came (null: none waiting).
  readAt: number;
  waitingSince: number | null;
  // The newest read: an older read's answer is dropped.
  seq: number;
};

const LOADING: FlowState = { status: 'loading', data: null };

export function flowKey(scope: ItemsScope, days: number): string {
  return `${scope.projectId}|${scope.tabId ?? ''}|${scope.shareCode ?? ''}|${days}`;
}

const versions = new WeakMap<ReadonlyMap<string, Item>, string>();
const FNV_PRIME = 16777619;

// What the flow charts draw from the cards on screen: how many there are and each one's id, type and status, as the
// count and an order-free hash (a sum of each card's FNV-1a hash), worked out once per items map (a new map on every
// write). A title or any other field edit leaves it as it was, so it reads nothing.
export function flowVersionOf(items: ReadonlyMap<string, Item> | undefined): string | undefined {
  if (!items) return undefined;
  const kept = versions.get(items);
  if (kept !== undefined) return kept;
  let sum = 0;
  for (const item of items.values()) {
    const text = `${item.id}\u0000${item.type}\u0000${itemStatus(item) ?? ''}`;
    let h = 2166136261;
    for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), FNV_PRIME);
    sum = (sum + (h >>> 0)) >>> 0;
  }
  const version = `${items.size}:${sum}`;
  versions.set(items, version);
  return version;
}

export function createFlowStore(read = fetchFlow, now: () => number = Date.now) {
  const entries = new Map<string, Entry>();

  const set = (entry: Entry, state: FlowState) => {
    entry.state = state;
    for (const fn of entry.subs) fn();
  };

  const load = (key: string, scope: ItemsScope, days: number) => {
    const entry = entries.get(key);
    if (!entry) return;
    entry.timer = null;
    entry.readAt = now();
    entry.waitingSince = null;
    const seq = ++entry.seq;
    if (!entry.state.data && entry.state.status !== 'loading') set(entry, LOADING);
    read(scope, days).then(
      (answer) => {
        if (entries.get(key) !== entry || entry.seq !== seq) return;
        set(
          entry,
          answer === 'offline'
            ? { status: 'offline', data: null }
            : { status: 'ready', data: answer },
        );
      },
      (error: unknown) => {
        if (entries.get(key) !== entry || entry.seq !== seq) return;
        debugLog('[items] flow.read.failed', { days, error: String(error) });
        // A failed refresh keeps the last answer on screen.
        if (!entry.state.data) set(entry, { status: 'error', data: null });
      },
    );
  };

  return {
    get(key: string): FlowState {
      return entries.get(key)?.state ?? LOADING;
    },
    subscribe(key: string, fn: () => void): () => void {
      let entry = entries.get(key);
      if (!entry) {
        entry = {
          state: LOADING,
          subs: new Set(),
          version: undefined,
          timer: null,
          seq: 0,
          readAt: -Infinity,
          waitingSince: null,
        };
        entries.set(key, entry);
      }
      entry.subs.add(fn);
      const held = entry;
      return () => {
        held.subs.delete(fn);
        if (held.subs.size > 0 || entries.get(key) !== held) return;
        if (held.timer) clearTimeout(held.timer);
        entries.delete(key);
      };
    },
    // A chart wants the range read for the cards as they are (`version`): the first ask reads at once, a later one
    // with changed cards reads after the pause (asks from the other charts of the range in the same change share it),
    // at the later of FLOW_REFETCH_MS after this change and FLOW_MIN_INTERVAL_MS after the last read, and never later
    // than FLOW_MIN_INTERVAL_MS after the oldest change still waiting.
    want(key: string, scope: ItemsScope, days: number, version: unknown) {
      const entry = entries.get(key);
      if (!entry || entry.version === version) return;
      const first = entry.seq === 0 && entry.version === undefined;
      entry.version = version;
      if (first) return load(key, scope, days);
      const at = now();
      entry.waitingSince ??= at;
      const due = Math.min(
        Math.max(at + FLOW_REFETCH_MS, entry.readAt + FLOW_MIN_INTERVAL_MS),
        entry.waitingSince + FLOW_MIN_INTERVAL_MS,
      );
      if (entry.timer) clearTimeout(entry.timer);
      entry.timer = setTimeout(() => load(key, scope, days), due - at);
    },
    retry(key: string, scope: ItemsScope, days: number) {
      const entry = entries.get(key);
      if (!entry) return;
      if (entry.timer) clearTimeout(entry.timer);
      set(entry, LOADING);
      load(key, scope, days);
    },
    size: () => entries.size,
  };
}

export type FlowStore = ReturnType<typeof createFlowStore>;

// The editor's one store.
export const flowStore: FlowStore = createFlowStore();
