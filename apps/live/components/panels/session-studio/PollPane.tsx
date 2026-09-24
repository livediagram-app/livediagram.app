'use client';

// The Poll tool (spec/88): compose a question, choose how people answer, see
// exactly what they will be shown, and ask.
//
// The composer's centrepiece is the live preview card. A poll is the one
// session tool that interrupts everyone with a prompt, so the facilitator
// should see that prompt before sending it, not discover a typo on twelve
// screens at once. While a poll runs this pane shrinks to a status card: the
// results and the End control live in the floating Poll panel everyone can
// see, not behind a menu only the host has open.

import { useRef, useState, type ReactNode } from 'react';
import { flushSync } from 'react-dom';
import {
  POLL_OPTIONS_MAX,
  POLL_OPTIONS_MIN,
  POLL_OPTION_MAX,
  POLL_QUESTION_MAX,
  type LivePoll,
  type PollStyle,
} from '@livediagram/api-schema';
import { POLL_STYLES, POLL_STYLE_LABEL, pollStyleTokens } from '@livediagram/diagram';
import type { SessionToolsProps } from '@/components/chrome/session-tools-props';
import { StudioButton, StudioCallout, StudioLabel } from './studio-ui';

const field =
  'w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[12px] text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-brand-400 focus:ring-2 focus:ring-brand-400/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100';

type PollPaneProps = Pick<SessionToolsProps, 'livePoll' | 'pollConnected' | 'onStartPoll'>;

export function PollPane({ livePoll, pollConnected, onStartPoll }: PollPaneProps) {
  if (livePoll) return <RunningPoll poll={livePoll} />;
  if (!pollConnected) return <PollNeedsRoom />;
  return <PollComposer onStartPoll={onStartPoll} />;
}

function PollComposer({ onStartPoll }: Pick<PollPaneProps, 'onStartPoll'>) {
  const [question, setQuestion] = useState('');
  const [style, setStyle] = useState<PollStyle>('yesNo');
  const [options, setOptions] = useState<string[]>(['', '']);
  const optionRefs = useRef<(HTMLInputElement | null)[]>([]);

  const trimmed = options.map((o) => o.trim()).filter((o) => o.length > 0);
  const missing = !question.trim()
    ? 'Write a question to ask'
    : style === 'choice' && trimmed.length < POLL_OPTIONS_MIN
      ? `Add at least ${POLL_OPTIONS_MIN} answers`
      : null;

  const start = () => {
    if (missing) return;
    onStartPoll({ question: question.trim(), style, options: trimmed });
  };

  const addOption = (focus: boolean) => {
    if (options.length >= POLL_OPTIONS_MAX) return;
    // Flushed so the new field exists before focus moves to it: deferring the
    // focus a frame let quick typing land in the answer you just left.
    flushSync(() => setOptions((prev) => [...prev, '']));
    if (focus) optionRefs.current[options.length]?.focus();
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <StudioLabel
          aside={
            question.length > POLL_QUESTION_MAX * 0.8
              ? `${question.length}/${POLL_QUESTION_MAX}`
              : undefined
          }
        >
          Question
        </StudioLabel>
        <textarea
          value={question}
          rows={2}
          autoFocus
          onChange={(e) =>
            setQuestion(e.target.value.slice(0, POLL_QUESTION_MAX).replace(/\n/g, ' '))
          }
          onKeyDown={(e) => {
            e.stopPropagation();
            // Enter asks, as in any single-line prompt; a question has no use
            // for a line break.
            if (e.key === 'Enter') {
              e.preventDefault();
              start();
            }
          }}
          placeholder="What should we tackle first?"
          aria-label="Poll question"
          className={`${field} resize-none leading-snug`}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <StudioLabel>Answers</StudioLabel>
        <div className="grid grid-cols-3 gap-1" role="radiogroup" aria-label="Answer style">
          {POLL_STYLES.map((s) => (
            <StyleTile key={s} style={s} selected={style === s} onPick={() => setStyle(s)} />
          ))}
        </div>
      </div>
      {style === 'choice' ? (
        <div className="flex flex-col gap-1">
          {options.map((opt, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[10px] font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                {String.fromCharCode(65 + i)}
              </span>
              <input
                ref={(el) => {
                  optionRefs.current[i] = el;
                }}
                value={opt}
                onChange={(e) => {
                  const value = e.target.value.slice(0, POLL_OPTION_MAX);
                  setOptions((prev) => prev.map((o, j) => (j === i ? value : o)));
                }}
                onKeyDown={(e) => {
                  e.stopPropagation();
                  // Enter moves on to the next answer, making a new one at the
                  // end of the list, so a list can be typed without the mouse.
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    if (i < options.length - 1) optionRefs.current[i + 1]?.focus();
                    else addOption(true);
                  }
                }}
                placeholder={`Answer ${String.fromCharCode(65 + i)}`}
                aria-label={`Answer ${i + 1}`}
                className={field}
              />
              {options.length > POLL_OPTIONS_MIN ? (
                <button
                  type="button"
                  aria-label={`Remove answer ${i + 1}`}
                  onClick={() => setOptions((prev) => prev.filter((_, j) => j !== i))}
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10"
                >
                  ×
                </button>
              ) : null}
            </div>
          ))}
          {options.length < POLL_OPTIONS_MAX ? (
            <button
              type="button"
              onClick={() => addOption(true)}
              className="ml-6 self-start rounded-md px-1.5 py-0.5 text-[11px] font-semibold text-brand-600 transition hover:bg-brand-50 dark:text-brand-300 dark:hover:bg-brand-500/15"
            >
              + Add answer
            </button>
          ) : null}
        </div>
      ) : null}
      <PromptPreview question={question.trim()} style={style} options={trimmed} />
      <StudioButton variant="primary" onClick={start} disabled={missing !== null}>
        {missing ?? 'Ask everyone'}
      </StudioButton>
      <p className="text-center text-[10px] leading-snug text-slate-400 dark:text-slate-500">
        Everyone here is asked, view-only visitors included. Answers are anonymous and nothing is
        saved to the diagram.
      </p>
    </div>
  );
}

