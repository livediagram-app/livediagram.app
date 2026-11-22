'use client';

// Which AI answers the next question (docs/specs/030-knowledgebase/search-and-ask.md "Choosing which AI answers"):
// under Ask's field once a key answers, Built-In AI or the key (the knowledgebase's, the team's or the person's) named
// by its model and whose it is ("Which key answers"). The choice is the person's,
// kept in this browser per knowledgebase; a change applies to the next question, mid-chat too.
import type { AskAiChoice, KnowledgeAiSettings } from '@liveknowledge/api-schema';
import { SegmentedToggle, type SegmentedOption } from '@liveknowledge/ui';
import type { KnowledgeCaller } from '@/lib/api/knowledge';
import {
  BUILT_IN_LABEL,
  askAiChoiceStore,
  keyChoiceDescription,
  keyChoiceLabel,
  useAskAiChoice,
} from '@/lib/knowledge-ask/ask-ai-choice';
import { track } from '@/lib/telemetry';

export function AskAiPicker({
  who,
  documentId,
  settings,
}: {
  who: KnowledgeCaller;
  documentId: string;
  settings: Pick<KnowledgeAiSettings, 'hasKey' | 'model' | 'models' | 'uses' | 'usesModelLabel'>;
}) {
  const choice = useAskAiChoice(who, documentId);
  const options: readonly SegmentedOption<AskAiChoice>[] = [
    {
      value: 'built-in',
      label: BUILT_IN_LABEL,
      description: 'Included with liveknowledge, with daily limits. Applies to your next question.',
    },
    {
      value: 'key',
      label: keyChoiceLabel(settings),
      description: keyChoiceDescription(settings),
    },
  ];
  return (
    <SegmentedToggle
      label="Answer With"
      value={choice}
      options={options}
      onChange={(next) => {
        track('UI', 'Changed', next === 'built-in' ? 'AskAiBuiltIn' : 'AskAiKey');
        askAiChoiceStore.set(who, documentId, next);
      }}
      className="max-w-full"
    />
  );
}
