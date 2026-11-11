'use client';

// The open plan's rules, read once and shared (docs/specs/026-plan/automations.md "Where it shows"): the footer's
// amber dot, the Automations screen and a card's Run Rule all read one list per plan, kept in a small store outside
// React so each re-renders only when the list changes. It is read when first asked for (the editor asks a little
// after an Editor opens a plan saved to an account, for the dot) and again whenever the screen opens; every change
// the screen makes lands in the list from the api's answer, so nothing reads it twice for one change. A 403
// (`automations_need_editor`) settles as 'refused', and the button hides.

import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react';
import type {
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

type Entry = { state: AutomationsState; listeners: Set<() => void>; reading: boolean };

const entries = new Map<string, Entry>();

const keyOf = (scope: AutomationsScope) => `${scope.ownerId}\u0000${scope.projectId}`;

function entryOf(scope: AutomationsScope): Entry {
  const key = keyOf(scope);
  let entry = entries.get(key);
  if (!entry) {
    entry = { state: IDLE, listeners: new Set(), reading: false };
    entries.set(key, entry);
  }
  return entry;
}

function publish(entry: Entry, state: AutomationsState): void {
  entry.state = state;
  for (const l of entry.listeners) l();
}

/** Reads the list (once at a time); a read already under way is not repeated. */
export async function readAutomations(scope: AutomationsScope): Promise<void> {
  const entry = entryOf(scope);
  if (entry.reading) return;
  entry.reading = true;
  if (entry.state.status !== 'ready') publish(entry, { status: 'loading', data: entry.state.data });
  try {
    publish(entry, { status: 'ready', data: await listAutomations(scope) });
  } catch (error) {
    const refused = error instanceof AutomationRefusal && error.code === 'automations_need_editor';
    debugLog('[automations] list.failed', { refused, error: String(error) });
    publish(entry, { status: refused ? 'refused' : 'error', data: entry.state.data });
  } finally {
    entry.reading = false;
  }
}

// A change the api answered, folded into the list.
function change(
  scope: AutomationsScope,
  fold: (rules: readonly AutomationListedRule[]) => AutomationListedRule[],
): void {
  const entry = entryOf(scope);
  const data = entry.state.data;
  if (!data) return;
  publish(entry, { status: entry.state.status, data: { ...data, rules: fold(data.rules) } });
}

const put = (rule: AutomationListedRule) => (rules: readonly AutomationListedRule[]) =>
  rules.some((r) => r.id === rule.id)
    ? rules.map((r) => (r.id === rule.id ? rule : r))
    : [...rules, rule];

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
  // Test on a Card (the rule as the builder holds it, unsaved) and Run Rule: the run, as the Run Log shows it.
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
