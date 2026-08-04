'use client';

// The Slide Deck panel (spec/31): where a deck is built, ordered, checked and
// started. The seventh tool panel, on the same contract as the other six —
// mounted only while its tool is active, docks in the corner stack, gets a
// mobile dock button.
//
// It is the SINGLE home for everything about the deck, so there is never a
// second place to look. What it deliberately does not do is reorder tabs: slide
// order is the deck's own array, so a tab reorder changes nothing here, and a
// control that looked like deck management but only reshuffled the tab bar
// would undermine exactly that promise.
//
// An empty deck stays empty. No seeded slides, no "one per tab" starter: a
// generated deck is one you have to read and prune before you can trust it.

import { useEffect, useRef, useState } from 'react';

import { slideName, type Slide } from '@livediagram/diagram';

import { ModePanel, type ModePanelProps } from '@/components/panels/ModePanel';
import { Tooltip } from '@/components/primitives/Tooltip';
import type { SlideDeckState } from '@/app/diagram/[id]/useSlideDeck';

const ROW_DRAG_SLOP_PX = 4;

function PlayIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" aria-hidden>
      <path d="M3 1.8 10 6l-7 4.2z" />
    </svg>
  );
}

function SmallIconButton({
  label,
  description,
  onPress,
  danger,
  children,
}: {
  label: string;
  description: string;
  onPress: () => void;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Tooltip title={label} description={description}>
      <button
        type="button"
        aria-label={label}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          onPress();
        }}
        className={`flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded transition ${
          danger
            ? 'text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/15'
            : 'text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200'
        }`}
      >
        {children}
      </button>
    </Tooltip>
  );
}

/** One slide row: position, name, member count, and its verbs. */
function SlideRow({
  slide,
  index,
  total,
  tabName,
  isOpen,
  isDragging,
  onOpen,
  onRename,
  onDuplicate,
  onDelete,
  onPointerDown,
  onPointerMove,
  onPointerUp,
}: {
  slide: Slide;
  index: number;
  total: number;
  /** Absent when the slide's tab has been deleted. */
  tabName: string | undefined;
  isOpen: boolean;
  isDragging: boolean;
  onOpen: () => void;
  onRename: (name: string) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onPointerDown: (e: React.PointerEvent) => void;
  onPointerMove: (e: React.PointerEvent) => void;
  onPointerUp: (e: React.PointerEvent) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  const commit = () => {
    setEditing(false);
    onRename(draft);
  };

  return (
    <div
      data-slide-slot={index}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      // Without this a touch-drag scrolls the panel instead of moving the row.
      style={{ touchAction: 'none' }}
      className={`flex w-full cursor-grab items-center gap-2 rounded-md border px-2 py-1.5 text-left transition ${
        isDragging
          ? 'border-brand-400 bg-brand-50 opacity-60 dark:border-brand-500/60 dark:bg-brand-500/15'
          : isOpen
            ? 'border-brand-300 bg-brand-50/70 dark:border-brand-500/50 dark:bg-brand-500/10'
            : 'border-slate-200 bg-white hover:border-brand-300 dark:border-slate-700 dark:bg-slate-800/60'
      }`}
    >
      <span className="w-4 shrink-0 text-center text-[10px] font-semibold tabular-nums text-slate-400">
        {index + 1}
      </span>
      <button
        type="button"
        onClick={onOpen}
        onDoubleClick={() => {
          setDraft(slide.name ?? '');
          setEditing(true);
        }}
        className="flex min-w-0 flex-1 cursor-pointer flex-col text-left"
      >
        {editing ? (
          <input
            ref={inputRef}
            value={draft}
            autoFocus
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            // The canvas listens for keys; a text field has to keep its own or
            // typing a slide name would fire tool shortcuts.
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === 'Enter') commit();
              if (e.key === 'Escape') setEditing(false);
            }}
            onPointerDown={(e) => e.stopPropagation()}
            className="w-full rounded border border-brand-300 bg-white px-1 py-0.5 text-[11px] text-slate-800 outline-none dark:bg-slate-900 dark:text-slate-100"
          />
        ) : (
          <span className="truncate text-[11px] font-medium text-slate-700 dark:text-slate-200">
            {slideName(slide, index)}
          </span>
        )}
        <span className="truncate text-[9px] text-slate-400 dark:text-slate-500">
          {/* The tab is named because a deck spans tabs: "3 elements" on its
              own does not tell you which board they are on. A slide whose tab
              has been deleted says so rather than showing a blank. */}
          {tabName ?? 'Tab deleted'} ·{' '}
          {slide.elementIds.length === 1 ? '1 element' : `${slide.elementIds.length} elements`}
          {slide.notes ? ' · notes' : ''}
        </span>
      </button>
      <SmallIconButton
        label={`Duplicate ${slideName(slide, index)}`}
        description="Copy this slide, with the same elements, straight after it."
        onPress={onDuplicate}
      >
        <svg
          width="11"
          height="11"
          viewBox="0 0 14 14"
          fill="none"
          stroke="currentColor"
          aria-hidden
        >
          <rect x="1.8" y="1.8" width="7.4" height="7.4" rx="1.2" strokeWidth="1.4" />
          <path d="M4.8 12.2h6a1.4 1.4 0 0 0 1.4-1.4v-6" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      </SmallIconButton>
      <SmallIconButton
        label={`Delete ${slideName(slide, index)}`}
        description={`Remove this slide from the deck. The ${
          slide.elementIds.length === 1 ? 'element stays' : 'elements stay'
        } on the canvas.`}
        onPress={onDelete}
        danger
      >
        <svg
          width="11"
          height="11"
          viewBox="0 0 14 14"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
          aria-hidden
        >
          <path d="M2.5 3.8h9M5.6 3.8V2.5h2.8v1.3M3.8 3.8l.6 7.7h5.2l.6-7.7" />
        </svg>
      </SmallIconButton>
      <span className="sr-only">{`Slide ${index + 1} of ${total}`}</span>
    </div>
  );
}

