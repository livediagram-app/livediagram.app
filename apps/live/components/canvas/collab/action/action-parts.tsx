// The Action panel's small parts (docs/specs/012-collaboration/action-panel.md "The card"): its glyph, the
// Open / Done status chip, the one loud act (Mark Complete, quiet Reopen once
// done) and the round Edit pencil beside it.

import { Glyph, GlyphDisc, HoverCard } from '@livediagram/ui';
import { usePressWithoutDrag } from '@/hooks/ui/usePressWithoutDrag';
import { tint } from '../collab-chrome';
import {
  CheckGlyph,
  QA_ACCENT,
  QA_ACCENT_INK,
  QA_ON_ACCENT,
  ReopenGlyph,
  stopPointer,
} from '../qa/qa-parts';

// Completion's colour: the Done check's green, so "finished" means one thing
// across the Collaborate cards.
export const ACTION_DONE = '#16a34a';

// A clipboard with a tick: work handed to somebody.
export const ActionGlyph = ({ size = 12 }: { size?: number }) => (
  <Glyph size={size} units={16}>
    <path d="M5.5 2.8h5M5.5 2.8a1 1 0 0 0-1 1v.2h7v-.2a1 1 0 0 0-1-1M4.5 3.4H3.6a1 1 0 0 0-1 1v8.6a1 1 0 0 0 1 1h8.8a1 1 0 0 0 1-1V4.4a1 1 0 0 0-1-1h-.9" />
    <path d="m5.6 9.2 1.7 1.7 3.2-3.6" />
  </Glyph>
);

const PencilGlyph = ({ size = 12 }: { size?: number }) => (
  <Glyph size={size} units={16}>
    <path d="M10.6 3.1 12.9 5.4 6 12.3l-3 .7.7-3 6.9-6.9Z" />
    <path d="m9.4 4.3 2.3 2.3" />
  </Glyph>
);

export function StatusChip({ done }: { done: boolean }) {
  return (
    <span
      key={done ? 'done' : 'open'}
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${done ? 'qa-pop' : ''}`}
      style={
        done
          ? { color: ACTION_DONE, backgroundColor: tint(ACTION_DONE, 0.14) }
          : { color: QA_ACCENT_INK, backgroundColor: tint(QA_ACCENT, 0.14) }
      }
    >
      {done ? (
        <CheckGlyph size={10} />
      ) : (
        <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: QA_ACCENT }} />
      )}
      {done ? 'Done' : 'Open'}
    </span>
  );
}

// The card's one act. Loud in the accent while open; quiet once done, where
// the same place takes it back.
export function CompleteButton({
  done,
  onPress,
  textColor,
}: {
  done: boolean;
  onPress: () => void;
  textColor: string;
}) {
  const press = usePressWithoutDrag(onPress);
  return (
    <button
      type="button"
      {...press}
      {...stopPointer}
      className="done-button pointer-events-auto flex min-w-0 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-xl py-2 text-[12px] font-semibold"
      style={
        done
          ? { color: textColor, backgroundColor: tint(textColor, 0.08) }
          : {
              color: QA_ON_ACCENT,
              backgroundColor: QA_ACCENT,
              boxShadow: `0 8px 16px -10px ${QA_ACCENT}`,
            }
      }
    >
      {done ? <ReopenGlyph size={12} /> : <CheckGlyph size={13} />}
      {done ? 'Reopen' : 'Mark Complete'}
    </button>
  );
}

export function EditButton({ onPress, textColor }: { onPress: () => void; textColor: string }) {
  const press = usePressWithoutDrag(onPress);
  return (
    <HoverCard title="Edit" description="Change the action, its details or who it is for.">
      <GlyphDisc
        size={34}
        as="button"
        type="button"
        {...press}
        {...stopPointer}
        aria-label="Edit"
        className="pointer-events-auto shrink-0 cursor-pointer transition hover:scale-105 active:scale-95"
        style={{ color: textColor, backgroundColor: tint(textColor, 0.08) }}
      >
        <PencilGlyph size={14} />
      </GlyphDisc>
    </HoverCard>
  );
}
