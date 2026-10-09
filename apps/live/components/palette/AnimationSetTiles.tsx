// The tile grid for one animation set (docs/specs/028-animation/element-animations.md "The menu"):
// None plus an illustrated tile per option, then Speed and Repeat once one is picked. Every set
// (Shape, Sticky, Drawing, Media, Table, Text) renders through this one grid, so the sets cannot
// drift on layout, hover preview or the Speed row's gating.
//
// A value saved before the sets split that this set no longer offers keeps playing; it shows as
// one extra, selected tile after the set's own so it can be seen and replaced, and is gone for
// good once anything else is picked.

import { useState } from 'react';
import {
  ANIMATION_SET_VALUES,
  animationLabel,
  keptAnimation,
  type AnimationSetId,
  type AnimationSpeed,
} from '@livediagram/document';
import {
  NOOP,
  SpeedAndRepeatRows,
  useSpeedRowGate,
  withNone,
} from '@/components/palette/context-menu-tiles';
import { AnimationPreviewTile } from '@/components/palette/AnimationPreviewTile';
import { AnimationSetPreview, previewFrame } from '@/components/palette/animation-set-previews';
import { useRevertOnUnmount } from '@/components/primitives/hover-preview';

export function AnimationSetTiles({
  set,
  current,
  speed,
  repeat,
  onSet,
  onSetSpeed,
  onSetRepeat,
  onPreview,
  onPreviewEnd,
}: {
  set: AnimationSetId;
  // The stored value, which may be a kept value the set no longer offers.
  current: string | null;
  speed: AnimationSpeed;
  repeat: boolean;
  onSet: (v: string | null) => void;
  onSetSpeed: (v: AnimationSpeed) => void;
  onSetRepeat: (v: boolean) => void;
  // Desktop hover-to-preview: play the hovered motion live, revert on leave. Omitted = no preview.
  onPreview?: (v: string | null) => void;
  onPreviewEnd?: () => void;
}) {
  useRevertOnUnmount(onPreviewEnd ?? NOOP);
  // Captured at open like the Speed gate, so hovering (which previews into the live tab) never
  // adds or removes the kept tile under the pointer; a real pick of anything else drops it.
  const [kept, setKept] = useState(() => keptAnimation(set, current));
  const { showSpeed, handleSet: gateSet } = useSpeedRowGate(current, onSet);
  const handleSet = (v: string | null) => {
    if (v !== kept) setKept(undefined);
    gateSet(v);
  };
  const values: (string | null)[] = [
    ...withNone(ANIMATION_SET_VALUES[set]),
    ...(kept ? [kept] : []),
  ];
  return (
    <>
      <div className="grid grid-cols-4 gap-1 px-2 py-1.5">
        {values.map((v) => {
          // A kept value is an old Shape value: it previews as one.
          const shown = v === kept ? 'shape' : set;
          return (
            <AnimationPreviewTile
              key={v ?? 'none'}
              active={current === v}
              label={v ? animationLabel(v) : 'None'}
              frame={previewFrame(shown, v)}
              onClick={() => handleSet(v)}
              onPreview={onPreview ? () => onPreview(v) : undefined}
              onPreviewEnd={onPreviewEnd}
            >
              <AnimationSetPreview set={shown} value={v} />
            </AnimationPreviewTile>
          );
        })}
      </div>
      {showSpeed ? (
        <SpeedAndRepeatRows
          speed={speed}
          repeat={repeat}
          onSetSpeed={onSetSpeed}
          onSetRepeat={onSetRepeat}
        />
      ) : null}
    </>
  );
}
