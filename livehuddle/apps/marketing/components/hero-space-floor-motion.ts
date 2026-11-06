// The landing hero's Space (docs/specs/019-marketing/marketing-site.md "Hero"): the cast's walks and stops
// (hero-space-floor-cast.ts) as a timeline, the stills each character shows, where each bubble stands, and the
// keyframes that play it all on CSS alone. Pure: lib/hero-space-floor.test.tsx writes the keyframes to
// app/hero-scenes/space-floor.generated.css, and HeroSpaceStage.tsx reads the same timeline to draw the stage.
//
// Each character is two moving boxes: the walker, translated along its path, and a film strip of its stills inside a
// one-still window, translated to the still it shows (a stride frame, a standing turn, a wave). Both move by
// transform alone, so the browser composites them without repainting; a bubble fades on opacity and rises on
// transform.

import type { AvatarFacing } from '@liveworkspace/avatar/walk';
import {
  LOOP_S,
  SETTLED_AT,
  STRIDE_S,
  WALK_SPEED,
  WAVE_SWING_S,
  type FloorStage,
  type Point,
  type Rect,
  type Walker,
} from './hero-space-floor-cast';

/** One still the strip holds: a stride frame, a standing turn, a wave's two swings or the seated pose. */
export type StillKey =
  `walk-${AvatarFacing}-${0 | 1}` | `stand-${AvatarFacing}` | `wave-${0 | 1}` | 'sit';

/** One stretch of a character's loop: a straight walk, or a stop. Times in seconds from the loop's start. */
export type Segment = {
  start: number;
  end: number;
  from: Point;
  to: Point;
  facing: AvatarFacing;
  walking: boolean;
  say?: string;
  wave?: true;
};

const facingOf = (dx: number, dy: number): AvatarFacing =>
  Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up';

/** The character's beats in turn, as long as they take. */
function beatTimeline(walker: Walker): Segment[] {
  const segments: Segment[] = [];
  let at = 0;
  let here = walker.from;
  for (const beat of walker.beats) {
    if ('to' in beat) {
      const dx = beat.to.x - here.x;
      const dy = beat.to.y - here.y;
      const duration = Math.hypot(dx, dy) / WALK_SPEED;
      segments.push({
        start: at,
        end: at + duration,
        from: here,
        to: beat.to,
        facing: facingOf(dx, dy),
        walking: true,
      });
      at += duration;
      here = beat.to;
    } else {
      segments.push({
        start: at,
        end: at + beat.stay,
        from: here,
        to: here,
        facing: beat.face,
        walking: false,
        ...(beat.say ? { say: beat.say } : {}),
        ...(beat.wave ? { wave: true as const } : {}),
      });
      at += beat.stay;
    }
  }
  return segments;
}

/** How long the character's beats take before the last stop stretches (the loop must hold them). */
export function beatsLength(walker: Walker): number {
  return beatTimeline(walker).at(-1)?.end ?? 0;
}

/** The character's loop, beat by beat; the last stop stretches to fill the loop. */
export function timelineOf(walker: Walker): Segment[] {
  const segments = beatTimeline(walker);
  const last = segments.at(-1);
  if (last && !last.walking && last.end < LOOP_S) last.end = LOOP_S;
  return segments;
}

/** Where the character stands at a moment of the loop. */
export function positionAt(walker: Walker, t: number): Point {
  const segments = timelineOf(walker);
  const seg = segments.find((s) => t >= s.start && t < s.end) ?? segments[segments.length - 1]!;
  const k = seg.end > seg.start ? (t - seg.start) / (seg.end - seg.start) : 0;
  return {
    x: seg.from.x + (seg.to.x - seg.from.x) * k,
    y: seg.from.y + (seg.to.y - seg.from.y) * k,
  };
}

/** The still a stop shows. */
function stopStill(walker: Walker, seg: Segment): StillKey {
  if (walker.seated) return 'sit';
  if (seg.wave) return 'wave-0';
  return `stand-${seg.facing}`;
}

/** Every still the character shows, in strip order, so the sheet and the strip hold exactly those. */
export function stillKeysOf(walker: Walker): StillKey[] {
  const keys: StillKey[] = [];
  const add = (key: StillKey) => {
    if (!keys.includes(key)) keys.push(key);
  };
  for (const seg of timelineOf(walker)) {
    if (seg.walking) {
      add(`walk-${seg.facing}-0`);
      add(`walk-${seg.facing}-1`);
    } else if (seg.wave && !walker.seated) {
      add('wave-0');
      add('wave-1');
    } else {
      add(stopStill(walker, seg));
    }
  }
  return keys;
}

/** A still's id in the sprite sheet: the same character on both stages shares its stills. */
export function stillId(walker: Walker, key: StillKey): string {
  return `${walker.name.toLowerCase()}-${key}`;
}

