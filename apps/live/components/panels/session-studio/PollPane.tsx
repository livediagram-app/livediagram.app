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

import { useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import {
  POLL_OPTIONS_MAX,
  POLL_OPTIONS_MIN,
  POLL_OPTION_MAX,
  POLL_QUESTION_MAX,
  type LivePoll,
  type PollStyle,
} from '@livediagram/api-schema';
import { POLL_STYLE_LABEL, pollStyleTokens, pollStyleUsesRoster } from '@livediagram/diagram';
import { pollCollaboratorOptions } from '@/lib/poll-collaborators';
import { PollStyleTiles } from '@/components/palette/PollAnswerStyleRow';
import type { SessionToolsProps } from '@/components/chrome/session-tools-props';
import { StudioButton, StudioCallout, StudioLabel } from './studio-ui';

const field =
  'w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[12px] text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-brand-400 focus:ring-2 focus:ring-brand-400/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100';

type PollPaneProps = Pick<
  SessionToolsProps,
  'livePoll' | 'pollHasAudience' | 'onStartPoll' | 'pollCollaborators'
>;

export function PollPane({
  livePoll,
  pollHasAudience,
  onStartPoll,
  pollCollaborators,
}: PollPaneProps) {
  if (livePoll) return <RunningPoll poll={livePoll} />;
  return (
    <PollComposer
      onStartPoll={onStartPoll}
      hasAudience={pollHasAudience}
      collaborators={pollCollaborators}
    />
  );
}

function PollComposer({
  onStartPoll,
  hasAudience,
  collaborators,
}: Pick<PollPaneProps, 'onStartPoll'> & {
  hasAudience: boolean;
  collaborators: PollPaneProps['pollCollaborators'];
}) {
  const [question, setQuestion] = useState('');
  const [style, setStyle] = useState<PollStyle>('yesNo');
  const [options, setOptions] = useState<string[]>(['', '']);
  const optionRefs = useRef<(HTMLInputElement | null)[]>([]);

  const trimmed = options.map((o) => o.trim()).filter((o) => o.length > 0);
  // What a roster poll WOULD freeze if it started now. Shown rather than
  // described, because the ballot is about to be fixed for everyone and a
  // facilitator should see the names — and the truncation, if the room is
  // bigger than the cap — before asking rather than after.
  const rosterOptions = pollStyleUsesRoster(style) ? pollCollaboratorOptions(collaborators) : [];
  const missing = !question.trim()
    ? 'Write a question to ask'
    : style === 'choice' && trimmed.length < POLL_OPTIONS_MIN
      ? `Add at least ${POLL_OPTIONS_MIN} answers`
      : // The room is the ballot, so there is nothing the facilitator can type
        // to fix this one: it needs another person, not another answer.
        pollStyleUsesRoster(style) && rosterOptions.length < POLL_OPTIONS_MIN
        ? 'Need at least 2 people here to vote on'
        : null;

  const start = () => {
    if (missing) return;
    // `options` is ignored for a roster poll — `startPoll` reads the room
    // itself, so what is asked matches the instant of the press rather than
    // whenever this pane last rendered.
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
      {/* Never a gate: a poll on an unshared diagram still runs (rehearsing
          one, or asking the people in the room you're presenting to), it just
          reaches nobody else, and the facilitator should know that first. */}
      {!hasAudience ? (
        <StudioCallout>
          This diagram isn&apos;t shared, so only you will get this poll. Share it to ask others.
        </StudioCallout>
      ) : null}
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
        <PollStyleTiles style={style} onChange={setStyle} />
      </div>
      {pollStyleUsesRoster(style) ? <RosterPreview options={rosterOptions} /> : null}
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

// The ballot a `collaborators` poll will freeze (spec/88): the room, exactly as
// it will be asked. Read-only on purpose — these are not answers the author
// writes, and a list they could edit would be a list that disagrees with who is
// actually here.
function RosterPreview({ options }: { options: string[] }) {
  if (options.length === 0) {
    return (
      <p className="rounded-lg bg-slate-50 px-2.5 py-2 text-[11px] text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
        Nobody else is here yet. Share the diagram and this poll will list whoever has joined when
        you ask it.
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-1">
      <StudioLabel>Who people can pick</StudioLabel>
      <ul className="flex flex-wrap gap-1">
        {options.map((name) => (
          <li
            key={name}
            className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-700 dark:bg-slate-800 dark:text-slate-200"
          >
            {name}
          </li>
        ))}
      </ul>
      <p className="text-[10px] text-slate-400 dark:text-slate-500">
        Taken when you ask, so anyone who joins after won&rsquo;t be on the list.
      </p>
    </div>
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
