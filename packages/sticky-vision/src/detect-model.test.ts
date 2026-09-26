import { describe, expect, it } from 'vitest';
import { eventStormingNote } from '@livediagram/diagram';
import { hexToRgb, type ImageBuffer } from './colour';
import { detectStickies, type DetectDropReason } from './detect';
import type { ModelCues } from './model-cues';

// The detector with a boundary model's cues handed in (docs/specs/021-event-storming/event-storming.md Phase 9,
// group J): the classical boxes, corrected where the model is sure. The
// model itself is not here; its cues are drawn, like the image.

function wallWith(notes: { x: number; y: number }[], size = 40): ImageBuffer {
  const width = 300;
  const height = 120;
  // A pale grey wall: pure white reads as a pale shade of paper.
  const data = new Uint8ClampedArray(width * height * 4).map(
    (_, i) => [241, 245, 249, 255][i % 4]!,
  );
  const paper = hexToRgb(eventStormingNote('domain-event').fill);
  // Paper with its edge, a darker line as a camera sees one.
  for (const n of notes)
    for (let y = n.y; y < n.y + size; y += 1)
      for (let x = n.x; x < n.x + size; x += 1) {
        const edge = x === n.x || y === n.y || x === n.x + size - 1 || y === n.y + size - 1;
        const k = edge ? 0.35 : 1;
        const i = (y * width + x) * 4;
        data[i] = paper.r * k;
        data[i + 1] = paper.g * k;
        data[i + 2] = paper.b * k;
      }
  return { width, height, data };
}

function cuesFor(image: ImageBuffer, notes: { x: number; y: number }[], size = 40): ModelCues {
  const background = new Uint8Array(image.width * image.height).fill(255);
  return {
    width: image.width,
    height: image.height,
    background,
    notes: notes.map((n) => ({
      x: n.x,
      y: n.y,
      w: size,
      h: size,
      core: { x: n.x + 4, y: n.y + 4, w: size - 8, h: size - 8 },
      corePixels: (size - 8) ** 2,
      confidence: 0.9,
    })),
  };
}

describe('detectStickies with a model', () => {
  const at = [
    { x: 20, y: 40 },
    { x: 130, y: 40 },
    { x: 240, y: 40 },
  ];

  it('finds the same notes with the model as without it when the two agree', () => {
    const image = wallWith(at);
    const plain = detectStickies(image);
    const hybrid = detectStickies(image, {
      model: { cues: cuesFor(image, at), rules: { drop: { minBackground: 0.9 } } },
    });
    expect(plain).toHaveLength(3);
    expect(hybrid).toEqual(plain);
  });

  it('drops the box the model sees as background, and says why', () => {
    const image = wallWith(at);
    const drops: DetectDropReason[] = [];
    const found = detectStickies(image, {
      model: { cues: cuesFor(image, at.slice(0, 2)), rules: { drop: { minBackground: 0.9 } } },
      onDrop: (_, why) => drops.push(why),
    });
    expect(found.map((s) => s.x)).toEqual([21, 131]);
    expect(found.map((s) => s.order)).toEqual([0, 1]);
    expect(drops).toContain('model-background');
  });
});
