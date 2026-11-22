'use client';

// The source line in an editor (liveworkspace/docs/specs/003-accounts/ai-keys.md "The source line (AiSource)"):
// @liveworkspace/settings-ui's AiSource, bound once for every editor. It reads the account's AI keys over the app's
// bearer door (`/api/workspace/account`), opens Settings on its AI category through the editor's own Settings host
// (lib/open-settings.ts), so the dialog it sits in stays open underneath, and counts its two events. The item's team
// and whether the person is signed in come from the editor, which says them once (ai-source-scope.ts).

import type { ReactNode } from 'react';
import type { AiKeyFailure } from '@liveworkspace/ai/key-failure';
import { AiSource, useAiSource, type AiSourceEvent } from '@liveworkspace/settings-ui/ai-source';
import { workbench } from '../../bindings';
import { requestOpenSettings } from '../../lib/open-settings';
import { accountDoor, useEditorAiScope } from './ai-source-scope';

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
  const editor = useEditorAiScope();
  const signed = signedIn ?? editor.signedIn;
  const { line, act } = useAiSource({
    request: signed ? accountDoor() : null,
    teamId: teamId === undefined ? editor.teamId : teamId,
    failure,
    openSettings: openAiSettings,
    track,
  });
  return <AiSource line={line} act={act} allowance={allowance} id={id} />;
}
