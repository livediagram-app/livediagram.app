// The five faces you pick from (docs/specs/012-collaboration/temperature-check.md "The face"): a face over its
// number, sharing the row's width up to a sensible cap. Yours fills in its own
// colour, lifts, and pops when you choose it. The value's word (Blocked ...
// All in) is only the accessible name: printed, it took room from the face
// and added nothing, and a hover card over five obvious faces was noise. A
// viewer who can't answer sees them unpressable.

import { useState } from 'react';
import { TEMPERATURE_COLORS, TEMPERATURE_MOODS, TEMPERATURE_VALUES } from '@livediagram/document';
import { usePressWithoutDrag } from '@/hooks/ui/usePressWithoutDrag';
import { tint } from '../collab-chrome';
import { stopPointer } from '../qa/qa-parts';
import { MoodGlyph } from './MoodGlyph';
import { MOOD_GRID } from './mood-grid';

export function MoodButtons({
  mine,
  textColor,
  onRespond,
}: {
  mine: string | undefined;
  textColor: string;
  onRespond?: (value: string) => void;
}) {
  // Your pick as the card first painted: choosing a DIFFERENT face pops it,
  // a reload doesn't.
  const [initial] = useState(mine);
  return (
    // The shared five-column grid (MOOD_GRID), so each face sits exactly
    // over its bar and its point on the mood meter.
    <div className={MOOD_GRID}>
      {TEMPERATURE_VALUES.map((value, i) => (
        <MoodButton
          key={value}
          value={value}
          index={i}
          chosen={mine === value}
          pop={mine === value && mine !== initial}
          textColor={textColor}
          onPress={onRespond ? () => onRespond(value) : undefined}
        />
      ))}
    </div>
  );
}

function MoodButton({
  value,
  index,
  chosen,
  pop,
  textColor,
  onPress,
}: {
  value: string;
  index: number;
  chosen: boolean;
  pop: boolean;
  textColor: string;
  onPress?: () => void;
}) {
  const press = usePressWithoutDrag(() => onPress?.());
  const hue = TEMPERATURE_COLORS[index]!;
  const word = TEMPERATURE_MOODS[index]!;
  const button = (
    <button
      type="button"
      {...press}
      {...stopPointer}
      disabled={!onPress}
      aria-pressed={chosen}
      aria-label={`${value}, ${word}`}
      className="mood-button pointer-events-auto flex w-full min-w-0 cursor-pointer flex-col items-center gap-1 rounded-xl border px-1 pb-2 pt-2.5 disabled:cursor-default"
      style={
        {
          color: chosen ? hue : textColor,
          backgroundColor: chosen ? tint(hue, 0.16) : tint(textColor, 0.04),
          borderColor: chosen ? tint(hue, 0.7) : tint(textColor, 0.1),
          boxShadow: chosen ? `0 8px 16px -8px ${hue}` : undefined,
          transform: chosen ? 'translateY(-2px)' : undefined,
        } as React.CSSProperties
      }
    >
      <span key={pop ? 'pop' : 'rest'} className={pop ? 'qa-pop inline-flex' : 'inline-flex'}>
        <MoodGlyph value={index + 1} size={26} />
      </span>
      <span
        className="text-[12px] font-bold leading-none tabular-nums"
        style={{ color: textColor }}
      >
        {value}
      </span>
    </button>
  );
  return button;
}
