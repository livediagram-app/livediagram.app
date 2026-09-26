import { classifyRgb, wallFloorsOf } from '@livediagram/sticky-vision';
import type { EventStormingNoteKind } from '@livediagram/diagram';

// The dominant paper colour inside a box the author drew, classified against
// the notation's own fills. Wall, ink and unknown pixels are ignored; the note
// kind is the colour that actually fills the box.
//
// The FRAME-wide floors, deliberately: one small rectangle is not enough of a
// photograph to measure a wall from, so the wall it is compared against is the
// whole picture's.
export function kindOfBox(
  imageData: Uint8ClampedArray,
  imageSize: { width: number; height: number },
  box: { x: number; y: number; w: number; h: number },
): EventStormingNoteKind {
  const floors = wallFloorsOf({
    width: imageSize.width,
    height: imageSize.height,
    data: imageData,
  });
  const votes = new Map<string, number>();
  const x1 = Math.min(imageSize.width, box.x + box.w);
  const y1 = Math.min(imageSize.height, box.y + box.h);
  for (let y = box.y; y < y1; y += 3) {
    for (let x = box.x; x < x1; x += 3) {
      const i = (y * imageSize.width + x) * 4;
      const c = classifyRgb(imageData[i]!, imageData[i + 1]!, imageData[i + 2]!, floors);
      if (c === 'wall' || c === 'ink' || c === 'unknown') continue;
      votes.set(c, (votes.get(c) ?? 0) + 1);
    }
  }
  let best: string | null = null;
  let bestCount = -1;
  for (const [kind, count] of votes) {
    if (count > bestCount) {
      bestCount = count;
      best = kind;
    }
  }
  return (best as EventStormingNoteKind | null) ?? 'domain-event';
}