export function SlideDeckPanel({
  state,
  tabs,
  activeTabId,
  isReadOnly,
  ...placement
}: {
  state: SlideDeckState;
  /** id + name only: the panel names a slide's tab, it never reads its
   *  elements. The deck hook holds the real tabs. */
  tabs: { id: string; name: string }[];
  activeTabId: string;
  isReadOnly: boolean;
} & ModePanelProps) {
  const {
    deck,
    openSlideId,
    openSlide,
    openSlideInEditor,
    selectionCount,
    currentSelectionIds,
    runnable,
    newSlideFromSelection,
    addSelectionToSlide,
    removeFromSlide,
    renameSlide,
    setSlideNotes,
    deleteSlide,
    duplicateSlide,
    reorderSlides,
    start,
    startingDeck,
  } = state;

  const tabNames = new Map(tabs.map((t) => [t.id, t.name]));

  // Row drag, the pointer-event kind the Layers panel uses: HTML5 dnd is
  // unreliable in a panel and dead on touch.
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [moving, setMoving] = useState(false);
  const origin = useRef<{ x: number; y: number } | null>(null);
  const dragging = useRef(false);

  const slotUnder = (x: number, y: number): number => {
    const el = document.elementFromPoint(x, y)?.closest('[data-slide-slot]');
    const raw = el?.getAttribute('data-slide-slot');
    return raw === null || raw === undefined ? -1 : Number(raw);
  };

  const beginDrag = (e: React.PointerEvent, id: string) => {
    if (e.button !== 0 || isReadOnly) return;
    origin.current = { x: e.clientX, y: e.clientY };
    dragging.current = false;
    setMoving(false);
    setDraggingId(id);
    // NOT captured here. A row carries its own buttons — open, rename on
    // double-click, duplicate, delete — and capturing on pointer-down
    // redirects every later event to the row, so the click those buttons
    // needed never arrived. The row looked draggable and was otherwise dead.
    // Capture happens below, the moment a press becomes a drag.
  };
  const moveDrag = (e: React.PointerEvent) => {
    if (!draggingId || !origin.current) return;
    if (!dragging.current) {
      const dx = e.clientX - origin.current.x;
      const dy = e.clientY - origin.current.y;
      if (Math.hypot(dx, dy) < ROW_DRAG_SLOP_PX) return;
      dragging.current = true;
      setMoving(true);
      // Now it IS a drag, so take the pointer: the row has to keep receiving
      // moves even when the cursor travels over its neighbours.
      e.currentTarget.setPointerCapture(e.pointerId);
    }
    // elementFromPoint, not the event target: pointer capture keeps every move
    // on the row the drag started from.
    const to = slotUnder(e.clientX, e.clientY);
    if (to < 0) return;
    const from = deck.slides.findIndex((s) => s.id === draggingId);
    if (from < 0 || from === to) return;
    reorderSlides(draggingId, to);
  };
  const endDrag = (e: React.PointerEvent) => {
    if (dragging.current && e.currentTarget.hasPointerCapture?.(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    setDraggingId(null);
    setMoving(false);
    dragging.current = false;
    origin.current = null;
  };

  const canAddToOpen = openSlide !== null && openSlide.tabId === activeTabId && selectionCount > 0;

  return (
    <ModePanel title="Slide Deck" {...placement}>
      <div className="flex max-h-[26rem] flex-col gap-2 px-2 pb-2">
        {deck.slides.length === 0 ? (
          <p className="px-1 py-3 text-center text-[11px] leading-snug text-slate-400 dark:text-slate-500">
            No slides yet. Select what you want on the first slide, then press{' '}
            <span className="font-medium text-slate-500 dark:text-slate-300">New slide</span>.
          </p>
        ) : (
          <div className="flex max-h-52 flex-col gap-1 overflow-y-auto overflow-x-hidden py-px">
            {deck.slides.map((slide, i) => (
              <SlideRow
                key={slide.id}
                slide={slide}
                index={i}
                total={deck.slides.length}
                tabName={tabNames.get(slide.tabId)}
                isOpen={slide.id === openSlideId}
                isDragging={draggingId === slide.id && moving}
                onOpen={() => openSlideInEditor(slide.id)}
                onRename={(name) => renameSlide(slide.id, name)}
                onDuplicate={() => duplicateSlide(slide.id)}
                onDelete={() => deleteSlide(slide.id)}
                onPointerDown={(e) => beginDrag(e, slide.id)}
                onPointerMove={moveDrag}
                onPointerUp={endDrag}
              />
            ))}
          </div>
        )}

        {!isReadOnly ? (
          <div className="flex flex-col gap-1">
            <button
              type="button"
              onClick={newSlideFromSelection}
              disabled={selectionCount === 0}
              className="w-full cursor-pointer rounded-md border border-slate-200 bg-white px-2 py-1.5 text-[11px] font-medium text-slate-600 transition hover:border-brand-300 hover:text-brand-700 disabled:cursor-default disabled:opacity-40 disabled:hover:border-slate-200 disabled:hover:text-slate-600 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300"
            >
              {selectionCount === 0
                ? 'Select elements to make a slide'
                : `New slide from ${selectionCount === 1 ? '1 element' : `${selectionCount} elements`}`}
            </button>
            {openSlide ? (
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => addSelectionToSlide(openSlide.id)}
                  disabled={!canAddToOpen}
                  // Offered only on the slide's OWN tab: a slide holds one
                  // tab's elements, so adding from another is not something to
                  // refuse politely, it cannot be expressed.
                  title={
                    openSlide.tabId === activeTabId
                      ? undefined
                      : 'Switch to this slide’s tab to add elements to it'
                  }
                  className="flex-1 cursor-pointer rounded-md border border-slate-200 px-2 py-1 text-[10px] font-medium text-slate-600 transition hover:border-brand-300 hover:text-brand-700 disabled:cursor-default disabled:opacity-40 dark:border-slate-700 dark:text-slate-300"
                >
                  Add selection
                </button>
                <button
                  type="button"
                  onClick={() => removeFromSlide(openSlide.id, currentSelectionIds)}
                  disabled={!canAddToOpen}
                  className="flex-1 cursor-pointer rounded-md border border-slate-200 px-2 py-1 text-[10px] font-medium text-slate-600 transition hover:border-red-300 hover:text-red-600 disabled:cursor-default disabled:opacity-40 dark:border-slate-700 dark:text-slate-300"
                >
                  Remove selection
                </button>
              </div>
            ) : null}
          </div>
        ) : null}

        {openSlide && !isReadOnly ? (
          <label className="flex flex-col gap-1">
            <span className="px-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
              Presenter notes
            </span>
            {/* The SLIDE's notes: what you mean to say over it. Not the
                elements' own note field, which is about a thing rather than
                about a moment in a talk. */}
            <textarea
              value={openSlide.notes ?? ''}
              onChange={(e) => setSlideNotes(openSlide.id, e.target.value)}
              onKeyDown={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
              rows={3}
              placeholder="What you'll say over this slide…"
              className="w-full resize-none rounded-md border border-slate-200 bg-white px-2 py-1.5 text-[11px] leading-snug text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-brand-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            />
          </label>
        ) : null}

        <button
          type="button"
          onClick={() => void start()}
          disabled={runnable.length === 0 || startingDeck}
          className="flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-md bg-brand-600 px-2 py-2 text-[11px] font-semibold text-white transition hover:bg-brand-700 disabled:cursor-default disabled:opacity-40"
        >
          <PlayIcon />
          {startingDeck ? 'Loading…' : `Start${runnable.length > 0 ? ` (${runnable.length})` : ''}`}
        </button>
      </div>
    </ModePanel>
  );
}
