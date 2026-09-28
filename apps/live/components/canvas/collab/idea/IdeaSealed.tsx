// A closed Idea box's body (docs/specs/012-collaboration/idea-box.md "The look"): a lock, the count large,
// and the promise that nothing shows until the box is opened. No text, not
// even to its writer.
//
// When an idea lands the count pops and lifts a +1 (the Q&A board's vote
// motion), so the room watches the box fill without reading a word. Both are
// keyed on the count, so each new idea remounts them and replays the
// animation; the count the box first painted with doesn't animate.

import { useState } from 'react';
import { GlyphDisc } from '@livediagram/ui';
import { tint } from '../collab-chrome';
import { LockGlyph, QA_ACCENT, QA_ACCENT_INK } from '../qa/qa-parts';

export function IdeaSealed({ count, textColor }: { count: number; textColor: string }) {
  const [initial] = useState(count);
  const bumped = count > initial;
  return (
    <div
      className="flex flex-col items-center gap-1.5 rounded-xl px-3 py-4 text-center"
      style={{
        backgroundColor: tint(textColor, 0.04),
        boxShadow: `inset 0 0 0 1px ${tint(textColor, 0.08)}`,
      }}
    >
      <GlyphDisc size={30} style={{ color: QA_ACCENT_INK, backgroundColor: tint(QA_ACCENT, 0.14) }}>
        <LockGlyph size={15} />
      </GlyphDisc>
      <span className="relative mt-1 inline-flex">
        <span
          key={count}
          className={`text-[26px] font-bold leading-none tabular-nums ${bumped ? 'qa-pop' : ''}`}
          style={{ color: textColor }}
        >
          {count}
        </span>
        {bumped ? (
          <span
            key={`+${count}`}
            aria-hidden
            className="qa-float pointer-events-none absolute left-1/2 top-0 text-[11px] font-black"
            style={{ color: QA_ACCENT_INK }}
          >
            +1
          </span>
        ) : null}
      </span>
      <span className="text-[11px] font-semibold" style={{ color: textColor }}>
        {count === 1 ? 'idea sealed' : 'ideas sealed'}
      </span>
      <span className="text-[10.5px] leading-snug" style={{ color: textColor, opacity: 0.55 }}>
        Hidden from everyone until the box is opened.
      </span>
    </div>
  );
}
