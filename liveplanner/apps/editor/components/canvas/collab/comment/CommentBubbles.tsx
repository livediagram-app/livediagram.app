// A stored Comment panel's thread as a conversation, read-only (docs/specs/012-collaboration/comment-pin.md, retired):
// bubbles under their author, your own on the right in the accent, everyone
// else's on the left. Consecutive comments by one author group under one
// name, the way a chat does, so a three-part remark reads as one voice.

import { reactionDef, reactionGroups, type Comment } from '@liveplanner/project';
import { IDENTITY_FILL, PictureDisc, identityVars } from '@liveplanner/ui';
import { useOwnPicture } from '@/lib/own-picture';
import { relativeSince } from '@/lib/relative-time';
import { MentionText } from '@liveworkspace/workbench/components/primitives/MentionText';
import { tint } from '../collab-chrome';
import { COLLAB_ACCENT } from '../collab-parts';

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
}: {
  comments: readonly Comment[];
  selfId: string;
  textColor: string;
  now: number;
}) {
  const { picture: ownPicture } = useOwnPicture();
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
            <span className="mt-0.5 inline-flex shrink-0">
              {/* Your own group wears your Google picture; others' stay their initial (the comment keeps no
                  picture, only the room's presence carries one). */}
              <PictureDisc
                size={20}
                aria-hidden
                pictureUrl={mine ? ownPicture : null}
                name={first.authorName}
                className={`font-bold text-white ${IDENTITY_FILL}`}
                style={{ ...identityVars(first.authorColor), fontSize: 10 }}
              >
                {first.authorName.trim().charAt(0).toUpperCase() || '?'}
              </PictureDisc>
            </span>
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
                const reactions = reactionGroups(c.reactions);
                return [
                  <span
                    key={c.id}
                    className={`relative max-w-full whitespace-pre-wrap break-words px-2.5 py-1.5 text-[11.5px] leading-snug ${
                      mine ? 'rounded-2xl rounded-tr-md' : 'rounded-2xl rounded-tl-md'
                    }`}
                    style={{
                      color: textColor,
                      backgroundColor: mine ? tint(COLLAB_ACCENT, 0.16) : tint(textColor, 0.06),
                    }}
                  >
                    <MentionText
                      text={c.text}
                      mentions={c.mentions}
                      // Falls back to the text colour where no card accent is in
                      // scope.
                      chipStyle={{
                        color: `var(--collab-accent-ink, ${textColor})`,
                        backgroundColor: tint(`var(--collab-accent, ${textColor})`, 0.16),
                      }}
                    />
                  </span>,
                  // Its reactions, as a quiet line under the bubble (docs/specs/012-collaboration/comment-reactions.md):
                  // read here, left from the thread's popover.
                  reactions.length ? (
                    <span
                      key={`${c.id}-reactions`}
                      className="flex flex-wrap gap-1 px-1 text-[10px] tabular-nums"
                      style={{ color: textColor }}
                      role="img"
                      aria-label={reactions
                        .map((r) => `${reactionDef(r.emoji).name} ${r.count}`)
                        .join(', ')}
                    >
                      {reactions.map((r) => (
                        <span
                          key={r.emoji}
                          aria-hidden
                          className="inline-flex items-center gap-0.5 rounded-full px-1.5 py-px"
                          style={{ backgroundColor: tint(textColor, 0.08) }}
                        >
                          {reactionDef(r.emoji).emoji}
                          <span className="opacity-70">{r.count}</span>
                        </span>
                      ))}
                    </span>
                  ) : null,
                ];
              })}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
