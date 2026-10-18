'use client';

// The New Document wizard's first step (docs/specs/007-editor/new-document-route.md "Choosing a mode"): what you are
// making, as the five editor modes, never a template. Each mode is a card of one build and one height: a fan of its own
// templates' previews on top, then its mark, its name and its number key, then a line on what it makes, so the choice
// reads as the work it leads to. In the mode switch's order, three then two (one column on a phone), so Diagram, first
// there and where most start, leads the top row as an equal. Choosing one creates the document at once, which opens on
// that mode's own start (Start Diagramming, Start Planning, ...), where the templates are. Arrow keys move between the
// cards, and 1 to 5 (printed on each card) choose one straight away.
import { useEffect, useRef, type KeyboardEvent } from 'react';
import { EDITOR_MODE_ICONS } from '@livediagram/ui';
import { EDITOR_MODES, editorModeLabel, type EditorMode } from '@livediagram/document';
import { PreviewFan } from '@livediagram/template-previews';
import { isBlankTemplate, popularKindsFor, type TemplateKind } from '@livediagram/templates';
import { Spinner } from './template-picker-icons';

// The modes in the order every mode list shows them (the mode switch's dropdown, Opens in): the catalogue's.
export const NEW_DOCUMENT_MODES: readonly EditorMode[] = EDITOR_MODES;

// What each mode makes, in the words of the work rather than the tools.
const PITCH: Record<EditorMode, string> = {
  diagram: 'Flowcharts, mind maps, org charts and architecture, snapped neatly into place.',
  draw: 'A freehand whiteboard: pens, highlighters and shapes that tidy themselves.',
  pages: 'Pages to design: infographics, slides, articles and logos.',
  plan: 'Boards, sheets and dashboards for the work in motion.',
  facilitate: 'Run a collaborative session with your team, from workshops to retros.',
};

// A mode's own templates, its Popular shelf without the blanks (its own, and Blank Spreadsheet): the fan's previews.
function examplesOf(mode: EditorMode): TemplateKind[] {
  return popularKindsFor(mode).filter((k) => !isBlankTemplate(k));
}

// Where each card sits in the six-track grid from 640px: the first row's three cards take two tracks each, the second
// row's two take three, so both rows span the dialog and Diagram leads at the same height as every other card (the
// rows share one height, `auto-rows-fr`).
export function modeCardSpan(index: number): string {
  return index < 3 ? 'sm:col-span-2' : 'sm:col-span-3';
}

