import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { createShape } from '@livehuddle/document';
import {
  BACK_ROW_SPAN,
  BACK_ROW_Y,
  FLOOR_CLIP_Y,
  FLOOR_FURNITURE_SCALE,
  FLOOR_MOTION,
  FLOOR_ONLY,
  FLOOR_STAGES,
  LOOP_S,
  SETTLED_AT,
  type FloorStage,
  type Rect,
  type Walker,
} from './hero-space-floor-cast';
import {
  BUBBLE_HEIGHT,
  beatsLength,
  bubbleBox,
  bubbleWidth,
  figureRect,
  floorCss,
  positionAt,
  stillChanges,
  stillKeysOf,
  timelineOf,
} from './hero-space-floor-motion';

// docs/specs/019-marketing/marketing-site.md "Hero": the copy stays clear, the groups talk in turn, the loop closes,
// reduced motion holds a settled frame, and only transform and opacity move.

const overlaps = (a: Rect, b: Rect) =>
  a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
const inside = (a: Rect, b: Rect) =>
  a.x >= b.x && a.y >= b.y && a.x + a.width <= b.x + b.width && a.y + a.height <= b.y + b.height;

const every = FLOOR_MOTION.flatMap((stage) =>
  stage.cast.map((walker) => [stage.key, walker.name, stage, walker] as const),
);

/** The furniture's boxes, at the size the art is drawn (lib/hero-space-floor.test.tsx). */
function furnitureRects(stage: FloorStage): Rect[] {
  return stage.furniture.map((piece) => {
    const base = createShape(piece.kind, piece.x, piece.y) as { width: number; height: number };
    const width = piece.width ?? base.width * FLOOR_FURNITURE_SCALE;
    return { x: piece.x, y: piece.y, width, height: (base.height * width) / base.width };
  });
}

/** Every box a character covers over the loop: its figure along each stretch, and its name chip under it. */
function walkerRects(walker: Walker): Rect[] {
  return timelineOf(walker).flatMap((seg) => {
    const a = figureRect(walker, seg.from);
    const b = figureRect(walker, seg.to);
    const x = Math.min(a.x, b.x);
    const y = Math.min(a.y, b.y);
    const swept = {
      x,
      y,
      width: Math.max(a.x, b.x) + a.width - x,
      height: Math.max(a.y, b.y) + a.height - y,
    };
    // The name chip: about 7 px a letter, its dot and padding.
    const chipWidth = walker.name.length * 7 + 28;
    const chip = {
      x: Math.min(seg.from.x, seg.to.x) - chipWidth / 2,
      y: Math.max(seg.from.y, seg.to.y) + 4,
      width: Math.abs(seg.to.x - seg.from.x) + chipWidth,
      height: 18,
    };
    return [swept, chip];
  });
}

function bubbleRects(stage: FloorStage, walker: Walker) {
  return timelineOf(walker)
    .filter((seg) => seg.say)
    .map((seg) => {
      const box = bubbleBox(stage, walker, seg);
      return {
        seg,
        rect: {
          x: seg.to.x + box.left,
          y: seg.to.y + box.top,
          width: box.width,
          height: BUBBLE_HEIGHT,
        },
      };
    });
}

