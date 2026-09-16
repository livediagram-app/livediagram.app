import { describe, expect, it } from 'vitest';
import { EVENT_STORMING_NOTES, eventStormingNote } from '@livediagram/diagram';
import { classifyRgb, PAPER_CLASSES } from './classify';
import { greyWorldBalance, hexToRgb, rgbToHsv, type ImageBuffer } from './colour';
import { detectStickies, cropRects, toNormalised } from './detect';

// Finding stickies in a photograph (spec/139 Phase 8). Every image here is
// DRAWN by the test, which is the point of doing this with classical CV: the
// input is exactly known, so a failure names its own cause.

function blank(width: number, height: number, fill = '#f1f5f9'): ImageBuffer {
  const { r, g, b } = hexToRgb(fill);
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = r;
    data[i + 1] = g;
    data[i + 2] = b;
    data[i + 3] = 255;
  }
  return { width, height, data };
}

function rect(
  image: ImageBuffer,
  x: number,
  y: number,
  w: number,
  h: number,
  hex: string,
): ImageBuffer {
  const { r, g, b } = hexToRgb(hex);
  for (let yy = y; yy < y + h; yy += 1) {
    for (let xx = x; xx < x + w; xx += 1) {
      if (xx < 0 || yy < 0 || xx >= image.width || yy >= image.height) continue;
      const i = (yy * image.width + xx) * 4;
      image.data[i] = r;
      image.data[i + 1] = g;
      image.data[i + 2] = b;
      image.data[i + 3] = 255;
    }
  }
  return image;
}

const fillOf = (kind: Parameters<typeof eventStormingNote>[0]) => eventStormingNote(kind).fill;

describe('the colour classes come from the catalogue', () => {
  it('has exactly one class per note kind', () => {
    expect(PAPER_CLASSES).toHaveLength(EVENT_STORMING_NOTES.length);
    expect(new Set(PAPER_CLASSES.map((c) => c.kind)).size).toBe(EVENT_STORMING_NOTES.length);
  });

  it('classifies each catalogue fill as its own kind — except the two pinks', () => {
    for (const note of EVENT_STORMING_NOTES) {
      const { r, g, b } = hexToRgb(note.fill);
      // The catalogue's external-system pink and its hotspot red-pink are the
      // same colour to a camera, and the operator's own walls use pink for
      // hotspots. Pink is hotspot; an external system read as one is re-kinded
      // in the draft, which is a click (spec/139).
      const expected = note.kind === 'external-system' ? 'hotspot' : note.kind;
      expect(classifyRgb(r, g, b), note.kind).toBe(expected);
    }
  });

  it('calls the wall the wall, and ink ink', () => {
    expect(classifyRgb(241, 245, 249)).toBe('wall');
    expect(classifyRgb(255, 255, 255)).toBe('wall');
    expect(classifyRgb(20, 20, 20)).toBe('ink');
  });

  it('separates the two yellows by how pale the paper is', () => {
    // The catalogue's own two: a saturated actor, a pale aggregate.
    const actor = hexToRgb(fillOf('actor'));
    const aggregate = hexToRgb(fillOf('aggregate'));
    expect(classifyRgb(actor.r, actor.g, actor.b)).toBe('actor');
    expect(classifyRgb(aggregate.r, aggregate.g, aggregate.b)).toBe('aggregate');
  });
});

