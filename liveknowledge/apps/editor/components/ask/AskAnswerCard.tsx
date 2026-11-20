'use client';

// One answer (docs/specs/030-knowledgebase/search-and-ask.md "What an answer shows"): the text with its citation
// chips, the trust line, an amber note for each part the pages do not cover, and its footer. The answer's Markdown
// is formatted once it has ended (AnswerBody), from text and elements made here, never as HTML. Memoised on its turn, so an earlier answer is not drawn again when
// a later one arrives.
import { memo, useMemo, useState } from 'react';
import type { KnowledgeAiProvider } from '@liveknowledge/api-schema';
import { Button, HoverCard } from '@liveknowledge/ui';
import { Callout } from '@liveworkspace/ui/callout';
import { REVIEW_DUE_PILL, VERIFIED_PILL } from '@/components/knowledge/TrustBadge';
import { answerMarkdown } from '@/lib/knowledge-ask/answer-parts';
import type { AskConversation, AskTurnView } from '@/lib/knowledge-ask/ask-conversation';
import { askFailureWords } from '@/lib/knowledge-ask/ask-failure-words';
import { answerTrust } from '@/lib/knowledge-ask/ask-trust';
import { track } from '@/lib/telemetry';
import { openAiSettingsFrom } from './AiSettingsButton';
import {
  CopiedIcon,
  CopyIcon,
  HelpfulIcon,
  NotHelpfulIcon,
  SavePageIcon,
  VerifiedIcon,
  WarningIcon,
} from './ask-icons';
import { AnswerBody } from './AnswerBody';
import { StreamingAnswer } from './StreamingAnswer';

const CARD =
  'rounded-2xl border border-slate-200 bg-white p-4 text-[15px] leading-7 text-slate-800 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 sm:p-5';
const FOOT_BUTTON = 'gap-1.5 !px-2';
const PRESSED = '!bg-slate-100 !text-slate-900 dark:!bg-slate-800 dark:!text-white';
/** How long Copy Answer says Copied. */
const COPIED_MS = 2000;

export type AskAnswerCardProps = {
  turn: AskTurnView;
  conversation: AskConversation;
  manageAi: boolean;
  /** Whose key the knowledgebase holds: a failure of the provider's own names it. */
  provider?: KnowledgeAiProvider | undefined;
  // Save as Page is an Editor's.
  canSave: boolean;
  onCite: (turnId: string, number: number) => void;
  onSave: (turnId: string) => void;
  onGrow?: (() => void) | undefined;
};

function AnswerText({ turn, onCite }: { turn: AskTurnView; onCite: AskAnswerCardProps['onCite'] }) {
  // The same map while the turn is the same, so the answer's Markdown is read once (AnswerBody).
  const titles = useMemo(
    () => new Map(turn.sources.map((source) => [source.number, source.title])),
    [turn.sources],
  );
  return (
    <AnswerBody text={turn.text} titles={titles} onCite={(number) => onCite(turn.id, number)} />
  );
}

function TrustLine({ turn }: { turn: AskTurnView }) {
  const trust = answerTrust(turn.sources);
  if (!trust) return null;
  return (
    <p
      data-ask-trust=""
      className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] leading-5"
    >
      <span
        className={`inline-flex items-center gap-1 rounded-full py-0.5 pl-1.5 pr-2 font-medium ${
          trust.verified > 0 ? VERIFIED_PILL : REVIEW_DUE_PILL
        }`}
      >
        {trust.verified > 0 ? <VerifiedIcon /> : <WarningIcon />}
        {trust.pill}
      </span>
      {trust.rest ? <span className="text-slate-600 dark:text-slate-400">{trust.rest}</span> : null}
    </p>
  );
}