/** The still the strip shows from each moment it changes: strides alternate, waves swing. */
export function stillChanges(walker: Walker): { at: number; still: StillKey }[] {
  const out: { at: number; still: StillKey }[] = [];
  for (const seg of timelineOf(walker)) {
    if (seg.walking || (seg.wave && !walker.seated)) {
      const step = seg.walking ? STRIDE_S : WAVE_SWING_S;
      let i = 0;
      for (let at = seg.start; at < seg.end - 1e-6; at += step, i += 1) {
        const frame = (i % 2) as 0 | 1;
        out.push({ at, still: seg.walking ? `walk-${seg.facing}-${frame}` : `wave-${frame}` });
      }
    } else {
      out.push({ at: seg.start, still: stopStill(walker, seg) });
    }
  }
  // Drop repeats, so a run of stops facing one way is one keyframe.
  return out.filter((c, i) => i === 0 || c.still !== out[i - 1]!.still);
}

// The size of one still in the strip, in stage px: the sprite's box at FLOOR_AVATAR_SCALE without its jump
// headroom (lib/hero-space-floor.test.tsx crops each symbol to it), and where the feet stand inside it.
export const FRAME = { width: 78, height: 90, feetX: 39, feetY: 85.2 } as const;
// The drawn figure's height above its feet (24 grid rows of 3 px), less a seated figure's drop.
export const FIGURE_HEIGHT = 72;
export const SEATED_DROP = 15;

// A bubble: 13px text at about 7 px a character (an emoji about two), padded, with the name line under it.
export const BUBBLE_HEIGHT = 44;
const BUBBLE_GAP = 10;
export function bubbleWidth(text: string): number {
  return Math.round(
    [...text].reduce((w, ch) => w + ((ch.codePointAt(0) ?? 0) > 0x2000 ? 15 : 7), 0) + 28,
  );
}

// How far in from a leaning bubble's edge its tail points down at the speaker: as far to one side as the tail goes.
export const BUBBLE_TAIL_INSET = 18;

/**
 * Where a bubble stands over its speaker, relative to the speaker's feet: centred over the head, or leaning to the
 * walker's `lean` side, or off the copy's side when centring would put it in the keep-clear column. `tail` is the
 * tail's x within the bubble.
 */
export function bubbleBox(
  stage: FloorStage,
  walker: Walker,
  seg: Segment,
): { left: number; top: number; width: number; tail: number } {
  const width = bubbleWidth(seg.say ?? '');
  const head = FIGURE_HEIGHT - (walker.seated ? SEATED_DROP : 0);
  const top = -head - BUBBLE_GAP - BUBBLE_HEIGHT;
  const feet = seg.to;
  let left =
    walker.lean === 'left'
      ? BUBBLE_TAIL_INSET - width
      : walker.lean === 'right'
        ? -BUBBLE_TAIL_INSET
        : -width / 2;
  const { clear } = stage;
  const overlaps = (l: number) =>
    feet.x + l < clear.x + clear.width &&
    feet.x + l + width > clear.x &&
    feet.y + top < clear.y + clear.height &&
    feet.y + top + BUBBLE_HEIGHT > clear.y;
  if (overlaps(left))
    left =
      feet.x < clear.x + clear.width / 2
        ? clear.x - feet.x - width - 4
        : clear.x + clear.width - feet.x + 4;
  const tail = Math.min(width - BUBBLE_TAIL_INSET, Math.max(BUBBLE_TAIL_INSET, -left));
  return { left: Math.round(left), top: Math.round(top), width, tail: Math.round(tail) };
}

/** The box a character covers at a point: its drawn figure, standing on its feet. */
export function figureRect(walker: Walker, at: Point): Rect {
  const height = FIGURE_HEIGHT - (walker.seated ? SEATED_DROP : 0);
  return { x: at.x - 24, y: at.y - height, width: 48, height };
}

// --- The keyframes ----------------------------------------------------------------------------------------

const pct = (t: number) => `${+((t / LOOP_S) * 100).toFixed(3)}%`;
const px = (n: number) => `${+n.toFixed(2)}px`;

/** The class names a character's boxes wear, unique per stage. */
export function floorClass(stage: FloorStage, walker: Walker, part?: string): string {
  return `hsf-${stage.key}-${walker.name.toLowerCase()}${part ? `-${part}` : ''}`;
}

function rule(selector: string, body: string[]): string {
  return `${selector} {\n${body.map((line) => `  ${line}\n`).join('')}}\n`;
}

function keyframes(name: string, stops: { at: string; body: string[] }[]): string {
  const inner = stops
    .map(({ at, body }) => `  ${at} {\n${body.map((line) => `    ${line}\n`).join('')}  }\n`)
    .join('');
  return `@keyframes ${name} {\n${inner}}\n`;
}

/** The walker's moves: its position at each segment's ends, linear between. */
function moveCss(stage: FloorStage, walker: Walker): string {
  const segments = timelineOf(walker);
  const name = floorClass(stage, walker);
  const stops: { at: string; body: string[] }[] = [];
  const seen = new Set<string>();
  const push = (t: number, p: Point) => {
    const at = pct(t);
    if (seen.has(at)) return;
    seen.add(at);
    stops.push({ at, body: [`transform: translate(${px(p.x)}, ${px(p.y)});`] });
  };
  for (const seg of segments) {
    push(seg.start, seg.from);
    push(seg.end, seg.to);
  }
  if (segments.every((s) => !s.walking)) {
    // A character who never walks needs no animation, only its place.
    return rule(`.${name}`, [`transform: translate(${px(walker.from.x)}, ${px(walker.from.y)});`]);
  }
  return (
    rule(`.${name}`, [
      `transform: translate(${px(walker.from.x)}, ${px(walker.from.y)});`,
      `animation: ${name} ${LOOP_S}s linear infinite;`,
    ]) +
    '\n' +
    keyframes(name, stops)
  );
}

