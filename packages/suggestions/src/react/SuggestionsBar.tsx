'use client';

// The canvas's suggestions bar (liveworkspace/docs/specs/014-suggestions/canvas-suggestions.md "Suggesting" and
// "Reviewing"; blueprint "Presentation and UX"): a small floating bar at the canvas's top edge.
//   - An Editor: the mode switch, Editing or Suggesting, then the tab's suggestion count, which opens the review list.
//   - A Participant on Suggest Only: a Suggesting chip (no switch: it always suggests), then the count.
//   - Any other Participant: the count, only while the tab has suggestions.
// The review list sits under the bar, in place: one row per suggestion (its author, what it does, when, and a flag
// when the canvas changed since), with Accept and Reject for an Editor and Take Back on your own; Accept All and
// Reject All head it. Pointing at a row brings its ghost forward. Escape closes it and gives the focus back.
import { useEffect, useId, useRef, useState } from 'react';
import {
  CheckIcon,
  ChevronDownIcon,
  CloseIcon,
  PencilIcon,
  SegmentedToggle,
  Tooltip,
  relativeSince,
} from '@liveworkspace/ui';
import { describeSuggestion } from '../plan';
import type { CanvasSuggestion, SuggestionElement } from '../suggestion';
import type { CanvasSuggestions, SuggestMode } from './useCanvasSuggestions';

const BAR =
  'pointer-events-auto flex items-center gap-1 rounded-full border border-slate-200 bg-white/95 p-1 shadow-md backdrop-blur dark:border-slate-700 dark:bg-slate-900/95';
const COUNT =
  'flex h-7 cursor-pointer items-center gap-1.5 rounded-full px-2.5 text-xs font-semibold text-slate-700 transition-colors duration-micro hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:text-slate-200 dark:hover:bg-slate-800';
const ICON_BUTTON =
  'flex size-7 cursor-pointer items-center justify-center rounded-full text-slate-500 transition-colors duration-micro hover:bg-slate-100 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 disabled:cursor-not-allowed disabled:opacity-50 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100';
const TEXT_BUTTON =
  'cursor-pointer rounded-md px-2 py-1 text-xs font-semibold transition-colors duration-micro focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 disabled:cursor-not-allowed disabled:opacity-50';

export const SUGGESTING_DESCRIPTION = 'Your changes become suggestions to accept or reject';
export const EDITING_DESCRIPTION = 'Change the canvas directly';
export const SUGGEST_ONLY_HINT = 'You suggest changes; an Editor accepts or rejects them';

const MODE_OPTIONS = [
  { value: 'editing', label: 'Editing', description: EDITING_DESCRIPTION },
  { value: 'suggesting', label: 'Suggesting', description: SUGGESTING_DESCRIPTION },
] as const;

const countWords = (n: number) =>
  n === 0 ? 'No suggestions' : n === 1 ? '1 suggestion' : `${n} suggestions`;

