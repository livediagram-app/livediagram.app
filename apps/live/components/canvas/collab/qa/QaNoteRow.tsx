// One note in the Q&A board's live queue (docs/specs/012-collaboration/qa-board.md): the vote pill, the note,
// who asked and when, and a heat bar showing its share of the top note's
// votes, so the shape of the queue reads from across a room. The facilitator's
// actions surface on hover.

import { forwardRef } from 'react';
import type { QaNote } from '@livediagram/document';
import { tint } from '../collab-chrome';
import {
  AuthorChip,
  CheckGlyph,
  QA_ACCENT,
  QA_ACCENT_INK,
  RoundAction,
  DiscussGlyph,
  TrashGlyph,
  VotePill,
  relTime,
} from './qa-parts';

export type QaRowActions = {
  onDiscuss: () => void;
  onDone: () => void;
  onRemove: () => void;
};

export const QaNoteRow = forwardRef<
  HTMLLIElement,
  {
    note: QaNote;
    rank: number;
    // The top note's votes, for the heat bar. 0 when nobody has voted yet.
    maxVotes: number;
    mine: boolean;
    fresh: boolean;
    textColor: string;
    onVote?: () => void;
    actions?: QaRowActions;
  }
>(function QaNoteRow({ note, rank, maxVotes, mine, fresh, textColor, onVote, actions }, ref) {
  const votes = note.voters.length;
  const top = rank === 0 && votes > 0;
  const heat = maxVotes > 0 ? votes / maxVotes : 0;
  return (
    <li
      ref={ref}
      className={`qa-row group relative flex gap-2.5 overflow-hidden rounded-xl p-2 ${fresh ? 'qa-enter' : ''}`}
      style={{
        backgroundColor: top ? tint(QA_ACCENT, 0.09) : tint(textColor, 0.04),
        boxShadow: top ? `inset 0 0 0 1px ${tint(QA_ACCENT, 0.28)}` : undefined,
      }}
    >
      <VotePill count={votes} mine={mine} onToggle={onVote} textColor={textColor} />
      <div className="flex min-w-0 flex-1 flex-col gap-1 pr-1">
        {top ? (
          <span
            className="inline-flex items-center self-start rounded-full px-1.5 py-px text-[9px] font-bold"
            style={{ color: QA_ACCENT_INK, backgroundColor: tint(QA_ACCENT, 0.14) }}
          >
            <span className="text-optical-line text-optical-caps [--optical-tracking:0.08em]">
              Most wanted
            </span>
          </span>
        ) : null}
        <p
          className="text-[12px] font-medium leading-snug"
          style={{
            color: textColor,
            // Whole, never clamped: the panel's body scrolls (docs/specs/012-collaboration), and nowhere else
            // shows the rest of it.
            overflowWrap: 'anywhere',
          }}
        >
          {note.text}
        </p>
        <div className="flex min-w-0 items-center gap-1.5 text-[10px]">
          <AuthorChip author={note.author} textColor={textColor} size={14} />
          <span className="shrink-0 opacity-40" style={{ color: textColor }}>
            · {relTime(note.at)}
          </span>
        </div>
      </div>
      {actions ? (
        // On a solid pill in the card's own colour, so the note underneath
        // is covered cleanly rather than bleeding through three tinted discs.
        <div
          className="qa-row-actions absolute right-1.5 top-1.5 flex gap-1 rounded-full p-0.5"
          style={{
            backgroundColor: 'var(--qa-card)',
            boxShadow: `0 2px 8px -2px ${tint(textColor, 0.3)}, 0 0 0 1px ${tint(textColor, 0.08)}`,
          }}
        >
          <RoundAction
            label="Discuss Now"
            description="Put this note in the spotlight at the top of the board."
            tone="accent"
            textColor={textColor}
            onPress={actions.onDiscuss}
          >
            <DiscussGlyph />
          </RoundAction>
          <RoundAction
            label="Mark Done"
            description="Folds it into Discussed with its votes frozen."
            textColor={textColor}
            onPress={actions.onDone}
          >
            <CheckGlyph />
          </RoundAction>
          <RoundAction
            label="Remove"
            description="Takes this note off the board for everyone."
            textColor={textColor}
            onPress={actions.onRemove}
          >
            <TrashGlyph />
          </RoundAction>
        </div>
      ) : null}
      {/* The heat bar: this note's share of the most-voted note's count. */}
      <span
        aria-hidden
        className="qa-heat absolute bottom-0 left-0 h-[2px] rounded-full"
        style={{
          width: `${Math.round(heat * 100)}%`,
          background: `linear-gradient(90deg, ${tint(QA_ACCENT, 0.35)}, ${QA_ACCENT})`,
        }}
      />
    </li>
  );
});
