'use client';

// The question field at the foot of the conversation (docs/specs/030-knowledgebase/search-and-ask.md "Bounds"): Enter
// sends, Shift and Enter make a new line, 1,000 characters at most with a count as the limit nears. While an answer
// streams the field waits and the button becomes Stop, which aborts the request.
import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import { HoverCard, TextArea, isComposingKey } from '@liveknowledge/ui';
import { ASK_MAX_QUESTION_CHARS } from '@liveknowledge/knowledge';
import { SendIcon, StopIcon } from './ask-icons';

/** The count shows from here on. */
export const ASK_COUNT_FROM = ASK_MAX_QUESTION_CHARS - 100;
// The field grows with its writing up to this height, then scrolls.
const MAX_FIELD_HEIGHT_PX = 160;

const ROUND_BUTTON =
  'touch-target relative flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full motion-safe:transition-colors motion-safe:duration-micro focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 disabled:cursor-not-allowed disabled:opacity-40';

export function AskComposer({
  streaming,
  followUp,
  onAsk,
  onStop,
  initialValue = '',
}: {
  streaming: boolean;
  // A turn is already there: the field asks for a follow-up.
  followUp: boolean;
  // False when the question was not taken (the field then keeps it).
  onAsk: (question: string) => boolean;
  onStop: () => void;
  // Words already in the field (Ask About This Page): focused, the caret at their end, nothing sent.
  initialValue?: string;
}) {
  const [value, setValue] = useState(initialValue);
  const field = useRef<HTMLTextAreaElement>(null);
  const started = useRef(initialValue);
  useEffect(() => {
    const el = field.current;
    if (!started.current || !el) return;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
  }, []);
  const countId = useId();
  const length = value.length;
  const ready = value.trim() !== '' && !streaming;

  // As tall as its writing, up to the cap.
  useLayoutEffect(() => {
    const el = field.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, MAX_FIELD_HEIGHT_PX)}px`;
  }, [value]);

  const send = () => {
    if (!ready) return;
    if (onAsk(value)) setValue('');
  };
  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter while an input method is composing confirms the word, it does not send.
    if (event.key !== 'Enter' || event.shiftKey || isComposingKey(event)) return;
    event.preventDefault();
    send();
  };

  return (
    <form
      data-ask-composer=""
      onSubmit={(event) => {
        event.preventDefault();
        send();
      }}
      className="flex items-end gap-2 rounded-2xl border border-slate-300 bg-white p-2 pl-3 shadow-sm focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-500/25 dark:border-slate-700 dark:bg-slate-900"
    >
      <TextArea
        ref={field}
        rows={1}
        value={value}
        maxLength={ASK_MAX_QUESTION_CHARS}
        disabled={streaming}
        aria-label={followUp ? 'Ask a follow-up' : 'Ask a question'}
        aria-describedby={length >= ASK_COUNT_FROM ? countId : undefined}
        placeholder={followUp ? 'Ask a follow-up' : 'Ask this knowledgebase a question'}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={onKeyDown}
        className="min-h-9 flex-1 resize-none !border-0 !bg-transparent !px-0 !py-1.5 !shadow-none !outline-none !ring-0"
      />
      {length >= ASK_COUNT_FROM ? (
        <span
          id={countId}
          role="status"
          data-ask-count=""
          className={`shrink-0 self-center text-xs tabular-nums ${
            length >= ASK_MAX_QUESTION_CHARS
              ? 'font-semibold text-amber-800 dark:text-amber-200'
              : 'text-slate-600 dark:text-slate-400'
          }`}
        >
          {length.toLocaleString('en')} / {ASK_MAX_QUESTION_CHARS.toLocaleString('en')}
        </span>
      ) : null}
      {streaming ? (
        <HoverCard title="Stop" description="Stops this answer. What has arrived is kept.">
          <button
            type="button"
            aria-label="Stop"
            onClick={onStop}
            className={`${ROUND_BUTTON} bg-slate-900 text-white hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white`}
          >
            <StopIcon />
          </button>
        </HoverCard>
      ) : (
        <HoverCard title="Send" description="Enter sends. Shift and Enter make a new line.">
          <button
            type="submit"
            aria-label="Send"
            disabled={!ready}
            className={`${ROUND_BUTTON} bg-brand-700 text-white enabled:hover:bg-brand-800 dark:bg-brand-600 dark:enabled:hover:bg-brand-500`}
          >
            <SendIcon />
          </button>
        </HoverCard>
      )}
    </form>
  );
}
