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

import { useSelectionOf } from '@/hooks/canvas/useSelectionStore';
import {
  sameMembers,
  selectionIds,
  type Selection,
} from '@liveworkspace/workbench/lib/selection-store';
import { useMemo, useRef, useState } from 'react';

import { slideName } from '@livedesign/design';

import { ModePanel, type ModePanelProps } from '@/components/panels/ModePanel';
import { PageSlidePicker } from '@/components/panels/PageSlidePicker';
import { SlideRowMenu } from '@/components/panels/SlideRowMenu';
import { SlideDeckSettingsPopover } from '@/components/panels/SlideDeckSettingsPopover';
import { SlideDeckRow } from '@/components/panels/SlideDeckRow';
import { PlayIcon } from '@/components/primitives/PlayIcon';
import { ConfirmPopover } from '@liveworkspace/workbench/components/primitives/ConfirmPopover';
import type { SlideDeckState } from '@/app/design/[id]/useSlideDeck';
import { track } from '@/lib/telemetry';
import { rowDropIndex, useRowReorderDrag } from '@/hooks/ui/useRowReorderDrag';
import { DropCaret } from '@/components/primitives/DropCaret';
import { SOLID_BRAND_DARK_CONTROL } from '@livedesign/ui';
import { SlideDeckIcon } from '@/components/palette/palette-icons';

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
  // The active tab's pages while it is shown in Pages mode: every page joins the deck on its own, and
  // a copy of one is added a page at a time (PageSlidePicker) rather than from a selection.
  pages?: readonly { id: string; label: string }[];
} & ModePanelProps) {
  // The Pages popover: room for large pictures, headlines and Present from Here.
  const roomy = placement.asPopover === true;
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
    ownPageSlideIds,
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

  // Row drag: a caret shows where the row lands, the move commits on release (useRowReorderDrag).
  const { draggingId, moving, beginDrag, moveDrag, endDrag, caretBefore, caretAfterLast } =
    useRowReorderDrag({
      slot: 'slide-slot',
      count: deck.slides.length,
      disabled: isReadOnly,
      onDrop: (id, drop) => {
        const to = rowDropIndex(
          deck.slides.findIndex((s) => s.id === id),
          drop,
          deck.slides.length,
        );
        if (to !== null) reorderSlides(id, to);
      },
    });

  // The talk's planned length: every shown slide's minutes.
  const totalMinutes = deck.slides.reduce((n, sl) => n + (sl.hidden ? 0 : (sl.minutes ?? 0)), 0);
  // A deck spanning tabs names each slide's tab.
  const spansTabs = new Set(deck.slides.map((sl) => sl.tabId)).size > 1;
  return (
    <ModePanel
      title="Slide Deck"
      helpArticle="slideDeck"
      // The Pages tour's Present step rings it (docs/specs/007-editor/pages-tour.md).
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
              {/* Each way in names the button it has: on a Pages tab every page joins on its own
                  (docs/specs/012-collaboration/presentation-mode.md "The deck follows the pages"), a copy a page at a
                  time. */}
              {pages
                ? 'Pages join the deck on their own. To present one twice, pick it below and press'
                : 'Select what you want on the first slide, then press'}{' '}
              <span className="font-medium text-slate-700 dark:text-slate-200">
                {pages ? 'Add as slide' : 'New slide'}
              </span>
              .
            </p>
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
                        onDelete={
                          ownPageSlideIds.has(slide.id)
                            ? undefined
                            : (anchor) =>
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
            {caretAfterLast ? <DropCaret /> : null}
          </div>
        )}

        {notesSlide && !isReadOnly ? (
          <label className="flex flex-col gap-1">
            <span className="flex items-center justify-between px-0.5">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Notes · {slideName(notesSlide, deck.slides.indexOf(notesSlide))}
              </span>
              <button
                type="button"
                onClick={() => {
                  setNotesForId(null);
                  notesTracked.current = null;
                }}
                className="cursor-pointer text-[10px] font-medium text-slate-500 dark:text-slate-400 transition hover:text-slate-700 dark:hover:text-slate-200"
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
              <span className="text-[10px] text-slate-500 dark:text-slate-400">Budget</span>
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
              <span className="text-[10px] text-slate-500 dark:text-slate-400">
                min · shown in the HUD if you turn the budget on
              </span>
            </span>
          </label>
        ) : null}

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
          data-presentation-start="panel"
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
