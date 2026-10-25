// The Q&A board's composer (docs/specs/012-collaboration/qa-board.md): the shared CollabComposer with an
// Anonymous toggle under the field. The toggle is sticky for the session on
// purpose: people who want to ask anonymously tend to want it for every note,
// and re-arming it per note is how a name slips onto the one note that
// shouldn't have it.

import { useState } from 'react';
import { QA_MAX_TEXT } from '@livediagram/document';
import { SwitchRow } from '@livediagram/ui';
import { tint } from '../collab-chrome';
import { CollabComposer } from '../CollabComposer';
import { MaskGlyph, QA_ACCENT, QA_ACCENT_INK, stopPointer } from './qa-parts';

export function QaComposer({
  textColor,
  selfName,
  full = false,
  onAdd,
}: {
  textColor: string;
  selfName: string;
  // The board holds QA_MAX_NOTES and takes no more.
  full?: boolean;
  onAdd: (text: string, anonymous: boolean) => boolean | Promise<boolean>;
}) {
  const [anonymous, setAnonymous] = useState(false);
  return (
    <CollabComposer
      textColor={textColor}
      placeholder="Add a note…"
      ariaLabel="Add a note to the board"
      sendLabel="Post note"
      maxLength={QA_MAX_TEXT}
      full={full ? 'Board is full' : undefined}
      onSubmit={(text) => onAdd(text, anonymous)}
      meta={
        <SwitchRow
          // A stable name, the state is aria-checked: a name that flipped
          // between "As Sam" and "Anonymous" announced as two controls.
          aria-label="Anonymous"
          checked={anonymous}
          onChange={setAnonymous}
          {...stopPointer}
          onClick={(e) => e.stopPropagation()}
          size="xs"
          track="start"
          onColor={QA_ACCENT}
          offColor={tint(textColor, 0.2)}
          knob={
            anonymous ? (
              <span className="flex text-slate-700">
                <MaskGlyph size={8} />
              </span>
            ) : null
          }
          layout="pointer-events-auto inline-flex items-center gap-1.5 rounded-full"
          className="py-0.5 pl-0.5 pr-2 text-[10px] font-semibold transition"
          style={{
            color: anonymous ? QA_ACCENT_INK : textColor,
            backgroundColor: anonymous ? tint(QA_ACCENT, 0.14) : tint(textColor, 0.06),
          }}
        >
          {anonymous ? 'Anonymous' : `As ${selfName || 'you'}`}
        </SwitchRow>
      }
    />
  );
}