describe('the hero floor keeps the copy clear', () => {
  it.each(FLOOR_STAGES.map((s) => [s.key, s] as const))(
    'places the %s stage’s furniture off the copy, on the stage',
    (_, stage) => {
      const bounds = { x: 0, y: 0, width: stage.width, height: stage.height };
      stage.furniture.forEach((piece, i) => {
        const rect = furnitureRects(stage)[i]!;
        expect(overlaps(rect, stage.clear), `${piece.kind} at ${piece.x}, ${piece.y}`).toBe(false);
        expect(inside(rect, bounds), `${piece.kind} at ${piece.x}, ${piece.y}`).toBe(true);
      });
    },
  );

  it('stands the back of the office wholly in its span, so a common screen never cuts it', () => {
    const wide = FLOOR_STAGES.find((s) => s.key === 'wide')!;
    const back = [
      ...furnitureRects(wide),
      ...wide.cast.flatMap((walker) => [
        ...walkerRects(walker),
        ...bubbleRects(wide, walker).map((b) => b.rect),
      ]),
    ].filter((rect) => rect.y < BACK_ROW_Y);
    expect(back.length).toBeGreaterThan(10);
    for (const rect of back) {
      expect(rect.y).toBeGreaterThanOrEqual(BACK_ROW_SPAN.top);
      expect(rect.y + rect.height).toBeLessThanOrEqual(BACK_ROW_SPAN.foot);
    }
  });

  it.each(every)(
    'walks %s %s round the copy, never into it or off the stage',
    (_, __, stage, walker) => {
      const bounds = { x: 0, y: 0, width: stage.width, height: stage.height };
      for (const rect of walkerRects(walker)) {
        expect(overlaps(rect, stage.clear)).toBe(false);
        expect(inside(rect, bounds)).toBe(true);
      }
      for (const { rect } of bubbleRects(stage, walker)) {
        expect(overlaps(rect, stage.clear)).toBe(false);
        expect(inside(rect, bounds)).toBe(true);
      }
    },
  );
});

// Between sm and lg the wide stage hides its wings, showing only the back of the office above BACK_ROW_Y and the floor
// below FLOOR_CLIP_Y (Work Tracker #440, #505): a walker who crossed either line would vanish mid-walk, so each one
// shown there stays wholly in one band all loop, and a walker whose own path crosses one walks its floor path instead
// (FLOOR_ONLY).
describe('the hero floor between sm and lg', () => {
  const wide = FLOOR_STAGES.find((s) => s.key === 'wide')!;
  const shownBelowLg = wide.cast.map(
    (walker) => FLOOR_ONLY.cast.find((twin) => twin.name === walker.name) ?? walker,
  );
  const STEP = 0.05;
  const moments = Array.from({ length: Math.round(LOOP_S / STEP) + 1 }, (_, i) => i * STEP);
  const side = (rect: Rect) => {
    if (rect.y >= FLOOR_CLIP_Y) return 'floor';
    if (rect.y + rect.height <= BACK_ROW_Y) return 'back';
    return rect.y >= BACK_ROW_Y && rect.y + rect.height <= FLOOR_CLIP_Y ? 'clipped' : 'cut';
  };

  it.each(shownBelowLg.map((walker) => [walker.name, walker] as const))(
    'keeps %s wholly at the back, on the floor or clipped away at every moment of the loop',
    (_, walker) => {
      const sides = new Set(moments.map((t) => side(figureRect(walker, positionAt(walker, t)))));
      expect([...sides]).not.toContain('cut');
      expect(sides.size, `${walker.name} crosses the clip line`).toBe(1);
      // A line said on the floor or at the back is said wholly there, never cut by the clip.
      const stage = FLOOR_ONLY.cast.includes(walker) ? FLOOR_ONLY : wide;
      const [only] = sides;
      if (only !== 'clipped')
        for (const { rect } of bubbleRects(stage, walker)) expect(side(rect)).toBe(only);
    },
  );

  it('gives a floor path to exactly the walkers whose own path crosses the line', () => {
    const crossing = wide.cast.filter(
      (walker) =>
        new Set(moments.map((t) => side(figureRect(walker, positionAt(walker, t))))).size > 1,
    );
    expect(crossing.map((w) => w.name)).toEqual(FLOOR_ONLY.cast.map((w) => w.name));
    expect(crossing.length).toBeGreaterThan(0);
  });

  it('talks in turn with the walkers it shares the floor with', () => {
    const lines = shownBelowLg.flatMap((walker) =>
      bubbleRects(FLOOR_ONLY.cast.includes(walker) ? FLOOR_ONLY : wide, walker),
    );
    for (const a of lines)
      for (const b of lines) {
        if (a === b) continue;
        const near = Math.hypot(a.seg.to.x - b.seg.to.x, a.seg.to.y - b.seg.to.y) < 320;
        const together = a.seg.start < b.seg.end && b.seg.start < a.seg.end;
        if (near) expect(together, `${a.seg.say} / ${b.seg.say}`).toBe(false);
      }
  });

  it('clips the stage on the same lines the paths keep to', () => {
    const css = readFileSync(
      new URL('../app/hero-scenes/space-floor.css', import.meta.url),
      'utf8',
    );
    expect(css).toContain(
      `clip-path: polygon(0 0, 100% 0, 100% ${BACK_ROW_Y}px, 0 ${BACK_ROW_Y}px, 0 ${FLOOR_CLIP_Y}px, 100% ${FLOOR_CLIP_Y}px, 100% 100%, 0 100%);`,
    );
  });

  it('shows the back of the office at every height from lg, and the floor under the copy at every width', () => {
    // From lg the band is at least its content (hero-tall.css): the copy's top padding, the copy and the floor room
    // under the calls to action, so the stage shows from at most this far over its foot.
    const shortest = 80 + 352 + 316;
    expect(wide.height - shortest).toBe(BACK_ROW_Y);
    // The copy (badges to calls to action) stands at one place on the stage, inside the keep-clear column.
    expect(wide.clear.y).toBeLessThanOrEqual(wide.height - 316 - 352);
    expect(wide.clear.y + wide.clear.height).toBeGreaterThanOrEqual(wide.height - 316);
    expect(FLOOR_CLIP_Y).toBeGreaterThanOrEqual(wide.height - 316);
    // The headline, 792px wide at 72px type and centred, stays inside the column at every width.
    expect(wide.clear.x).toBeLessThanOrEqual(wide.width / 2 - 396 - 20);
    expect(wide.clear.x + wide.clear.width).toBeGreaterThanOrEqual(wide.width / 2 + 396 + 20);
  });
});

