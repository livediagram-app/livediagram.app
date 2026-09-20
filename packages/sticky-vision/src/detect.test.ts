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

// Dim one part of the image the way a window does: full light on most of the
// frame, a soft shadow edge, and half the light beyond it. Pure illumination
// — every channel is scaled by the same factor, so hue and saturation are
// untouched and only `value` moves, which is exactly what a shaded wall does
// to a camera. The lit part stays the MAJORITY of the frame on purpose: that
// is what sets a frame-wide floor too high for everything behind the shadow.
function shade(image: ImageBuffer, darkest = 0.5): ImageBuffer {
  const from = image.width * 0.55;
  const to = image.width * 0.65;
  for (let y = 0; y < image.height; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      const t = Math.min(1, Math.max(0, (x - from) / (to - from)));
      const smooth = t * t * (3 - 2 * t);
      const factor = 1 - (1 - darkest) * smooth;
      const i = (y * image.width + x) * 4;
      image.data[i] = image.data[i]! * factor;
      image.data[i + 1] = image.data[i + 1]! * factor;
      image.data[i + 2] = image.data[i + 2]! * factor;
    }
  }
  return image;
}

// What the detector should call each catalogue fill. Pink is hotspot: the
// catalogue's external-system pink and its hotspot red-pink are the same
// colour to a camera (see the classification tests).
const expectedKind = (kind: string) => (kind === 'external-system' ? 'hotspot' : kind);

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

  it('keeps a note shattered by REAL handwriting as one note (morphological close)', () => {
    // A working-size photo and a real note. Six marker strokes, 8px wide, wider
    // than the 6px merge gap at 1000px: without a morphological close the
    // fragments never re-join and the note is lost to the too-thin/aspect filters.
    const image = blank(1000, 750);
    rect(image, 100, 100, 200, 200, fillOf('command'));
    // Strokes spanning the FULL width cut the note into separate fragments.
    for (const y of [150, 180, 210, 240, 270]) rect(image, 100, y, 200, 8, '#111827');
    const found = detectStickies(image);
    expect(found).toHaveLength(1);
    expect(found[0]!.kind).toBe('command');
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

  it('finds the notes on the shaded half of a wall lit from one side', () => {
    // The operator's own photographs: one wall, a window on one side, and the
    // right-hand half at about half the light. The same eight notes are drawn
    // twice, left bank and right bank, and the right bank is multiplied down
    // to 50% brightness — so every note the detector misses on the right is a
    // note it found in identical paper on the left.
    const image = blank(1200, 520, '#e2e8f0');
    for (const bankX of [40, 700]) {
      EVENT_STORMING_NOTES.forEach((note, i) => {
        const x = bankX + (i % 4) * 120;
        const y = 40 + Math.floor(i / 4) * 260;
        rect(image, x, y, 100, 100, note.fill);
      });
    }
    shade(image);

    const found = detectStickies(image);
    const right = found.filter((s) => s.x >= 660);
    const left = found.filter((s) => s.x < 660);
    expect(left).toHaveLength(EVENT_STORMING_NOTES.length);
    expect(right).toHaveLength(EVENT_STORMING_NOTES.length);
    // …and the shade must not change what a note IS: the same eight kinds on
    // both sides. A note found but re-coloured by the dark is a note the
    // author has to re-kind by hand.
    const kindsOf = (set: typeof found) => [...set].sort((a, b) => a.x - b.x).map((s) => s.kind);
    expect(kindsOf(right)).toEqual(kindsOf(left));
    expect(new Set(kindsOf(left))).toEqual(
      new Set(EVENT_STORMING_NOTES.map((n) => expectedKind(n.kind))),
    );
  });

  it('finds the same notes in the shade on a KRAFT wall, where the wall is paper-coloured', () => {
    // The harder half of the same problem, and the operator's actual wall:
    // brown kraft is the same hue as an orange domain event, so the floor that
    // keeps the lit wall out is measured against a wall whose brightness
    // halves across the frame. Asserted as a SYMMETRY rather than a count —
    // pale paper on kraft is a separate, documented limit (the aggregate and
    // the pale external-system pink are wall to the classifier at any
    // brightness), and this test is about the shade, not about that.
    const image = blank(1200, 520, '#a8907a');
    for (const bankX of [40, 700]) {
      EVENT_STORMING_NOTES.forEach((note, i) => {
        rect(image, bankX + (i % 4) * 120, 40 + Math.floor(i / 4) * 260, 100, 100, note.fill);
      });
    }
    shade(image);

    const found = detectStickies(image);
    const kindsOf = (from: number, to: number) =>
      found
        .filter((s) => s.x >= from && s.x < to)
        .sort((a, b) => a.y - b.y || a.x - b.x)
        .map((s) => s.kind);
    const left = kindsOf(0, 660);
    expect(left.length).toBeGreaterThanOrEqual(6);
    expect(kindsOf(660, 1200)).toEqual(left);
  });

  it('takes a sagging ROW of touching notes apart into notes', () => {
    // The commonest shape on the operator's wall, and the one that was losing
    // the most notes: six stickies lapped edge to edge along a line that sags
    // across the paper. They arrive as ONE component whose bounding box is
    // half wall — too unsolid to cut by the old rule, too long to keep — and
    // the whole run went in the bin together.
    const image = blank(1000, 500, '#a8907a');
    const orange = fillOf('domain-event');
    // Two notes on their own first: a wall always has some, and they are what
    // tells the detector how big a note is here.
    rect(image, 120, 30, 72, 72, orange);
    rect(image, 700, 40, 72, 72, orange);
    for (let i = 0; i < 6; i += 1) rect(image, 150 + i * 70, 220 + i * 14, 72, 72, orange);
    const found = detectStickies(image);
    expect(found).toHaveLength(8);
    expect(found.every((s) => s.kind === 'domain-event')).toBe(true);
  });

  it('never gives one solid note more than one box', () => {
    // The stacked boxes the operator saw: three at 82%, three at 83%, on top
    // of each other. A note is one note however the splitter feels about its
    // proportions — including a note larger than its neighbours, which is
    // what drags the median note size down far enough for the split rule to
    // start dicing.
    const image = blank(900, 500, '#a8907a');
    rect(image, 60, 60, 130, 130, fillOf('domain-event'));
    for (let i = 0; i < 4; i += 1) rect(image, 420 + i * 110, 300, 60, 60, fillOf('command'));
    const found = detectStickies(image);
    const big = found.filter((s) => s.kind === 'domain-event');
    expect(big).toHaveLength(1);
    expect(found).toHaveLength(5);
  });

  it('does not weld a row of notes photographed close up into one bar', () => {
    // The photograph this comes from: a close-up of a wall whose notes are
    // big, well lit and plainly separate, on which the detector found FOUR of
    // its forty-one. The notes were in the mask the whole time. What lost
    // them was the morphological close — which exists to fuse handwriting
    // back into its own note — reaching a fixed fraction of the FRAME: at a
    // working width of 1000 that is 6px from every side, so it bridges a 12px
    // gap, and a row of notes a finger apart welded into one bar at 30% fill.
    // Every number downstream then described the weld: the note size came out
    // at 24px against a hand-measured 55.
    //
    // A pen stroke is a fraction of a NOTE, not of the frame, and that is the
    // whole fix: measure the note first, close by a fraction of it.
    const image = blank(1000, 563, '#a8907a');
    const orange = fillOf('domain-event');
    for (let i = 0; i < 5; i += 1) {
      const x = 60 + i * 110;
      rect(image, x, 200, 100, 100, orange);
      // …and handwriting on each, inset from the paper's edge the way a hand
      // writes, so the close still has its real job to do.
      for (const y of [230, 250, 270]) rect(image, x + 12, y, 76, 5, '#111827');
    }
    const found = detectStickies(image);
    expect(found).toHaveLength(5);
    for (const note of found) {
      expect(note.w).toBeGreaterThan(80);
      expect(note.w).toBeLessThan(130);
    }
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
