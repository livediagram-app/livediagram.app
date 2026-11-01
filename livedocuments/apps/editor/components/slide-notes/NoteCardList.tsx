'use client';

// A slide's speaker notes as note cards (docs/specs/012-collaboration/speaker-note-cards.md "Writing note cards"):
// the list the title bar's Notes popover (or a phone's bottom sheet) and the Slide Deck panel both show. One card open
// for writing at a time; add, reorder (drag by the grip, the Move buttons or Alt+arrows) and remove with an Undo.
// Every change hands the whole list to `onChange`, which writes the deck.
import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { lucidePlus } from '@liveworkspace/icons/lucide';
import { debugLog } from '@liveworkspace/workbench/lib/debug-log';
import { useLatest } from '@liveworkspace/workbench/hooks/ui/useLatest';
import { useCoarsePointer } from '@liveworkspace/workbench/hooks/ui/useCoarsePointer';
import { DropCaret } from '@liveworkspace/workbench/components/primitives/DropCaret';
import {
  rowDropIndex,
  useRowReorderDrag,
} from '@liveworkspace/workbench/hooks/ui/useRowReorderDrag';
import {
  NOTE_CARDS_MAX,
  isBlankNoteCard,
  noteCardSpeakingSeconds,
  speakingTimeLabel,
  type NoteCard,
} from '@livedocuments/document';
import { Button, CompactEmptyState, lucideGlyph, Tooltip } from '@livedocuments/ui';
import { track } from '@/lib/telemetry';
import {
  addNoteCard,
  moveNoteCard,
  removeNoteCard,
  restoreNoteCard,
  setNoteCardText,
  type RemovedNoteCard,
} from '@/lib/note-card-edits';
import { NoteCardItem } from './NoteCardItem';
import { NoteCardsIcon } from './NoteCardsIcon';

const PlusIcon = lucideGlyph(lucidePlus, 12);

// How long a removed card's Undo stays (blueprint NC3).
export const NOTE_CARD_UNDO_MS = 6000;

/** "3 cards · 2 min": how many cards have words, and the slide's speaking time; null for none. */
export function noteCardsSummary(cards: readonly NoteCard[]): string | null {
  const spoken = cards.filter((c) => !isBlankNoteCard(c));
  if (spoken.length === 0) return null;
  const seconds = spoken.reduce((sum, c) => sum + noteCardSpeakingSeconds(c.text), 0);
  const time = speakingTimeLabel(seconds);
  const count = spoken.length === 1 ? '1 card' : `${spoken.length} cards`;
  return time ? `${count} · ${time}` : count;
}

