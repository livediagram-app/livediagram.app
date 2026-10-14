'use client';

// The Slide Deck panel (docs/specs/012-collaboration/presentation-mode.md): where a deck is built, ordered, checked and
// started. The seventh tool panel, on the same contract as the other six —
// mounted only while its tool is active, docks in the corner stack.
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

import { ITEM_TYPES, itemTitle, typeIn } from '@livediagram/items';
import { usePlan } from '@/components/plan/PlanContext';
import { useSelectionOf } from '@/hooks/canvas/useSelectionStore';
import { sameMembers, selectionIds, type Selection } from '@/lib/selection-store';
import { useMemo, useRef, useState } from 'react';

import { slideName, type Slide } from '@livediagram/document';

import { ModePanel, type ModePanelProps } from '@/components/panels/ModePanel';
import { PageSlidePicker } from '@/components/panels/PageSlidePicker';
import { SlideRowMenu } from '@/components/panels/SlideRowMenu';
import { SlideDeckSettingsPopover } from '@/components/panels/SlideDeckSettingsPopover';
import { PlayIcon, SlideDeckRow } from '@/components/panels/SlideDeckRow';
import { ConfirmPopover } from '@/components/primitives/ConfirmPopover';
import type { SlideDeckState } from '@/app/document/[id]/useSlideDeck';
import { track } from '@/lib/telemetry';
import { isDragTravel } from '@/lib/press-gestures';
import { SOLID_BRAND_DARK_CONTROL } from '@livediagram/ui';
import { SlideDeckIcon } from '@/components/palette/palette-icons';
import { useLatest } from '@/hooks/ui/useLatest';

/** Where a dropped row will land, drawn between rows like the tab bar's caret. */
function DropCaret() {
  return <div aria-hidden className="pointer-events-none -my-0.5 h-0.5 rounded bg-brand-500" />;
}

const selectionSetOf = (s: Selection) => selectionIds(s.selectedId, s.multiSelectedIds);

