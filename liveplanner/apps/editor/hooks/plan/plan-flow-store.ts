// The flow charts' shared read (docs/specs/026-plan/plan-views.md "Flow charts", blueprint plan-views.md "Flow
// charts"): one read per range of the open plan, shared by every flow chart drawing that range, made when the first of
// them is drawn and again FLOW_REFETCH_MS after the cards last changed, so a burst of moves reads once. An entry lives
// while some chart shows it and is dropped with its last chart, so the store holds no more than the charts on screen.

import type { FlowResponse } from '@liveplanner/api-schema';
import { debugLog } from '@liveworkspace/workbench/lib/debug-log';
import { fetchFlow } from '@/lib/api/flow';
import type { ItemsScope } from '@/lib/api/items';

// A burst of card writes (a drag, a run of moves) reads the flow once, this long after the last.
export const FLOW_REFETCH_MS = 2000;

export type FlowStatus = 'loading' | 'ready' | 'error' | 'offline';
export type FlowState = { status: FlowStatus; data: FlowResponse | null };

type Entry = {
  state: FlowState;
  subs: Set<() => void>;
  // The cards as last seen (the items map: a new one on every write), to know when to read again.
  version: unknown;
  timer: ReturnType<typeof setTimeout> | null;
  // The newest read: an older read's answer is dropped.
  seq: number;
};

const LOADING: FlowState = { status: 'loading', data: null };

export function flowKey(scope: ItemsScope, days: number): string {
  return `${scope.projectId}|${scope.tabId ?? ''}|${scope.shareCode ?? ''}|${days}`;
}

export function createFlowStore(read = fetchFlow) {
  const entries = new Map<string, Entry>();

  const set = (entry: Entry, state: FlowState) => {
    entry.state = state;
    for (const fn of entry.subs) fn();
  };

  const load = (key: string, scope: ItemsScope, days: number) => {
    const entry = entries.get(key);
    if (!entry) return;
    entry.timer = null;
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
        entry = { state: LOADING, subs: new Set(), version: undefined, timer: null, seq: 0 };
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
    // with changed cards reads after the pause (asks from the other charts of the range in the same change share it).
    want(key: string, scope: ItemsScope, days: number, version: unknown) {
      const entry = entries.get(key);
      if (!entry || entry.version === version) return;
      const first = entry.seq === 0 && entry.version === undefined;
      entry.version = version;
      if (first) return load(key, scope, days);
      if (entry.timer) clearTimeout(entry.timer);
      entry.timer = setTimeout(() => load(key, scope, days), FLOW_REFETCH_MS);
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
