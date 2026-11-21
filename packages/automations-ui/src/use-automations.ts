'use client';

// The open item's rules, read once and shared (liveworkspace/docs/specs/018-automations/automations.md; blueprint
// ui.md "The list"): the footer's amber dot, the Automations screen and an app's own Run Rule all read one list per
// item, kept in a small store outside React so each re-renders only when the list changes. It is read when first
// asked for (the host asks a little after an Editor opens an item saved to an account, for the dot) and again
// whenever the screen opens; every change
// the screen makes lands in the list from the api's answer, so nothing reads it twice for one change (unless a read
// was under way when the change was answered: that read may predate it, so it reads once more). A 403
// (`automations_need_editor`) settles as 'refused', and the button hides; a refused list is read again only when the
// scope is asked as someone else (its share code, or the app's `as`: an Editor granted mid-session, another
// account), never twice for one asker.

import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react';
import type { AutomationHookInfo } from '@liveworkspace/automations';
import { debugLog } from '@liveworkspace/workbench/lib/debug-log';
import { AutomationRefusal, type AutomationsClient } from './automations-client';
import type { AutomationsScope } from './kit';
import type { ListResponse, ListedRule, ListedRun, RuleBody } from './types';

type AutomationListedRule = ListedRule;
type AutomationRuleBody = RuleBody;
type AutomationsListResponse = ListResponse;
type AutomationRunResponse = { run: ListedRun };

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
  reading: Promise<boolean> | null;
  // The rules (by name) a reader looked for and missed, each read for once (readAutomationsFor).
  missed: Set<string>;
  // A change answered while a read was under way: that read may have been served before it, so it reads again.
  stale: boolean;
  // Who the last read was asked as (askerOf), so a refusal is read again only for someone else.
  readAs: string | null;
};

const entries = new Map<string, Entry>();

const keyOf = (scope: AutomationsScope) => `${scope.ownerId}\u0000${scope.itemId}`;
const askerOf = (scope: AutomationsScope) => `${scope.shareCode ?? ''}\u0000${scope.as ?? ''}`;

function entryOf(scope: AutomationsScope): Entry {
  const key = keyOf(scope);
  let entry = entries.get(key);
  if (!entry) {
    entry = {
      state: IDLE,
      listeners: new Set(),
      reading: null,
      missed: new Set(),
      stale: false,
      readAs: null,
    };
    entries.set(key, entry);
  }
  return entry;
}

function publish(entry: Entry, state: AutomationsState): void {
  entry.state = state;
  for (const l of entry.listeners) l();
}

/** Reads the list (once at a time); a read already under way is not repeated, and settles when that one does.
 *  Resolves false when the read failed (the list read before stays), true otherwise (Refresh says which). */
export function readAutomations(
  client: Pick<AutomationsClient, 'list'>,
  scope: AutomationsScope,
): Promise<boolean> {
  const entry = entryOf(scope);
  if (entry.reading) return entry.reading;
  entry.readAs = askerOf(scope);
  if (entry.state.status !== 'ready') publish(entry, { status: 'loading', data: entry.state.data });
  entry.reading = (async () => {
    try {
      // A toggle, save or delete answered meanwhile may be missing from what this read was served: read again,
      // until a read starts after the last change.
      let data: AutomationsListResponse;
      do {
        entry.stale = false;
        data = await client.list(scope);
      } while (entry.stale);
      publish(entry, { status: 'ready', data });
      return true;
    } catch (error) {
      const refused =
        error instanceof AutomationRefusal && error.code === 'automations_need_editor';
      debugLog('[automations] list.failed', { refused, error: String(error) });
      publish(entry, { status: refused ? 'refused' : 'error', data: entry.state.data });
      return refused;
    } finally {
      entry.reading = null;
    }
  })();
  return entry.reading;
}

/** Reads the list again for a rule a reader names that it lacks (one made since it was read, by another Editor or an
 *  agent): once per name per item, so a rule really gone never reads it twice. */
export function readAutomationsFor(
  client: Pick<AutomationsClient, 'list'>,
  scope: AutomationsScope,
  name: string,
): void {
  const entry = entryOf(scope);
  if (entry.missed.has(name)) return;
  entry.missed.add(name);
  void readAutomations(client, scope);
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

/** Forgets every item's list (tests, and signing out). */
export function forgetAutomations(): void {
  entries.clear();
}

export type AutomationsApi = AutomationsState & {
  reload: () => void;
  save: (id: string | null, body: AutomationRuleBody) => Promise<AutomationListedRule>;
  toggle: (id: string, enabled: boolean) => Promise<AutomationListedRule>;
  duplicate: (id: string) => Promise<AutomationListedRule>;
  remove: (id: string) => Promise<void>;
  // Test Rule (the rule as the builder holds it, unsaved) and Run Rule: the run, as the Audit Trail shows it.
  test: (rule: AutomationRuleBody, subject: string | null) => Promise<AutomationRunResponse>;
  run: (id: string, subject: string | null) => Promise<AutomationRunResponse>;
};

/** The item's list and its changes; `read` asks for the list when nothing has been read yet. `client` must be the
 *  same object from render to render (the kit's). */
export function useAutomations(
  client: AutomationsClient | null,
  scope: AutomationsScope | null,
  read = true,
): AutomationsApi {
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
  // Read when nothing has been; and a refused list again once the scope is asked as someone else (also when the
  // refusal lands after the asker changed under a read).
  const { status } = state;
  useEffect(() => {
    if (!client || !scope) return;
    const entry = entryOf(scope);
    const idle = read && status === 'idle';
    const askedAnew = status === 'refused' && entry.readAs !== askerOf(scope);
    if (idle || askedAnew) void readAutomations(client, scope);
  }, [client, scope, read, status]);
  return useMemo<AutomationsApi>(() => {
    const need = (): AutomationsScope => {
      if (!scope) throw new Error('No item to change rules on');
      return scope;
    };
    const api = (): AutomationsClient => {
      if (!client) throw new Error('No Automations client');
      return client;
    };
    return {
      ...state,
      reload: () => {
        if (client && scope) void readAutomations(client, scope);
      },
      save: async (id, body) => {
        const s = need();
        const { rule } = id ? await api().update(s, id, body) : await api().create(s, body);
        change(s, put(rule));
        return rule;
      },
      toggle: async (id, enabled) => {
        const s = need();
        const { rule } = await api().toggle(s, id, enabled);
        change(s, put(rule));
        return rule;
      },
      duplicate: async (id) => {
        const s = need();
        const { rule } = await api().duplicate(s, id);
        change(s, put(rule));
        return rule;
      },
      remove: async (id) => {
        const s = need();
        await api().remove(s, id);
        change(s, (rules) => rules.filter((r) => r.id !== id));
      },
      test: (rule, subject) => api().test(need(), rule, subject),
      run: (id, subject) => api().run(need(), id, subject),
    };
  }, [client, scope, state]);
}