describe('the hero floor’s loop', () => {
  it.each(every)('closes %s %s’s loop in straight legs inside %ss', (_, __, ___, walker) => {
    expect(beatsLength(walker)).toBeLessThanOrEqual(LOOP_S);
    const segments = timelineOf(walker);
    expect(segments.at(-1)!.end).toBeCloseTo(LOOP_S);
    expect(segments.at(-1)!.walking).toBe(false);
    expect(segments.at(-1)!.to).toEqual(walker.from);
    for (const seg of segments)
      expect(seg.from.x === seg.to.x || seg.from.y === seg.to.y).toBe(true);
    expect(positionAt(walker, LOOP_S)).toEqual(walker.from);
  });

  it.each(FLOOR_MOTION.map((s) => [s.key, s] as const))(
    'talks in turn in each of the %s stage’s groups',
    (_, stage) => {
      const lines = stage.cast.flatMap((walker) =>
        bubbleRects(stage, walker).map((b) => ({ walker, ...b })),
      );
      for (const a of lines) {
        for (const b of lines) {
          if (a === b) continue;
          const near = Math.hypot(a.seg.to.x - b.seg.to.x, a.seg.to.y - b.seg.to.y) < 320;
          const together = a.seg.start < b.seg.end && b.seg.start < a.seg.end;
          // Two people near each other never speak at once, and no two bubbles ever cover each other.
          if (near) expect(together, `${a.seg.say} / ${b.seg.say}`).toBe(false);
          if (together) expect(overlaps(a.rect, b.rect), `${a.seg.say} / ${b.seg.say}`).toBe(false);
        }
      }
    },
  );

  it('says short, warm lines about meeting, never about workshops', () => {
    const lines = FLOOR_MOTION.flatMap((s) =>
      s.cast.flatMap((w) => timelineOf(w).flatMap((seg) => seg.say ?? [])),
    );
    expect(lines.length).toBeGreaterThan(8);
    for (const line of lines) {
      expect(line.length).toBeLessThanOrEqual(24);
      expect(line).not.toMatch(/workshop|retro|sticky|board|lorem/i);
    }
  });

  it.each(FLOOR_MOTION.map((s) => [s.key, s] as const))(
    'holds a settled %s frame for reduced motion: everyone stopped, every group talking',
    (_, stage) => {
      const talking = new Set<string>();
      for (const walker of stage.cast) {
        const seg = timelineOf(walker).find((s) => SETTLED_AT >= s.start && SETTLED_AT < s.end)!;
        expect(seg.walking, walker.name).toBe(false);
        if (seg.say) talking.add(walker.name);
      }
      // The floor paths are one walker at a desk at that moment, in no group.
      expect(talking.size).toBeGreaterThanOrEqual({ wide: 3, phone: 1, floor: 0 }[stage.key]);
    },
  );
});

