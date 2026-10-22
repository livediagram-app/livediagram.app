'use client';

// One slide in the Slide Deck panel (docs/specs/012-collaboration/presentation-mode.md "The Slide
// Deck panel"): its picture, its name and what it carries. A press opens the slide; every verb but
// one lives in its `…` menu: a small picture beside its number.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { slideName, type Slide } from '@livediagram/document';
import { lucideFileText } from '@livediagram/icons/lucide';
import { HoverCard, lucideGlyph, Tooltip, trustedHtml } from '@livediagram/ui';
import { EyeOffIcon } from '@/components/panels/layers-panel-icons';

const NotesIcon = lucideGlyph(lucideFileText, 11);

export function SlideDeckRow({
  slide,
  index,
  tabName,
  showTab,
  headline,
  isOpen,
  isDragging,
  renaming,
  thumb,
  card,
  onOpen,
  onRename,
  onRenameDone,
  menu,
  onPointerDown,
  onPointerMove,
  onPointerUp,
}: {
  slide: Slide;
  index: number;
  /** Absent when the slide's tab has been deleted. */
  tabName: string | undefined;
  // Name the slide's tab.
  showTab: boolean;
  // What the slide is about (its largest text), for a slide nobody named.
  headline?: string;
  isOpen: boolean;
  isDragging: boolean;
  renaming: boolean;
  /** Preview markup + viewBox, absent for an empty slide or a missing tab. */
  thumb: { markup: string; viewBox: string } | undefined;
  // An item slide's card: its title and type colour.
  card?: { title: string; color: string };
  onOpen: () => void;
  onRename: (name: string) => void;
  onRenameDone: () => void;
  menu: ReactNode;
  onPointerDown: (e: React.PointerEvent) => void;
  onPointerMove: (e: React.PointerEvent) => void;
  onPointerUp: (e: React.PointerEvent) => void;
}) {
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);
  // The draft is seeded during render from the name it is renaming, and re-seeded if that name
  // changes underneath.
  const name = slide.name ?? '';
  const [renamingFrom, setRenamingFrom] = useState<string | null>(null);
  if (renaming && renamingFrom !== name) {
    setRenamingFrom(name);
    setDraft(name);
  } else if (!renaming && renamingFrom !== null) {
    setRenamingFrom(null);
  }
  useEffect(() => {
    if (!renaming) return;
    // Select rather than just focus: renaming usually replaces the name.
    const t = window.setTimeout(() => inputRef.current?.select(), 0);
    return () => window.clearTimeout(t);
  }, [renaming, name]);
  const commit = () => {
    onRename(draft);
    onRenameDone();
  };

  const title = slide.name ?? card?.title ?? headline ?? slideName(slide, index);
  // Where it comes from: the tab, and the card or the count.
  const source = [
    showTab ? (tabName ?? 'Tab deleted') : null,
    slide.itemId
      ? card
        ? 'Card'
        : 'Card deleted'
      : slide.elementIds.length === 1
        ? '1 element'
        : `${slide.elementIds.length} elements`,
  ]
    .filter(Boolean)
    .join(' · ');

  const picture = (
    <span
      className={`relative flex h-8 w-11 shrink-0 items-center justify-center overflow-hidden rounded border bg-white transition dark:bg-slate-950 ${
        isOpen ? 'border-brand-400 dark:border-brand-400' : 'border-slate-200 dark:border-slate-700'
      } ${slide.hidden ? 'opacity-40' : ''}`}
    >
      {thumb ? (
        <svg
          viewBox={thumb.viewBox}
          preserveAspectRatio="xMidYMid meet"
          className="h-full w-full"
          aria-hidden
          // Our own renderer's output (every label is xmlEscaped inside it).
          dangerouslySetInnerHTML={{ __html: trustedHtml(thumb.markup) }}
        />
      ) : slide.itemId ? (
        <span
          aria-hidden
          className="relative flex h-5 w-8 flex-col justify-center gap-0.5 overflow-hidden rounded-sm border border-slate-200 bg-white pl-1.5 dark:border-slate-600 dark:bg-slate-800"
        >
          <span
            className="absolute inset-y-0 left-0 w-0.5"
            style={{ backgroundColor: card?.color ?? '#94a3b8' }}
          />
          <span className="h-0.5 w-4 rounded-full bg-slate-400" />
          <span className="h-0.5 w-2.5 rounded-full bg-slate-300 dark:bg-slate-600" />
        </span>
      ) : null}
    </span>
  );

  return (
    <div
      data-slide-slot={index}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      // Without this a touch-drag scrolls the panel instead of moving the row.
      style={{ touchAction: 'none' }}
      className={`group flex w-full items-center gap-2 rounded-md border px-2 py-1.5 text-left transition ${
        isDragging
          ? 'cursor-grabbing bg-brand-50 opacity-50 dark:bg-brand-500/15'
          : isOpen
            ? 'cursor-grab border-brand-300 bg-brand-50 dark:border-brand-500/50 dark:bg-brand-500/15'
            : 'cursor-grab border-slate-200 bg-white hover:border-brand-300 dark:border-slate-700 dark:bg-slate-800/60'
      }`}
    >
      <span
        className={`w-4 shrink-0 text-center text-[10px] font-semibold tabular-nums ${
          slide.hidden ? 'text-slate-300 dark:text-slate-600' : 'text-slate-400'
        }`}
      >
        {index + 1}
      </span>
      {/* The picture of the slide: seeing the shape of the talk is the point of a sorter. */}
      {picture}
      {renaming ? (
        <input
          ref={inputRef}
          value={draft}
          autoFocus
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          // The canvas listens for keys; a text field keeps its own.
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === 'Enter') commit();
            if (e.key === 'Escape') onRenameDone();
          }}
          onPointerDown={(e) => e.stopPropagation()}
          placeholder={headline ?? `Slide ${index + 1}`}
          className="min-w-0 flex-1 rounded border border-brand-300 bg-white px-1 py-0.5 text-[11px] text-slate-800 outline-none dark:bg-slate-900 dark:text-slate-100"
        />
      ) : (
        <button
          type="button"
          onClick={onOpen}
          className="flex min-w-0 flex-1 cursor-pointer flex-col gap-0.5 text-left"
        >
          <span
            className={`truncate text-[11px] font-medium ${
              slide.hidden
                ? 'text-slate-400 line-through dark:text-slate-400'
                : 'text-slate-800 dark:text-slate-100'
            }`}
          >
            {title}
          </span>
          <span className="flex min-w-0 items-center gap-1.5 text-[9px] text-slate-500 dark:text-slate-400">
            <span className="truncate">{source}</span>
            {/* Quiet markers for what the slide carries: its notes, its minutes, that it is hidden. */}
            {slide.notes ? (
              <Tooltip label="Has speaker notes">
                <span role="img" aria-label="Has speaker notes" className="flex shrink-0">
                  <NotesIcon />
                </span>
              </Tooltip>
            ) : null}
            {slide.minutes ? (
              <span className="shrink-0 tabular-nums">{slide.minutes} min</span>
            ) : null}
            {slide.hidden ? (
              <HoverCard
                title="Hidden from the presentation"
                description="This slide is skipped when you present. Show it again from its menu."
              >
                <span
                  role="img"
                  aria-label="Hidden from the presentation"
                  className="flex shrink-0 items-center gap-0.5"
                >
                  <EyeOffIcon />
                </span>
              </HoverCard>
            ) : null}
          </span>
        </button>
      )}
      {menu}
    </div>
  );
}