export function NoteCardList({
  cards,
  onChange,
  compact = false,
  heading = true,
}: {
  cards: readonly NoteCard[];
  onChange: (cards: readonly NoteCard[]) => void;
  // The Slide Deck panel's narrower list: smaller gaps, no line under it.
  compact?: boolean;
  // The "Speaker Notes" heading and summary; off where the surface names it (a phone's sheet, the panel).
  heading?: boolean;
}) {
  const touch = useCoarsePointer();
  const [openId, setOpenId] = useState<string | null>(null);
  const [undo, setUndo] = useState<RemovedNoteCard | null>(null);
  // The cards already counted for `UI · Changed · SlideNotes`: once per opening, on its first keystroke.
  const counted = useRef<string | null>(null);
  const list = useRef<HTMLDivElement>(null);
  // The newest cards for the unmount below, which runs after the props it closed over.
  const latest = useLatest({ cards, openId, onChange });

  const write = (next: readonly NoteCard[], action?: 'add' | 'remove' | 'move' | 'restore') => {
    if (next === cards) return;
    if (action) debugLog(`[note-cards] ${action}`, { cards: next.length });
    onChange(next);
  };

  // A card closed blank goes (no Undo: there was nothing on it).
  const close = (refocus = false) => {
    const current = cards.find((c) => c.id === openId);
    setOpenId(null);
    counted.current = null;
    if (current && isBlankNoteCard(current)) {
      write(removeNoteCard(cards, current.id).cards, 'remove');
    } else if (current && refocus) {
      // Back on the card it wrote, so the keyboard carries on from there.
      focusCard(current.id);
    }
  };

  const open = (id: string) => {
    if (id === openId) return;
    const current = cards.find((c) => c.id === openId);
    setOpenId(id);
    counted.current = null;
    if (current && isBlankNoteCard(current))
      write(removeNoteCard(cards, current.id).cards, 'remove');
  };

  const add = (afterIndex: number | null) => {
    // The open card closes first, a blank one going, so ⌘↵ on an empty card never stacks blanks.
    const current = cards.find((c) => c.id === openId);
    const base =
      current && isBlankNoteCard(current) ? removeNoteCard(cards, current.id).cards : cards;
    const at = afterIndex !== null && base !== cards ? afterIndex - 1 : afterIndex;
    const added = addNoteCard(base, at);
    if (!added) return;
    track('UI', 'Added', 'NoteCard');
    write(added.cards, 'add');
    setOpenId(added.id);
    counted.current = null;
  };

  const remove = (id: string) => {
    const { cards: next, removed } = removeNoteCard(cards, id);
    if (!removed) return;
    track('UI', 'Removed', 'NoteCard');
    if (id === openId) setOpenId(null);
    // Undo only for a card with words: a blank one had nothing to lose.
    setUndo(isBlankNoteCard(removed.card) ? null : removed);
    write(next, 'remove');
  };

  const restore = (removed: RemovedNoteCard) => {
    setUndo(null);
    write(restoreNoteCard(cards, removed), 'restore');
  };

  const focusCard = (id: string) =>
    requestAnimationFrame(() =>
      list.current
        ?.querySelector<HTMLElement>(`[data-note-card="${CSS.escape(id)}"][role="group"]`)
        ?.focus(),
    );

  const move = (from: number, to: number) => {
    const next = moveNoteCard(cards, from, to);
    if (next === cards) return;
    track('UI', 'Reordered', 'NoteCard');
    write(next, 'move');
    // Focus follows the card it moved, so Alt+arrow can carry on.
    focusCard(cards[from]!.id);
  };

  const focusSibling = (index: number) => {
    const target = cards[index];
    if (!target) return;
    list.current
      ?.querySelector<HTMLElement>(`[data-note-card="${CSS.escape(target.id)}"][role="group"]`)
      ?.focus();
  };

  // The Undo bar goes on its own after a while.
  useEffect(() => {
    if (!undo) return;
    const timer = window.setTimeout(() => setUndo(null), NOTE_CARD_UNDO_MS);
    return () => window.clearTimeout(timer);
  }, [undo]);

  // An outside press closes the open card (a blank one going). The press itself may open another card or add one:
  // those run their own close.
  const onOutsidePress = useEffectEvent((e: PointerEvent) => {
    const card = list.current?.querySelector('[data-note-card-open]');
    if (!card || !(e.target instanceof Node) || card.contains(e.target)) return;
    const pressed = (e.target as Element).closest?.('[data-note-card], [data-note-card-add]');
    if (!pressed || !list.current?.contains(pressed)) close();
  });
  const editing = openId !== null;
  useEffect(() => {
    if (!editing) return;
    const onDown = (e: PointerEvent) => onOutsidePress(e);
    window.addEventListener('pointerdown', onDown, true);
    return () => window.removeEventListener('pointerdown', onDown, true);
  }, [editing]);

  // Leaving with a blank card open (the popover closed round it) takes the blank card away.
  useEffect(
    () => () => {
      const { cards: last, openId: id, onChange: commit } = latest.current;
      const blank = last.find((c) => c.id === id);
      if (blank && isBlankNoteCard(blank)) commit(removeNoteCard(last, blank.id).cards);
    },
    [latest],
  );

  const drag = useRowReorderDrag({
    slot: 'note-card-slot',
    count: cards.length,
    disabled: openId !== null,
    onDrop: (id, drop) => {
      const from = cards.findIndex((c) => c.id === id);
      const to = rowDropIndex(from, drop, cards.length);
      if (to !== null) move(from, to);
    },
  });

  const summary = noteCardsSummary(cards);
  const full = cards.length >= NOTE_CARDS_MAX;

  if (cards.length === 0) {
    return (
      <div data-note-card-list="" className="flex flex-col gap-2">
        {heading ? <ListHeading summary={null} /> : null}
        <CompactEmptyState
          size="small"
          icon={<NoteCardsIcon />}
          title="No Notes Yet"
          description="Write what you'll say as cards, one point each. You flip through them while you present."
          action={
            <Button size="xs" variant="primary" onClick={() => add(null)} data-note-card-add="">
              <PlusIcon />
              Add First Card
            </Button>
          }
        />
        {undo ? <UndoBar onUndo={() => restore(undo)} /> : null}
      </div>
    );
  }

  return (
    <div
      ref={list}
      data-note-card-list=""
      className={`flex flex-col ${compact ? 'gap-1.5' : 'gap-2'}`}
    >
      {heading ? <ListHeading summary={summary} /> : null}
      <div className={`flex flex-col ${compact ? 'gap-1.5' : 'gap-2'}`}>
        {cards.map((card, i) => (
          <div key={card.id} className="flex flex-col gap-1">
            {drag.caretBefore(i) ? <DropCaret /> : null}
            <NoteCardItem
              card={card}
              index={i}
              count={cards.length}
              open={card.id === openId}
              touch={touch}
              dragging={drag.moving && drag.draggingId === card.id}
              onOpen={() => {
                if (drag.consumeDragClick()) return;
                open(card.id);
              }}
              onClose={() => close(true)}
              onText={(text) => {
                if (counted.current !== card.id) {
                  counted.current = card.id;
                  track('UI', 'Changed', 'SlideNotes');
                }
                write(setNoteCardText(cards, card.id, text));
              }}
              onAddAfter={() => add(i)}
              onMove={(delta) => move(i, i + delta)}
              onRemove={() => remove(card.id)}
              onFocusSibling={(delta) => focusSibling(i + delta)}
              onGripDown={(e) => drag.beginDrag(e, card.id)}
              onGripMove={drag.moveDrag}
              onGripUp={drag.endDrag}
            />
          </div>
        ))}
        {drag.caretAfterLast ? <DropCaret /> : null}
      </div>
      <Tooltip label={full ? `A slide holds up to ${NOTE_CARDS_MAX} cards` : 'Add Card'}>
        <button
          type="button"
          data-note-card-add=""
          aria-disabled={full || undefined}
          onClick={() => {
            if (!full) add(null);
          }}
          className={`flex h-9 w-full items-center justify-center gap-1.5 rounded-lg border border-dashed text-[12px] font-medium transition focus-visible:outline-2 focus-visible:outline-brand-600 ${
            full
              ? 'cursor-default border-slate-200 text-slate-300 dark:border-slate-700 dark:text-slate-600'
              : 'cursor-pointer border-slate-300 text-slate-500 hover:border-brand-400 hover:bg-brand-50/60 hover:text-brand-700 dark:border-slate-600 dark:text-slate-400 dark:hover:border-brand-400/70 dark:hover:bg-brand-500/10 dark:hover:text-brand-200'
          }`}
        >
          <PlusIcon />
          Add Card
        </button>
      </Tooltip>
      {undo ? <UndoBar onUndo={() => restore(undo)} /> : null}
    </div>
  );
}

function ListHeading({ summary }: { summary: string | null }) {
  return (
    <div className="flex items-baseline justify-between gap-2 px-0.5">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        Speaker Notes
      </span>
      {summary ? (
        <span
          className="text-[10px] tabular-nums text-slate-500 dark:text-slate-400"
          data-note-cards-summary=""
        >
          {summary}
        </span>
      ) : null}
    </div>
  );
}

function UndoBar({ onUndo }: { onUndo: () => void }) {
  return (
    <div
      role="status"
      className="flex items-center justify-between gap-2 rounded-lg bg-slate-900 px-3 py-1.5 text-[11px] text-white shadow-md dark:bg-slate-700"
    >
      <span>Card removed</span>
      <button
        type="button"
        onClick={onUndo}
        className="cursor-pointer rounded px-1.5 py-0.5 font-semibold text-brand-200 transition hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-brand-300"
      >
        Undo
      </button>
    </div>
  );
}
