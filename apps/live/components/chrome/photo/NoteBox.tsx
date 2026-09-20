'use client';

import { useEffect, useRef, useState } from 'react';
import { EVENT_STORMING_NOTES } from '@livediagram/diagram';
import type { DetectedSticky } from '@livediagram/sticky-vision';

// One sticky, drawn on the photograph it was found in (spec/139 Phase 9).
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
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(text);
  const input = useRef<HTMLInputElement | null>(null);

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
  // An ellipsis rather than a kind name: the reader is still working, and a
  // word that is not the note's own words would only have to be unlearned.
  const words = text.trim() === '' ? (reading ? '…' : '') : text;
  const label = words === '' || words === '…' ? 'this note' : words;

  return (
    <div
      // The reveal is a class rather than an inline transition so that a
      // reader who asks for less motion gets none: an inline style would win
      // over `motion-reduce`.
      className="absolute transition-[opacity,transform] duration-300 motion-reduce:transition-none"
      style={{
        left: `${(note.x / frame.width) * 100}%`,
        top: `${(note.y / frame.height) * 100}%`,
        width: `${(note.w / frame.width) * 100}%`,
        height: `${(note.h / frame.height) * 100}%`,
        // The reveal is opacity and scale only, so nothing on the surface
        // moves as boxes arrive.
        opacity: shown ? 1 : 0,
        transform: shown ? 'scale(1)' : 'scale(0.8)',
      }}
    >
      <div
        aria-hidden
        className={`absolute inset-0 rounded-sm border-2 ${ticked ? '' : 'opacity-30'}`}
        style={{ borderColor: colour, background: `${colour}22` }}
      />
      <button
        type="button"
        role="checkbox"
        aria-checked={ticked}
        aria-label={`Include ${label}`}
        onClick={onToggle}
        className="absolute -left-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-sm border border-white/70 bg-slate-900/80 text-[9px] font-bold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
      >
        {ticked ? '✓' : ''}
      </button>
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
          className="absolute inset-x-0 bottom-0 w-full rounded-b-sm border border-brand-400 bg-white px-1 py-0.5 text-[11px] leading-tight text-slate-900 outline-none"
        />
      ) : (
        <button
          type="button"
          data-testid={`note-words-${note.id}`}
          title={words === '' ? 'Type the words on this note' : words}
          onClick={open}
          onPointerDown={(e) => e.stopPropagation()}
          className={`absolute inset-x-0 bottom-0 block w-full truncate rounded-b-sm bg-slate-900/85 px-1 py-0.5 text-left text-[11px] leading-tight text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-white ${
            ticked ? '' : 'opacity-40'
          }`}
        >
          {words === '' ? <span className="text-slate-300">Type the words…</span> : words}
        </button>
      )}
    </div>
  );
}
