'use client';

// The source line in liveknowledge (docs/specs/030-knowledgebase/search-and-ask.md "The source line"): the shared
// AiSource, worked out from the knowledgebase's own `GET ai` (which already answers which key applies for this asker:
// the knowledgebase's, the team's, the person's or built-in AI) rather than from accounts again. The knowledgebase's key
// is changed in AI Settings, by those who manage it; the person's own, or a first key, in Settings › AI over the view;
// the team's by its admins. A key that will not open says so, with Fix Key, and so does a key the provider refused on the
// view's last call (Ask, Describe to Set Up, Describe the Structure), until the next answer or a change of key.
// Closing Settings reads `GET ai` again, so the line follows with no reload.

import { useEffect, useRef, useState } from 'react';
import {
  aiKeyFailureWords,
  isKeyFailureKind,
  type AiKeySource,
} from '@liveworkspace/ai/key-failure';
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
  | 'hasKey'
  | 'builtIn'
  | 'uses'
  | 'provider'
  | 'model'
  | 'models'
  | 'usesModel'
  | 'usesModelLabel'
  | 'usesProvider'
>;

/** The view's last call's failure: its kind (`bad-key`, `rate-limited`, …) and, where the answer named it, the
 *  provider that refused. */
export type KnowledgeCallFailure = { kind: string; provider?: string | null | undefined };

/** The line for this asker. `manageAi`: may change the knowledgebase's own key. `failure`: the view's last call's,
 *  which turns a key's line to Key Needs Attention when the provider refused the key. Null where no AI answers here. */
export function knowledgeAiLine(
  state: AiSettingsState | { status: 'ready'; settings: LineSettings },
  manageAi: boolean,
  failure: KnowledgeCallFailure | null = null,
): AiSourceLine | null {
  if (state.status === 'loading') return { kind: 'loading' };
  if (state.status !== 'ready') return null;
  const { settings } = state;
  const uses = aiInUse(settings);
  if (uses === null) return null;
  if (uses === 'built-in') return { kind: 'built-in', canChange: true };
  const owner = OWNER[uses];
  // A team's or a person's key may be another provider's than the knowledgebase's own.
  const provider = settings.usesProvider ?? settings.provider;
  // A team's key is its admins' (Settings › AI, Teams); the knowledgebase's, its managers'; the person's, theirs.
  const canChange = uses === 'knowledgebase' ? manageAi : uses === 'personal';
  // `usesModel` is absent for a key that will not open (search-and-ask.md "Which key answers").
  if (!settings.usesModel && settings.uses !== undefined)
    return {
      kind: 'failed',
      owner,
      provider: null,
      words: aiKeyFailureWords({
        source: SOURCE[uses],
        provider: null,
        kind: 'unreadable',
      }),
      canChange,
    };
  // A refusal the person fixes in Settings (a rejected key, no credit, a model the key cannot use); a passing one (busy,
  // rate limited) changes nothing here.
  if (failure && failure.kind !== 'unreadable' && isKeyFailureKind(failure.kind)) {
    const refused =
      failure.provider === 'anthropic' || failure.provider === 'openai'
        ? failure.provider
        : provider;
    return {
      kind: 'failed',
      owner,
      provider: refused,
      words: aiKeyFailureWords({ source: SOURCE[uses], provider: refused, kind: failure.kind }),
      canChange,
    };
  }
  return {
    kind: 'key',
    owner,
    provider,
    // `GET ai` names the model that answers; the overview, read before it, the knowledgebase's own.
    model:
      settings.usesModelLabel ??
      settings.models.find((m) => m.id === (settings.usesModel ?? settings.model))?.label ??
      settings.usesModel ??
      settings.model,
    canChange,
  };
}

/** Whether the line says the view's failure itself (a key the provider refused): the view's own callout is then
 *  heard, not drawn twice (ai-keys.md "The source line"). */
export const saidOnLine = (
  state: Parameters<typeof knowledgeAiLine>[0],
  manageAi: boolean,
  failure: KnowledgeCallFailure | null,
): boolean =>
  failure !== null &&
  isKeyFailureKind(failure.kind) &&
  knowledgeAiLine(state, manageAi, failure)?.kind === 'failed';

export function KnowledgeAiSource({
  state,
  who,
  documentId,
  manageAi,
  allowance,
  id,
  failure = null,
}: {
  state: AiSettingsState;
  // The view's last call's failure (held by the view, a new one per call), until its next answer.
  failure?: KnowledgeCallFailure | null;
  who: KnowledgeCaller;
  documentId: string;
  manageAi: boolean;
  allowance?: string;
  id?: string;
}) {
  // A change of key in Settings answers the failure: the next call says again if it still fails.
  const [settled, setSettled] = useState<KnowledgeCallFailure | null>(null);
  const line = knowledgeAiLine(state, manageAi, failure === settled ? null : failure);
  // Set when the action opened Settings on built-in AI, so a key added there is counted once.
  const openedOnBuiltIn = useRef(false);
  const live = useRef({ who, documentId, failure });
  useEffect(() => {
    live.current = { who, documentId, failure };
  }, [who, documentId, failure]);
  useEffect(() => {
    const changed = () => {
      setSettled(live.current.failure);
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
