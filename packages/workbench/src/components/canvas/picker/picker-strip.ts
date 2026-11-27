// The reel strip a Picker spins, and the names either side of the payline (docs/specs/012-collaboration/
// picker.md "The look"). Pure, so the strip's shape is testable without a canvas. How big the face is
// laid out is @liveworkspace/element-model/picker-layout, shared with the headless render.

import type { PickerCandidate } from '../../../lib/picker';

// The name either side of `label` in the reel's order, or null where there is no other name to show.
export function neighbourOf<C extends PickerCandidate>(
  ring: readonly C[],
  label: string | undefined,
  step: 1 | -1,
): C | null {
  const others = ring.filter((c) => c.label !== label);
  if (others.length === 0) return null;
  const at = label === undefined ? -1 : ring.findIndex((c) => c.label === label);
  if (at < 0) return step === 1 ? others[0]! : others[others.length - 1]!;
  const n = ring.length;
  return ring[(at + step + n) % n]!;
}

// The rows above and below a name standing on the payline. With one other name on the ring it shows
// once, below, rather than the same name either side.
export function besideRows<C extends PickerCandidate>(
  ring: readonly C[],
  label: string | undefined,
): [C | null, C | null] {
  const above = neighbourOf(ring, label, -1);
  const below = neighbourOf(ring, label, 1);
  return [above && below && above.label === below.label ? null : above, below];
}

// The strip a spin scrolls: the row above where the reel stands now, the row it stands on, the frames
// flicking past, then the landing with its neighbours either side, so the last frame is exactly the
// rest the face settles into. The window starts on index 1 and stops on `strip.length - 2`.
export function spinStrip<C extends PickerCandidate>(
  ring: readonly C[],
  standing: C | null,
  frames: readonly C[],
  landed: C,
): (C | null)[] {
  const [landedAbove, landedBelow] = besideRows(ring, landed.label);
  return [
    besideRows(ring, standing?.label)[0],
    standing,
    ...frames,
    landedAbove,
    landed,
    landedBelow,
  ];
}