// A thumbnail of the answer shape, drawn rather than described: two pills
// for Yes / No, five dots for a rating, lines for free text.
const STYLE_ART: Record<PollStyle, ReactNode> = {
  yesNo: <PillRow count={2} />,
  yesNoAbstain: <PillRow count={3} />,
  choice: (
    <span className="flex w-full flex-col gap-0.5">
      {[0, 1, 2].map((i) => (
        <span key={i} className="flex items-center gap-0.5">
          <span className="h-1 w-1 rounded-full bg-current opacity-70" />
          <span className="h-1 flex-1 rounded-full bg-current opacity-30" />
        </span>
      ))}
    </span>
  ),
  rating: (
    <span className="flex gap-0.5">
      {[0, 1, 2, 3, 4].map((i) => (
        <span key={i} className="h-1.5 w-1.5 rounded-full bg-current opacity-60" />
      ))}
    </span>
  ),
  text: (
    <span className="flex w-full flex-col gap-0.5">
      <span className="h-1 w-full rounded-full bg-current opacity-30" />
      <span className="h-1 w-2/3 rounded-full bg-current opacity-30" />
    </span>
  ),
};

function PillRow({ count }: { count: number }) {
  return (
    <span className="flex gap-0.5">
      {Array.from({ length: count }, (_, i) => (
        <span key={i} className="h-2 w-3 rounded-full bg-current opacity-50" />
      ))}
    </span>
  );
}

function StyleTile({
  style,
  selected,
  onPick,
}: {
  style: PollStyle;
  selected: boolean;
  onPick: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onPick}
      className={`flex flex-col items-center gap-1.5 rounded-lg border px-1 py-2 transition ${
        selected
          ? 'border-brand-400 bg-brand-50 text-brand-700 dark:border-brand-500/60 dark:bg-brand-500/15 dark:text-brand-200'
          : 'border-slate-200 bg-white text-slate-500 hover:border-brand-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400'
      }`}
    >
      <span className="flex h-4 w-8 items-center justify-center">{STYLE_ART[style]}</span>
      <span className="text-[10px] font-semibold leading-none">{POLL_STYLE_LABEL[style]}</span>
    </button>
  );
}

// What each participant's prompt will look like, drawn from the same token
// list the real prompt reads (`pollStyleTokens`), so the two can't disagree.
function PromptPreview({
  question,
  style,
  options,
}: {
  question: string;
  style: PollStyle;
  options: string[];
}) {
  const tokens = pollStyleTokens(style, options);
  return (
    <div className="flex flex-col gap-1.5">
      <StudioLabel>What people see</StudioLabel>
      <div className="flex flex-col gap-2 rounded-xl border border-dashed border-slate-200 bg-slate-50/70 p-2.5 dark:border-slate-700 dark:bg-slate-800/40">
        <span
          className={`text-[12px] font-semibold leading-snug ${
            question ? 'text-slate-800 dark:text-slate-100' : 'italic text-slate-400'
          }`}
        >
          {question || 'Your question'}
        </span>
        {style === 'text' ? (
          <span className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-400 dark:border-slate-700 dark:bg-slate-900">
            Type an answer…
          </span>
        ) : (
          <span className={`flex flex-wrap gap-1 ${style === 'choice' ? 'flex-col' : ''}`}>
            {(tokens.length ? tokens : ['Answer A', 'Answer B']).map((t, i) => (
              <span
                key={`${t}-${i}`}
                className={`rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 ${
                  style === 'rating' ? 'min-w-7 text-center' : ''
                } ${tokens.length ? '' : 'italic text-slate-400'}`}
              >
                {t}
              </span>
            ))}
          </span>
        )}
        <span className="text-[10px] text-slate-400">Skip</span>
      </div>
    </div>
  );
}

function RunningPoll({ poll }: { poll: LivePoll }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50/60 p-3 dark:border-emerald-500/30 dark:bg-emerald-500/10">
        <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" aria-hidden />
          Asking now · {POLL_STYLE_LABEL[poll.style]}
        </span>
        <span className="text-[13px] font-semibold leading-snug text-slate-800 dark:text-slate-100">
          {poll.question}
        </span>
      </div>
      <StudioCallout>
        Answers come in on the Poll panel, where you can end the poll or keep its results on the
        canvas.
      </StudioCallout>
    </div>
  );
}

function PollNeedsRoom() {
  return (
    <div className="flex flex-col items-center gap-2 px-2 py-4 text-center">
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-400 dark:bg-slate-800">
        <svg
          width="18"
          height="18"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          aria-hidden
        >
          <circle cx="5.5" cy="6" r="2" />
          <circle cx="11" cy="6" r="2" />
          <path d="M2 13c0-1.9 1.6-3 3.5-3s3.5 1.1 3.5 3M8.5 11.2c.6-.8 1.5-1.2 2.5-1.2 1.9 0 3 1.1 3 3" />
        </svg>
      </span>
      <span className="text-[12px] font-semibold text-slate-700 dark:text-slate-200">
        Polls need people to ask
      </span>
      <span className="text-[11px] leading-snug text-slate-500 dark:text-slate-400">
        A poll only lives in the realtime room. Share this diagram, then ask the people who join it.
      </span>
    </div>
  );
}
