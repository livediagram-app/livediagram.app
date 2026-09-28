// The scale as cards to pick from (docs/specs/012-collaboration/estimate-card.md "The look"): portrait cards
// sharing the row's width, each capped. Your pick fills in the accent, lifts,
// and pops; pressing it again withdraws it. A viewer who can't answer sees
// them unpressable.

import { useState } from 'react';
import { usePressWithoutDrag } from '@/hooks/ui/usePressWithoutDrag';
import { tint } from '../collab-chrome';
import { QA_ACCENT, QA_ON_ACCENT, stopPointer } from '../qa/qa-parts';

export function EstimatePicks({
  values,
  mine,
  textColor,
  onRespond,
}: {
  values: readonly string[];
  mine: string | undefined;
  textColor: string;
  onRespond?: (value: string) => void;
}) {
  // Your pick as the card first painted: a new pick pops, a reload doesn't.
  const [initial] = useState(mine);
  return (
    <div
      className="grid justify-center gap-1.5"
      style={{ gridTemplateColumns: `repeat(${values.length}, minmax(0, 52px))` }}
    >
      {values.map((value) => (
        <PickCard
          key={value}
          value={value}
          chosen={mine === value}
          pop={mine === value && mine !== initial}
          textColor={textColor}
          onPress={onRespond ? () => onRespond(value) : undefined}
        />
      ))}
    </div>
  );
}

function PickCard({
  value,
  chosen,
  pop,
  textColor,
  onPress,
}: {
  value: string;
  chosen: boolean;
  pop: boolean;
  textColor: string;
  onPress?: () => void;
}) {
  const press = usePressWithoutDrag(() => onPress?.());
  return (
    <button
      type="button"
      {...press}
      {...stopPointer}
      disabled={!onPress}
      aria-pressed={chosen}
      aria-label={chosen ? `Withdraw ${value}` : `Pick ${value}`}
      className="est-card pointer-events-auto flex h-[52px] w-full min-w-0 cursor-pointer items-center justify-center rounded-xl border text-[15px] font-bold tabular-nums disabled:cursor-default"
      style={{
        color: chosen ? QA_ON_ACCENT : textColor,
        backgroundColor: chosen ? QA_ACCENT : tint(textColor, 0.04),
        borderColor: chosen ? QA_ACCENT : tint(textColor, 0.14),
        boxShadow: chosen ? `0 10px 18px -10px ${QA_ACCENT}` : undefined,
        transform: chosen ? 'translateY(-3px)' : undefined,
      }}
    >
      <span key={pop ? 'pop' : 'rest'} className={`text-optical-centre ${pop ? 'qa-pop' : ''}`}>
        {value}
      </span>
    </button>
  );
}
