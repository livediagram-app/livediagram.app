'use client';

// An Ask AI answer's row under its footer (liveworkspace/docs/specs/020-ask/ask.md "Sending an answer on"): Send to
// Plan, a card of each listed item, and Send to Knowledge Base, the answer as written. The same row in every app's
// Ask AI and in liveknowledge's Ask. Each button shows only while the editor's host lets this session send (a
// signed-in account in person, the item in the cloud, not an embed, Offline or a Community copy); the items are read
// only when pressed. The pickers count their own opening (SendToPlan, SendToKnowledge).
import { HoverCard } from '@liveworkspace/ui';
import {
  canSendWordsToKnowledgeHere,
  sendWordsToKnowledge,
} from '../send-to-knowledge/send-to-knowledge-entry';
import { KnowledgeLogo } from '../send-to-knowledge/SendToKnowledgeButton';
import { answerItems } from './answer-items';
import { SendToPlanMenuIcon } from './send-menu-item';
import { canSendHere, sendFromHere } from './send-to-plan-entry';

const BUTTON =
  'touch-target relative inline-flex h-7 min-w-0 cursor-pointer items-center gap-1.5 rounded-full border border-slate-200 bg-white pl-2 pr-2.5 text-[12.5px] font-semibold text-slate-700 outline-none motion-safe:transition-colors motion-safe:duration-micro hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 focus-visible:ring-2 focus-visible:ring-brand-500/60 active:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:bg-slate-800 dark:hover:text-white dark:active:bg-slate-700';

/** The answer's cards for Send to Plan: a card a listed item, else one card of the whole answer. */
export function sendAnswerToPlan(markdown: string): void {
  const items = answerItems(markdown);
  if (items.length === 0) return;
  sendFromHere(
    'text',
    'answer',
    items.map((text) => ({ elementId: null, text, tabId: null })),
  );
}

export function AnswerSendActions({
  markdown,
  question,
  className = '',
}: {
  // The answer as written, its citation markers taken out.
  markdown: string;
  // The question it answers: the knowledgebase section's heading.
  question: string;
  className?: string;
}) {
  const plan = canSendHere();
  const knowledge = canSendWordsToKnowledgeHere();
  if ((!plan && !knowledge) || !markdown.trim()) return null;
  return (
    <div
      role="group"
      aria-label="Send this answer"
      data-ask-send=""
      className={`flex flex-wrap items-center gap-1.5 ${className}`}
    >
      {plan ? (
        <HoverCard
          title="Send to Plan"
          description="Make a card in liveplanner of each item this answer lists, every title editable first."
        >
          <button
            type="button"
            data-ask-send-to-plan=""
            onClick={() => sendAnswerToPlan(markdown)}
            className={BUTTON}
          >
            <SendToPlanMenuIcon size={14} />
            <span className="truncate">Send to Plan</span>
          </button>
        </HoverCard>
      ) : null}
      {knowledge ? (
        <HoverCard
          title="Send to Knowledge Base"
          description="Add this answer, as written, to a page in liveknowledge. No AI writes it up."
        >
          <button
            type="button"
            data-ask-send-to-knowledge=""
            onClick={() =>
              sendWordsToKnowledge({ heading: question.trim(), markdown: markdown.trim() })
            }
            className={BUTTON}
          >
            <KnowledgeLogo />
            <span className="truncate">Send to Knowledge Base</span>
          </button>
        </HoverCard>
      ) : null}
    </div>
  );
}