function AnswerFooter({ turn, conversation, canSave, onSave }: AskAnswerCardProps) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(answerMarkdown(turn.text, turn.sources));
    } catch {
      return;
    }
    track('UI', 'Copied', 'AskAnswer');
    setCopied(true);
    window.setTimeout(() => setCopied(false), COPIED_MS);
  };
  const rate = (feedback: 'helpful' | 'not-helpful') => {
    const next = turn.feedback === feedback ? undefined : feedback;
    if (next === 'helpful') track('UI', 'Used', 'AskHelpful');
    if (next === 'not-helpful') track('UI', 'Used', 'AskNotHelpful');
    conversation.setFeedback(turn.id, next);
  };
  return (
    <div className="mt-3 flex flex-wrap items-center gap-1 border-t border-slate-100 pt-3 dark:border-slate-800">
      <HoverCard title="Helpful" description="This answered the question.">
        <Button
          variant="ghost"
          size="xs"
          aria-label="Helpful"
          aria-pressed={turn.feedback === 'helpful'}
          onClick={() => rate('helpful')}
          className={`${FOOT_BUTTON} ${turn.feedback === 'helpful' ? PRESSED : ''}`}
        >
          <HelpfulIcon />
        </Button>
      </HoverCard>
      <HoverCard title="Not Helpful" description="This did not answer the question.">
        <Button
          variant="ghost"
          size="xs"
          aria-label="Not Helpful"
          aria-pressed={turn.feedback === 'not-helpful'}
          onClick={() => rate('not-helpful')}
          className={`${FOOT_BUTTON} ${turn.feedback === 'not-helpful' ? PRESSED : ''}`}
        >
          <NotHelpfulIcon />
        </Button>
      </HoverCard>
      <span className="flex-1" />
      <Button variant="ghost" size="xs" onClick={() => void copy()} className={FOOT_BUTTON}>
        {copied ? <CopiedIcon /> : <CopyIcon />}
        <span role="status">{copied ? 'Copied' : 'Copy Answer'}</span>
      </Button>
      {canSave ? (
        <Button variant="ghost" size="xs" onClick={() => onSave(turn.id)} className={FOOT_BUTTON}>
          <SavePageIcon />
          Save as Page
        </Button>
      ) : null}
    </div>
  );
}

function AnswerFailure({ turn, conversation, manageAi, provider }: AskAnswerCardProps) {
  const words = askFailureWords(turn.failure ?? 'other', { manageAi, provider });
  const action =
    words.step === 'ai-settings'
      ? { label: 'Open AI Settings', onSelect: openAiSettingsFrom }
      : words.step === 'ask-again'
        ? { label: 'Ask Again', onSelect: () => conversation.askAgain(turn.id) }
        : undefined;
  return (
    <Callout
      tone="warning"
      size="md"
      role="alert"
      title={words.title}
      {...(action ? { action } : {})}
    >
      {words.text}
    </Callout>
  );
}

export const AskAnswerCard = memo(function AskAnswerCard(props: AskAnswerCardProps) {
  const { turn, conversation, onCite, onGrow } = props;
  if (turn.status === 'failed')
    return (
      <div data-ask-turn={turn.id} data-status="failed">
        <AnswerFailure {...props} />
      </div>
    );
  return (
    <article
      aria-label="Answer"
      aria-busy={turn.status === 'streaming'}
      data-ask-turn={turn.id}
      data-status={turn.status}
      className={CARD}
    >
      {turn.status === 'streaming' ? (
        <StreamingAnswer conversation={conversation} turnId={turn.id} onGrow={onGrow} />
      ) : (
        <AnswerText turn={turn} onCite={onCite} />
      )}
      {turn.status === 'stopped' ? (
        <p className="mt-3 text-[13px] leading-5 text-slate-600 dark:text-slate-400">
          {turn.text ? 'Stopped. What had arrived is kept.' : 'Stopped before anything arrived.'}
        </p>
      ) : null}
      {turn.status === 'done' ? (
        <>
          <TrustLine turn={turn} />
          {turn.gaps.map((gap) => (
            <Callout
              key={gap}
              tone="warning"
              size="md"
              role="note"
              title="One thing the knowledgebase does not cover."
              className="mt-3"
            >
              {gap}
            </Callout>
          ))}
          <AnswerFooter {...props} />
        </>
      ) : null}
    </article>
  );
});
