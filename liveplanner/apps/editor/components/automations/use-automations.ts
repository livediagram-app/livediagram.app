'use client';

// The open plan's rules, read once and shared (docs/specs/026-plan/automations.md "Where it shows"): the footer's
// amber dot, the Automations screen and a card's Run Rule all read one list per plan, kept in a small store outside
// React so each re-renders only when the list changes. It is read when first asked for (the editor asks a little
// after an Editor opens a plan saved to an account, for the dot) and again whenever the screen opens; every change
// the screen makes lands in the list from the api's answer, so nothing reads it twice for one change (unless a read
// was under way when the change was answered: that read may predate it, so it reads once more). A 403
// (`automations_need_editor`) settles as 'refused', and the button hides.

import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react';
import type {
  AutomationHookInfo,
  AutomationListedRule,
  AutomationRuleBody,
  AutomationRunResponse,
  AutomationsListResponse,
} from '@liveplanner/api-schema';
import { debugLog } from '@liveworkspace/workbench/lib/debug-log';
import {
  AutomationRefusal,
  createRule,
  deleteRule,
  duplicateRule,
  listAutomations,
  runRule,
  testRule,
  toggleRule,
  updateRule,
  type AutomationsScope,
} from './automations-client';

export type AutomationsStatus = 'idle' | 'loading' | 'ready' | 'error' | 'refused';

export type AutomationsState = {
  status: AutomationsStatus;
  data: AutomationsListResponse | null;
};

const IDLE: AutomationsState = { status: 'idle', data: null };

type Entry = {
  state: AutomationsState;
  listeners: Set<() => void>;
  // The read under way, which a second ask waits on rather than repeating.
  reading: Promise<void> | null;
  // The rules (by name) a reader looked for and missed, each read for once (readAutomationsFor).
  missed: Set<string>;
  // A change answered while a read was under way: that read may have been served before it, so it reads again.
  stale: boolean;
};

const entries = new Map<string, Entry>();

const keyOf = (scope: AutomationsScope) => `${scope.ownerId}\u0000${scope.projectId}`;

function entryOf(scope: AutomationsScope): Entry {
  const key = keyOf(scope);
  let entry = entries.get(key);
  if (!entry) {
    entry = { state: IDLE, listeners: new Set(), reading: null, missed: new Set(), stale: false };
    entries.set(key, entry);
  }
  return entry;
}

function publish(entry: Entry, state: AutomationsState): void {
  entry.state = state;
  for (const l of entry.listeners) l();
}

/** Reads the list (once at a time); a read already under way is not repeated, and settles when that one does. */
export function readAutomations(scope: AutomationsScope): Promise<void> {
  const entry = entryOf(scope);
  if (entry.reading) return entry.reading;
  if (entry.state.status !== 'ready') publish(entry, { status: 'loading', data: entry.state.data });
  entry.reading = (async () => {
    try {
      // A toggle, save or delete answered meanwhile may be missing from what this read was served: read again,
      // until a read starts after the last change.
      let data: AutomationsListResponse;
      do {
        entry.stale = false;
        data = await listAutomations(scope);
      } while (entry.stale);
      publish(entry, { status: 'ready', data });
    } catch (error) {
      const refused =
        error instanceof AutomationRefusal && error.code === 'automations_need_editor';
      debugLog('[automations] list.failed', { refused, error: String(error) });
      publish(entry, { status: refused ? 'refused' : 'error', data: entry.state.data });
    } finally {
      entry.reading = null;
    }
  })();
  return entry.reading;
}

/** Reads the list again for a rule a reader names that it lacks (one made since it was read, by another Editor or an
 *  agent): once per name per plan, so a rule really gone never reads it twice. */
export function readAutomationsFor(scope: AutomationsScope, name: string): void {
  const entry = entryOf(scope);
  if (entry.missed.has(name)) return;
  entry.missed.add(name);
  void readAutomations(scope);
}

// A change the api answered, folded into the list.
function change(
  scope: AutomationsScope,
  fold: (rules: readonly AutomationListedRule[]) => AutomationListedRule[],
): void {
  const entry = entryOf(scope);
  if (entry.reading) entry.stale = true;
  const data = entry.state.data;
  if (!data) return;
  publish(entry, { status: entry.state.status, data: { ...data, rules: fold(data.rules) } });
}

const put = (rule: AutomationListedRule) => (rules: readonly AutomationListedRule[]) =>
  rules.some((r) => r.id === rule.id)
    ? rules.map((r) => (r.id === rule.id ? rule : r))
    : [...rules, rule];

/** Make Secret's or Regenerate's answer folded into its rule, so the builder opened again shows the new secret's
 * last four, not Make Secret (the secret itself is never kept). */
export function foldHook(scope: AutomationsScope, ruleId: string, hook: AutomationHookInfo): void {
  change(scope, (rules) => rules.map((r) => (r.id === ruleId ? { ...r, hook } : r)));
}

/** Forgets every plan's list (tests, and signing out). */
export function forgetAutomations(): void {
  entries.clear();
}

export type AutomationsApi = AutomationsState & {
  reload: () => void;
  save: (id: string | null, body: AutomationRuleBody) => Promise<AutomationListedRule>;
  toggle: (id: string, enabled: boolean) => Promise<AutomationListedRule>;
  duplicate: (id: string) => Promise<AutomationListedRule>;
  remove: (id: string) => Promise<void>;
  // Test on a Card (the rule as the builder holds it, unsaved) and Run Rule: the run, as the Audit Trail shows it.
  test: (rule: AutomationRuleBody, item: string) => Promise<AutomationRunResponse>;
  run: (id: string, item: string) => Promise<AutomationRunResponse>;
};

/** The plan's list and its changes; `read` asks for the list when nothing has been read yet. */
export function useAutomations(scope: AutomationsScope | null, read = true): AutomationsApi {
  const subscribe = useCallback(
    (listener: () => void) => {
      if (!scope) return () => {};
      const entry = entryOf(scope);
      entry.listeners.add(listener);
      return () => entry.listeners.delete(listener);
    },
    [scope],
  );
  const state = useSyncExternalStore(
    subscribe,
    () => (scope ? entryOf(scope).state : IDLE),
    () => IDLE,
  );
  useEffect(() => {
    if (scope && read && entryOf(scope).state.status === 'idle') void readAutomations(scope);
  }, [scope, read]);
  return useMemo<AutomationsApi>(() => {
    const need = (): AutomationsScope => {
      if (!scope) throw new Error('No plan to change rules on');
      return scope;
    };
    return {
      ...state,
      reload: () => {
        if (scope) void readAutomations(scope);
      },
      save: async (id, body) => {
        const s = need();
        const { rule } = id ? await updateRule(s, id, body) : await createRule(s, body);
        change(s, put(rule));
        return rule;
      },
      toggle: async (id, enabled) => {
        const s = need();
        const { rule } = await toggleRule(s, id, enabled);
        change(s, put(rule));
        return rule;
      },
      duplicate: async (id) => {
        const s = need();
        const { rule } = await duplicateRule(s, id);
        change(s, put(rule));
        return rule;
      },
      remove: async (id) => {
        const s = need();
        await deleteRule(s, id);
        change(s, (rules) => rules.filter((r) => r.id !== id));
      },
      test: (rule, item) => testRule(need(), rule, item),
      run: (id, item) => runRule(need(), id, item),
    };
  }, [scope, state]);
}