export function SuggestionsBar<E extends SuggestionElement>({
  suggestions: s,
  now: given,
}: {
  suggestions: CanvasSuggestions<E>;
  // The clock rows read "4 min ago" against (the editor's shared one, so every row agrees).
  now?: number;
}) {
  const [open, setOpen] = useState(false);
  const listId = useId();
  // Its own clock when the editor hands none, read a minute at a time.
  const [clock, setClock] = useState(() => Date.now());
  useEffect(() => {
    if (given !== undefined) return;
    const timer = setInterval(() => setClock(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, [given]);
  const now = given ?? clock;
  const countRef = useRef<HTMLButtonElement>(null);
  const editor = s.level === 'edit';
  const n = s.suggestions.length;
  // Nothing to show a Participant who neither suggests nor has anything to read.
  const shown = s.enabled && (editor || s.suggestOnly || n > 0);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      setOpen(false);
      s.focus(null);
      countRef.current?.focus();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [open, s]);
  if (!shown) return null;
  return (
    <div className="pointer-events-none flex flex-col items-center gap-2" data-suggestions-bar="">
      <div className={BAR}>
        {editor ? (
          <SegmentedToggle<SuggestMode>
            label="Mode"
            value={s.mode}
            onChange={s.setMode}
            options={MODE_OPTIONS}
            className="rounded-full border-0 bg-slate-100 dark:bg-slate-800 [&_button]:rounded-full"
          />
        ) : s.suggestOnly ? (
          <Tooltip label="Suggesting">
            <span
              tabIndex={0}
              aria-describedby={`${listId}-hint`}
              className="flex h-7 items-center gap-1.5 rounded-full bg-brand-50 px-2.5 text-xs font-semibold text-brand-700 ring-1 ring-brand-200 dark:bg-brand-500/15 dark:text-brand-200 dark:ring-brand-500/30"
            >
              <PencilIcon size={14} aria-hidden />
              Suggesting
              <span id={`${listId}-hint`} className="sr-only">
                {SUGGEST_ONLY_HINT}
              </span>
            </span>
          </Tooltip>
        ) : null}
        {editor || s.suggestOnly ? (
          <span aria-hidden className="mx-0.5 h-4 w-px bg-slate-200 dark:bg-slate-700" />
        ) : null}
        <button
          ref={countRef}
          type="button"
          aria-expanded={open}
          aria-controls={listId}
          onClick={() => {
            setOpen((o) => !o);
            if (open) s.focus(null);
          }}
          className={COUNT}
        >
          {n > 0 ? (
            <span className="flex min-w-5 items-center justify-center rounded-full bg-brand-600 px-1.5 py-0.5 text-[11px] leading-none text-white">
              {n}
            </span>
          ) : null}
          <span>{n === 0 ? 'No suggestions' : n === 1 ? 'Suggestion' : 'Suggestions'}</span>
          <ChevronDownIcon
            size={14}
            aria-hidden
            className={`transition-transform duration-micro ${open ? 'rotate-180' : ''}`}
          />
        </button>
      </div>
      {open ? (
        <ReviewList
          id={listId}
          s={s}
          now={now}
          onDone={() => {
            setOpen(false);
            s.focus(null);
          }}
        />
      ) : null}
    </div>
  );
}

function ReviewList<E extends SuggestionElement>({
  id,
  s,
  now,
  onDone,
}: {
  id: string;
  s: CanvasSuggestions<E>;
  now: number;
  onDone: () => void;
}) {
  const editor = s.level === 'edit';
  const n = s.suggestions.length;
  return (
    <section
      id={id}
      aria-label="Suggestions"
      className="pointer-events-auto w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900"
    >
      <header className="flex items-center gap-2 border-b border-slate-100 px-3 py-2 dark:border-slate-800">
        <h2 className="flex-1 text-sm font-semibold text-slate-800 dark:text-slate-100">
          {countWords(n)}
        </h2>
        {editor && n > 0 ? (
          <>
            <button
              type="button"
              disabled={s.busy}
              onClick={() => void s.reject({ all: true }).then(onDone)}
              className={`${TEXT_BUTTON} text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800`}
            >
              Reject All
            </button>
            <button
              type="button"
              disabled={s.busy}
              onClick={() => void s.accept({ all: true }).then(onDone)}
              className={`${TEXT_BUTTON} bg-brand-600 text-white hover:bg-brand-700`}
            >
              Accept All
            </button>
          </>
        ) : null}
      </header>
      {n === 0 ? (
        <p className="px-3 py-4 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
          {editor
            ? 'Nothing waiting on this tab. Switch to Suggesting to propose changes for an Editor to accept.'
            : 'Nothing waiting on this tab.'}
        </p>
      ) : (
        <ul className="max-h-[min(20rem,50vh)] divide-y divide-slate-100 overflow-y-auto dark:divide-slate-800">
          {s.suggestions.map((sg) => (
            <Row key={sg.id} sg={sg} s={s} now={now} />
          ))}
        </ul>
      )}
    </section>
  );
}

function Row<E extends SuggestionElement>({
  sg,
  s,
  now,
}: {
  sg: CanvasSuggestion<E>;
  s: CanvasSuggestions<E>;
  now: number;
}) {
  const editor = s.level === 'edit';
  const own = sg.author.key === s.selfKey;
  const conflict = (sg.conflict?.length ?? 0) > 0;
  const name = sg.author.name || 'Someone';
  return (
    <li
      className="flex items-center gap-2.5 px-3 py-2 transition-colors duration-micro hover:bg-slate-50 focus-within:bg-slate-50 dark:hover:bg-slate-800/60 dark:focus-within:bg-slate-800/60"
      onPointerEnter={() => s.focus(sg.id)}
      onPointerLeave={() => s.focus(null)}
      onFocus={() => s.focus(sg.id)}
      data-suggestion-row={sg.id}
    >
      <span
        aria-hidden
        className="size-2.5 shrink-0 rounded-full"
        style={{ background: sg.author.color }}
      />
      <div className="min-w-0 flex-1">
        <div className="truncate text-xs font-semibold text-slate-800 dark:text-slate-100">
          {own ? `${name} (you)` : name}
          <span className="font-normal text-slate-500 dark:text-slate-400">
            {' · '}
            {relativeSince(sg.createdAt, now)}
          </span>
        </div>
        <div className="truncate text-xs text-slate-600 dark:text-slate-300">
          {describeSuggestion(sg.ops)}
          {conflict ? (
            <span className="ml-1.5 rounded bg-amber-50 px-1 py-px text-[11px] font-semibold text-amber-800 ring-1 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-200 dark:ring-amber-500/30">
              Changed since
            </span>
          ) : null}
        </div>
      </div>
      {editor ? (
        <>
          <Tooltip label="Reject">
            <button
              type="button"
              aria-label="Reject"
              disabled={s.busy}
              onClick={() => void s.reject({ ids: [sg.id] })}
              className={ICON_BUTTON}
            >
              <CloseIcon size={14} aria-hidden />
            </button>
          </Tooltip>
          <Tooltip label="Accept">
            <button
              type="button"
              aria-label="Accept"
              disabled={s.busy || conflict}
              onClick={() => void s.accept({ ids: [sg.id] })}
              className={`${ICON_BUTTON} text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800 dark:text-emerald-300 dark:hover:bg-emerald-500/10`}
            >
              <CheckIcon size={14} aria-hidden />
            </button>
          </Tooltip>
        </>
      ) : own ? (
        <button
          type="button"
          disabled={s.busy}
          onClick={() => void s.reject({ ids: [sg.id] })}
          className={`${TEXT_BUTTON} text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800`}
        >
          Take Back
        </button>
      ) : null}
    </li>
  );
}

/** The bar where an editor mounts it: floating at the canvas's top edge, centred, over the canvas and below the
 *  editor's dialogs. Takes no room in the layout, so the canvas never shifts as it shows or hides. */
export function SuggestionsBarStrip<E extends SuggestionElement>({
  suggestions,
}: {
  suggestions: CanvasSuggestions<E>;
}) {
  return (
    <div className="relative z-[var(--z-toolbar)] h-0">
      <div className="pointer-events-none absolute inset-x-0 top-3 flex justify-center px-4">
        <SuggestionsBar suggestions={suggestions} />
      </div>
    </div>
  );
}
