'use client';

// Ask's question box (docs/specs/030-knowledgebase/search-and-ask.md "The question box"): the composer every app's Ask
// AI shares (@liveworkspace/ask), with the AI built into it as livediagram's is. The AI pill at its lower left says
// which AI answers the next question and opens Answer With; nothing about the AI is drawn outside the box. Answer From
// (the labels) stands above it.
import { AnswerWith, AskComposer as SharedComposer, askAiView } from '@liveworkspace/ask/composer';
import { ASK_BUILT_IN_PER_PERSON_PER_DAY } from '@liveknowledge/knowledge';
import { AskLabelScope } from '@/components/page-labels/AskLabelScope';
import type { KnowledgeCaller } from '@/lib/api/knowledge';
import type { AiSettingsState } from '@/lib/knowledge-ask/ai-settings-store';
import { askAiChoiceStore, askAiOf, useAskAiChoice } from '@/lib/knowledge-ask/ask-ai-choice';
import { track } from '@/lib/telemetry';
import {
  ITEM_KEY_NAME,
  useKnowledgeAiSource,
  type KnowledgeCallFailure,
} from './KnowledgeAiSource';

// The field grows with its writing up to this height, then scrolls: the Ask view is wider and taller than Tools.
const MAX_FIELD_HEIGHT_PX = 160;
/** Built-in AI's row in Answer With. */
export const BUILT_IN_DETAIL = `Included, ${ASK_BUILT_IN_PER_PERSON_PER_DAY} questions a person a day`;

export function AskComposer({
  streaming,
  followUp,
  onAsk,
  onStop,
  ai,
  who,
  documentId,
  manageAi,
  failure,
  cost,
}: {
  streaming: boolean;
  // A turn is already there: the field asks for a follow-up.
  followUp: boolean;
  // False when the question was not taken (the field then keeps it).
  onAsk: (question: string) => boolean;
  onStop: () => void;
  /** The knowledgebase's `GET ai`, for which AI answers. */
  ai: AiSettingsState;
  who: KnowledgeCaller;
  documentId: string;
  /** May change the knowledgebase's own key (an Editor). */
  manageAi: boolean;
  /** The last answer's failure: a key the provider refused turns the pill to Key Needs Attention. */
  failure: KnowledgeCallFailure | null;
  /** With Pro on and built-in AI answering, what the next question costs. */
  cost: string | null;
}) {
  const { line, act } = useKnowledgeAiSource({ state: ai, who, documentId, manageAi, failure });
  const choice = useAskAiChoice(who, documentId);
  // A server with no built-in AI has nothing to choose: the key answers whatever was picked before.
  const builtIn = ai.status !== 'ready' || ai.settings.builtIn;
  const view = askAiView(
    line,
    askAiOf(choice, ai.status === 'ready' ? ai.settings : null),
    ITEM_KEY_NAME,
  );
  return (
    <div className="flex flex-col gap-1.5">
      {/* Answer From, above the box, where the knowledgebase has labels (search-and-ask.md "Answer From"). */}
      <AskLabelScope />
      <SharedComposer
        label="Ask this knowledgebase a question"
        followUp={followUp}
        streaming={streaming}
        onAsk={onAsk}
        onStop={onStop}
        maxFieldHeight={MAX_FIELD_HEIGHT_PX}
        // Opening Ask leaves the caret where it was: on a phone the keyboard would cover the chats.
        autoFocus={false}
        cost={view.using === 'built-in' ? cost : null}
        pill={
          <AnswerWith
            app="liveknowledge"
            view={view}
            builtIn={builtIn}
            builtInDetail={BUILT_IN_DETAIL}
            manage={act}
            onPick={(next) => {
              track('UI', 'Changed', next === 'built-in' ? 'AskAiBuiltIn' : 'AskAiKey');
              askAiChoiceStore.set(who, documentId, next);
            }}
          />
        }
      />
    </div>
  );
}