describe('greyWorldBalance', () => {
  it('leaves a neutral image alone', () => {
    const image = blank(8, 8, '#808080');
    const out = greyWorldBalance(image);
    expect([...out.data.slice(0, 3)]).toEqual([128, 128, 128]);
  });

  it('is NOT what the detector relies on — the floors are measured per photo', () => {
    // On a brown kraft wall the balance takes the wall for a neutral surface
    // and corrects the brown out of the whole photograph, moving every paper
    // hue with it; detections on the operator's own walls fell by three
    // quarters. So it is off by default, and a warm cast is handled by
    // measuring the wall instead (see wallFloorsOf).
    const image = blank(60, 60, '#9aa2ab');
    rect(image, 10, 10, 40, 40, fillOf('actor'));
    for (let i = 0; i < image.data.length; i += 4) {
      image.data[i] = Math.min(255, image.data[i]! * 1.18);
      image.data[i + 2] = image.data[i + 2]! * 0.82;
    }
    const found = detectStickies(image);
    expect(found).toHaveLength(1);
    expect(found[0]!.kind).toBe('actor');
  });

  it('still balances a scene when asked, for a caller with a neutral backdrop', () => {
    // A tungsten-ish cast over the whole scene: more red, less blue. The wall
    // is a mid grey so nothing clips — a clipped channel is a cast this cannot
    // undo, and pretending otherwise would make the test a lie.
    const image = blank(60, 60, '#9aa2ab');
    rect(image, 10, 10, 40, 40, fillOf('actor'));
    for (let i = 0; i < image.data.length; i += 4) {
      image.data[i] = Math.min(255, image.data[i]! * 1.18);
      image.data[i + 2] = image.data[i + 2]! * 0.82;
    }
    const corrected = detectStickies(image, { balance: true });
    expect(corrected).toHaveLength(1);
    expect(corrected[0]!.kind).toBe('actor');
  });
});

describe('detectStickies', () => {
  it('finds nothing in a photo with no paper in it', () => {
    expect(detectStickies(blank(64, 64))).toEqual([]);
  });

  it('finds one sticky of each kind, alone', () => {
    for (const note of EVENT_STORMING_NOTES) {
      const image = rect(blank(120, 120), 20, 20, 60, 60, note.fill);
      const found = detectStickies(image);
      expect(found, note.kind).toHaveLength(1);
      // Pink is hotspot, per the classification above.
      const expected = note.kind === 'external-system' ? 'hotspot' : note.kind;
      expect(found[0]!.kind, note.kind).toBe(expected);
      expect(found[0]).toMatchObject({ x: 20, y: 20, w: 60, h: 60 });
    }
  });

  it('reads a 3×2 grid as six stickies, two rows, left to right', () => {
    const image = blank(400, 300);
    const orange = fillOf('domain-event');
    const cols = [20, 150, 280];
    const rows = [20, 170];
    rows.forEach((y) => cols.forEach((x) => rect(image, x, y, 90, 90, orange)));
    const found = detectStickies(image);
    expect(found).toHaveLength(6);
    expect(found.filter((s) => s.row === 0)).toHaveLength(3);
    expect(found.filter((s) => s.row === 1)).toHaveLength(3);
    const firstRow = found.filter((s) => s.row === 0).sort((a, b) => a.order - b.order);
    expect(firstRow.map((s) => s.x)).toEqual(cols);
  });

  it('keeps a sticky with heavy handwriting as ONE sticky', () => {
    const image = rect(blank(160, 160), 20, 20, 100, 100, fillOf('command'));
    // Three thick strokes of marker right across the paper.
    for (const y of [45, 65, 85]) rect(image, 25, y, 90, 8, '#111827');
    const found = detectStickies(image);
    expect(found).toHaveLength(1);
    expect(found[0]!.kind).toBe('command');
    // …and it knows it did not see solid paper.
    expect(found[0]!.confidence).toBeLessThan(1);
  });

  it('splits two overlapping notes of the SAME colour into two', () => {
    const image = blank(300, 160);
    const orange = fillOf('domain-event');
    rect(image, 20, 30, 100, 100, orange);
    rect(image, 110, 30, 100, 100, orange);
    const found = detectStickies(image);
    expect(found).toHaveLength(2);
    expect(found.map((s) => s.row)).toEqual([0, 0]);
    expect(found[0]!.x).toBeLessThan(found[1]!.x);
  });

  it('needs no splitting when the overlap is between DIFFERENT colours', () => {
    const image = blank(300, 160);
    rect(image, 20, 30, 100, 100, fillOf('domain-event'));
    rect(image, 110, 30, 100, 100, fillOf('command'));
    const found = detectStickies(image);
    expect(found).toHaveLength(2);
    expect(new Set(found.map((s) => s.kind))).toEqual(new Set(['domain-event', 'command']));
  });

  it('drops specks — a pen lid is not a sticky', () => {
    const image = blank(200, 200);
    rect(image, 20, 20, 100, 100, fillOf('policy'));
    rect(image, 170, 180, 5, 5, fillOf('hotspot'));
    const found = detectStickies(image);
    expect(found).toHaveLength(1);
    expect(found[0]!.kind).toBe('policy');
  });

  it('reads the silhouette off the box, against the photo’s own median', () => {
    const image = blank(500, 200);
    rect(image, 20, 40, 100, 100, fillOf('domain-event'));
    rect(image, 150, 40, 150, 90, fillOf('policy'));
    rect(image, 330, 55, 70, 70, fillOf('actor'));
    const found = detectStickies(image).sort((a, b) => a.x - b.x);
    expect(found.map((s) => s.size)).toEqual(['square', 'wide', 'small']);
  });

  it('survives a photo taken at a slight angle', () => {
    // A ±10° sticky, drawn as a staircase of rows.
    const image = blank(220, 220);
    const orange = fillOf('domain-event');
    for (let i = 0; i < 100; i += 1) rect(image, 40 + Math.round(i * 0.17), 50 + i, 100, 1, orange);
    const found = detectStickies(image);
    expect(found).toHaveLength(1);
    expect(found[0]!.kind).toBe('domain-event');
  });

  it('gets through a 1024px working image quickly', () => {
    const image = blank(1024, 1024);
    const orange = fillOf('domain-event');
    for (let y = 40; y < 900; y += 220) {
      for (let x = 40; x < 900; x += 220) rect(image, x, y, 160, 160, orange);
    }
    const started = performance.now();
    const found = detectStickies(image);
    const took = performance.now() - started;
    expect(found).toHaveLength(16);
    // A loose bound: the point is "not seconds", not a benchmark CI can flake on.
    expect(took).toBeLessThan(1500);
  });
});

