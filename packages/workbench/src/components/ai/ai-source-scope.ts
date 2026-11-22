'use client';

// What an editor tells every AI feature's source line (liveworkspace/docs/specs/003-accounts/ai-keys.md "The source
// line (AiSource)"): which team its item is in and whether the person is signed in, and the bearer door the line
// reads the account's keys through. Its own small module, so an editor's first load carries this and none of the line
// (WorkbenchAiSource.tsx, loaded with the dialog that shows it).

import { useEffect, useSyncExternalStore } from 'react';
import { bearerSettingsRequest, type SettingsRequest } from '@liveworkspace/settings-ui/request';
import { workbench } from '../../bindings';

export type AiSourceScope = {
  // The item's team, for its key; null for an item in no team, or before one exists.
  teamId: string | null;
  // A signed-in account (a guest sees no line: the features are for accounts).
  signedIn: boolean;
};

// The open editor's scope: one per page, so a module value with its listeners, not a provider around the tree.
const NONE: AiSourceScope = { teamId: null, signedIn: false };
let scope: AiSourceScope = NONE;
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => void listeners.delete(listener);
};
const getScope = () => scope;
const setScope = (next: AiSourceScope) => {
  if (next.teamId === scope.teamId && next.signedIn === scope.signedIn) return;
  scope = next;
  for (const listener of listeners) listener();
};

/** Says, once for an editor, which team its item is in and whether the person is signed in; cleared as it goes. */
export function useAiSourceScope(teamId: string | null, signedIn: boolean): void {
  useEffect(() => {
    setScope({ teamId, signedIn });
    return () => setScope(NONE);
  }, [teamId, signedIn]);
}

/** The scope the open editor said. */
export const useEditorAiScope = (): AiSourceScope =>
  useSyncExternalStore(subscribe, getScope, getScope);

// One door for the page, made when it is first used.
let door: SettingsRequest | null = null;
export const accountDoor = (): SettingsRequest =>
  (door ??= bearerSettingsRequest({
    baseUrl: '/api/workspace/account',
    token: () => workbench.api.currentBearer(),
  }));

/** Whether the person's own key applies (no item, so no team key): asked when a feature is about to run, never on
 *  load. False on any failure to read, so the feature runs as it would with no key. */
export async function hasOwnAiKey(): Promise<boolean> {
  // The door answers every failure (offline, signed out) rather than throwing. Only `key` is read.
  const answer = await accountDoor()<{ key: unknown }>('/ai-key');
  return answer.ok && answer.data.key !== null;
}