export function SlideDeckPanel({
  state,
  tabs,
  activeTabId,
  isReadOnly,
  pages,
  ...placement
}: {
  state: SlideDeckState;
  /** id + name only: the panel names a slide's tab, it never reads its
   *  elements. The deck hook holds the real tabs. */
  tabs: { id: string; name: string }[];
  activeTabId: string;
  isReadOnly: boolean;
  // The active tab's pages while it is shown in Illustrate mode: slides are then added a page at
  // a time (PageSlidePicker) rather than from a selection, and its slide pages all at once.
  pages?: readonly { id: string; label: string; slide?: boolean }[];
} & ModePanelProps) {
  // The Illustrate popover: room for large pictures, headlines and Present from Here.
  const roomy = placement.asPopover === true;
  // An item slide's card, read live from the items (docs/specs/012-collaboration/presentation-mode.md
  // "Item slides").
  const plan = usePlan();
  const slideCard = (slide: Slide) => {
    const item = slide.itemId ? plan?.items.get(slide.itemId) : undefined;
    if (!item) return undefined;
    return { title: itemTitle(item), color: typeIn(plan?.types ?? ITEM_TYPES, item.type).color };
  };
  const {
    deck,
    openSlideId,
    openSlideInEditor,
    runnable,
    thumbs,
    pageLabels,
    headlines,
    newSlideFromSelection,
    newPageSlide,
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
  // The selection the panel offers to slide, read from the store: a selection change re-renders this
  // panel and not the canvas (docs/specs/008-canvas/blueprints/selection-store.md).
  const selected = useSelectionOf(selectionSetOf, sameMembers);
  const selectionCount = selected.size;
  const currentSelectionIds = useMemo(() => [...selected], [selected]);

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
  // at — the tab bar settled this question already (docs/specs/006-document/tab-folders.md) and this follows
  // it, with pointer events instead of HTML5 dnd so it works on touch.
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [moving, setMoving] = useState(false);
  const [dropAt, setDropAt] = useState<{ index: number; side: 'before' | 'after' } | null>(null);
  const origin = useRef<{ x: number; y: number } | null>(null);
  const dragging = useRef(false);
  const dropRef = useLatest<{ index: number; side: 'before' | 'after' } | null>(dropAt);

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
      if (!isDragTravel(dx, dy)) return;
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

  // The talk's planned length: every shown slide's minutes.
  const totalMinutes = deck.slides.reduce((n, sl) => n + (sl.hidden ? 0 : (sl.minutes ?? 0)), 0);
  // A deck spanning tabs names each slide's tab.
  const spansTabs = new Set(deck.slides.map((sl) => sl.tabId)).size > 1;
  // The active tab's slide pages not yet in the deck, for Add All Slide Pages.
  const inDeck = new Set(
    deck.slides.filter((sl) => sl.tabId === activeTabId && sl.pageId).map((sl) => sl.pageId),
  );
  const missingSlidePages = (pages ?? []).filter((p) => p.slide && !inDeck.has(p.id));
  const addAll = () => {
    track('UI', 'Added', 'AllPageSlides');
    for (const p of missingSlidePages) newPageSlide(p.id);
  };
  const addAllButton =
    !isReadOnly && missingSlidePages.length > 0 ? (
      <button
        type="button"
        onClick={addAll}
        className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-brand-300 bg-brand-50/60 px-3 py-2 text-xs font-semibold text-brand-700 transition hover:border-brand-400 hover:bg-brand-50 focus-visible:outline-2 focus-visible:outline-brand-600 dark:border-brand-500/40 dark:bg-brand-500/10 dark:text-brand-200 dark:hover:bg-brand-500/20"
      >
        <SlideDeckIcon />
        {missingSlidePages.length === 1
          ? 'Add the Slide Page'
          : `Add All ${missingSlidePages.length} Slide Pages`}
      </button>
    ) : null;

  const caretBefore = (i: number) =>
    moving &&
    dropAt !== null &&
    (dropAt.side === 'before' ? dropAt.index === i : dropAt.index === i - 1);

  return (
    <ModePanel
      title="Slide Deck"
      helpArticle="slideDeck"
      // The Illustrate tour's Present step rings it (docs/specs/007-editor/illustrate-tour.md).
      dataTourId="slide-deck"
      // The SAME presenter settings the HUD's cog carries, reachable BEFORE
      // you start. Discovering "Actual size" or "Auto-advance" mid-talk means
      // changing it while a room watches; the point of a rehearsal is
      // arriving with it already set. One state, one localStorage key, two
      // doors — so whichever you find, the other agrees.
      headerActions={
        <>
          {deck.slides.length > 0 ? (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              {deck.slides.length === 1 ? '1 slide' : `${deck.slides.length} slides`}
              {totalMinutes > 0 ? ` · ${totalMinutes} min` : ''}
            </span>
          ) : null}
          {isReadOnly ? null : (
            <SlideDeckSettingsPopover
              config={state.config}
              onChange={state.updateConfig}
              onResetPosition={placement.onReset ?? (() => {})}
              resettable={placement.position !== null}
            />
          )}
        </>
      }
      {...(roomy ? { popoverWidth: 'w-[420px]' } : {})}
      {...placement}
    >
      <div
        className={`flex flex-col gap-2 px-2 pb-2 ${roomy ? 'max-h-[min(calc(100vh-200px),620px)]' : 'max-h-[26rem]'}`}
      >
        {deck.slides.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-2 py-5 text-center">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-200">
              <SlideDeckIcon />
            </span>
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
              Build your deck
            </p>
            <p className="max-w-[18rem] text-xs leading-snug text-slate-500 dark:text-slate-400">
              {/* Each way in names the button it has: an Illustrate tab adds a page at a time. */}
              {pages
                ? 'Add your slide pages in one go, or pick any page below and press'
                : 'Select what you want on the first slide, then press'}{' '}
              <span className="font-medium text-slate-700 dark:text-slate-200">
                {pages ? 'Add as slide' : 'New slide'}
              </span>
              .
            </p>
            {addAllButton}
          </div>
        ) : (
          <div
            className={`flex flex-col gap-1 overflow-y-auto overflow-x-hidden py-px ${roomy ? 'min-h-0 flex-1' : 'max-h-52'}`}
          >
            {deck.slides.map((slide, i) => (
              <div key={slide.id} className="flex flex-col gap-1">
                {caretBefore(i) ? <DropCaret /> : null}
                <SlideDeckRow
                  slide={slide}
                  index={i}
                  tabName={tabNames.get(slide.tabId)}
                  showTab={spansTabs || !roomy}
                  // From the slide's own tab's pages, so a slide on another tab names its page too.
                  pageName={pageLabels.get(slide.id) ?? null}
                  headline={headlines.get(slide.id)}
                  roomy={roomy}
                  onPresentFrom={
                    slide.hidden || runnable.length === 0 ? undefined : () => void start(slide.id)
                  }
                  isOpen={slide.id === openSlideId}
                  isDragging={draggingId === slide.id && moving}
                  renaming={renamingId === slide.id}
                  thumb={thumbs.get(slide.id)}
                  card={slideCard(slide)}
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
              <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-400">
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
              <span className="text-[10px] text-slate-400">Budget</span>
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
              <span className="text-[10px] text-slate-400">
                min · shown in the HUD if you turn the budget on
              </span>
            </span>
          </label>
        ) : null}

        {deck.slides.length > 0 ? addAllButton : null}
        {!isReadOnly && pages ? (
          <PageSlidePicker pages={pages} onAdd={newPageSlide} />
        ) : !isReadOnly ? (
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
          className={`flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-md bg-brand-700 font-semibold text-white transition hover:bg-brand-800 disabled:cursor-default disabled:opacity-40 ${
            roomy ? 'rounded-lg px-3 py-2.5 text-sm' : 'px-2 py-2 text-[11px]'
          } ${SOLID_BRAND_DARK_CONTROL}`}
        >
          <PlayIcon />
          {startingDeck ? 'Loading…' : 'Present'}
          {runnable.length > 0 && !startingDeck ? (
            <span className="inline-flex h-[17px] items-center rounded-full bg-white/25 px-1.5 text-[10px] font-semibold tabular-nums">
              <span className="text-optical-centre">{runnable.length}</span>
            </span>
          ) : null}
        </button>
      </div>
      {confirmDelete && deleting ? (
        <ConfirmPopover
          anchor={confirmDelete.anchor}
          message={`Delete “${slideName(deleting, deck.slides.indexOf(deleting))}”? ${
            deleting.pageId
              ? 'The page stays.'
              : deleting.elementIds.length === 1
                ? 'The element stays on the canvas.'
                : 'The elements stay on the canvas.'
          }`}
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
