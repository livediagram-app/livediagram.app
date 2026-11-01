'use client';

// One note card in a slide's list (docs/specs/012-collaboration/speaker-note-cards.md "Writing note cards"): closed,
// a small index card showing its number, its words and its speaking time, its grip and buttons beside the number;
// open, the same card grown into a text box in place. Only the open card mounts a text box, so a slide of twenty
// cards costs one editor, never twenty (the cost flashcards pay, filed as Work Tracker #234).
import { useLayoutEffect, useRef, type KeyboardEvent, type PointerEvent } from 'react';
import {
  lucideChevronDown,
  lucideChevronUp,
  lucideClock,
  lucideGripVertical,
  lucideTrash2,
} from '@liveworkspace/icons/lucide';
import { keyLabel } from '@liveworkspace/workbench/lib/key-label';
import {
  NOTE_CARD_TEXT_MAX,
  noteCardSpeakingSeconds,
  speakingTimeLabel,
  type NoteCard,
} from '@livedocuments/document';
import { lucideGlyph, Tooltip } from '@livedocuments/ui';

const GripIcon = lucideGlyph(lucideGripVertical, 12);
const UpIcon = lucideGlyph(lucideChevronUp, 12);
const DownIcon = lucideGlyph(lucideChevronDown, 12);
const BinIcon = lucideGlyph(lucideTrash2, 12);
const ClockIcon = lucideGlyph(lucideClock, 10);

// The counter shows from here (80 % of the cap), so it never nags a short card.
export const NOTE_CARD_COUNTER_FROM = 800;
// The open box grows to this many lines, then scrolls.
const EDIT_LINES = 12;
const LINE_PX = 19;

export type NoteCardItemProps = {
  card: NoteCard;
  index: number;
  count: number;
  open: boolean;
  // Grip and buttons always shown (touch, where nothing hovers), not only on hover or focus.
  touch: boolean;
  // Being dragged to a new place (dimmed while the caret shows where it lands).
  dragging: boolean;
  onOpen: () => void;
  onClose: () => void;
  onText: (text: string) => void;
  onAddAfter: () => void;
  onMove: (delta: -1 | 1) => void;
  onRemove: () => void;
  onFocusSibling: (delta: -1 | 1) => void;
  onGripDown: (e: PointerEvent) => void;
  onGripMove: (e: PointerEvent) => void;
  onGripUp: (e: PointerEvent) => void;
};

function CardButton({
  label,
  onPress,
  children,
}: {
  label: string;
  onPress: () => void;
  children: React.ReactNode;
}) {
  return (
    <Tooltip label={label}>
      <button
        type="button"
        aria-label={label}
        onClick={(e) => {
          e.stopPropagation();
          onPress();
        }}
        // A press of a button is never a press of the card under it.
        onKeyDown={(e) => e.stopPropagation()}
        className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-2 focus-visible:outline-brand-600 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-200"
      >
        {children}
      </button>
    </Tooltip>
  );
}

function SpeakingTime({ text }: { text: string }) {
  const label = speakingTimeLabel(noteCardSpeakingSeconds(text));
  if (!label) return null;
  return (
    <span
      className="flex items-center gap-1 text-[10px] tabular-nums text-slate-500 dark:text-slate-400"
      data-note-card-time=""
    >
      <ClockIcon />
      {label}
    </span>
  );
}

const NUMBER_CHIP =
  'flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-50 px-1.5 text-[10px] font-semibold tabular-nums text-brand-700 dark:bg-brand-400/25 dark:text-brand-100';

export function NoteCardItem(props: NoteCardItemProps) {
  const { card, index, count, open, touch, dragging } = props;
  return open ? (
    <OpenCard {...props} />
  ) : (
    <div
      role="group"
      aria-label={`Card ${index + 1} of ${count}`}
      tabIndex={0}
      data-note-card={card.id}
      data-note-card-slot={index}
      onClick={props.onOpen}
      onKeyDown={(e) => closedCardKeys(e, props)}
      className={`group/card relative cursor-pointer overflow-hidden rounded-lg border bg-white shadow-sm transition outline-none hover:border-slate-300 hover:shadow focus-visible:ring-2 focus-visible:ring-brand-500 dark:bg-slate-800 dark:hover:border-slate-600 ${
        dragging ? 'border-brand-300 opacity-50' : 'border-slate-200 dark:border-slate-700'
      }`}
    >
      {/* The index card's rule across its top, as a cue card's. */}
      <div aria-hidden className="h-0.5 bg-brand-400/70 dark:bg-brand-400/50" />
      <div className="flex items-center gap-1 pl-1 pr-1 pt-1">
        <Tooltip label="Drag to Reorder">
          <span
            role="img"
            aria-label="Drag to Reorder"
            onPointerDown={(e) => {
              e.stopPropagation();
              props.onGripDown(e);
            }}
            onPointerMove={props.onGripMove}
            onPointerUp={props.onGripUp}
            onPointerCancel={props.onGripUp}
            onClick={(e) => e.stopPropagation()}
            className={`flex h-6 w-4 cursor-grab touch-none items-center justify-center rounded text-slate-400 transition active:cursor-grabbing dark:text-slate-400 ${
              touch
                ? ''
                : 'opacity-0 group-hover/card:opacity-100 group-focus-within/card:opacity-100'
            }`}
          >
            <GripIcon />
          </span>
        </Tooltip>
        <span className={NUMBER_CHIP}>{index + 1}</span>
        <span className="flex-1" />
        <div
          className={`flex items-center transition ${
            touch
              ? ''
              : 'opacity-0 group-hover/card:opacity-100 group-focus-within/card:opacity-100'
          }`}
        >
          {index > 0 ? (
            <CardButton label="Move Up" onPress={() => props.onMove(-1)}>
              <UpIcon />
            </CardButton>
          ) : null}
          {index < count - 1 ? (
            <CardButton label="Move Down" onPress={() => props.onMove(1)}>
              <DownIcon />
            </CardButton>
          ) : null}
          <CardButton label="Remove Card" onPress={props.onRemove}>
            <BinIcon />
          </CardButton>
        </div>
      </div>
      <p
        className="line-clamp-6 whitespace-pre-wrap break-words px-3 pb-1 pt-0.5 text-[13px] leading-[19px] text-slate-700 dark:text-slate-200"
        data-note-card-text=""
      >
        {card.text.trim() ? (
          card.text
        ) : (
          <span className="italic text-slate-500 dark:text-slate-400">Empty card</span>
        )}
      </p>
      <div className="flex justify-end px-3 pb-1.5">
        <SpeakingTime text={card.text} />
      </div>
    </div>
  );
}

