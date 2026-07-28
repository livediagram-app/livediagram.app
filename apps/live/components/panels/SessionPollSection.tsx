'use client';

// The Poll category body in the tab menu (spec/88): compose a question,
// pick an answer style, and start. While a poll runs this collapses to a
// short status line — the live results and the End control live in the
// floating PollPanel, where every participant can see them, rather than
// behind a menu only the host has open.
//
// Deliberately separate from SessionToolsSection (timer + dot-vote): those
// are Tab state, this is ephemeral room state, and they share no plumbing.

import { useState } from 'react';
import {
  POLL_OPTIONS_MAX,
  POLL_OPTIONS_MIN,
  POLL_QUESTION_MAX,
  POLL_OPTION_MAX,
  type LivePoll,
  type PollStyle,
} from '@livediagram/api-schema';

const STYLE_LABELS: { id: PollStyle; label: string }[] = [
  { id: 'yesNo', label: 'Yes / No' },
  { id: 'yesNoAbstain', label: '+ Abstain' },
  { id: 'choice', label: 'Choices' },
  { id: 'rating', label: 'Rating 1-5' },
  { id: 'text', label: 'Free text' },
];

const chip = (on: boolean) =>
  on
    ? 'rounded-md border border-brand-400 bg-brand-50 px-2 py-1 text-[11px] font-medium text-brand-800 dark:bg-brand-500/20 dark:text-brand-100'
    : 'rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-600 transition hover:border-brand-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300';
const primaryBtn =
  'inline-flex w-full items-center justify-center gap-1 rounded-md bg-brand-500 px-2 py-1.5 text-[11px] font-semibold text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-40';
const field =
  'w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-700 outline-none transition focus:border-brand-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200';

export function SessionPollSection({
  poll,
  connected,
  onStartPoll,
}: {
  poll: LivePoll | null;
  // A poll only exists inside the realtime room, so there's nothing to
  // start on a diagram that isn't shared or on a team (spec/88).
  connected: boolean;
  onStartPoll: (draft: { question: string; style: PollStyle; options: string[] }) => void;
}) {
  const [question, setQuestion] = useState('');
  const [style, setStyle] = useState<PollStyle>('yesNo');
  const [options, setOptions] = useState<string[]>(['', '']);

  const trimmedOptions = options.map((o) => o.trim()).filter((o) => o.length > 0);
  const canStart =
    connected &&
    question.trim().length > 0 &&
    (style !== 'choice' || trimmedOptions.length >= POLL_OPTIONS_MIN);

  if (poll) {
    return (
      <div className="px-2.5 pb-2 pt-1">
        <p className="text-[11px] leading-snug text-slate-600 dark:text-slate-300">
          A poll is running. Results and the End control are on the poll panel.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5 px-2.5 pb-2 pt-1">
      {!connected ? (
        <p className="rounded-md bg-amber-50 px-2 py-1 text-[10px] leading-snug text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
          Share this diagram to poll the people in it. A poll is live-only, so it needs someone to
          ask.
        </p>
      ) : null}
      <input
        value={question}
        onChange={(e) => setQuestion(e.target.value.slice(0, POLL_QUESTION_MAX))}
        placeholder="Ask a question"
        aria-label="Poll question"
        className={field}
      />
      <div className="flex flex-wrap gap-1">
        {STYLE_LABELS.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setStyle(s.id)}
            className={chip(style === s.id)}
          >
            {s.label}
          </button>
        ))}
      </div>
      {style === 'choice' ? (
        <div className="flex flex-col gap-1">
          {options.map((opt, i) => (
            <input
              key={i}
              value={opt}
              onChange={(e) => {
                const value = e.target.value.slice(0, POLL_OPTION_MAX);
                setOptions((prev) => prev.map((o, j) => (j === i ? value : o)));
              }}
              placeholder={`Option ${i + 1}`}
              aria-label={`Poll option ${i + 1}`}
              className={field}
            />
          ))}
          {options.length < POLL_OPTIONS_MAX ? (
            <button
              type="button"
              onClick={() => setOptions((prev) => [...prev, ''])}
              className="self-start text-[11px] font-medium text-brand-600 hover:underline dark:text-brand-300"
            >
              + Add option
            </button>
          ) : null}
        </div>
      ) : null}
      <p className="text-[10px] leading-snug text-slate-400 dark:text-slate-500">
        Everyone here gets asked, including view-only visitors. Answers aren&apos;t shown against
        names, and nothing is saved to the diagram.
      </p>
      <button
        type="button"
        disabled={!canStart}
        onClick={() => {
          onStartPoll({ question: question.trim(), style, options: trimmedOptions });
          setQuestion('');
          setOptions(['', '']);
        }}
        className={primaryBtn}
      >
        Start poll
      </button>
    </div>
  );
}