function ModeCard({
  mode,
  index,
  selected,
  creating,
  onChoose,
  register,
}: {
  mode: EditorMode;
  index: number;
  selected: boolean;
  // This card's document is being made: its key gives way to a spinner.
  creating: boolean;
  onChoose: () => void;
  register: (el: HTMLButtonElement | null) => void;
}) {
  const Icon = EDITOR_MODE_ICONS[mode];
  const examples = examplesOf(mode);
  const label = editorModeLabel(mode);
  return (
    <button
      ref={register}
      type="button"
      data-new-mode={mode}
      aria-pressed={selected}
      aria-busy={creating || undefined}
      aria-keyshortcuts={String(index + 1)}
      onClick={onChoose}
      className={`group relative flex cursor-pointer flex-col overflow-hidden rounded-2xl border bg-white text-left transition duration-micro ease-out hover:-translate-y-0.5 hover:border-brand-400 hover:shadow-xl hover:shadow-brand-900/10 focus-visible:-translate-y-0.5 focus-visible:border-brand-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 motion-reduce:transition-none motion-reduce:hover:translate-y-0 dark:bg-slate-900 dark:hover:border-brand-400 dark:hover:shadow-black/40 ${modeCardSpan(index)} ${
        selected
          ? 'border-brand-500 ring-2 ring-brand-500/30 dark:border-brand-400'
          : 'border-slate-200 dark:border-slate-700'
      }`}
    >
      {/* The work it leads to: its templates fanned on a plate, wider on hover. */}
      <span className="relative shrink-0 bg-gradient-to-br from-brand-50 via-slate-50 to-white px-3 py-1.5 dark:from-brand-500/10 dark:via-slate-900 dark:to-slate-900">
        <PreviewFan
          kinds={examples}
          plateClassName="h-20 rounded-xl !bg-transparent"
          cardClassName="h-12 [&>svg]:h-8"
        />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-1 px-3.5 py-3">
        <span className="flex items-center gap-2.5">
          <span
            aria-hidden
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700 transition group-hover:bg-brand-700 group-hover:text-white dark:bg-brand-500/15 dark:text-brand-300"
          >
            <Icon size={16} />
          </span>
          <span className="text-[15px] font-semibold tracking-tight text-slate-900 dark:text-slate-50">
            {label}
            {/* The card is named by its own text, "Plan: Track work…", so everything it shows is in its
                name (WCAG 2.5.3); the colon only separates the two for a screen reader. */}
            <span className="sr-only">: </span>
          </span>
          {/* The card's number key, as the keyboard picks it (aria-keyshortcuts carries it for assistive technology);
              left off a phone, which has no keys to press. While its document is made, a spinner in its place. */}
          {creating ? (
            <span data-mode-creating className="ml-auto flex text-brand-700 dark:text-brand-300">
              <Spinner />
            </span>
          ) : null}
          <kbd
            aria-hidden
            data-mode-key
            className={`ml-auto h-5 min-w-5 items-center justify-center rounded border border-slate-200 px-1 text-[10px] font-medium text-slate-400 dark:border-slate-700 dark:text-slate-400 ${creating ? 'hidden' : 'hidden sm:flex'}`}
          >
            {/* Trimmed to its cap band, so centring lands on the digit, whatever the face (optical-alignment.md). */}
            <span className="text-optical-centre">{index + 1}</span>
          </kbd>
        </span>
        <span className="text-[12.5px] leading-snug text-slate-600 dark:text-slate-300">
          {PITCH[mode]}
        </span>
      </span>
    </button>
  );
}

export function NewDocumentModeStep({
  selected,
  creating = false,
  onChoose,
}: {
  // The mode picked so far: a `?mode=` preset, or the one being created.
  selected: EditorMode | null;
  // The chosen mode's document is being made.
  creating?: boolean;
  onChoose: (mode: EditorMode) => void;
}) {
  const cards = useRef<(HTMLButtonElement | null)[]>([]);
  // The chosen (else the first) mode's card is focused on a desktop, so Enter or the arrows work at once.
  useEffect(() => {
    if (!window.matchMedia?.('(pointer: fine)').matches) return;
    const at = Math.max(0, NEW_DOCUMENT_MODES.indexOf(selected ?? 'diagram'));
    cards.current[at]?.focus({ preventScroll: true });
    // Once, as the step appears.
    // oxlint-disable-next-line react/exhaustive-deps
  }, []);
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const digit = Number(e.key);
    if (Number.isInteger(digit) && digit >= 1 && digit <= NEW_DOCUMENT_MODES.length) {
      e.preventDefault();
      onChoose(NEW_DOCUMENT_MODES[digit - 1]!);
      return;
    }
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    if (!step) return;
    const at = cards.current.findIndex((c) => c === document.activeElement);
    if (at < 0) return;
    e.preventDefault();
    const n = NEW_DOCUMENT_MODES.length;
    cards.current[(at + step + n) % n]?.focus();
  };
  return (
    <div role="group" aria-label="What are you making?" onKeyDown={onKeyDown}>
      <div className="grid grid-cols-1 gap-2.5 sm:auto-rows-fr sm:grid-cols-6 lvd-cascade">
        {NEW_DOCUMENT_MODES.map((mode, i) => (
          <ModeCard
            key={mode}
            mode={mode}
            index={i}
            selected={selected === mode}
            creating={creating && selected === mode}
            onChoose={() => onChoose(mode)}
            register={(el) => {
              cards.current[i] = el;
            }}
          />
        ))}
      </div>
    </div>
  );
}
