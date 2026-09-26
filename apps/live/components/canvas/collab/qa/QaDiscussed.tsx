// The Q&A board's Discussed drawer (spec/151): every closed note, folded away
// below the live queue, most recently closed first, counts frozen. Closed by
// default: the record of what the room covered is kept, not shown off.

import { useState } from 'react';
import type { QaNote } from '@livediagram/diagram';
import { tint } from '../collab-chrome';
import { ChevronGlyph, CheckGlyph, ReopenGlyph, RoundAction, stopPointer } from './qa-parts';

export function QaDiscussed({
  notes,
  textColor,
  onReopen,
}: {
  notes: QaNote[];
  textColor: string;
  onReopen?: (noteId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  if (notes.length === 0) return null;
  return (
    <div className="shrink-0">
      <button
        type="button"
        {...stopPointer}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        aria-expanded={open}
        className="pointer-events-auto flex w-full cursor-pointer items-center gap-2 rounded-lg px-1 py-1 text-[10.5px] font-semibold transition hover:opacity-100"
        style={{ color: textColor, opacity: 0.7 }}
      >
        <span
          className="inline-flex h-4 w-4 items-center justify-center rounded-full"
          style={{ backgroundColor: tint(textColor, 0.1) }}
        >
          <CheckGlyph size={9} />
        </span>
        <span className="uppercase tracking-[0.08em]">Discussed · {notes.length}</span>
        <span className="h-px flex-1" style={{ backgroundColor: tint(textColor, 0.12) }} />
        <ChevronGlyph open={open} />
      </button>
      {open ? (
        <ul className="mt-1 flex flex-col gap-1">
          {notes.map((note) => (
            <li
              key={note.id}
              className="qa-row qa-enter relative flex items-start gap-2 rounded-lg px-2 py-1.5"
              style={{ backgroundColor: tint(textColor, 0.03) }}
            >
              <span
                className="mt-px shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-bold tabular-nums"
                style={{ color: textColor, backgroundColor: tint(textColor, 0.07), opacity: 0.7 }}
              >
                ▲ {note.voters.length}
              </span>
              <p
                className="min-w-0 flex-1 text-[11px] leading-snug line-through decoration-1"
                style={{
                  color: textColor,
                  opacity: 0.55,
                  textDecorationColor: tint(textColor, 0.35),
                  overflowWrap: 'anywhere',
                }}
              >
                {note.text}
              </p>
              {onReopen ? (
                <div className="qa-row-actions shrink-0">
                  <RoundAction
                    label="Reopen"
                    description="Puts it back in the live queue with its votes."
                    textColor={textColor}
                    onPress={() => onReopen(note.id)}
                  >
                    <ReopenGlyph size={11} />
                  </RoundAction>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
