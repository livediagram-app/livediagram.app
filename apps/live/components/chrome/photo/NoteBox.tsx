'use client';

import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { EVENT_STORMING_NOTES } from '@livediagram/diagram';
import type { DetectedSticky } from '@livediagram/sticky-vision';
import type { Corner } from '@/lib/photo-boxes';
import { BoxEditControls } from './BoxEditControls';
import { lineHeightPx, useFitText, WORDS_FONT } from './fitText';

// One sticky, drawn on the photograph it was found in (docs/specs/021-event-storming/event-storming.md Phase 9).
//
// The box carries the two things the author cannot get from the photo itself:
// what the reader made of the handwriting, and whether this one is coming to
// the board. The KIND is not one of them — it is the box's colour, which is
// the notation's own alphabet, and spelling it out in words as well only
// covered the handwriting it was meant to explain.

const KIND_META = new Map(EVENT_STORMING_NOTES.map((n) => [n.kind, n]));

export const fillOf = (kind: string): string => KIND_META.get(kind as never)?.fill ?? '#cbd5e1';
export const sizeOf = (kind: string): 'square' | 'wide' | 'small' =>
  KIND_META.get(kind as never)?.size ?? 'square';

export function NoteBox({
  note,
  frame,
  text,
  reading,
  ticked,
  shown,
  onToggle,
  onEdit,
  zoom = 1,
  selected = false,
  onGrab,
  onResizeStart,
  onKind,
  onDelete,
}: {
  note: DetectedSticky;
  // The working image's size, so the box can be placed as a percentage and
  // stay put at any photo scale.
  frame: { width: number; height: number };
  text: string;
  reading: boolean;
  ticked: boolean;
  shown: boolean;
  onToggle: () => void;
  onEdit: (value: string) => void;
  // How far the photo is zoomed. The box grows with the photo; its controls
  // do not — see `chrome` below.
  zoom?: number;
  // Correcting the box itself: selected by a press on its body, which also
  // starts moving it; resized from its corners; re-kinded; deleted.
  selected?: boolean;
  onGrab?: (e: PointerEvent) => void;
  onResizeStart?: (e: PointerEvent, corner: Corner) => void;
  onKind?: (kind: string) => void;
  onDelete?: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(text);
  const input = useRef<HTMLInputElement | null>(null);
  const chip = useRef<HTMLButtonElement | null>(null);
  // The words' font, fitted to the box: at most two lines (fitText.ts).
  const [fontPx, setFontPx] = useState<number>(WORDS_FONT.max);

  useEffect(() => {
    if (editing) input.current?.focus();
  }, [editing]);

  const open = () => {
    setDraft(text);
    setEditing(true);
  };
  const commit = () => {
    setEditing(false);
    if (draft !== text) onEdit(draft);
  };

  const colour = fillOf(note.kind);
  // THE CONTROLS KEEP THEIR SIZE ON SCREEN. The box is on the photo and zooms
  // with it; the tick and the word pill are UI, and zooming them too makes a
  // pill four times as big at 400% — covering exactly the notes the zoom was
  // for. So they are scaled back down by the zoom: the pill is drawn `zoom`
  // times as wide, then shrunk by `zoom`, which leaves it the box's width on
  // screen with its text at the one size text should be.
  const chrome = zoom === 1 ? undefined : `scale(${1 / zoom})`;
  // An ellipsis rather than a kind name: the reader is still working, and a
  // word that is not the note's own words would only have to be unlearned.
  const words = text.trim() === '' ? (reading ? '…' : '') : text;
  const label = words === '' || words === '…' ? 'this note' : words;
  useFitText(chip, words, setFontPx);
  // The chip's FIRST line sits inside the box's bottom edge; a second hangs
  // below it, never up over the handwriting. Its offset is on-screen pixels,
  // so it is divided by the zoom like the rest of the controls.
  const chipTop = `calc(100% - ${lineHeightPx(fontPx) / zoom}px)`;

  return (
    <div
      data-testid={`note-box-${note.id}`}
      data-kind={note.kind}
      data-shown={shown ? 'yes' : 'no'}
      data-selected={selected ? 'yes' : undefined}
      // The reveal is a class rather than an inline transition so that a
      // reader who asks for less motion gets none: an inline style would win
      // over `motion-reduce`.
      // The box's BODY takes no clicks: only its tick and its word pill do.
      // A box drawn over another's corner must not bury that box's tick, and a
      // drag that starts over a box still draws — the photo is underneath.
      className="pointer-events-none absolute transition-[opacity,transform] duration-300 motion-reduce:transition-none"
      style={{
        left: `${(note.x / frame.width) * 100}%`,
        top: `${(note.y / frame.height) * 100}%`,
        width: `${(note.w / frame.width) * 100}%`,
        height: `${(note.h / frame.height) * 100}%`,
        // The reveal is opacity and scale only, so nothing on the surface
        // moves as boxes arrive.
        opacity: shown ? 1 : 0,
        // NO transform once shown: any transform makes the box a stacking
        // context, and a tick inside one cannot rise above the boxes drawn
        // after it.
        transform: shown ? undefined : 'scale(0.8)',
      }}
    >
      <div
        aria-hidden
        data-testid={`note-body-${note.id}`}
        // The BODY is how a box is picked up: pressed, it is selected, and
        // dragged, it moves. Below the tick and the words (z-0 against their
        // z-20 / z-10), so a body drawn over another box's corner never buries
        // that box's tick.
        onPointerDown={onGrab}
        className={`absolute inset-0 z-0 ${onGrab ? 'pointer-events-auto cursor-move' : ''} ${ticked ? '' : 'opacity-30'}`}
        // The outline stays two pixels ON SCREEN at any zoom. Drawn as an inset
        // shadow, not a border: a browser rounds a border thinner than one
        // pixel UP to one before the zoom multiplies it, so at 800% a 2/8px
        // border was a fat 8px band; a shadow's spread is painted as given.
        style={{
          background: `${colour}22`,
          boxShadow: selected
            ? `inset 0 0 0 ${2 / zoom}px ${colour}, 0 0 0 ${2 / zoom}px white`
            : `inset 0 0 0 ${2 / zoom}px ${colour}`,
          borderRadius: 2 / zoom,
        }}
      />
      {/* While the box is selected its tick moves into the toolbar: the corner
          belongs to the resize handle then, and one control under another is
          one that cannot be reached. */}
      {selected && onResizeStart && onKind && onDelete ? null : (
        <button
          type="button"
          role="checkbox"
          aria-checked={ticked}
          aria-label={`Include ${label}`}
          onClick={onToggle}
          // Its offset off the corner is 6px ON SCREEN too, or at 800% the tick floats
          // 48px away from the note it belongs to.
          style={
            chrome
              ? { transform: chrome, transformOrigin: 'top left', left: -6 / zoom, top: -6 / zoom }
              : undefined
          }
          className="pointer-events-auto absolute -left-1.5 -top-1.5 z-20 flex h-4 w-4 items-center justify-center rounded-sm border border-white/70 bg-slate-900/80 text-[9px] font-bold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          {ticked ? '✓' : ''}
        </button>
      )}
      {editing ? (
        <input
          ref={input}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === 'Enter') commit();
            if (e.key === 'Escape') setEditing(false);
          }}
          onPointerDown={(e) => e.stopPropagation()}
          aria-label="The words on this note"
          style={
            chrome
              ? { transform: chrome, transformOrigin: 'bottom left', width: `${zoom * 100}%` }
              : undefined
          }
          className="pointer-events-auto absolute inset-x-0 bottom-0 z-10 w-full rounded-b-sm border border-brand-400 bg-white px-1 py-0.5 text-[11px] leading-tight text-slate-900 outline-none"
        />
      ) : (
        <button
          ref={chip}
          type="button"
          data-testid={`note-words-${note.id}`}
          title={words === '' ? 'Type the words on this note' : words}
          onClick={open}
          onPointerDown={(e) => e.stopPropagation()}
          style={{
            top: chipTop,
            fontSize: fontPx,
            ...(chrome
              ? { transform: chrome, transformOrigin: 'top left', width: `${zoom * 100}%` }
              : {}),
          }}
          className={`pointer-events-auto absolute inset-x-0 z-10 block w-full line-clamp-2 break-words rounded-b-sm bg-slate-900/85 px-1 py-0.5 text-left leading-tight text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-white ${
            ticked ? '' : 'opacity-40'
          }`}
        >
          {words === '' ? <span className="text-slate-300">Type the words…</span> : words}
        </button>
      )}
      {selected && onResizeStart && onKind && onDelete ? (
        <BoxEditControls
          ticked={ticked}
          includeLabel={`Include ${label}`}
          onToggle={onToggle}
          kind={note.kind}
          zoom={zoom}
          onResizeStart={onResizeStart}
          onKind={onKind}
          onDelete={onDelete}
        />
      ) : null}
    </div>
  );
}
