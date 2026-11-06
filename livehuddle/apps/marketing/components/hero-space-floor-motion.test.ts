import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { createShape } from '@livehuddle/document';
import {
  BACK_ROW_MIN_BAND,
  BACK_ROW_MIN_TOP,
  BACK_ROW_SPAN,
  FLOOR_CLIP_Y,
  FLOOR_FURNITURE_SCALE,
  FLOOR_MOTION,
  FLOOR_ONLY,
  FLOOR_STAGES,
  LOOP_S,
  HERO_HEADER,
  SETTLED_AT,
  backRowTop,
  onBackRow,
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

// The floor under the calls to action (Hero.tsx FLOOR_ROOM) and the copy's height from lg, badges to calls to action.
const FLOOR_ROOM = 316;
const LG_COPY = 352;
// The narrowest window that shows the wide stage's floor (Tailwind's sm); below it the phone's stage takes over.
const SM = 640;

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

/** The name chip under a character's feet: about 7 px a letter, its dot and padding. */
function chipRect(walker: Walker, at: { x: number; y: number }): Rect {
  const width = walker.name.length * 7 + 28;
  return { x: at.x - width / 2, y: at.y + 4, width, height: 18 };
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
    const from = chipRect(walker, seg.from);
    const to = chipRect(walker, seg.to);
    const chip = {
      x: Math.min(from.x, to.x),
      y: Math.max(from.y, to.y),
      width: Math.abs(seg.to.x - seg.from.x) + from.width,
      height: from.height,
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

  it('stands the back of the office wholly in its span, players, chips and bubbles too', () => {
    const wide = FLOOR_STAGES.find((s) => s.key === 'wide')!;
    const back = [
      ...furnitureRects(wide),
      ...wide.cast.flatMap((walker) => [
        ...walkerRects(walker),
        ...bubbleRects(wide, walker).map((b) => b.rect),
      ]),
    ].filter((rect) => rect.y < BACK_ROW_SPAN.foot);
    expect(back.length).toBeGreaterThan(10);
    for (const rect of back) {
      expect(rect.y).toBeGreaterThanOrEqual(BACK_ROW_SPAN.top);
      expect(rect.y + rect.height).toBeLessThanOrEqual(BACK_ROW_SPAN.foot);
    }
    // Its players stand still, so nobody walks across the layer's edge.
    for (const walker of wide.cast.filter(onBackRow))
      expect(timelineOf(walker).every((seg) => !seg.walking)).toBe(true);
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

// Every bubble stands on clear floor (Work Tracker #587): never over a piece of furniture (a rug lies flat under it, so
// it may), another character or their name chip, at any moment it shows; and nobody walking past covers someone
// else's chip. Checked on each set of walkers a window shows together: the wide stage from lg, its floor paths below
// lg (over the same furniture) and the phone's stage.
describe('the hero floor’s bubbles stand clear', () => {
  const wide = FLOOR_STAGES.find((s) => s.key === 'wide')!;
  const phone = FLOOR_STAGES.find((s) => s.key === 'phone')!;
  const twin = (walker: Walker) => FLOOR_ONLY.cast.find((w) => w.name === walker.name);
  const scenes = [
    { name: 'wide', furniture: wide, cast: wide.cast.map((w) => ({ stage: wide, walker: w })) },
    {
      name: 'below lg',
      furniture: wide,
      cast: wide.cast.map((w) =>
        twin(w) ? { stage: FLOOR_ONLY, walker: twin(w)! } : { stage: wide, walker: w },
      ),
    },
    { name: 'phone', furniture: phone, cast: phone.cast.map((w) => ({ stage: phone, walker: w })) },
  ];
  const STEP = 0.1;

  it.each(scenes)('keeps every $name bubble off furniture, people and chips', (scene) => {
    const rects = furnitureRects(scene.furniture);
    const pieces = scene.furniture.furniture
      .map((piece, i) => ({ kind: piece.kind, rect: rects[i]! }))
      .filter((piece) => piece.kind !== 'rug');
    expect(pieces.length).toBeGreaterThan(2);
    const wrong = new Set<string>();
    for (const { stage, walker } of scene.cast) {
      for (const { seg, rect } of bubbleRects(stage, walker)) {
        for (const piece of pieces)
          if (overlaps(rect, piece.rect))
            wrong.add(`${walker.name}’s “${seg.say}” over the ${piece.kind}`);
        for (let t = seg.start; t <= seg.end; t += STEP)
          for (const other of scene.cast) {
            if (other.walker.name === walker.name) continue;
            const at = positionAt(other.walker, t);
            if (overlaps(rect, figureRect(other.walker, at)))
              wrong.add(`${walker.name}’s “${seg.say}” over ${other.walker.name}`);
            if (overlaps(rect, chipRect(other.walker, at)))
              wrong.add(`${walker.name}’s “${seg.say}” over ${other.walker.name}’s chip`);
          }
      }
    }
    for (let t = 0; t <= LOOP_S; t += STEP)
      for (const a of scene.cast)
        for (const b of scene.cast) {
          if (a === b) continue;
          if (
            overlaps(
              figureRect(a.walker, positionAt(a.walker, t)),
              chipRect(b.walker, positionAt(b.walker, t)),
            )
          )
            wrong.add(`${a.walker.name} over ${b.walker.name}’s chip at ${t.toFixed(1)}s`);
        }
    expect([...wrong]).toEqual([]);
  });
});

// Between sm and lg the wide stage shows its floor alone, clipped above FLOOR_CLIP_Y (Work Tracker #440): a walker
// who crossed that line would vanish mid-walk, so each one shown there stays wholly on one side of it all loop, and a
// walker whose own path crosses it walks its floor path instead (FLOOR_ONLY). The back row's players are on a layer
// of their own (below).
describe('the hero floor between sm and lg', () => {
  const wide = FLOOR_STAGES.find((s) => s.key === 'wide')!;
  const shownBelowLg = wide.cast
    .filter((walker) => !onBackRow(walker))
    .map((walker) => FLOOR_ONLY.cast.find((twin) => twin.name === walker.name) ?? walker);
  const STEP = 0.05;
  const moments = Array.from({ length: Math.round(LOOP_S / STEP) + 1 }, (_, i) => i * STEP);
  const side = (rect: Rect) =>
    rect.y >= FLOOR_CLIP_Y ? 'floor' : rect.y + rect.height <= FLOOR_CLIP_Y ? 'clipped' : 'cut';

  it.each(shownBelowLg.map((walker) => [walker.name, walker] as const))(
    'keeps %s wholly on the floor or wholly clipped away at every moment of the loop',
    (_, walker) => {
      const sides = new Set(moments.map((t) => side(figureRect(walker, positionAt(walker, t)))));
      expect([...sides]).not.toContain('cut');
      expect(sides.size, `${walker.name} crosses the clip line`).toBe(1);
      // A line said on the floor is said wholly on it, never cut by the clip, and inside the middle of the stage the
      // narrowest of these windows (sm, 640px) shows, so no line runs off the window's edge.
      const stage = FLOOR_ONLY.cast.includes(walker) ? FLOOR_ONLY : wide;
      const shown = { x: (wide.width - SM) / 2, y: 0, width: SM, height: wide.height };
      if (sides.has('floor'))
        for (const { seg, rect } of bubbleRects(stage, walker)) {
          expect(side(rect)).toBe('floor');
          expect(
            inside(rect, shown),
            `${walker.name}’s “${seg.say}” runs off a ${SM}px window`,
          ).toBe(true);
        }
    },
  );

  it('gives a floor path to exactly the walkers whose own path crosses the line', () => {
    const crossing = wide.cast.filter(
      (walker) =>
        !onBackRow(walker) &&
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

  it('clips the stage on the lines the paths and the back row keep to', () => {
    const css = readFileSync(
      new URL('../app/hero-scenes/space-floor.css', import.meta.url),
      'utf8',
    );
    expect(css).toContain(`clip-path: inset(${BACK_ROW_SPAN.foot}px 0 0 0);`);
    expect(css).toContain(`clip-path: inset(${FLOOR_CLIP_Y}px 0 0 0);`);
    // The back row's layer, as backRowTop places it: at the band's foot less its place on the stage, or
    // BACK_ROW_MIN_TOP under the band's top; hidden in a window under the band it needs plus the header.
    expect(css).toContain(
      `top: max(calc(100% - ${wide.height - BACK_ROW_SPAN.top}px), ${BACK_ROW_MIN_TOP}px);`,
    );
    expect(css).toContain(
      `@media (max-height: ${BACK_ROW_MIN_BAND + HERO_HEADER - 1 + 0.98}px) {\n  .hsf-back {\n    display: none;`,
    );
  });

  it('stands the copy at one place on the stage, inside the keep-clear column', () => {
    expect(wide.clear.y).toBeLessThanOrEqual(wide.height - FLOOR_ROOM - LG_COPY);
    expect(wide.clear.y + wide.clear.height).toBeGreaterThanOrEqual(wide.height - FLOOR_ROOM);
    expect(FLOOR_CLIP_Y).toBeGreaterThanOrEqual(wide.height - FLOOR_ROOM);
    // The headline, 792px wide at 72px type and centred, stays inside the column at every width.
    expect(wide.clear.x).toBeLessThanOrEqual(wide.width / 2 - 396 - 20);
    expect(wide.clear.x + wide.clear.width).toBeGreaterThanOrEqual(wide.width / 2 + 396 + 20);
  });
});

// The back of the office is a layer of its own (Work Tracker #505's rework): a window shows it whole, its players'
// heads and bubbles too, or not at all, and never over the copy or the wings, at every height a window comes in.
describe('the hero’s back row at every window height', () => {
  const wide = FLOOR_STAGES.find((s) => s.key === 'wide')!;
  const GAP = 12;
  const grow = (r: Rect): Rect => ({
    x: r.x - GAP,
    y: r.y - GAP,
    width: r.width + 2 * GAP,
    height: r.height + 2 * GAP,
  });
  const back = [
    ...furnitureRects(wide).filter((r) => r.y < BACK_ROW_SPAN.foot),
    ...wide.cast
      .filter(onBackRow)
      .flatMap((w) => [...walkerRects(w), ...bubbleRects(wide, w).map((b) => b.rect)]),
  ];
  // What the stage shows from lg: every piece, figure and bubble under the back row (the wings and the floor).
  const stageLg = [
    ...furnitureRects(wide).filter((r) => r.y >= BACK_ROW_SPAN.foot),
    ...wide.cast
      .filter((w) => !onBackRow(w))
      .flatMap((w) => [...walkerRects(w), ...bubbleRects(wide, w).map((b) => b.rect)]),
  ];
  // Below lg the stage shows only its floor.
  const stageBelowLg = stageLg.filter((r) => r.y >= FLOOR_CLIP_Y);
  // The copy's height, badges to calls to action, and its top padding: one line of headline from lg, and from sm a
  // smaller headline over a subhead of three or four lines.
  const layouts = [
    { name: 'lg', padding: 80, copy: [LG_COPY], stage: stageLg },
    { name: 'sm', padding: 64, copy: [322, 350, 380], stage: stageBelowLg },
  ];
  const heights = Array.from({ length: 1440 - 640 + 1 }, (_, i) => 640 + i);

  it.each(layouts)(
    'shows it whole or not at all, clear of the copy and the stage ($name)',
    (layout) => {
      // Collected and asserted once: a million expects would cost seconds.
      const wrong: string[] = [];
      for (const copy of layout.copy) {
        // Every height a window comes in, checked once per band height it makes.
        const seen = new Set<number>();
        for (const height of heights) {
          const band = Math.max(
            layout.padding + copy + FLOOR_ROOM,
            Math.min(height - HERO_HEADER, wide.height),
          );
          const top = backRowTop(band);
          // The CSS hides the layer by the window's height; backRowTop by the band's: the two agree.
          if ((top === null) !== height - HERO_HEADER < BACK_ROW_MIN_BAND)
            wrong.push(`${height}: shown by one rule, hidden by the other`);
          if (top === null || seen.has(band)) continue;
          seen.add(band);
          const at = `${layout.name}, copy ${copy}, window ${height}`;
          const lift = wide.height - band;
          const copyRect = {
            x: wide.clear.x,
            y: band - FLOOR_ROOM - copy,
            width: wide.clear.width,
            height: copy,
          };
          const shown = layout.stage.map((r) => ({ ...r, y: r.y - lift }));
          for (const r of back) {
            const inBand = { ...r, y: top + r.y - BACK_ROW_SPAN.top };
            // Whole: everything on it, bubbles included, under the band's top.
            if (inBand.y < BACK_ROW_MIN_TOP) wrong.push(`${at}: cut at the top`);
            // Clear of the copy and of whatever the stage shows there.
            const placed = grow(inBand);
            if (overlaps(placed, copyRect)) wrong.push(`${at}: over the copy`);
            if (shown.some((s) => overlaps(placed, s))) wrong.push(`${at}: over the stage`);
          }
        }
      }
      expect(wrong.slice(0, 5)).toEqual([]);
    },
  );

  it('shows it at 1000 to 1200px and on a full cap, at its place on the stage when the band is tall enough', () => {
    for (let height = 1000; height <= 1200; height++)
      expect(backRowTop(Math.min(height - HERO_HEADER, wide.height)), `${height}`).not.toBeNull();
    expect(backRowTop(wide.height)).toBe(BACK_ROW_SPAN.top);
    expect(backRowTop(1128)).toBe(1128 - wide.height + BACK_ROW_SPAN.top);
    expect(backRowTop(888)).toBe(BACK_ROW_MIN_TOP);
    expect(backRowTop(BACK_ROW_MIN_BAND - 1)).toBeNull();
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
    // A walker leaning its bubbles stands it off its head to that side, the tail at the near edge.
    const leaning = (lean: 'left' | 'right') =>
      bubbleBox(
        { ...stage, clear: { x: 0, y: 0, width: 0, height: 0 } },
        { ...walker, lean },
        segments[0]!,
      );
    const width = bubbleWidth('Hello there');
    expect(leaning('left')).toMatchObject({ left: 18 - width, tail: width - 18 });
    expect(leaning('right')).toMatchObject({ left: -18, tail: 18 });
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