/** The strip's moves: which still shows from each change, held (step-end) until the next. */
function stripCss(stage: FloorStage, walker: Walker): string {
  const keys = stillKeysOf(walker);
  const changes = stillChanges(walker);
  const name = floorClass(stage, walker, 'strip');
  const offset = (still: StillKey) =>
    `transform: translateX(${px(-keys.indexOf(still) * FRAME.width)});`;
  const first = changes[0]!.still;
  if (changes.length === 1) return rule(`.${name}`, [offset(first)]);
  const stops = changes.map((c) => ({ at: pct(c.at), body: [offset(c.still)] }));
  stops.push({ at: '100%', body: [offset(changes[changes.length - 1]!.still)] });
  return (
    rule(`.${name}`, [offset(first), `animation: ${name} ${LOOP_S}s step-end infinite;`]) +
    '\n' +
    keyframes(name, stops)
  );
}

/** Each line's bubble: rises in over a quarter second, holds, and drifts off as the stop ends. */
function bubbleCss(stage: FloorStage, walker: Walker): string {
  const out: string[] = [];
  timelineOf(walker)
    .filter((seg) => seg.say)
    .forEach((seg, i) => {
      const name = floorClass(stage, walker, `say-${i}`);
      const fade = 0.25;
      const stops: { at: string; body: string[] }[] = [];
      const hidden = (y: number) => ['opacity: 0;', `transform: translateY(${px(y)});`];
      const shown = ['opacity: 1;', 'transform: translateY(0px);'];
      if (seg.start > 0) stops.push({ at: '0%', body: hidden(6) });
      stops.push({ at: pct(seg.start), body: hidden(6) });
      stops.push({ at: pct(seg.start + fade), body: shown });
      stops.push({ at: pct(seg.end - fade), body: shown });
      stops.push({ at: pct(seg.end), body: hidden(-4) });
      if (seg.end < LOOP_S) stops.push({ at: '100%', body: hidden(-4) });
      out.push(
        rule(`.${name}`, [`animation: ${name} ${LOOP_S}s linear infinite;`]) +
          '\n' +
          keyframes(name, stops),
      );
    });
  return out.join('\n');
}

/** Reduced motion: the loop held at SETTLED_AT, nothing moving. */
function settledCss(stage: FloorStage, walker: Walker): string[] {
  const keys = stillKeysOf(walker);
  const at = positionAt(walker, SETTLED_AT);
  const segments = timelineOf(walker);
  const seg = segments.find((s) => SETTLED_AT >= s.start && SETTLED_AT < s.end)!;
  const still: StillKey = seg.walking ? `walk-${seg.facing}-0` : stopStill(walker, seg);
  const out = [
    rule(`.${floorClass(stage, walker)}`, [
      'animation: none;',
      `transform: translate(${px(at.x)}, ${px(at.y)});`,
    ]),
    rule(`.${floorClass(stage, walker, 'strip')}`, [
      'animation: none;',
      `transform: translateX(${px(-keys.indexOf(still) * FRAME.width)});`,
    ]),
  ];
  segments
    .filter((s) => s.say)
    .forEach((s, i) => {
      const showing = s === seg;
      out.push(
        rule(`.${floorClass(stage, walker, `say-${i}`)}`, [
          'animation: none;',
          `opacity: ${showing ? 1 : 0};`,
          'transform: none;',
        ]),
      );
    });
  return out;
}

const HEADER = `/* Generated by lib/hero-space-floor.test.tsx from components/hero-space-floor-cast.ts (HERO_SPACE_WRITE=1 writes it
   afresh); edit the cast, never this file. The landing hero's Space (docs/specs/019-marketing/marketing-site.md
   "Hero"): every character's walk, the still its strip shows and its bubbles, on one ${LOOP_S}s loop. */
`;

/** The whole stylesheet: every stage's characters, then the reduced-motion frame. */
export function floorCss(stages: readonly FloorStage[]): string {
  const parts: string[] = [];
  const settled: string[] = [];
  for (const stage of stages) {
    for (const walker of stage.cast) {
      parts.push(moveCss(stage, walker), stripCss(stage, walker));
      const bubbles = bubbleCss(stage, walker);
      if (bubbles) parts.push(bubbles);
      settled.push(...settledCss(stage, walker));
    }
  }
  const media = `@media (prefers-reduced-motion: reduce) {\n${settled
    .join('')
    .split('\n')
    .map((line) => (line ? `  ${line}` : line))
    .join('\n')}}\n`;
  return `${HEADER}\n${parts.join('\n')}\n${media}`;
}
