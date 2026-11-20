'use client';

// A page's formatting controls (docs/specs/030-knowledgebase/page-surface.md "The formatting bar"), the left of the
// top row while a page is being written (components/chrome/KnowledgeTopRow.tsx): formatting only. The controls are
// the page toolbar's own (PageToolbar renders them into this slot, lib/article/article-dock.ts), then Undo and Redo.
// A phone has none here: its writing bar is the page toolbar's own, along the top of the screen.
import { useCallback, type ReactNode } from 'react';
import { HoverCard, RedoIcon, UndoIcon } from '@liveknowledge/ui';
import { setArticleDock } from '@/lib/article/article-dock';

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
  canUndo,
  canRedo,
  onUndo,
  onRedo,
}: {
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
      data-region="palette"
      className="flex min-w-0 flex-1 items-center gap-0.5"
    >
      {/* The page toolbar's controls (block style to Comment), which scroll sideways where the row is narrow. */}
      <div
        ref={slot}
        data-article-dock=""
        className="flex min-w-0 flex-initial items-center overflow-x-auto [scrollbar-width:none]"
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
  );
}
