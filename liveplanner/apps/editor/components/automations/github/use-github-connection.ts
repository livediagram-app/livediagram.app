'use client';

// The plan's GitHub connection as the Automations screen holds it (docs/specs/026-plan/automations.md "The GitHub
// view"): read the first time a GitHub trigger's panel asks and each time the GitHub view opens (never on the board), kept in a small
// store outside React per plan so both read one answer, and set from each route's answer, so nothing reads it twice
// for one change. A 403 (`github_needs_editor`) settles as 'refused'.

import { useCallback, useEffect, useSyncExternalStore } from 'react';
import type { GithubConnectionView } from '@liveplanner/api-schema';
import { debugLog } from '@liveworkspace/workbench/lib/debug-log';
import type { AutomationsScope } from '../automations-client';
import { GithubRefusal, readGithub } from './github-client';

export type GithubStatus = 'idle' | 'loading' | 'ready' | 'error' | 'refused';
export type GithubState = { status: GithubStatus; connection: GithubConnectionView | null };

const IDLE: GithubState = { status: 'idle', connection: null };

type Entry = { state: GithubState; listeners: Set<() => void>; reading: boolean };
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

function publish(entry: Entry, state: GithubState): void {
  entry.state = state;
  for (const l of entry.listeners) l();
}

/** Reads the connection again (one read at a time per plan). */
export async function loadGithub(scope: AutomationsScope): Promise<void> {
  const entry = entryOf(scope);
  if (entry.reading) return;
  entry.reading = true;
  if (entry.state.status !== 'ready') publish(entry, { ...entry.state, status: 'loading' });
  try {
    publish(entry, { status: 'ready', connection: await readGithub(scope) });
  } catch (error) {
    debugLog('[github] read.failed', { error: String(error) });
    const refused = error instanceof GithubRefusal && error.code === 'github_needs_editor';
    publish(entry, { status: refused ? 'refused' : 'error', connection: entry.state.connection });
  } finally {
    entry.reading = false;
  }
}

/** The connection as a route answered it (a choice, a disconnect). */
export function setGithub(scope: AutomationsScope, connection: GithubConnectionView | null): void {
  publish(entryOf(scope), { status: 'ready', connection });
}

/** Forgets every plan's connection (tests). */
export function resetGithubForTests(): void {
  entries.clear();
}

/** The plan's connection: read when first asked while `enabled` (the deployment has GitHub), else idle. `fresh` reads
 *  it again as the caller mounts (the GitHub view, each time it opens), showing what was read before meanwhile. */
export function useGithubConnection(
  scope: AutomationsScope,
  enabled: boolean,
  fresh = false,
): GithubState & { reload: () => void } {
  const entry = entryOf(scope);
  const subscribe = useCallback(
    (l: () => void) => {
      entry.listeners.add(l);
      return () => void entry.listeners.delete(l);
    },
    [entry],
  );
  const state = useSyncExternalStore(
    subscribe,
    () => entry.state,
    () => IDLE,
  );
  useEffect(() => {
    if (enabled && (fresh || entry.state.status === 'idle')) void loadGithub(scope);
  }, [enabled, fresh, entry, scope]);
  const reload = useCallback(() => void loadGithub(scope), [scope]);
  return { ...(enabled ? state : IDLE), reload };
}