describe('what the detector hands on', () => {
  it('normalises a box against the image it was found in', () => {
    const image = rect(blank(200, 100), 40, 20, 40, 40, fillOf('domain-event'));
    const [sticky] = detectStickies(image);
    expect(toNormalised(sticky!, image)).toEqual({ cx: 0.3, cy: 0.4, w: 0.2, h: 0.4 });
  });

  it('scales the crop back to the full-resolution photo, with padding', () => {
    const sticky = {
      id: 0,
      kind: 'domain-event' as const,
      size: 'square' as const,
      x: 10,
      y: 20,
      w: 100,
      h: 100,
      row: 0,
      order: 0,
      confidence: 1,
    };
    const [crop] = cropRects([sticky], 2, 0.1);
    // 2× the working image, with 10% of the note as padding each side.
    expect(crop).toEqual({ id: 0, x: 0, y: 20, w: 240, h: 240 });
  });

  it('never cuts outside the photo', () => {
    const sticky = {
      id: 0,
      kind: 'domain-event' as const,
      size: 'square' as const,
      x: 0,
      y: 0,
      w: 50,
      h: 50,
      row: 0,
      order: 0,
      confidence: 1,
    };
    const [crop] = cropRects([sticky], 1);
    expect(crop!.x).toBe(0);
    expect(crop!.y).toBe(0);
  });
});

describe('hue arithmetic', () => {
  it('measures round the circle, not across it', () => {
    expect(rgbToHsv({ r: 255, g: 0, b: 0 }).h).toBe(0);
    expect(Math.round(rgbToHsv({ r: 0, g: 255, b: 0 }).h)).toBe(120);
  });
});
