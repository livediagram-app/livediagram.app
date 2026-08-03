'use client';

import { useState } from 'react';

import {
  SESSION_POLL_MAX_OPTIONS,
  VOTE_DOTS_RANGE,
  type SessionButtonConfig,
} from '@livediagram/diagram';

import {
  ElementEllipsisMenu,
  ElementMenuItem,
  ElementMenuLabel,
} from '@/components/canvas/ElementEllipsisMenu';

// The `…` menu on a Vote or Poll session element (spec/105): its settings,
// on the element rather than three levels into the right-click menu.
//
// The two are in one file because they are one menu with two bodies, and
// because what they have in common — the trigger, the dismiss, the rows — is
// already shared through ElementEllipsisMenu.
//
// A vote is a single number, so it is a list of presets: one tap, done. A poll
// is text, so it is a small form. That asymmetry is the point rather than an
// inconsistency: a menu of presets for a question nobody has written yet would
// be a menu of nothing.

const DOT_PRESETS = [1, 2, 3, 5, 8] as const;

function PollForm({
  config,
  onChange,
}: {
  config: SessionButtonConfig;
  onChange: (next: SessionButtonConfig) => void;
}) {
  // Drafts, committed on blur. Committing per keystroke would write a change
  // entry for every letter of the question.
  const [question, setQuestion] = useState(config.question ?? '');
  const options = config.options ?? [];

  const setOption = (i: number, value: string) => {
    const next = [...options];
    next[i] = value;
    onChange({ ...config, options: next });
  };

  const field =
    'w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 outline-none transition focus:border-brand-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200';

  return (
    <div className="flex w-60 flex-col gap-1.5 px-3 py-1.5">
      <ElementMenuLabel>Question</ElementMenuLabel>
      <input
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        onBlur={() => onChange({ ...config, question })}
        // The menu and the canvas both listen for keys; a text field has to
        // keep its own, or typing "v" would switch tool mid-question.
        onKeyDown={(e) => e.stopPropagation()}
        placeholder="Which option?"
        className={field}
      />
      <ElementMenuLabel>Answers</ElementMenuLabel>
      {options.map((opt, i) => (
        <span key={i} className="flex items-center gap-1">
          <input
            value={opt}
            onChange={(e) => setOption(i, e.target.value)}
            onKeyDown={(e) => e.stopPropagation()}
            className={field}
          />
          <button
            type="button"
            aria-label={`Remove answer ${i + 1}`}
            // Two is the floor: sessionPlan refuses a poll with fewer, so
            // removing below it would leave a button nobody can press.
            disabled={options.length <= 2}
            onClick={() => onChange({ ...config, options: options.filter((_, j) => j !== i) })}
            className="shrink-0 cursor-pointer rounded px-1 text-xs text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:cursor-default disabled:opacity-30 dark:hover:bg-slate-800"
          >
            ✕
          </button>
        </span>
      ))}
      {options.length < SESSION_POLL_MAX_OPTIONS ? (
        <button
          type="button"
          onClick={() => onChange({ ...config, options: [...options, ''] })}
          className="cursor-pointer rounded-md px-1 py-1 text-left text-xs font-medium text-brand-600 transition hover:bg-slate-100 dark:text-brand-300 dark:hover:bg-slate-800"
        >
          Add answer
        </button>
      ) : null}
    </div>
  );
}

export function SessionSettingsMenu({
  config,
  onChange,
}: {
  config: SessionButtonConfig;
  // Absent on a read-only surface, where the trigger is not rendered at all.
  onChange: (next: SessionButtonConfig) => void;
}) {
  if (config.tool === 'timer') return null;
  return (
    <ElementEllipsisMenu label={config.tool === 'vote' ? 'Dot vote options' : 'Poll options'}>
      {(close) =>
        config.tool === 'vote' ? (
          <>
            <ElementMenuLabel>Dots each</ElementMenuLabel>
            {DOT_PRESETS.filter((d) => d >= VOTE_DOTS_RANGE.min && d <= VOTE_DOTS_RANGE.max).map(
              (d) => (
                <ElementMenuItem
                  key={d}
                  active={d === (config.dots ?? 3)}
                  onPress={() => {
                    onChange({ ...config, dots: d });
                    close();
                  }}
                >
                  {d === 1 ? '1 dot' : `${d} dots`}
                </ElementMenuItem>
              ),
            )}
          </>
        ) : (
          <PollForm config={config} onChange={onChange} />
        )
      }
    </ElementEllipsisMenu>
  );
}
