// The Q&A board's spotlight (docs/specs/012-collaboration/qa-board.md): the note the room is discussing, lifted
// out of the queue into a lit card with a slow accent sweep round its edge and
// a breathing "live" dot. The facilitator closes it from here, or closes it
// and brings up the next top note in one press.

import type { QaNote } from '@livediagram/diagram';
import { usePressWithoutDrag } from '@/hooks/ui/usePressWithoutDrag';
import { Tooltip } from '@/components/primitives/Tooltip';
import { tint } from '../collab-chrome';
import {
  AuthorChip,
  CheckGlyph,
  QA_ACCENT,
  QA_ACCENT_INK,
  QA_ON_ACCENT,
  VotePill,
  stopPointer,
} from './qa-parts';

function SpotButton({
  children,
  onPress,
  loud,
  textColor,
  tooltip,
}: {
  children: React.ReactNode;
  onPress: () => void;
  loud?: boolean;
  textColor: string;
  tooltip: { title: string; description: string };
}) {
  const press = usePressWithoutDrag(onPress);
  return (
    <Tooltip title={tooltip.title} description={tooltip.description}>
      <button
        type="button"
        {...press}
        {...stopPointer}
        className="pointer-events-auto inline-flex cursor-pointer items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold transition hover:brightness-110 active:scale-95"
        style={
          loud
            ? {
                color: QA_ON_ACCENT,
                backgroundColor: QA_ACCENT,
                boxShadow: `0 4px 14px -6px ${QA_ACCENT}`,
              }
            : { color: textColor, backgroundColor: tint(textColor, 0.08) }
        }
      >
        {children}
      </button>
    </Tooltip>
  );
}

export function QaSpotlight({
  note,
  mine,
  textColor,
  onVote,
  onDone,
  onDoneNext,
  hasNext,
  onReturn,
}: {
  note: QaNote;
  mine: boolean;
  textColor: string;
  onVote?: () => void;
  // Facilitator controls; absent for everyone else.
  onDone?: () => void;
  onDoneNext?: () => void;
  hasNext: boolean;
  onReturn?: () => void;
}) {
  return (
    <section
      aria-label="Now discussing"
      className="qa-spotlight qa-enter relative shrink-0 rounded-2xl p-3"
      style={{ boxShadow: `0 10px 30px -14px ${QA_ACCENT}` }}
    >
      <div className="mb-2 flex items-center gap-1.5">
        <span className="qa-live h-2 w-2 rounded-full" style={{ backgroundColor: QA_ACCENT }} />
        <span
          className="text-[9.5px] font-bold uppercase tracking-[0.12em]"
          style={{ color: QA_ACCENT_INK }}
        >
          Now discussing
        </span>
        {onReturn ? (
          <button
            type="button"
            {...stopPointer}
            onClick={(e) => {
              e.stopPropagation();
              onReturn();
            }}
            className="pointer-events-auto ml-auto cursor-pointer text-[10px] font-medium opacity-50 transition hover:opacity-90"
            style={{ color: textColor }}
          >
            Back to queue
          </button>
        ) : null}
      </div>
      <div className="flex gap-3">
        <VotePill
          count={note.voters.length}
          mine={mine}
          onToggle={onVote}
          textColor={textColor}
          large
        />
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <p
            className="text-[14.5px] font-semibold leading-snug"
            style={{
              color: textColor,
              display: '-webkit-box',
              WebkitBoxOrient: 'vertical',
              WebkitLineClamp: 5,
              overflow: 'hidden',
              overflowWrap: 'anywhere',
            }}
          >
            {note.text}
          </p>
          <div className="text-[10.5px]">
            <AuthorChip note={note} textColor={textColor} />
          </div>
        </div>
      </div>
      {onDone ? (
        <div className="mt-2.5 flex justify-end gap-1.5">
          <SpotButton
            textColor={textColor}
            onPress={onDone}
            tooltip={{
              title: 'Done',
              description: 'Folds this note into Discussed. Its votes freeze.',
            }}
          >
            <CheckGlyph size={11} /> Done
          </SpotButton>
          {hasNext && onDoneNext ? (
            <SpotButton
              loud
              textColor={textColor}
              onPress={onDoneNext}
              tooltip={{
                title: 'Done, next',
                description: 'Closes this note and spotlights the current top note.',
              }}
            >
              Done, next →
            </SpotButton>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
