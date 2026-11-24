'use client';

// The question box every Ask shares (liveworkspace/docs/specs/020-ask/ask.md "The tool"): the field on top, and under
// it, in the same rounded box, the AI pill at the left, the count as the limit nears, New Chat and Send (Stop while an
// answer streams) at the right. It knows no app and no item: the host hands it its words, its pill and what a
// question does. Enter sends, Shift and Enter make a new line.
import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { TextArea, Tooltip, isComposingKey } from '@liveworkspace/ui';
import { ASK_MAX_QUESTION_CHARS } from '../limits';
import { SendIcon, StopIcon } from './ask-icons';

/** The count shows from here on. */
export const ASK_COUNT_FROM = ASK_MAX_QUESTION_CHARS - 100;
// The field grows with its writing up to this height, then scrolls.
const MAX_FIELD_HEIGHT_PX = 120;

const ROUND_BUTTON =
  'touch-target relative flex size-[34px] shrink-0 cursor-pointer items-center justify-center rounded-full outline-none motion-safe:transition-colors motion-safe:duration-micro focus-visible:ring-2 focus-visible:ring-brand-500/60 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40 dark:focus-visible:ring-offset-slate-900';
const QUIET_BUTTON =
  'touch-target relative shrink-0 cursor-pointer rounded-full px-2 py-1.5 text-[12.5px] font-semibold text-slate-600 outline-none motion-safe:transition-colors motion-safe:duration-micro hover:bg-slate-100 hover:text-slate-900 focus-visible:ring-2 focus-visible:ring-brand-500/60 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white';

export function AskComposer({
  label,
  followUpLabel = 'Ask a follow-up',
  followUp,
  streaming,
  onAsk,
  onStop,
  onNewChat = null,
  pill,
  cost = null,
  maxFieldHeight = MAX_FIELD_HEIGHT_PX,
  autoFocus = true,
}: {
  /** The empty field's name and placeholder: "Ask this canvas a question". */
  label: string;
  /** Its name once a turn is there. */
  followUpLabel?: string;
  // A turn is already there: the field asks for a follow-up.
  followUp: boolean;
  streaming: boolean;
  // False when the question was not taken (the field then keeps it).
  onAsk: (question: string) => boolean;
  onStop: () => void;
  /** New Chat, once there is a turn; null leaves it out. */
  onNewChat?: (() => void) | null;
  /** Which AI answers: the AI pill (`AnswerWith`), at the lower row's left. */
  pill: ReactNode;
  /** What the next question costs, with Pro on and built-in AI answering: "Uses 1 AI credit". */
  cost?: string | null;
  maxFieldHeight?: number;
  /** Put the caret in the field when the box first shows. */
  autoFocus?: boolean;
}) {
  const [value, setValue] = useState('');
  const field = useRef<HTMLTextAreaElement>(null);
  const countId = useId();
  const length = value.length;
  const ready = value.trim() !== '' && !streaming;
  const name = followUp ? followUpLabel : label;

  // As tall as its writing, up to the cap.
  useLayoutEffect(() => {
    const el = field.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, maxFieldHeight)}px`;
  }, [value, maxFieldHeight]);
  // Opening puts the caret in the field, ready to type (after the host's own first focus).
  useEffect(() => {
    if (!autoFocus) return;
    const frame = requestAnimationFrame(() => field.current?.focus({ preventScroll: true }));
    return () => cancelAnimationFrame(frame);
  }, [autoFocus]);

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
      className="flex flex-col gap-1.5 rounded-[18px] border border-slate-300 bg-white py-2 pl-3.5 pr-2 shadow-sm focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-500/25 dark:border-slate-700 dark:bg-slate-900"
    >
      <TextArea
        ref={field}
        rows={1}
        value={value}
        maxLength={ASK_MAX_QUESTION_CHARS}
        disabled={streaming}
        aria-label={name}
        aria-describedby={length >= ASK_COUNT_FROM ? countId : undefined}
        placeholder={name}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={onKeyDown}
        className="min-h-[30px] w-full resize-none !border-0 !bg-transparent !px-0 !py-1 !shadow-none !outline-none !ring-0"
      />
      <div className="flex min-w-0 items-center gap-1.5">
        {pill}
        <span className="flex-1" />
        {length >= ASK_COUNT_FROM ? (
          <span
            id={countId}
            role="status"
            data-ask-count=""
            className={`shrink-0 text-xs tabular-nums ${
              length >= ASK_MAX_QUESTION_CHARS
                ? 'font-semibold text-amber-800 dark:text-amber-200'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            {length.toLocaleString('en')} / {ASK_MAX_QUESTION_CHARS.toLocaleString('en')}
          </span>
        ) : null}
        {onNewChat ? (
          <Tooltip label="New Chat">
            <button type="button" data-ask-new-chat="" onClick={onNewChat} className={QUIET_BUTTON}>
              New Chat
            </button>
          </Tooltip>
        ) : null}
        {streaming ? (
          <Tooltip label="Stop">
            <button
              type="button"
              aria-label="Stop"
              onClick={onStop}
              className={`${ROUND_BUTTON} bg-slate-900 text-white hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white`}
            >
              <StopIcon />
            </button>
          </Tooltip>
        ) : (
          <Tooltip label="Send">
            <button
              type="submit"
              aria-label="Send"
              disabled={!ready}
              className={`${ROUND_BUTTON} bg-brand-700 text-white enabled:hover:bg-brand-800 dark:bg-brand-600 dark:enabled:hover:bg-brand-500`}
            >
              <SendIcon />
            </button>
          </Tooltip>
        )}
      </div>
      {cost ? (
        <p data-ask-credits="" className="text-[12px] leading-4 text-slate-600 dark:text-slate-400">
          {cost}
        </p>
      ) : null}
    </form>
  );
}
