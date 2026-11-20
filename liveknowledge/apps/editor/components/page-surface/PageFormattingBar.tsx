'use client';

// The formatting bar (docs/specs/030-knowledgebase/page-surface.md "The formatting bar"): one slim bar pinned to
// the top of the writing's column, formatting only. Its controls are the page toolbar's own (PageToolbar renders
// them into this bar's slot, lib/article/article-dock.ts), then Undo and Redo. It stands over the top of what
// scrolls, in the room the page keeps clear above itself (PAGE_TOP_ROOM), so it never covers the Title or a caret.
// A phone has no bar here: its writing bar is the page toolbar's own, along the top of the screen.
import { useCallback, type ReactNode } from 'react';
import { HoverCard, RedoIcon, UndoIcon } from '@liveknowledge/ui';
import { setArticleDock } from '@/lib/article/article-dock';

/** Screen px the bar is tall; PAGE_TOP_ROOM (lib/page-surface/page-lock.ts) keeps 12 px more under it. */
export const FORMATTING_BAR_HEIGHT = 44;
/** The bar is never wider than the page it stands over. */
export const FORMATTING_BAR_MAX_WIDTH = 820;

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

export function PageFormattingBar({
  left,
  right,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
}: {
  // Screen px of chrome down the surface's left and right (the page tree, the docked rail): the bar is centred in
  // the room between them, as the writing's column is.
  left: number;
  right: number;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: (() => void) | undefined;
  onRedo: (() => void) | undefined;
}) {
  const slot = useCallback((el: HTMLDivElement | null) => setArticleDock(el), []);
  const mod = isMac() ? '⌘' : 'Ctrl+';
  return (
    <div
      data-page-formatting-bar=""
      className="pointer-events-none absolute top-0 z-[var(--z-panel)] flex justify-center"
      style={{ left, right }}
    >
      <div
        data-region="palette"
        onPointerDown={(e) => e.stopPropagation()}
        onContextMenu={(e) => e.stopPropagation()}
        className="pointer-events-auto flex w-full items-center gap-0.5 border-b border-slate-200 bg-white/95 px-3 backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900/95"
        style={{ height: FORMATTING_BAR_HEIGHT, maxWidth: FORMATTING_BAR_MAX_WIDTH }}
      >
        {/* The page toolbar's controls (block style to Comment), which scroll sideways where the bar is narrow. */}
        <div
          ref={slot}
          data-article-dock=""
          className="flex min-w-0 flex-1 items-center overflow-x-auto [scrollbar-width:none]"
        />
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
    </div>
  );
}
