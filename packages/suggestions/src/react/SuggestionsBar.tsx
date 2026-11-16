'use client';

// The canvas's suggestions control (liveworkspace/docs/specs/015-suggestions/canvas-suggestions.md "Suggesting" and
// "Reviewing"; blueprint "Presentation and UX"): a row in the editor footer's Tools menu
// (liveworkspace/docs/specs/004-index/footer-tools-menu.md), reading Suggest or Suggesting with the tab's suggestion
// count. Choosing it opens the panel over the footer:
//   - An Editor: the mode switch, Editing or Suggesting, then the review list.
//   - A Participant on Suggest Only: a line saying it suggests (no switch: it always does), then the list.
//   - Any other Participant: the list; the row shows only while the tab has suggestions.
// The review list: one row per suggestion (its author, what it does, when, and a flag
// when the canvas changed since), with Accept and Reject for an Editor and Take Back on your own; Accept All and
// Reject All head it. Pointing at a row brings its ghost forward. Escape closes it and gives the focus back.
import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import {
  CheckIcon,
  CloseIcon,
  CountBadge,
  PencilIcon,
  Portal,
  SegmentedToggle,
  Tooltip,
  relativeSince,
} from '@liveworkspace/ui';
import type { ChromeToolsItem } from '@liveworkspace/workbench/components/chrome/ChromeToolsMenu';
import { describeSuggestion } from '../plan';
import type { CanvasSuggestion, SuggestionElement } from '../suggestion';
import type { CanvasSuggestions, SuggestMode } from './useCanvasSuggestions';

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

// Where the panel opens: on the side of its anchor with more room (above the footer's Tools button), right-aligned to
// it, kept inside the viewport.
const PANEL_WIDTH_REM = 22;
const PANEL_GAP_PX = 6;
const EDGE_PX = 8;

type Place = { right: number } & ({ top: number } | { bottom: number });

function placeBeside(anchor: HTMLElement): Place {
  const at = anchor.getBoundingClientRect();
  const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
  const width = Math.min(PANEL_WIDTH_REM * rem, window.innerWidth - 2 * EDGE_PX);
  const right = Math.max(
    EDGE_PX,
    Math.min(window.innerWidth - at.right, window.innerWidth - width - EDGE_PX),
  );
  const above = at.top > window.innerHeight - at.bottom;
  return above
    ? { right, bottom: window.innerHeight - at.top + PANEL_GAP_PX }
    : { right, top: at.bottom + PANEL_GAP_PX };
}

/** The Tools menu's Suggest row and the panel it opens (render `panel` beside the menu). The row is null where the
 *  person has nothing to do with suggestions: a Viewer, or a Participant who neither suggests nor has any to read. */
export function useSuggestionsToolsItem<E extends SuggestionElement>(
  s: CanvasSuggestions<E> | undefined,
  given?: number,
): { item: ChromeToolsItem | null; panel: ReactNode } {
  const [place, setPlace] = useState<Place | null>(null);
  const anchorRef = useRef<HTMLElement | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const panelId = useId();
  const open = place !== null;
  // Its own clock when the editor hands none, read a minute at a time, and only while the panel is open.
  const [clock, setClock] = useState(() => Date.now());
  useEffect(() => {
    if (given !== undefined || !open) return;
    // Read once as it opens (on the next tick, not in the effect's own pass), then a minute at a time.
    const first = setTimeout(() => setClock(Date.now()), 0);
    const timer = setInterval(() => setClock(Date.now()), 60_000);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [given, open]);
  const now = given ?? clock;
  const editor = s?.level === 'edit';
  const n = s?.suggestions.length ?? 0;
  const shown = !!s?.enabled && (editor || s.suggestOnly || n > 0);
  const focus = s?.focus;
  const close = useCallback(
    (refocus: boolean) => {
      setPlace(null);
      focus?.(null);
      if (refocus) anchorRef.current?.focus();
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
      if (panelRef.current?.contains(e.target as Node | null)) return;
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
  // Moving the panel's focus in once it is drawn, so the keyboard lands on its first control.
  useEffect(() => {
    if (open) panelRef.current?.querySelector<HTMLElement>('button, [tabindex="0"]')?.focus();
  }, [open]);
  if (!s || !shown) return { item: null, panel: null };
  const word = s.suggesting ? 'Suggesting' : 'Suggest Changes';
  const item: ChromeToolsItem = {
    id: 'suggestions',
    group: 'collaborate',
    label: word,
    description: s.suggestOnly
      ? 'Your edits go to an Editor to accept.'
      : editor
        ? 'Propose edits and review suggestions.'
        : 'Edits others propose on this tab.',
    icon: <PencilIcon size={16} aria-hidden />,
    aside: n > 0 ? <CountBadge tone="brand" count={n} /> : undefined,
    // Suggestions waiting for an Editor put a dot on Tools, so they are seen with the menu shut.
    ...(editor && n > 0 ? { attention: 'brand' as const, attentionLabel: countWords(n) } : {}),
    onSelect: (anchor) => {
      anchorRef.current = anchor;
      if (anchor) setPlace(placeBeside(anchor));
    },
  };
  const panel = place ? (
    <Portal>
      <div
        ref={panelRef}
        className="fixed z-[var(--z-modal)]"
        style={place}
        data-suggestions-panel=""
      >
        <ReviewList id={panelId} s={s} now={now} onDone={() => close(true)} />
      </div>
    </Portal>
  ) : null;
  return { item, panel };
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
