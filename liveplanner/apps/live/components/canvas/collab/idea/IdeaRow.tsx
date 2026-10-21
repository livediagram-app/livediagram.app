// One idea in an opened Idea box (docs/specs/012-collaboration/idea-box.md "The look"), drawn as the Q&A
// board's note card: a tile on the left the size of the Q&A vote pill, the
// text, and a meta line under it. Nothing is votable, so the tile is not a
// control: it carries the idea's number, and the meta line carries the mask
// where a Q&A note names its author. An idea added after the box first
// painted slides in.

import { tint } from '../collab-chrome';
import { AuthorChip } from '../qa/qa-parts';

export function IdeaRow({
  text,
  index,
  fresh,
  textColor,
}: {
  text: string;
  // Submission order, from 0; shown from 1.
  index: number;
  fresh: boolean;
  textColor: string;
}) {
  return (
    <li
      className={`relative flex gap-2.5 overflow-hidden rounded-xl p-2 ${fresh ? 'qa-enter' : ''}`}
      style={{ backgroundColor: tint(textColor, 0.04) }}
    >
      <span
        aria-hidden
        className="flex h-[42px] w-9 shrink-0 items-center justify-center rounded-xl border text-[13px] font-bold tabular-nums"
        style={{
          color: textColor,
          backgroundColor: tint(textColor, 0.06),
          borderColor: tint(textColor, 0.16),
        }}
      >
        <span className="text-optical-centre">{index + 1}</span>
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1 pr-1">
        <p
          className="text-[12px] font-medium leading-snug"
          style={{
            color: textColor,
            // Whole, never clamped: the panel's body scrolls (docs/specs/012-collaboration), and nowhere else
            // shows the rest of it.
            overflowWrap: 'anywhere',
          }}
        >
          {text}
        </p>
        <div className="flex min-w-0 items-center gap-1.5 text-[10px]">
          <AuthorChip author={undefined} textColor={textColor} size={14} />
        </div>
      </div>
    </li>
  );
}
