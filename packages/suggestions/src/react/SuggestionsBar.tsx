'use client';

// The canvas's suggestions control (liveworkspace/docs/specs/015-suggestions/canvas-suggestions.md "Suggesting" and
// "Reviewing"; blueprint "Presentation and UX"): a row in the editor footer's Tools menu
// (liveworkspace/docs/specs/004-index/footer-tools-menu.md), reading Suggest or Suggesting with the tab's suggestion
// count. Choosing it opens the list inside Tools, under its back bar:
//   - An Editor: the mode switch, Editing or Suggesting, then the review list.
//   - A Participant on Suggest Only: a line saying it suggests (no switch: it always does), then the list.
//   - Any other Participant: the list; the row shows only while the tab has suggestions.
// The review list: one row per suggestion (its author, what it does, when, and a flag
// when the canvas changed since), with Accept and Reject for an Editor and Take Back on your own; Accept All and
// Reject All head it, and close Tools once done. Pointing at a row brings its ghost forward. Escape steps back to the
// Tools list.
import { useEffect, useId, useState } from 'react';
import {
  CheckIcon,
  CloseIcon,
  CountBadge,
  PencilIcon,
  SegmentedToggle,
  Tooltip,
  relativeSince,
} from '@liveworkspace/ui';
import { ToolExplainer } from '@liveworkspace/ui/tool-explainer';
import { suggestionsArt } from '@liveworkspace/ui/tool-explainer-art';
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

/** The Tools menu's Suggest row, which opens the mode switch and the review list inside Tools (footer-tools-menu.md
 *  "Opening a tool inside Tools"). Null where the person has nothing to do with suggestions: a Viewer, or a Participant
 *  who neither suggests nor has any to read. */
export function useSuggestionsToolsItem<E extends SuggestionElement>(
  s: CanvasSuggestions<E> | undefined,
  given?: number,
): ChromeToolsItem | null {
  const editor = s?.level === 'edit';
  const n = s?.suggestions.length ?? 0;
  const shown = !!s?.enabled && (editor || s.suggestOnly || n > 0);
  if (!s || !shown) return null;
  const word = s.suggesting ? 'Suggesting' : 'Suggest Changes';
  return {
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
    onSelect: () => {},
    view: ({ close }) => <SuggestionsView s={s} given={given} onDone={close} />,
  };
}

// The view inside Tools: the review list on its own clock (a minute at a time, only while it is open) unless the
// editor hands one. Leaving it lets go of the ghost a row brought forward.
function SuggestionsView<E extends SuggestionElement>({
  s,
  given,
  onDone,
}: {
  s: CanvasSuggestions<E>;
  given?: number;
  onDone: () => void;
}) {
  const id = useId();
  const [clock, setClock] = useState(() => Date.now());
  useEffect(() => {
    if (given !== undefined) return;
    const timer = setInterval(() => setClock(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, [given]);
  const focus = s.focus;
  useEffect(() => () => focus(null), [focus]);
  return <ReviewList id={id} s={s} now={given ?? clock} onDone={onDone} />;
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
  // Nothing waiting: the tool's explainer (footer-tools-menu.md "Explainers"), the mode switch its action.
  if (n === 0) return <SuggestionsExplainer id={id} s={s} />;
  return (
    <section
      id={id}
      aria-label="Suggestions"
      data-suggestions-panel=""
      className="flex min-h-0 flex-col border-t border-slate-100 dark:border-slate-800"
    >
      {editor ? <ModeRow s={s} /> : s.suggestOnly ? <SuggestOnlyHint /> : null}
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
      <ul className="min-h-0 flex-1 divide-y divide-slate-100 overflow-y-auto overscroll-contain dark:divide-slate-800">
        {s.suggestions.map((sg) => (
          <Row key={sg.id} sg={sg} s={s} now={now} />
        ))}
      </ul>
    </section>
  );
}

// What Suggest Changes is, while the tab has none: what a suggestion is, how one is made and answered, and (for an
// Editor) the switch that starts suggesting.
function SuggestionsExplainer<E extends SuggestionElement>({
  id,
  s,
}: {
  id: string;
  s: CanvasSuggestions<E>;
}) {
  const editor = s.level === 'edit';
  const copy = editor
    ? {
        title: 'Propose, Then Decide',
        description:
          'Suggest changes instead of making them. Each shows on the canvas as a ghost until an Editor accepts or rejects it.',
        steps: [
          'Switch to Suggesting below.',
          'Change the canvas: each edit waits as a suggestion.',
          'You or another Editor accept or reject it here.',
        ],
      }
    : s.suggestOnly
      ? {
          title: 'Your Edits Are Suggestions',
          description:
            'On this link your changes are proposals. They show on the canvas as ghosts until an Editor decides.',
          steps: [
            'Change the canvas as you would.',
            'Each change waits here as a suggestion.',
            'An Editor accepts or rejects it, and you can take one back.',
          ],
        }
      : {
          title: 'No Suggestions Yet',
          description:
            'Changes people propose on this tab show here, and on the canvas as ghosts, until an Editor decides.',
          steps: undefined,
        };
  return (
    <section
      id={id}
      aria-label="Suggestions"
      data-suggestions-panel=""
      className="flex min-h-0 flex-col overflow-y-auto overscroll-contain border-t border-slate-100 px-4 pb-5 pt-4 dark:border-slate-800"
    >
      <ToolExplainer
        art={suggestionsArt}
        title={copy.title}
        description={copy.description}
        steps={copy.steps}
        data="suggestions"
      >
        {editor ? (
          <div className="rounded-xl border border-slate-200 dark:border-slate-700">
            <ModeRow s={s} />
          </div>
        ) : null}
      </ToolExplainer>
    </section>
  );
}

// An Editor's switch: their edits change the canvas, or become suggestions.
function ModeRow<E extends SuggestionElement>({ s }: { s: CanvasSuggestions<E> }) {
  return (
    <div className="flex items-center justify-between gap-3 px-3 py-2.5 [&:not(:last-child)]:border-b [&:not(:last-child)]:border-slate-100 dark:[&:not(:last-child)]:border-slate-800">
      <div className="min-w-0">
        <div className="text-xs font-semibold text-slate-800 dark:text-slate-100">Your Edits</div>
        <div className="text-[11px] leading-snug text-slate-500 dark:text-slate-400">
          {s.mode === 'suggesting' ? SUGGESTING_DESCRIPTION : EDITING_DESCRIPTION}
        </div>
      </div>
      <SegmentedToggle<SuggestMode>
        label="Mode"
        value={s.mode}
        onChange={s.setMode}
        options={MODE_OPTIONS}
      />
    </div>
  );
}

// A Participant on Suggest Only: they always suggest, so a line says so in place of the switch.
function SuggestOnlyHint() {
  return (
    <p className="flex items-center gap-1.5 border-b border-slate-100 bg-brand-50 px-3 py-2 text-xs font-medium text-brand-800 dark:border-slate-800 dark:bg-brand-500/10 dark:text-brand-200">
      <PencilIcon size={14} aria-hidden />
      {SUGGEST_ONLY_HINT}
    </p>
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
