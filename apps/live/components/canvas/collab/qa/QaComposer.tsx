// The Q&A board's composer (docs/specs/012-collaboration/qa-board.md): the shared CollabComposer with an
// Anonymous toggle under the field. The toggle is sticky for the session on
// purpose: people who want to ask anonymously tend to want it for every note,
// and re-arming it per note is how a name slips onto the one note that
// shouldn't have it.

import { useState } from 'react';
import { QA_MAX_TEXT } from '@livediagram/diagram';
import { HoverCard } from '@livediagram/ui';
import { tint } from '../collab-chrome';
import { CollabComposer } from '../CollabComposer';
import { MaskGlyph, QA_ACCENT, QA_ACCENT_INK, stopPointer } from './qa-parts';

export function QaComposer({
  textColor,
  selfName,
  onAdd,
}: {
  textColor: string;
  selfName: string;
  onAdd: (text: string, anonymous: boolean) => void;
}) {
  const [anonymous, setAnonymous] = useState(false);
  return (
    <CollabComposer
      textColor={textColor}
      placeholder="Add a note…"
      ariaLabel="Add a note to the board"
      sendLabel="Post note"
      maxLength={QA_MAX_TEXT}
      onSubmit={(text) => onAdd(text, anonymous)}
      meta={
        <HoverCard
          title={anonymous ? 'Posting anonymously' : `Posting as ${selfName || 'you'}`}
          description={
            anonymous
              ? 'No name is stored with the note, and nothing goes to the change log.'
              : 'Your name shows on the note. Switch on to post without it.'
          }
        >
          <button
            type="button"
            role="switch"
            aria-checked={anonymous}
            {...stopPointer}
            onClick={(e) => {
              e.stopPropagation();
              setAnonymous((a) => !a);
            }}
            className="pointer-events-auto inline-flex cursor-pointer items-center gap-1.5 rounded-full py-0.5 pl-0.5 pr-2 text-[10px] font-semibold transition"
            style={{
              color: anonymous ? QA_ACCENT_INK : textColor,
              backgroundColor: anonymous ? tint(QA_ACCENT, 0.14) : tint(textColor, 0.06),
            }}
          >
            <span
              className="inline-flex h-4 w-7 items-center rounded-full p-0.5 transition-colors"
              style={{ backgroundColor: anonymous ? QA_ACCENT : tint(textColor, 0.2) }}
            >
              <span
                className="inline-flex h-3 w-3 items-center justify-center rounded-full bg-white text-slate-700 transition-transform duration-200"
                style={{ transform: anonymous ? 'translateX(12px)' : 'none' }}
              >
                {anonymous ? <MaskGlyph size={8} /> : null}
              </span>
            </span>
            {anonymous ? 'Anonymous' : `As ${selfName || 'you'}`}
          </button>
        </HoverCard>
      }
    />
  );
}
