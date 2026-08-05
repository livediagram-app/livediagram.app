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
// A row does ONE thing: press it to open that slide. Every verb — rename,
// notes, membership, duplicate, delete — lives in its `…` menu, because a
// panel the width of the palette cannot carry five controls per row and stay
// legible.
//
// An empty deck stays empty. No seeded slides, no "one per tab" starter: a
// generated deck is one you have to read and prune before you can trust it.

import { useEffect, useRef, useState } from 'react';

import { slideName, type Slide } from '@livediagram/diagram';

import { ModePanel, type ModePanelProps } from '@/components/panels/ModePanel';
import { SlideRowMenu } from '@/components/panels/SlideRowMenu';
import { SlideDeckSettingsPopover } from '@/components/panels/SlideDeckSettingsPopover';
import { EyeOffIcon } from '@/components/panels/layers-panel-icons';
import { ConfirmPopover } from '@/components/primitives/ConfirmPopover';
import { Tooltip } from '@/components/primitives/Tooltip';
import type { SlideDeckState } from '@/app/diagram/[id]/useSlideDeck';
import { track } from '@/lib/telemetry';

const ROW_DRAG_SLOP_PX = 4;

function PlayIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" aria-hidden>
      <path d="M3 1.8 10 6l-7 4.2z" />
    </svg>
  );
}

/** Where a dropped row will land, drawn between rows like the tab bar's caret. */
function DropCaret() {
  return <div aria-hidden className="pointer-events-none -my-0.5 h-0.5 rounded bg-brand-500" />;
}

