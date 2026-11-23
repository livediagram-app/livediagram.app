'use client';

// Which AI answers, in the question field (liveworkspace/docs/specs/019-ask/ask.md "Choosing which AI answers"): a
// pill that says it ("Built-In AI", or the key's model and whose it is), opening Answer With, where the person picks
// between built-in AI and the key that applies, and goes to Settings › AI to add or change a key. The choice applies
// to the next question, mid-chat too.
import { useState } from 'react';
import type { AppName } from '@liveworkspace/sites';
import { SparkleIcon } from '@liveworkspace/ui';
import { AnchoredPopover } from '@liveworkspace/workbench/components/primitives/AnchoredPopover';
import {
  OptionRows,
  type OptionRow,
} from '@liveworkspace/workbench/components/primitives/OptionRows';
import type { AskAiChoice } from './ask-ai-choice';
import { AlertIcon, KeyIcon, MenuChevronIcon } from './ask-icons';
import { BUILT_IN_LABEL, builtInDetail, type AskAiView } from './ask-words';

export const ANSWER_WITH_WIDTH_PX = 400;

const PILL =
  'touch-target relative -ml-1 flex min-w-0 cursor-pointer items-center gap-1.5 rounded-full bg-slate-100 py-1.5 pl-2 pr-2 text-[12.5px] font-semibold text-slate-700 outline-none motion-safe:transition-colors motion-safe:duration-micro hover:bg-slate-200 focus-visible:ring-2 focus-visible:ring-brand-500/60 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700';
const TILE = 'flex size-[30px] shrink-0 items-center justify-center rounded-lg';
const BUILT_IN_TILE = `${TILE} bg-brand-600 text-white dark:bg-brand-500`;
const KEY_TILE = `${TILE} bg-orange-50 text-orange-700 ring-1 ring-inset ring-orange-200 dark:bg-orange-500/15 dark:text-orange-200 dark:ring-orange-400/30`;
const FAILED_TILE = `${TILE} bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200 dark:bg-amber-500/15 dark:text-amber-200 dark:ring-amber-400/30`;

export function AnswerWith({
  app,
  view,
  manage,
  onPick,
}: {
  app: AppName;
  view: AskAiView;
  /** Opens Settings › AI; null for someone who cannot change what applies (a member of a team with a key). */
  manage: (() => void) | null;
  onPick: (choice: AskAiChoice) => void;
}) {
  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null);
  if (view.using === 'loading')
    return (
      <span
        aria-busy
        data-ask-ai="loading"
        className="h-7 w-28 animate-pulse rounded-full bg-slate-100 motion-reduce:animate-none dark:bg-slate-800"
      />
    );
  const failed = view.using === 'failed';
  const rows: OptionRow[] = [
    {
      id: 'built-in',
      label: BUILT_IN_LABEL,
      detail: builtInDetail(app),
      icon: (
        <span aria-hidden className={BUILT_IN_TILE}>
          <SparkleIcon size={14} />
        </span>
      ),
    },
    ...(view.key
      ? [
          {
            id: 'key',
            label: view.key.label,
            detail: view.key.detail,
            icon: (
              <span
                aria-hidden
                className={view.key.label.endsWith('Attention') ? FAILED_TILE : KEY_TILE}
              >
                {view.key.label.endsWith('Attention') ? (
                  <AlertIcon size={14} />
                ) : (
                  <KeyIcon size={14} />
                )}
              </span>
            ),
          },
        ]
      : []),
  ];
  return (
    <>
      <button
        type="button"
        data-ask-ai={view.using}
        aria-haspopup="dialog"
        aria-expanded={anchor !== null}
        aria-label={`Answer With: ${view.label}`}
        onClick={(event) => setAnchor(anchor ? null : event.currentTarget)}
        className={`${PILL} ${failed ? '!bg-amber-100 !text-amber-900 dark:!bg-amber-500/20 dark:!text-amber-100' : ''}`}
      >
        <span aria-hidden className="flex shrink-0">
          {failed ? (
            <AlertIcon />
          ) : view.using === 'key' ? (
            <KeyIcon className="text-orange-700 dark:text-orange-300" />
          ) : (
            <SparkleIcon size={13} className="text-brand-700 dark:text-brand-300" />
          )}
        </span>
        <span className="min-w-0 truncate">{view.label}</span>
        <MenuChevronIcon aria-hidden className="shrink-0" />
      </button>
      {anchor ? (
        <AnchoredPopover
          anchor={anchor}
          name="Answer With"
          width={ANSWER_WITH_WIDTH_PX}
          onClose={() => setAnchor(null)}
        >
          <div
            data-ask-answer-with=""
            className="flex flex-col gap-1 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-xl shadow-slate-900/15 dark:border-slate-700 dark:bg-slate-900"
          >
            <p className="px-2.5 pb-0.5 pt-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">
              Answer With
            </p>
            <OptionRows
              kind="single"
              label="Answer With"
              rows={rows}
              selected={view.using === 'built-in' ? 'built-in' : 'key'}
              onPick={(id) => {
                onPick(id === 'built-in' ? 'built-in' : 'key');
                setAnchor(null);
                anchor.focus();
              }}
            />
            <div className="flex items-center justify-between gap-2 px-2.5 pb-1 pt-1.5">
              <span className="min-w-0 text-[12px] text-slate-600 dark:text-slate-400">
                {view.key
                  ? 'Applies to your next question'
                  : manage
                    ? 'Your Anthropic or OpenAI key, with no daily limits'
                    : 'Applies to your next question'}
              </span>
              {manage ? (
                <button
                  type="button"
                  data-ask-manage-keys=""
                  onClick={() => {
                    setAnchor(null);
                    manage();
                  }}
                  className="touch-target relative shrink-0 cursor-pointer rounded text-[12px] font-semibold text-brand-700 outline-none hover:text-brand-800 focus-visible:ring-2 focus-visible:ring-brand-500/60 dark:text-brand-300 dark:hover:text-brand-200"
                >
                  {failed ? 'Fix Key' : view.key ? 'Manage Keys' : 'Use Your Own Key'}
                </button>
              ) : null}
            </div>
          </div>
        </AnchoredPopover>
      ) : null}
    </>
  );
}
