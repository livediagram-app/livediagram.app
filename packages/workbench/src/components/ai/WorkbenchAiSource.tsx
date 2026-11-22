'use client';

// The source line in an editor (liveworkspace/docs/specs/003-accounts/ai-keys.md "The source line (AiSource)"):
// @liveworkspace/settings-ui's AiSource, bound once for every editor. It reads the account's AI keys over the app's
// bearer door (`/api/workspace/account`), opens Settings on its AI category through the editor's own Settings host
// (lib/open-settings.ts), so the dialog it sits in stays open underneath, and counts its two events. The item's team
// and whether the person is signed in come from the AiSourceScope the editor sets around itself.

import { createContext, useContext, type ReactNode } from 'react';
import type { AiKeyFailure } from '@liveworkspace/ai';
import {
  AiSource,
  bearerSettingsRequest,
  useAiSource,
  type AiKeysAnswer,
  type AiSourceEvent,
  type SettingsRequest,
} from '@liveworkspace/settings-ui/ai-source';
import { workbench } from '../../bindings';
import { requestOpenSettings } from '../../lib/open-settings';

type Scope = {
  // The item's team, for its key; null for an item in no team, or before one exists.
  teamId: string | null;
  // A signed-in account (a guest sees no line: the features are for accounts).
  signedIn: boolean;
};

const AiSourceScopeContext = createContext<Scope>({ teamId: null, signedIn: false });

/** Says, once for an editor, which team its item is in and whether the person is signed in. */
export function AiSourceScope({ children, teamId, signedIn }: Scope & { children: ReactNode }) {
  return <AiSourceScopeContext value={{ teamId, signedIn }}>{children}</AiSourceScopeContext>;
}

// One door for the page, made when a line first shows.
let door: SettingsRequest | null = null;
const accountDoor = (): SettingsRequest =>
  (door ??= bearerSettingsRequest({
    baseUrl: '/api/workspace/account',
    token: () => workbench.api.currentBearer(),
  }));

/** Whether the person's own key applies (no item, so no team key): asked when a feature is about to run, never on
 *  load. False on any failure to read, so the feature runs as it would with no key. */
export async function hasOwnAiKey(): Promise<boolean> {
  const answer = await accountDoor()<AiKeysAnswer>('/ai-key').catch(() => null);
  return answer?.ok === true && answer.data.key !== null;
}

const openAiSettings = () => requestOpenSettings('ai');
const track = (event: AiSourceEvent) =>
  event === 'opened'
    ? workbench.track('UI', 'Opened', 'AiSourceSettings')
    : workbench.track('UI', 'Added', 'AiSourceKey');

export type WorkbenchAiSourceProps = {
  // On built-in AI, the feature's allowance.
  allowance?: ReactNode;
  // The feature's last call's key failure (`ai_key_failed`'s `aiKey`).
  failure?: AiKeyFailure | null;
  // For the field it describes.
  id?: string;
  // Where the scope does not reach: said here instead.
  teamId?: string | null;
  signedIn?: boolean;
};

export function WorkbenchAiSource({
  allowance,
  failure = null,
  id,
  teamId,
  signedIn,
}: WorkbenchAiSourceProps) {
  const scope = useContext(AiSourceScopeContext);
  const signed = signedIn ?? scope.signedIn;
  const { line, act } = useAiSource({
    request: signed ? accountDoor() : null,
    teamId: teamId === undefined ? scope.teamId : teamId,
    failure,
    openSettings: openAiSettings,
    track,
  });
  return <AiSource line={line} act={act} allowance={allowance} id={id} />;
}