describe('the hero floor’s stills', () => {
  const jo = FLOOR_STAGES[0]!.cast.find((w) => w.name === 'Jo')!;

  it('strides between the walk’s two frames and swings a wave', () => {
    const changes = stillChanges(jo);
    const walking = changes.filter((c) => c.still.startsWith('walk-left'));
    expect(walking.map((c) => c.still).slice(0, 3)).toEqual([
      'walk-left-0',
      'walk-left-1',
      'walk-left-0',
    ]);
    expect(changes.some((c) => c.still === 'wave-1')).toBe(true);
    expect(stillKeysOf(jo)).toEqual(
      expect.arrayContaining(['wave-0', 'wave-1', 'stand-up', 'walk-right-1']),
    );
  });

  it('sits a seated character the whole loop', () => {
    const priya = FLOOR_STAGES[0]!.cast.find((w) => w.name === 'Priya')!;
    expect(stillKeysOf(priya)).toEqual(['sit']);
    expect(stillChanges(priya)).toEqual([{ at: 0, still: 'sit' }]);
  });
});

describe('the hero floor’s keyframes', () => {
  const css = floorCss(FLOOR_MOTION);

  it('moves only transform and opacity', () => {
    const inKeyframes = [...css.matchAll(/@keyframes [^{]+\{([\s\S]*?)\n\}/g)].map((m) => m[1]!);
    expect(inKeyframes.length).toBeGreaterThan(10);
    for (const body of inKeyframes) {
      for (const prop of body.matchAll(/^\s+([a-z-]+):/gm))
        expect(['transform', 'opacity']).toContain(prop[1]);
    }
  });

  it('holds still under reduced motion', () => {
    const reduced = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'));
    for (const stage of FLOOR_MOTION) {
      for (const walker of stage.cast)
        expect(reduced).toContain(`.hsf-${stage.key}-${walker.name.toLowerCase()} {`);
    }
    expect(reduced).not.toContain('infinite');
  });

  it('plays a walk that ends the loop and a line said up to its end', () => {
    // A made-up stage: the loop's last beat a walk (no stop to stretch), a line held to the loop's end, and a line
    // leaning right off the copy.
    const walker: Walker = {
      name: 'Test',
      colour: '#000000',
      config: { gender: 'male', hair: 'short', clothing: 'tee', size: 'regular' },
      from: { x: 500, y: 300 },
      beats: [
        { stay: LOOP_S - 1, face: 'down', say: 'Hello there' },
        { to: { x: 500 + 90, y: 300 } },
      ],
    };
    const stage: FloorStage = {
      key: 'wide',
      width: 1000,
      height: 400,
      clear: { x: 400, y: 0, width: 140, height: 300 },
      furniture: [],
      cast: [walker],
    };
    const segments = timelineOf(walker);
    expect(segments.at(-1)!.walking).toBe(true);
    expect(segments.at(-1)!.end).toBeCloseTo(LOOP_S);
    // Centred, the bubble would cover the copy's column; it leans right, off it, its tail back towards the speaker.
    const box = bubbleBox(stage, walker, segments[0]!);
    expect(500 + box.left).toBeGreaterThanOrEqual(540);
    expect(box.tail).toBe(18);
    const css = floorCss([stage]);
    // Said from the loop's start: it rises in from 0%, with no hidden stop before it.
    expect(css).toContain('@keyframes hsf-wide-test-say-0 {\n  0% {\n    opacity: 0;');
    expect(css).not.toContain(
      '@keyframes hsf-wide-test-say-0 {\n  0% {\n    opacity: 0;\n    transform: translateY(6px);\n  }\n  0% {',
    );
  });

  it('measures an emoji as two letters', () => {
    expect(bubbleWidth('Hi ☕')).toBe(bubbleWidth('Hi xx') + 1);
  });
});