/** One slide row: position, name, and where it came from. */
function SlideRow({
  slide,
  index,
  tabName,
  isOpen,
  isDragging,
  renaming,
  thumb,
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
  isOpen: boolean;
  isDragging: boolean;
  renaming: boolean;
  /** Preview markup + viewBox, absent for an empty slide or a missing tab. */
  thumb: { markup: string; viewBox: string } | undefined;
  onOpen: () => void;
  onRename: (name: string) => void;
  onRenameDone: () => void;
  menu: React.ReactNode;
  onPointerDown: (e: React.PointerEvent) => void;
  onPointerMove: (e: React.PointerEvent) => void;
  onPointerUp: (e: React.PointerEvent) => void;
}) {
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    if (renaming) {
      setDraft(slide.name ?? '');
      // Select rather than just focus: renaming usually replaces the name.
      window.setTimeout(() => inputRef.current?.select(), 0);
    }
  }, [renaming, slide.name]);

  const commit = () => {
    onRename(draft);
    onRenameDone();
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
      className={`flex w-full items-center gap-2 rounded-md border px-2 py-1.5 text-left transition ${
        isDragging
          ? 'cursor-grabbing border-brand-400 bg-brand-50 opacity-50 dark:border-brand-500/60 dark:bg-brand-500/15'
          : isOpen
            ? 'cursor-grab border-brand-300 bg-brand-50/70 dark:border-brand-500/50 dark:bg-brand-500/10'
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
      {/* A passive marker, not a control: the toggle lives in the row's menu
          under Visibility, so the row stays one press = open this slide. */}
      {slide.hidden ? (
        <Tooltip
          title="Hidden from the presentation"
          description="This slide is skipped when you present. Show it again from its menu."
        >
          <span
            aria-label="Hidden from the presentation"
            className="flex h-5 w-5 shrink-0 items-center justify-center text-slate-300 dark:text-slate-600"
          >
            <EyeOffIcon />
          </span>
        </Tooltip>
      ) : null}
      {/* The picture of the slide. A deck row without one is a list of names,
          and seeing the shape of the talk is the whole point of a sorter. It
          dims with the row when the slide is hidden. */}
      <span
        className={`flex h-8 w-11 shrink-0 items-center justify-center overflow-hidden rounded border border-slate-200 bg-white transition dark:border-slate-700 dark:bg-slate-950 ${
          slide.hidden ? 'opacity-40' : ''
        }`}
      >
        {thumb ? (
          <svg
            viewBox={thumb.viewBox}
            preserveAspectRatio="xMidYMid meet"
            className="h-full w-full"
            aria-hidden
            dangerouslySetInnerHTML={{ __html: thumb.markup }}
          />
        ) : null}
      </span>
      {renaming ? (
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
            if (e.key === 'Escape') onRenameDone();
          }}
          onPointerDown={(e) => e.stopPropagation()}
          placeholder={`Slide ${index + 1}`}
          className="min-w-0 flex-1 rounded border border-brand-300 bg-white px-1 py-0.5 text-[11px] text-slate-800 outline-none dark:bg-slate-900 dark:text-slate-100"
        />
      ) : (
        <button
          type="button"
          onClick={onOpen}
          className="flex min-w-0 flex-1 cursor-pointer flex-col text-left"
        >
          <span
            className={`truncate text-[11px] font-medium ${
              slide.hidden
                ? 'text-slate-400 line-through dark:text-slate-500'
                : 'text-slate-700 dark:text-slate-200'
            }`}
          >
            {slideName(slide, index)}
          </span>
          <span className="truncate text-[9px] text-slate-400 dark:text-slate-500">
            {/* The tab is named because a deck spans tabs: "3 elements" on its
                own does not say which board they are on. A slide whose tab has
                been deleted says so rather than showing a blank. */}
            {tabName ?? 'Tab deleted'} ·{' '}
            {slide.elementIds.length === 1 ? '1 element' : `${slide.elementIds.length} elements`}
            {slide.notes ? ' · notes' : ''}
            {slide.hidden ? ' · hidden' : ''}
          </span>
        </button>
      )}
      {menu}
    </div>
  );
}

export function SlideDeckPanel({
  onExportDeck,
  state,
  tabs,
  activeTabId,
  isReadOnly,
  ...placement
}: {
  /** Opens the tab Export dialog scoped to the deck. */
  onExportDeck: () => void;
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
    openSlideInEditor,
    selectionCount,
    currentSelectionIds,
    runnable,
    thumbs,
    newSlideFromSelection,
    addSelectionToSlide,
    removeFromSlide,
    renameSlide,
    setSlideNotes,
    setSlideMinutes,
    deleteSlide,
    toggleSlideHidden,
    duplicateSlide,
    reorderSlides,
    start,
    startingDeck,
  } = state;

  const tabNames = new Map(tabs.map((t) => [t.id, t.name]));
  const [renamingId, setRenamingId] = useState<string | null>(null);
  // Which slide's notes are being written. Opened from the row's menu rather
  // than shown for whatever slide happens to be open, so the panel never grows
  // a text area you did not ask for.
  const [notesForId, setNotesForId] = useState<string | null>(null);
  // One 'notes were written' event per editing session, fired on the first
  // keystroke. Per-keystroke would be a flood, and per-open would count the
  // times somebody looked without typing.
  const notesTracked = useRef<string | null>(null);
  // Deleting a slide asks first, anchored to the row's own menu button. A deck
  // is authored work — the elements survive, but the arrangement does not, and
  // it is the arrangement you spent the time on.
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; anchor: HTMLElement } | null>(
    null,
  );
  const deleting = deck.slides.find((s) => s.id === confirmDelete?.id) ?? null;
  const notesSlide = deck.slides.find((s) => s.id === notesForId) ?? null;

  // Row drag. The order does NOT change while you drag: a caret shows where the
  // row will land and the move commits on release. Reordering live meant the
  // list reshuffled under the pointer, which moved the very row you were aiming
  // at — the tab bar settled this question already (spec/30) and this follows
  // it, with pointer events instead of HTML5 dnd so it works on touch.
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [moving, setMoving] = useState(false);
  const [dropAt, setDropAt] = useState<{ index: number; side: 'before' | 'after' } | null>(null);
  const origin = useRef<{ x: number; y: number } | null>(null);
  const dragging = useRef(false);
  const dropRef = useRef<{ index: number; side: 'before' | 'after' } | null>(null);
  dropRef.current = dropAt;

  const slotUnder = (x: number, y: number) => {
    const el = document.elementFromPoint(x, y)?.closest('[data-slide-slot]');
    if (!el) return null;
    const raw = el.getAttribute('data-slide-slot');
    if (raw === null) return null;
    const rect = el.getBoundingClientRect();
    return {
      index: Number(raw),
      // Which half the pointer is in decides the side, so the caret sits
      // exactly where the row will land.
      side: (y < rect.top + rect.height / 2 ? 'before' : 'after') as 'before' | 'after',
    };
  };

  const beginDrag = (e: React.PointerEvent, id: string) => {
    if (e.button !== 0 || isReadOnly) return;
    origin.current = { x: e.clientX, y: e.clientY };
    dragging.current = false;
    setMoving(false);
    setDraggingId(id);
    // NOT captured here. A row carries a press target and a `…` button, and
    // capturing on pointer-down redirects every later event to the row, so the
    // click those needed never arrives. Capture happens once it IS a drag.
  };

  const moveDrag = (e: React.PointerEvent) => {
    if (!draggingId || !origin.current) return;
    if (!dragging.current) {
      const dx = e.clientX - origin.current.x;
      const dy = e.clientY - origin.current.y;
      if (Math.hypot(dx, dy) < ROW_DRAG_SLOP_PX) return;
      dragging.current = true;
      setMoving(true);
      e.currentTarget.setPointerCapture(e.pointerId);
    }
    // elementFromPoint, not the event target: pointer capture keeps every move
    // on the row the drag started from.
    setDropAt(slotUnder(e.clientX, e.clientY));
  };

  const endDrag = (e: React.PointerEvent) => {
    if (dragging.current && e.currentTarget.hasPointerCapture?.(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    const target = dropRef.current;
    const id = draggingId;
    if (dragging.current && id && target) {
      const from = deck.slides.findIndex((s) => s.id === id);
      // The caret sits BETWEEN rows, so 'after' means the slot below. Pulling
      // the dragged row out first shifts everything below it up by one, which
      // is why a downward move loses a step.
      let to = target.side === 'before' ? target.index : target.index + 1;
      if (from >= 0 && from < to) to -= 1;
      const clamped = Math.max(0, Math.min(deck.slides.length - 1, to));
      if (from >= 0 && clamped !== from) reorderSlides(id, clamped);
    }
    setDraggingId(null);
    setMoving(false);
    setDropAt(null);
    dragging.current = false;
    origin.current = null;
  };

  const caretBefore = (i: number) =>
    moving &&
    dropAt !== null &&
    (dropAt.side === 'before' ? dropAt.index === i : dropAt.index === i - 1);

  return (
    <ModePanel
      title="Slide Deck"
      helpArticle="slideDeck"
      // The SAME presenter settings the HUD's cog carries, reachable BEFORE
      // you start. Discovering "Actual size" or "Auto-advance" mid-talk means
      // changing it while a room watches; the point of a rehearsal is
      // arriving with it already set. One state, one localStorage key, two
      // doors — so whichever you find, the other agrees.
      headerActions={
        isReadOnly ? undefined : (
          <SlideDeckSettingsPopover
            config={state.config}
            onChange={state.updateConfig}
            onResetPosition={placement.onReset ?? (() => {})}
            resettable={placement.position !== null}
          />
        )
      }
      {...placement}
    >
      <div className="flex max-h-[26rem] flex-col gap-2 px-2 pb-2">
        {deck.slides.length === 0 ? (
          <p className="px-1 py-3 text-center text-[11px] leading-snug text-slate-400 dark:text-slate-500">
            No slides yet. Select what you want on the first slide, then press{' '}
            <span className="font-medium text-slate-500 dark:text-slate-300">New slide</span>.
          </p>
        ) : (
          <div className="flex max-h-52 flex-col gap-1 overflow-y-auto overflow-x-hidden py-px">
            {deck.slides.map((slide, i) => (
              <div key={slide.id} className="flex flex-col gap-1">
                {caretBefore(i) ? <DropCaret /> : null}
                <SlideRow
                  slide={slide}
                  index={i}
                  tabName={tabNames.get(slide.tabId)}
                  isOpen={slide.id === openSlideId}
                  isDragging={draggingId === slide.id && moving}
                  renaming={renamingId === slide.id}
                  thumb={thumbs.get(slide.id)}
                  onOpen={() => openSlideInEditor(slide.id)}
                  onRename={(name) => renameSlide(slide.id, name)}
                  onRenameDone={() => setRenamingId(null)}
                  onPointerDown={(e) => beginDrag(e, slide.id)}
                  onPointerMove={moveDrag}
                  onPointerUp={endDrag}
                  menu={
                    isReadOnly ? null : (
                      <SlideRowMenu
                        slide={slide}
                        index={i}
                        onSameTab={slide.tabId === activeTabId}
                        selectionCount={selectionCount}
                        onRename={() => setRenamingId(slide.id)}
                        onEditNotes={() => setNotesForId(slide.id)}
                        onAddSelection={() => addSelectionToSlide(slide.id)}
                        onRemoveSelection={() => removeFromSlide(slide.id, currentSelectionIds)}
                        onToggleHidden={() => toggleSlideHidden(slide.id)}
                        onDuplicate={() => duplicateSlide(slide.id)}
                        onDelete={(anchor) =>
                          anchor
                            ? setConfirmDelete({ id: slide.id, anchor })
                            : deleteSlide(slide.id)
                        }
                      />
                    )
                  }
                />
              </div>
            ))}
            {/* The caret past the last row, for a drop below everything. */}
            {moving && dropAt?.side === 'after' && dropAt.index === deck.slides.length - 1 ? (
              <DropCaret />
            ) : null}
          </div>
        )}

        {notesSlide && !isReadOnly ? (
          <label className="flex flex-col gap-1">
            <span className="flex items-center justify-between px-0.5">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                Notes · {slideName(notesSlide, deck.slides.indexOf(notesSlide))}
              </span>
              <button
                type="button"
                onClick={() => {
                  setNotesForId(null);
                  notesTracked.current = null;
                }}
                className="cursor-pointer text-[10px] font-medium text-slate-400 transition hover:text-slate-700 dark:hover:text-slate-200"
              >
                Done
              </button>
            </span>
            {/* The SLIDE's notes: what you mean to say over it. Not the
                elements' own note field, which is about a thing rather than
                about a moment in a talk. */}
            <textarea
              value={notesSlide.notes ?? ''}
              autoFocus
              onChange={(e) => {
                if (notesTracked.current !== notesSlide.id) {
                  notesTracked.current = notesSlide.id;
                  track('UI', 'Changed', 'SlideNotes');
                }
                setSlideNotes(notesSlide.id, e.target.value);
              }}
              onKeyDown={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
              rows={3}
              placeholder="What you'll say over this slide…"
              className="w-full resize-none rounded-md border border-slate-200 bg-white px-2 py-1.5 text-[11px] leading-snug text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-brand-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            />
            {/* The slide's time budget, beside its notes because both are
                decided while WRITING the talk rather than while giving it.
                Blank means no target, which is most slides. */}
            <span className="flex items-center gap-2 px-0.5 pt-0.5">
              <span className="text-[10px] text-slate-400 dark:text-slate-500">Budget</span>
              <input
                type="number"
                min={0}
                max={240}
                value={notesSlide.minutes ?? ''}
                onChange={(e) => setSlideMinutes(notesSlide.id, Number(e.target.value))}
                onKeyDown={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
                placeholder="—"
                aria-label={`Minutes budgeted for ${slideName(notesSlide, deck.slides.indexOf(notesSlide))}`}
                className="w-14 rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-[11px] tabular-nums text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-brand-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
              />
              <span className="text-[10px] text-slate-400 dark:text-slate-500">
                min · shown in the HUD if you turn the budget on
              </span>
            </span>
          </label>
        ) : null}

        {!isReadOnly ? (
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
        ) : null}

        <button
          type="button"
          onClick={() => void start()}
          disabled={runnable.length === 0 || startingDeck}
          className="flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-md bg-brand-600 px-2 py-2 text-[11px] font-semibold text-white transition hover:bg-brand-700 disabled:cursor-default disabled:opacity-40"
        >
          <PlayIcon />
          {startingDeck ? 'Loading…' : 'Present'}
          {runnable.length > 0 && !startingDeck ? (
            <span className="rounded-full bg-white/25 px-1.5 py-px text-[10px] font-semibold tabular-nums">
              {runnable.length}
            </span>
          ) : null}
        </button>

        {/* The deck leaves as one PDF, a page per slide (spec/31). Here rather
            than only in the tab menu because this panel is the single home for
            everything about the deck — and the export dialog it opens is the
            same one a tab uses, just scoped to the slides. */}
        {runnable.length > 0 ? (
          <button
            type="button"
            onClick={onExportDeck}
            className="flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-[11px] font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
          >
            Export deck as PDF
          </button>
        ) : null}
      </div>
      {confirmDelete && deleting ? (
        <ConfirmPopover
          anchor={confirmDelete.anchor}
          message={`Delete “${slideName(deleting, deck.slides.indexOf(deleting))}”? The ${
            deleting.elementIds.length === 1 ? 'element stays' : 'elements stay'
          } on the canvas.`}
          confirmLabel="Delete slide"
          onConfirm={() => {
            deleteSlide(confirmDelete.id);
            setConfirmDelete(null);
          }}
          onCancel={() => setConfirmDelete(null)}
        />
      ) : null}
    </ModePanel>
  );
}
