// The Comment panel's thread as a conversation (docs/specs/012-collaboration/comment-pin.md "The look"):
// bubbles under their author, your own on the right in the accent, everyone
// else's on the left. Consecutive comments by one author group under one
// name, the way a chat does, so a three-part remark reads as one voice.

import type { Comment } from '@livediagram/diagram';
import { Glyph, GlyphDisc } from '@livediagram/ui';
import { IDENTITY_FILL, identityVars } from '@/lib/identity-fill';
import { relativeSince } from '@/lib/relative-time';
import { MentionText } from '@/components/primitives/MentionText';
import { tint } from '../collab-chrome';
import { QA_ACCENT, stopPointer } from '../qa/qa-parts';

const CrossGlyph = () => (
  <Glyph size={8} units={16}>
    <path d="m4 4 8 8M12 4l-8 8" />
  </Glyph>
);

// Runs of consecutive comments by the same author.
export function groupByAuthor(comments: readonly Comment[]): Comment[][] {
  const groups: Comment[][] = [];
  for (const c of comments) {
    const last = groups[groups.length - 1];
    const prev = last?.[last.length - 1];
    const same =
      prev !== undefined &&
      (prev.authorId && c.authorId
        ? prev.authorId === c.authorId
        : prev.authorName === c.authorName);
    if (same) last!.push(c);
    else groups.push([c]);
  }
  return groups;
}

export function CommentBubbles({
  comments,
  selfId,
  textColor,
  now,
  freshFrom,
  onDelete,
}: {
  comments: readonly Comment[];
  selfId: string;
  textColor: string;
  now: number;
  // Comments at or past this index arrived while the card was on screen, and
  // settle in rather than simply appearing.
  freshFrom: number;
  onDelete?: (commentId: string) => void;
}) {
  let index = 0;
  return (
    <ul className="flex flex-col gap-2.5">
      {groupByAuthor(comments).map((group) => {
        const first = group[0]!;
        const mine = !!selfId && first.authorId === selfId;
        return (
          <li
            key={first.id}
            className={`flex min-w-0 gap-1.5 ${mine ? 'flex-row-reverse' : 'flex-row'}`}
          >
            <GlyphDisc
              size={20}
              aria-hidden
              className={`mt-0.5 shrink-0 font-bold text-white ${IDENTITY_FILL}`}
              style={{ ...identityVars(first.authorColor), fontSize: 10 }}
            >
              {first.authorName.trim().charAt(0).toUpperCase() || '?'}
            </GlyphDisc>
            <div className={`flex min-w-0 flex-col gap-1 ${mine ? 'items-end' : 'items-start'}`}>
              <span
                className="flex items-baseline gap-1.5 px-1 text-[10px]"
                style={{ color: textColor }}
              >
                <span className="font-semibold">{mine ? 'You' : first.authorName}</span>
                <span className="opacity-45">
                  {relativeSince(group[group.length - 1]!.createdAt, now)}
                </span>
              </span>
              {group.map((c) => {
                const fresh = index++ >= freshFrom;
                return (
                  <span
                    key={c.id}
                    className={`group/bubble relative max-w-full whitespace-pre-wrap break-words px-2.5 py-1.5 text-[11.5px] leading-snug ${
                      mine ? 'rounded-2xl rounded-tr-md' : 'rounded-2xl rounded-tl-md'
                    } ${fresh ? 'qa-enter' : ''}`}
                    style={{
                      color: textColor,
                      backgroundColor: mine ? tint(QA_ACCENT, 0.16) : tint(textColor, 0.06),
                    }}
                  >
                    <MentionText
                      text={c.text}
                      mentions={c.mentions}
                      // Falls back to the text colour where no card accent is in
                      // scope (the presentation popover reuses these bubbles).
                      chipStyle={{
                        color: `var(--qa-accent-ink, ${textColor})`,
                        backgroundColor: tint(`var(--qa-accent, ${textColor})`, 0.16),
                      }}
                    />
                    {/* Your own comments only: the rule the popover applies,
                        so a panel cannot become a way around it. */}
                    {mine && onDelete ? (
                      <GlyphDisc
                        size={16}
                        as="button"
                        type="button"
                        aria-label="Delete this comment"
                        {...stopPointer}
                        onClick={(e: React.MouseEvent) => {
                          e.stopPropagation();
                          onDelete(c.id);
                        }}
                        className="pointer-events-auto absolute -left-1.5 -top-1.5 cursor-pointer opacity-0 shadow-sm transition-opacity group-hover/bubble:opacity-100"
                        style={{ color: textColor, backgroundColor: tint(textColor, 0.14) }}
                      >
                        <CrossGlyph />
                      </GlyphDisc>
                    ) : null}
                  </span>
                );
              })}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