// The keys a closed card takes while it has focus (blueprint "NoteCardList"): Enter opens, Delete or Backspace
// removes, Alt+arrows move it, the arrows alone move focus.
function closedCardKeys(e: KeyboardEvent, props: NoteCardItemProps) {
  if (e.target !== e.currentTarget) return;
  const done = () => {
    e.preventDefault();
    e.stopPropagation();
  };
  if (e.key === 'Enter' || e.key === ' ') {
    done();
    props.onOpen();
  } else if (e.key === 'Delete' || e.key === 'Backspace') {
    done();
    props.onRemove();
  } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
    done();
    const delta = e.key === 'ArrowUp' ? -1 : 1;
    if (e.altKey) props.onMove(delta);
    else props.onFocusSibling(delta);
  } else if (e.key !== 'Escape' && e.key !== 'Tab') {
    // Never the editor's shortcuts underneath.
    e.stopPropagation();
  }
}

function OpenCard({ card, index, touch, onClose, onText, onAddAfter }: NoteCardItemProps) {
  const box = useRef<HTMLTextAreaElement>(null);
  // As tall as its text, up to EDIT_LINES, then it scrolls.
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, EDIT_LINES * LINE_PX + 12)}px`;
  }, [card.text]);
  // The caret at the end of what is there, as a card opened to add to it.
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    el.focus({ preventScroll: true });
    el.setSelectionRange(el.value.length, el.value.length);
    el.scrollIntoView?.({ block: 'nearest' });
  }, []);
  const length = card.text.length;
  const atLimit = length >= NOTE_CARD_TEXT_MAX;
  return (
    <div
      data-note-card={card.id}
      data-note-card-open=""
      data-note-card-slot={index}
      className="overflow-hidden rounded-lg border border-brand-400 bg-white shadow-md ring-2 ring-brand-500/15 dark:border-brand-400/70 dark:bg-slate-800"
    >
      <div aria-hidden className="h-0.5 bg-brand-500" />
      <div className="flex items-center gap-1.5 px-2 pt-1.5">
        <span className={NUMBER_CHIP}>{index + 1}</span>
        <span className="flex-1" />
        <button
          type="button"
          onClick={onClose}
          className="cursor-pointer rounded-md px-1.5 py-0.5 text-[11px] font-semibold text-brand-700 transition hover:bg-brand-50 focus-visible:outline-2 focus-visible:outline-brand-600 dark:text-brand-200 dark:hover:bg-brand-500/15"
        >
          Done
        </button>
      </div>
      <textarea
        ref={box}
        value={card.text}
        maxLength={Math.max(NOTE_CARD_TEXT_MAX, length)}
        rows={2}
        aria-label={`Card ${index + 1}`}
        placeholder="What you'll say for this point…"
        onChange={(e) => onText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            // Closes the card, never the popover it sits in.
            e.preventDefault();
            e.stopPropagation();
            onClose();
            return;
          }
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            e.stopPropagation();
            onAddAfter();
            return;
          }
          // Typing is the card's, never the editor's shortcuts.
          e.stopPropagation();
        }}
        className="block w-full resize-none bg-transparent px-3 py-1.5 text-[13px] leading-[19px] text-slate-800 outline-none placeholder:text-slate-400 dark:text-slate-100 dark:placeholder:text-slate-400"
      />
      <div className="flex min-h-6 items-center gap-2 px-3 pb-1.5 text-[10px] text-slate-500 dark:text-slate-400">
        {touch ? null : (
          <span aria-hidden data-note-card-hint="">
            {keyLabel('Mod-')}↵ New Card · Esc Done
          </span>
        )}
        <span className="flex-1" />
        {length >= NOTE_CARD_COUNTER_FROM ? (
          <span
            aria-live="polite"
            className={`tabular-nums ${atLimit ? 'font-semibold text-amber-600 dark:text-amber-400' : ''}`}
          >
            {length.toLocaleString('en-GB')} / {NOTE_CARD_TEXT_MAX.toLocaleString('en-GB')}
          </span>
        ) : (
          <SpeakingTime text={card.text} />
        )}
      </div>
    </div>
  );
}
