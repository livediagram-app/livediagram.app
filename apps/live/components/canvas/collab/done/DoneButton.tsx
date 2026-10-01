// The Done check's one action (docs/specs/012-collaboration/done-check.md "Reading the card"): "I'm done" in the
// accent with a check, which pops when pressed; once you are done it turns
// quiet and reads "I'm not done", the same press to take it back.

import { useState } from 'react';
import { usePressWithoutDrag } from '@/hooks/ui/usePressWithoutDrag';
import { tint } from '../collab-chrome';
import { CheckGlyph, LOUD_ACCENT, stopPointer } from '../qa/qa-parts';

export function DoneButton({
  mine,
  textColor,
  onToggle,
}: {
  mine: boolean;
  textColor: string;
  onToggle?: () => void;
}) {
  const [initial] = useState(mine);
  const press = usePressWithoutDrag(() => onToggle?.());
  return (
    <button
      type="button"
      {...press}
      {...stopPointer}
      disabled={!onToggle}
      className="done-button pointer-events-auto flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-xl py-2 text-[12px] font-semibold disabled:cursor-default disabled:opacity-50"
      style={mine ? { color: textColor, backgroundColor: tint(textColor, 0.08) } : LOUD_ACCENT}
    >
      <span
        key={mine ? 'mine' : 'not'}
        className={`inline-flex items-center gap-1.5 ${mine !== initial ? 'qa-pop' : ''}`}
      >
        {mine ? null : <CheckGlyph size={13} />}
        {mine ? "I'm not done" : "I'm done"}
      </span>
    </button>
  );
}
