'use client';

// AI Editing's three cards (docs/specs/030-knowledgebase/ai-editing.md "The dialog"): native radios in one group, so
// the arrow keys move between them, Space chooses and a screen reader says which of three; each card its picture, its
// name, its line and a radio mark. Remove Verification When AI Edits unfolds inside Edit Any Page's card while it is
// chosen, the shared switch beside its words.
import { useId } from 'react';
import { Switch } from '@liveworkspace/ui';
import { Chip } from '@liveknowledge/ui';
import type { AiEditing } from '@liveknowledge/knowledge';
import { AiEditingPicture } from './ai-editing-art';
import {
  AI_EDITING_LEVELS_WORDS,
  DEFAULT_PILL,
  UNVERIFY_ABOUT,
  UNVERIFY_LABEL,
} from './ai-editing-words';

const CARD =
  'group/card relative rounded-2xl border transition-[border-color,background-color,box-shadow] duration-short motion-reduce:transition-none';
const CARD_ON =
  'border-brand-500 bg-brand-50/60 shadow-[0_0_0_3px] shadow-brand-500/15 dark:border-brand-400 dark:bg-brand-500/10 dark:shadow-brand-400/20';
const CARD_OFF =
  'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/70 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-slate-600 dark:hover:bg-slate-800/50';

export function AiEditingChoices({
  level,
  unverifies,
  disabled,
  labelledBy,
  onLevel,
  onUnverifies,
}: {
  level: AiEditing;
  unverifies: boolean;
  disabled: boolean;
  /** The dialog's title: the group's name. */
  labelledBy: string;
  onLevel: (level: AiEditing) => void;
  onUnverifies: (on: boolean) => void;
}) {
  const name = useId();
  const switchWords = useId();
  return (
    <div
      role="radiogroup"
      aria-labelledby={labelledBy}
      className="flex flex-col gap-2.5"
      data-ai-editing-levels=""
    >
      {AI_EDITING_LEVELS_WORDS.map(({ id, label, about }) => {
        const on = id === level;
        const aboutId = `${name}-${id}-about`;
        const labelId = `${name}-${id}-label`;
        return (
          <div
            key={id}
            className={`${CARD} ${on ? CARD_ON : CARD_OFF}`}
            data-ai-editing-level={id}
            data-on={on || undefined}
          >
            <label className="flex min-h-[4.75rem] cursor-pointer items-center gap-3.5 px-3.5 py-3 has-[:disabled]:cursor-not-allowed pointer-coarse:min-h-14 sm:gap-4 sm:px-4">
              <input
                type="radio"
                name={name}
                value={id}
                checked={on}
                disabled={disabled}
                // Named by the level alone, described by its line: one announcement, never the line twice.
                aria-labelledby={labelId}
                aria-describedby={aboutId}
                onChange={() => onLevel(id)}
                className="peer sr-only"
              />
              <span
                aria-hidden
                className={`flex h-14 w-16 shrink-0 items-center justify-center rounded-xl transition-colors duration-short motion-reduce:transition-none ${
                  on
                    ? 'bg-white shadow-sm ring-1 ring-brand-200 dark:bg-slate-900 dark:ring-brand-500/40'
                    : 'bg-slate-100 dark:bg-slate-800'
                }`}
              >
                <AiEditingPicture level={id} on={on} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  <span
                    id={labelId}
                    className="text-[15px] font-semibold leading-6 text-slate-900 dark:text-slate-50"
                  >
                    {label}
                  </span>
                  {id === 'suggest' ? (
                    <Chip className="bg-slate-100 px-2 py-px text-[11px] font-semibold text-slate-600 ring-1 ring-inset ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700">
                      {DEFAULT_PILL}
                    </Chip>
                  ) : null}
                </span>
                <span
                  id={aboutId}
                  className="mt-0.5 block text-[13px] leading-5 text-slate-600 dark:text-slate-400"
                >
                  {about}
                </span>
              </span>
              {/* The radio's mark, ringed with focus from the keyboard. */}
              <span
                aria-hidden
                className={`flex size-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors duration-short peer-focus-visible:ring-2 peer-focus-visible:ring-brand-500 peer-focus-visible:ring-offset-2 motion-reduce:transition-none dark:peer-focus-visible:ring-offset-slate-900 ${
                  on
                    ? 'border-brand-600 bg-brand-600 dark:border-brand-400 dark:bg-brand-400'
                    : 'border-slate-300 dark:border-slate-600'
                }`}
              >
                {on ? <span className="size-2 rounded-full bg-white dark:bg-slate-900" /> : null}
              </span>
            </label>
            {id === 'any' ? (
              // Unfolds under the card's words while Edit Any Page is chosen; the panel keeps one height, so nothing
              // below moves the dialog.
              <div
                className={`grid transition-[grid-template-rows] duration-short ease-out motion-reduce:transition-none ${
                  on ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
                }`}
                data-ai-edit-unverifies-row=""
                {...(on ? {} : { inert: true, 'aria-hidden': true })}
              >
                <div className="min-h-0 overflow-hidden">
                  <div className="mx-3.5 mb-3 flex items-center gap-3 rounded-xl border border-brand-200/80 bg-white/80 px-3.5 py-2.5 dark:border-brand-500/30 dark:bg-slate-900/70 sm:mx-4">
                    <div className="min-w-0 flex-1">
                      <span className="block text-[13px] font-semibold leading-5 text-slate-900 dark:text-slate-100">
                        {UNVERIFY_LABEL}
                      </span>
                      <span
                        id={switchWords}
                        className="block text-xs leading-[18px] text-slate-600 dark:text-slate-400"
                      >
                        {UNVERIFY_ABOUT}
                      </span>
                    </div>
                    <Switch
                      checked={unverifies}
                      size="sm"
                      disabled={disabled}
                      label={UNVERIFY_LABEL}
                      describedBy={switchWords}
                      onChange={onUnverifies}
                    />
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
