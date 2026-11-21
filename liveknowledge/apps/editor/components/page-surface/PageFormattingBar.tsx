'use client';

// A page's formatting controls (docs/specs/030-knowledgebase/page-surface.md "The formatting bar"), the left of the
// top row while a page is being written (components/chrome/KnowledgeTopRow.tsx): formatting only. The controls are
// the page toolbar's own (PageToolbar renders them into this slot, lib/article/article-dock.ts), then Undo and Redo.
// A phone has none here: its writing bar is the page toolbar's own, along the top of the screen.
import { useCallback, type ReactNode } from 'react';
import { HoverCard, RedoIcon, UndoIcon } from '@liveknowledge/ui';
import { ChevronLeftIcon, ChevronRightIcon } from './page-surface-icons';
import { setArticleDock } from '@/lib/article/article-dock';
import { useScrollEdges } from './useScrollEdges';

const isMac = () => typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

function HistoryButton({
  label,
  description,
  disabled,
  onPress,
  children,
}: {
  label: string;
  description: string;
  disabled: boolean;
  onPress: (() => void) | undefined;
  children: ReactNode;
}) {
  return (
    <HoverCard title={label} description={description}>
      <button
        type="button"
        aria-label={label}
        disabled={disabled}
        onClick={onPress}
        className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-md text-slate-600 motion-safe:transition-colors motion-safe:duration-micro hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-brand-600 disabled:cursor-not-allowed disabled:text-slate-300 disabled:hover:bg-transparent dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100 dark:disabled:text-slate-600"
      >
        {children}
      </button>
    </HoverCard>
  );
}

// An edge of the formatting controls with more past it: the row's ground fading over the controls, and a chevron
// that pages to them. Hidden from the tab order and from assistive technology while there is nothing past the edge.
function ScrollEdge({
  direction,
  shown,
  onPage,
}: {
  direction: 'left' | 'right';
  shown: boolean;
  onPage: (direction: 'left' | 'right') => void;
}) {
  const label = direction === 'left' ? 'Earlier Formatting Controls' : 'More Formatting Controls';
  const left = direction === 'left';
  return (
    <span
      data-formatting-edge={direction}
      data-shown={shown}
      className={`pointer-events-none absolute inset-y-0 flex w-12 items-center motion-safe:transition-opacity motion-safe:duration-micro data-[shown=false]:opacity-0 ${
        left
          ? 'left-0 justify-start bg-gradient-to-r from-white via-white/90 to-transparent dark:from-slate-900 dark:via-slate-900/90'
          : 'right-0 justify-end bg-gradient-to-l from-white via-white/90 to-transparent dark:from-slate-900 dark:via-slate-900/90'
      }`}
    >
      <HoverCard
        title={label}
        description={
          left
            ? 'Shows the controls before these.'
            : 'Shows the controls that do not fit in the row.'
        }
      >
        <button
          type="button"
          aria-label={label}
          aria-hidden={shown ? undefined : true}
          tabIndex={shown ? undefined : -1}
          onClick={() => onPage(direction)}
          className={`flex h-7 w-7 cursor-pointer items-center justify-center rounded-full bg-white text-slate-600 shadow-[0_0_0_1px_rgb(15_23_42/0.1),0_2px_6px_-1px_rgb(15_23_42/0.18)] motion-safe:transition-colors motion-safe:duration-micro hover:bg-slate-50 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 dark:bg-slate-800 dark:text-slate-300 dark:shadow-[0_0_0_1px_rgb(255_255_255/0.14),0_2px_8px_-1px_rgb(0_0_0/0.6)] dark:hover:bg-slate-700 dark:hover:text-white ${
            shown ? 'pointer-events-auto' : 'pointer-events-none'
          }`}
        >
          {left ? <ChevronLeftIcon /> : <ChevronRightIcon />}
        </button>
      </HoverCard>
    </span>
  );
}

export function PageFormattingBar({
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  drawing,
}: {
  // A drawing zone being edited: its tools, in the formatting controls' place. The page toolbar's slot stays
  // mounted and hidden, so the toolbar keeps its home and never floats over the writing meanwhile.
  drawing?: ReactNode;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: (() => void) | undefined;
  onRedo: (() => void) | undefined;
}) {
  const { ref: scrollRef, edges, page } = useScrollEdges();
  const slot = useCallback(
    (el: HTMLDivElement | null) => {
      setArticleDock(el);
      scrollRef(el);
    },
    [scrollRef],
  );
  const mod = isMac() ? '⌘' : 'Ctrl+';
  return (
    <div
      data-page-formatting-bar=""
      data-region="palette"
      className="flex min-w-0 flex-1 items-center gap-0.5"
    >
      {/* The page toolbar's controls (block style to Comment). Where the row is too narrow for them they scroll
          sideways, and each edge with more past it fades and holds a chevron that pages to it. */}
      <div
        className="relative flex min-w-0 flex-initial items-center [&:has(>[hidden])]:hidden"
        data-formatting-scroll=""
      >
        <div
          ref={slot}
          data-article-dock=""
          hidden={drawing != null}
          className="flex min-w-0 flex-initial items-center overflow-x-auto [scrollbar-width:none] [&[hidden]]:hidden"
        />
        <ScrollEdge direction="left" shown={edges.left} onPage={page} />
        <ScrollEdge direction="right" shown={edges.right} onPage={page} />
      </div>
      {drawing ?? null}
      <span aria-hidden className="mx-1 h-5 w-px shrink-0 bg-slate-200 dark:bg-slate-700" />
      <HistoryButton
        label="Undo"
        description={`Take back the last change (${mod}Z).`}
        disabled={!canUndo}
        onPress={onUndo}
      >
        <UndoIcon />
      </HistoryButton>
      <HistoryButton
        label="Redo"
        description={`Do again what was taken back (${mod}${isMac() ? '⇧Z' : 'Shift+Z'}).`}
        disabled={!canRedo}
        onPress={onRedo}
      >
        <RedoIcon />
      </HistoryButton>
    </div>
  );
}
