// One action on an Action panel (docs/specs/012-collaboration/action-panel.md "The card"): a round check that
// completes or reopens it, its name (struck through once done), and who it is
// for. Pressing the rest of the row edits it. The check pops green on done.

import { COLLAB_DONE_COLOR as ACTION_DONE, type ElementAction } from '@livediagram/diagram';
import { GlyphDisc } from '@livediagram/ui';
import { initialsOf } from '@/lib/identity';
import { usePressWithoutDrag } from '@/hooks/ui/usePressWithoutDrag';
import { tint } from '../collab-chrome';
import { CheckGlyph, QA_ACCENT, QA_ON_ACCENT, stopPointer } from '../qa/qa-parts';

export function ActionRow({
  action,
  mine,
  textColor,
  fresh,
  onToggle,
  onEdit,
}: {
  action: ElementAction;
  // Assigned to the viewer: reads "You" and wears the accent.
  mine: boolean;
  textColor: string;
  // Added while the card was on screen: settles in.
  fresh: boolean;
  onToggle?: () => void;
  onEdit?: () => void;
}) {
  const done = action.status === 'done';
  const toggle = usePressWithoutDrag(() => onToggle?.());
  const edit = usePressWithoutDrag(() => onEdit?.());
  const who = action.assignee.name?.trim() || 'Teammate';
  return (
    <li
      className={`flex items-start gap-2.5 rounded-xl px-2 py-2 transition-colors ${fresh ? 'qa-enter' : ''}`}
      style={{ backgroundColor: tint(textColor, mine && !done ? 0.07 : 0.04) }}
    >
      <button
        type="button"
        {...toggle}
        {...stopPointer}
        disabled={!onToggle}
        aria-pressed={done}
        aria-label={done ? `Reopen ${action.name}` : `Complete ${action.name}`}
        className="pointer-events-auto mt-px flex h-[22px] w-[22px] shrink-0 cursor-pointer items-center justify-center rounded-full border-2 transition hover:scale-110 disabled:cursor-default disabled:hover:scale-100"
        style={
          done
            ? { borderColor: ACTION_DONE, backgroundColor: ACTION_DONE, color: '#ffffff' }
            : { borderColor: tint(QA_ACCENT, 0.6), color: QA_ACCENT }
        }
      >
        {done ? (
          <span key="done" className="qa-pop inline-flex">
            <CheckGlyph size={12} />
          </span>
        ) : null}
      </button>
      <button
        type="button"
        {...edit}
        {...stopPointer}
        disabled={!onEdit}
        className="pointer-events-auto flex min-w-0 flex-1 cursor-pointer flex-col gap-1 text-left disabled:cursor-default"
      >
        <span
          className="text-[12.5px] font-semibold leading-snug"
          style={{
            color: textColor,
            opacity: done ? 0.5 : 1,
            textDecoration: done ? 'line-through' : undefined,
            display: '-webkit-box',
            WebkitBoxOrient: 'vertical',
            WebkitLineClamp: 2,
            overflow: 'hidden',
          }}
        >
          {action.name}
        </span>
        <span className="flex min-w-0 items-center gap-1.5" style={{ color: textColor }}>
          <GlyphDisc
            size={16}
            aria-hidden
            className="text-[7px] font-bold"
            style={
              done
                ? { color: '#ffffff', backgroundColor: ACTION_DONE }
                : { color: QA_ON_ACCENT, backgroundColor: QA_ACCENT }
            }
          >
            {initialsOf(who)}
          </GlyphDisc>
          <span className="truncate text-[10.5px] opacity-65">{mine ? 'You' : who}</span>
        </span>
      </button>
    </li>
  );
}
