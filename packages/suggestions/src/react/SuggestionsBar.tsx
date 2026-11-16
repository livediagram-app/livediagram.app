'use client';

// The canvas's suggestions control (liveworkspace/docs/specs/015-suggestions/canvas-suggestions.md "Suggesting" and
// "Reviewing"; blueprint "Presentation and UX"): a header action in the editor's title bar, reading Suggest or
// Suggesting, its glyph carrying the tab's suggestion count. A press opens the panel under it:
//   - An Editor: the mode switch, Editing or Suggesting, then the review list.
//   - A Participant on Suggest Only: a line saying it suggests (no switch: it always does), then the list.
//   - Any other Participant: the list; the action shows only while the tab has suggestions.
// The review list: one row per suggestion (its author, what it does, when, and a flag
// when the canvas changed since), with Accept and Reject for an Editor and Take Back on your own; Accept All and
// Reject All head it. Pointing at a row brings its ghost forward. Escape closes it and gives the focus back.
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import {
  CheckIcon,
  CloseIcon,
  CountBadge,
  HoverCard,
  PencilIcon,
  Portal,
  SegmentedToggle,
  Tooltip,
  relativeSince,
} from '@liveworkspace/ui';
import {
  HEADER_ACTION_BTN,
  HEADER_ACTION_TONE,
  HeaderGlyph,
} from '@liveworkspace/workbench/components/chrome/header-action';
import { describeSuggestion } from '../plan';
import type { CanvasSuggestion, SuggestionElement } from '../suggestion';
import type { CanvasSuggestions, SuggestMode } from './useCanvasSuggestions';

// The header action while this person suggests: the brand tint, so the mode reads at a glance.
const SUGGESTING_TONE =
  'bg-brand-50 text-brand-700 hover:bg-brand-100 dark:bg-brand-500/15 dark:text-brand-200 dark:hover:bg-brand-500/25';
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

// Where the panel opens: under its button, right-aligned to it, kept inside the viewport.
const PANEL_WIDTH_REM = 22;
const PANEL_GAP_PX = 6;
const EDGE_PX = 8;

/** The suggestions control in the editor's title bar (the header's lead action, beside Share): a header action at
 *  every width, so the canvas's own toolbars never cover it. Its glyph carries the count; a press opens the panel. */
export function SuggestionsHeaderAction<E extends SuggestionElement>({
  suggestions: s,
  now: given,
}: {
  suggestions: CanvasSuggestions<E>;
  // The clock rows read "4 min ago" against (the editor's shared one, so every row agrees).
  now?: number;
}) {
  const [place, setPlace] = useState<{ top: number; right: number } | null>(null);
  const open = place !== null;
  const panelId = useId();
  // Its own clock when the editor hands none, read a minute at a time.
  const [clock, setClock] = useState(() => Date.now());
  useEffect(() => {
    if (given !== undefined) return;
    const timer = setInterval(() => setClock(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, [given]);
  const now = given ?? clock;
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const editor = s.level === 'edit';
  const n = s.suggestions.length;
  // Nothing to show a Participant who neither suggests nor has anything to read.
  const shown = s.enabled && (editor || s.suggestOnly || n > 0);
  const { focus } = s;
  const close = useCallback(
    (refocus: boolean) => {
      setPlace(null);
      focus(null);
      if (refocus) buttonRef.current?.focus();
    },
    [focus],
  );
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      close(true);
    };
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node | null;
      if (panelRef.current?.contains(t) || buttonRef.current?.contains(t)) return;
      close(false);
    };
    const onResize = () => close(false);
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('pointerdown', onDown, true);
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('pointerdown', onDown, true);
      window.removeEventListener('resize', onResize);
    };
  }, [open, close]);
  if (!shown) return null;
  const word = s.suggesting ? 'Suggesting' : 'Suggest';
  const toggle = () => {
    if (open) return close(false);
    const at = buttonRef.current?.getBoundingClientRect();
    if (!at) return;
    const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    const width = Math.min(PANEL_WIDTH_REM * rem, window.innerWidth - 2 * EDGE_PX);
    const right = Math.max(
      EDGE_PX,
      Math.min(window.innerWidth - at.right, window.innerWidth - width - EDGE_PX),
    );
    setPlace({ top: at.bottom + PANEL_GAP_PX, right });
  };
  return (
    <>
      <HoverCard
        title={s.suggesting ? 'Suggesting' : 'Suggestions'}
        description={
          s.suggestOnly
            ? SUGGEST_ONLY_HINT
            : editor && s.suggesting
              ? 'Your changes become suggestions. Switch back to Editing, or review.'
              : editor
                ? 'Switch to Suggesting, and review what others suggest.'
                : 'What others suggest on this tab.'
        }
      >
        <button
          ref={buttonRef}
          type="button"
          aria-expanded={open}
          aria-controls={open ? panelId : undefined}
          aria-label={`${word}. ${countWords(n)}`}
          data-suggestions-action=""
          onClick={toggle}
          className={`${HEADER_ACTION_BTN} ${s.suggesting ? SUGGESTING_TONE : HEADER_ACTION_TONE}`}
        >
          <HeaderGlyph>
            <span className="relative inline-flex">
              <PencilIcon size={14} aria-hidden />
              {n > 0 ? (
                <CountBadge
                  tone="brand"
                  count={n}
                  className="absolute -top-2 left-2.5 ring-2 ring-white dark:ring-slate-900"
                />
              ) : null}
            </span>
          </HeaderGlyph>
          <span aria-hidden>{word}</span>
        </button>
      </HoverCard>
      {place ? (
        <Portal>
          <div
            ref={panelRef}
            className="fixed z-[var(--z-modal)]"
            style={{ top: place.top, right: place.right }}
            data-suggestions-panel=""
          >
            <ReviewList id={panelId} s={s} now={now} onDone={() => close(true)} />
          </div>
        </Portal>
      ) : null}
    </>
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
      className="w-[min(22rem,calc(100vw-1rem))] animate-fade-in overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl shadow-slate-900/15 dark:border-slate-700 dark:bg-slate-900"
    >
      {editor ? (
        <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-3 py-2 dark:border-slate-800">
          <span className="text-xs font-medium text-slate-600 dark:text-slate-300">Mode</span>
          <SegmentedToggle<SuggestMode>
            label="Mode"
            value={s.mode}
            onChange={s.setMode}
            options={MODE_OPTIONS}
          />
        </div>
      ) : s.suggestOnly ? (
        <p className="flex items-center gap-1.5 border-b border-slate-100 bg-brand-50 px-3 py-2 text-xs font-medium text-brand-800 dark:border-slate-800 dark:bg-brand-500/10 dark:text-brand-200">
          <PencilIcon size={14} aria-hidden />
          {SUGGEST_ONLY_HINT}
        </p>
      ) : null}
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
