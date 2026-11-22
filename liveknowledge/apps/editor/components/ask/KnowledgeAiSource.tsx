'use client';

// The source line in liveknowledge (docs/specs/030-knowledgebase/search-and-ask.md "The source line"): the shared
// AiSource, worked out from the knowledgebase's own `GET ai` (which already answers which key applies for this asker:
// the knowledgebase's, the team's, the person's or built-in AI) rather than from accounts again. The knowledgebase's key
// is changed in AI Settings, by those who manage it; the person's own, or a first key, in Settings › AI over the view;
// the team's by its admins. A key that will not open says so, with Fix Key. Closing Settings reads `GET ai` again, so
// the line follows with no reload.

import { useEffect, useRef } from 'react';
import { aiKeyFailureWords, type AiKeySource } from '@liveworkspace/ai';
import type { KnowledgeAiSettings } from '@liveknowledge/api-schema';
import {
  AI_KEY_CHANGED_EVENT,
  AiSource,
  type AiSourceLine,
  type AiSourceOwner,
} from '@liveworkspace/settings-ui/ai-source';
import { requestOpenSettings } from '@liveworkspace/workbench/lib/open-settings';
import type { KnowledgeCaller } from '@/lib/api/knowledge';
import { aiSettingsStore, type AiSettingsState } from '@/lib/knowledge-ask/ai-settings-store';
import { aiInUse } from '@/lib/knowledge-ask/ai-settings-words';
import { track } from '@/lib/telemetry';
import { openAiSettingsFrom } from './AiSettingsButton';

const OWNER: Record<'knowledgebase' | 'team' | 'personal', AiSourceOwner> = {
  knowledgebase: 'item',
  team: 'team',
  personal: 'you',
};
const SOURCE: Record<'knowledgebase' | 'team' | 'personal', AiKeySource> = {
  knowledgebase: 'item',
  team: 'team',
  personal: 'account',
};

type LineSettings = Pick<
  KnowledgeAiSettings,
  'hasKey' | 'builtIn' | 'uses' | 'provider' | 'usesModel' | 'usesModelLabel'
>;

/** The line for this asker. `manageAi`: may change the knowledgebase's own key. Null where no AI answers here. */
export function knowledgeAiLine(
  state: AiSettingsState | { status: 'ready'; settings: LineSettings },
  manageAi: boolean,
): AiSourceLine | null {
  if (state.status === 'loading') return { kind: 'loading' };
  if (state.status !== 'ready') return null;
  const { settings } = state;
  const uses = aiInUse(settings);
  if (uses === null) return null;
  if (uses === 'built-in') return { kind: 'built-in', canChange: true };
  const owner = OWNER[uses];
  // A team's key is its admins' (Settings › AI, Teams); the knowledgebase's, its managers'; the person's, theirs.
  const canChange = uses === 'knowledgebase' ? manageAi : uses === 'personal';
  // `usesModel` is absent for a key that will not open (search-and-ask.md "Which key answers").
  if (!settings.usesModel && settings.uses !== undefined)
    return {
      kind: 'failed',
      owner,
      provider: settings.provider,
      words: aiKeyFailureWords({
        source: SOURCE[uses],
        provider: settings.provider,
        kind: 'unreadable',
      }),
      canChange,
    };
  return {
    kind: 'key',
    owner,
    provider: settings.provider,
    model: settings.usesModelLabel ?? settings.usesModel ?? '',
    canChange,
  };
}

export function KnowledgeAiSource({
  state,
  who,
  documentId,
  manageAi,
  allowance,
  id,
}: {
  state: AiSettingsState;
  who: KnowledgeCaller;
  documentId: string;
  manageAi: boolean;
  allowance?: string;
  id?: string;
}) {
  const line = knowledgeAiLine(state, manageAi);
  // Set when the action opened Settings on built-in AI, so a key added there is counted once.
  const openedOnBuiltIn = useRef(false);
  const live = useRef({ who, documentId });
  useEffect(() => {
    live.current = { who, documentId };
  }, [who, documentId]);
  useEffect(() => {
    const changed = () => {
      const { who: caller, documentId: doc } = live.current;
      void aiSettingsStore.refresh(caller, doc).then(() => {
        const next = aiSettingsStore.get(doc);
        if (!openedOnBuiltIn.current || next.status !== 'ready') return;
        if (aiInUse(next.settings) === 'built-in') return;
        openedOnBuiltIn.current = false;
        track('UI', 'Added', 'AiSourceKey');
      });
    };
    window.addEventListener(AI_KEY_CHANGED_EVENT, changed);
    return () => window.removeEventListener(AI_KEY_CHANGED_EVENT, changed);
  }, []);

  const act =
    !line || line.kind === 'loading' || !line.canChange
      ? null
      : line.kind !== 'built-in' && line.owner === 'item'
        ? openAiSettingsFrom
        : () => {
            openedOnBuiltIn.current = line.kind === 'built-in';
            track('UI', 'Opened', 'AiSourceSettings');
            requestOpenSettings('ai');
          };
  return (
    <AiSource
      line={line}
      act={act}
      allowance={allowance}
      itemKeyName="This Knowledgebase’s Key"
      id={id}
    />
  );
}
