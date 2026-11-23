'use client';

// Required Reading's setup panel (docs/specs/030-knowledgebase/required-reading.md "Where it shows"): a popover under
// its button, a sheet on a phone. Who should read the page, Everyone or Chosen People (a checklist of the people the
// editor knows, the person here first), Cancel and Require Reading (Save once required), and Stop Requiring at its
// foot when required; or the same body in a centred modal, from the page menu (ReadingSetupModal). Chosen People with
// nobody ticked can't be saved. The choices are a radio group: arrows move,
// Space or Enter picks; the chosen one carries a tick as well as its colour.
import { useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import {
  READING_PEOPLE_MAX,
  type PageReadingChange,
  type ReadingAudience,
} from '@liveknowledge/api-schema';
import { Button, ResponsivePopover } from '@liveknowledge/ui';
import { Dialog } from '@liveworkspace/workbench/components/dialogs/Dialog';
import type { KnowledgePerson } from '@/components/knowledge/usePageKnowledge';
import { AudienceIcon, ReadingBookIcon } from './reading-icons';

const ROW =
  'flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-lg border px-3.5 py-2 text-left text-sm motion-safe:transition-colors motion-safe:duration-micro focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 sm:min-h-10';
const CHOSEN =
  'border-brand-600 bg-brand-50 text-slate-900 dark:border-brand-400 dark:bg-brand-500/15 dark:text-slate-100';
const REST =
  'border-slate-200 bg-white text-slate-700 hover:border-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-500';

function Mark({ on, round }: { on: boolean; round: boolean }) {
  return (
    <span
      aria-hidden
      className={`flex size-5 shrink-0 items-center justify-center border ${
        round ? 'rounded-full' : 'rounded-md'
      } ${
        on
          ? 'border-brand-700 bg-brand-700 text-white dark:border-brand-600 dark:bg-brand-600'
          : 'border-slate-400 bg-transparent text-transparent dark:border-slate-500'
      }`}
    >
      <svg
        viewBox="0 0 16 16"
        className="size-3"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
      >
        <path d="M3.5 8.5l3 3 6-7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

const CHOICES: { value: ReadingAudience; label: string; line: string }[] = [
  { value: 'everyone', label: 'Everyone', line: 'Every member of the team' },
  { value: 'people', label: 'Chosen People', line: 'Only the people you tick' },
];

export type ReadingSetupProps = {
  /** The page's audience now; null when it is not required. */
  audience: ReadingAudience | null;
  /** The ids chosen now (Chosen People). */
  chosen: readonly string[];
  /** Who may be chosen: the person here first. */
  people: readonly KnowledgePerson[];
  busy: boolean;
  onSave: (change: PageReadingChange) => void;
  onCancel: () => void;
};

/** The panel's body, for its tests. */
export function ReadingSetupBody({
  titleId,
  audience,
  chosen,
  people,
  busy,
  onSave,
  onCancel,
}: ReadingSetupProps & { titleId: string }) {
  const lineId = useId();
  const group = useRef<HTMLDivElement>(null);
  const [pick, setPick] = useState<ReadingAudience>(audience ?? 'everyone');
  const [ticked, setTicked] = useState<ReadonlySet<string>>(() => new Set(chosen));
  // Someone already chosen whom the editor no longer knows stays listed, so saving never drops them unseen.
  const listed = useMemo(() => {
    const known = new Set(people.map((p) => p.id));
    return [
      ...people,
      ...chosen.filter((id) => !known.has(id)).map((id) => ({ id, name: 'Someone' })),
    ];
  }, [people, chosen]);
  const full = ticked.size >= READING_PEOPLE_MAX;
  const canSave = !busy && (pick === 'everyone' || ticked.size > 0);
  const toggle = (id: string) =>
    setTicked((was) => {
      const next = new Set(was);
      if (next.has(id)) next.delete(id);
      else if (!full) next.add(id);
      return next;
    });
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const step =
      e.key === 'ArrowDown' || e.key === 'ArrowRight'
        ? 1
        : e.key === 'ArrowUp' || e.key === 'ArrowLeft'
          ? -1
          : 0;
    if (step === 0) return;
    e.preventDefault();
    const at = CHOICES.findIndex((c) => c.value === pick);
    const next = CHOICES[(at + step + CHOICES.length) % CHOICES.length]!;
    setPick(next.value);
    group.current?.querySelector<HTMLButtonElement>(`[data-audience="${next.value}"]`)?.focus();
  };
  const save = () =>
    onSave(
      pick === 'everyone' ? { audience: 'everyone' } : { audience: 'people', people: [...ticked] },
    );
  return (
    <div data-reading-setup="" className="flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-700 ring-1 ring-inset ring-brand-100 dark:bg-brand-500/15 dark:text-brand-300 dark:ring-brand-900/50"
        >
          <ReadingBookIcon />
        </span>
        <div className="min-w-0">
          <h2 id={titleId} className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Required Reading
          </h2>
          <p
            id={lineId}
            className="mt-0.5 text-[13px] leading-5 text-slate-600 dark:text-slate-400"
          >
            Who should read this page?
          </p>
        </div>
      </div>
      <div
        ref={group}
        role="radiogroup"
        aria-labelledby={titleId}
        aria-describedby={lineId}
        onKeyDown={onKeyDown}
        className="flex flex-col gap-1.5"
      >
        {CHOICES.map((choice) => {
          const on = choice.value === pick;
          return (
            <button
              key={choice.value}
              type="button"
              role="radio"
              aria-checked={on}
              tabIndex={on ? 0 : -1}
              data-audience={choice.value}
              onClick={() => setPick(choice.value)}
              className={`${ROW} ${on ? CHOSEN : REST}`}
            >
              <Mark on={on} round />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="font-medium">{choice.label}</span>
                <span className="text-xs text-slate-500 dark:text-slate-400">{choice.line}</span>
              </span>
            </button>
          );
        })}
      </div>
      {pick === 'people' ? (
        <fieldset data-reading-people="" className="min-w-0">
          <legend className="sr-only">Chosen People</legend>
          {listed.length === 0 ? (
            <p className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2.5 text-xs text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">
              <AudienceIcon />
              Nobody to choose yet. Share the knowledgebase with a team first.
            </p>
          ) : (
            <ul className="-mx-1 flex max-h-56 flex-col overflow-y-auto px-1 py-0.5">
              {listed.map((person) => {
                const on = ticked.has(person.id);
                return (
                  <li key={person.id}>
                    <label
                      data-reading-person={person.id}
                      className={`flex min-h-10 cursor-pointer items-center gap-3 rounded-lg px-2 text-sm text-slate-800 hover:bg-slate-50 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-brand-600 phone:min-h-11 dark:text-slate-200 dark:hover:bg-slate-800/60 ${
                        !on && full ? 'cursor-not-allowed opacity-60' : ''
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={on}
                        disabled={!on && full}
                        onChange={() => toggle(person.id)}
                      />
                      <Mark on={on} round={false} />
                      <span className="min-w-0 flex-1 truncate">{person.name}</span>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
          <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400" aria-live="polite">
            {ticked.size === 0
              ? 'Tick at least one person.'
              : `${ticked.size.toLocaleString('en')} chosen${full ? `, the most a page can ask` : ''}.`}
          </p>
        </fieldset>
      ) : null}
      <div className="flex items-center justify-end gap-2 pt-1">
        <Button variant="secondary" size="xs" onClick={onCancel} className="phone:min-h-11">
          Cancel
        </Button>
        <Button
          size="xs"
          busy={busy}
          disabled={!canSave && !busy}
          onClick={save}
          data-reading-save=""
          className="phone:min-h-11"
        >
          {audience ? 'Save' : 'Require Reading'}
        </Button>
      </div>
      {audience ? (
        <div className="border-t border-slate-200/70 pt-3 dark:border-slate-800/70">
          <button
            type="button"
            data-reading-stop=""
            disabled={busy}
            onClick={() => onSave({ audience: null })}
            className="cursor-pointer rounded-md text-xs font-medium text-red-700 underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-brand-600 disabled:cursor-not-allowed disabled:opacity-60 phone:min-h-11 dark:text-red-300"
          >
            Stop Requiring
          </button>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            Clears the requirement and everyone&apos;s confirmations.
          </p>
        </div>
      ) : null}
    </div>
  );
}

/** The panel, opened from `anchor`. */
export function ReadingSetupPanel({
  anchor,
  onClose,
  ...props
}: Omit<ReadingSetupProps, 'onCancel'> & {
  anchor: HTMLElement | null;
  onClose: () => void;
}): ReactNode {
  const titleId = useId();
  return (
    <ResponsivePopover
      open={anchor !== null}
      onClose={onClose}
      anchor={anchor}
      titleId={titleId}
      width={340}
      align="end"
    >
      {anchor ? <ReadingSetupBody titleId={titleId} {...props} onCancel={onClose} /> : null}
    </ResponsivePopover>
  );
}

/** The panel's body in a centred modal (a sheet on a phone): the page menu's Require Reading opens it, as its Request
 *  Approval opens that modal (required-reading.md "Where it shows"). */
export function ReadingSetupModal({
  onClose,
  ...props
}: Omit<ReadingSetupProps, 'onCancel'> & { onClose: () => void }): ReactNode {
  const titleId = useId();
  return (
    <Dialog open onClose={onClose} titleId={titleId} size="sm" phoneSheet>
      <div data-reading-ask="" className="p-6">
        <ReadingSetupBody titleId={titleId} {...props} onCancel={onClose} />
      </div>
    </Dialog>
  );
}
