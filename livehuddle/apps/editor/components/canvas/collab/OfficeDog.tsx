'use client';

// The office dog over a Pet Bed (docs/specs/009-elements/blueprints/workday-pieces.md): asleep on its bed, or out
// at its spot in the bed's area, its legs pattering while it walks and a pat answered. WorkdayFace (WorkdayFaces.tsx)
// draws it; WorkdayFaces.tsx re-exports dogOffset.

import { memo, useEffect, useEffectEvent, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  msToNextWalk,
  petLeg,
  petWalkAt,
  PET_RADIUS,
  WORKDAY_TONES,
  type PetArea,
  type ShapeElement,
} from '@livehuddle/document';
import { buildNavGrid, findWalkPath } from '@livehuddle/avatar/pathing';
import type { FenceSegment } from '@livehuddle/avatar/collision';
import { useReducedMotion } from '@/lib/reduced-motion';
import { pieceControlProps } from '@/lib/piece-control';
import { track } from '@/lib/telemetry';
import { usePetArea } from '@/lib/office/useWorkdayPieces';
import { dogAtTime, dogTrot } from './dog-trot';

// --- The office dog -------------------------------------------------------------------------------------------------

const T = WORKDAY_TONES;

// The dog's drawing box, in canvas px, and where its feet are in it.
const DOG_W = 44;
const DOG_H = 32;
const DOG_FEET = { x: 22, y: 30 };
const PAT_MS = 1500;

/**
 * The walk the dog is on now, ticking once a walk (one timer per dog, every PET_WALK_MS: it walks one leg and rests
 * lying down through the others); never under reduced motion.
 */
function usePetWalk(still: boolean): number {
  const [leg, setLeg] = useState(() => petWalkAt(Date.now()));
  useEffect(() => {
    if (still) return;
    let t: ReturnType<typeof setTimeout>;
    const arm = () => {
      t = setTimeout(
        () => {
          setLeg(petWalkAt(Date.now()));
          arm();
        },
        msToNextWalk(Date.now()) + 20,
      );
    };
    arm();
    return () => clearTimeout(t);
  }, [still]);
  return leg;
}

/** Where the dog's feet go on a leg, relative to the bed's box: its spot, or its bed (null spot). */
export function dogOffset(
  bed: { id: string; x: number; y: number; width: number; height: number },
  area: PetArea | null,
  leg: number,
): { x: number; y: number; asleep: boolean } {
  const home = { x: bed.width / 2, y: bed.height * 0.72, asleep: true };
  if (!area) return home;
  const spot = petLeg(bed.id, leg, area);
  if (!spot) return home;
  return { x: spot.x - bed.x, y: spot.y - bed.y, asleep: false };
}

// The dog's pace on its way, in canvas px a second: a trot across its room takes a few seconds.
const DOG_SPEED = 70;
// How far its body keeps from a piece's box as it walks round it, in canvas px.
const DOG_REACH = 18;

// Where each bed's dog stands now, in canvas px, kept across a re-mount (the view going 3D or turning, a tab coming
// back), so it walks on from where it was and never jumps (the owner, 2026-11-18: "transport back to his bed or to
// random nearby places").
const dogAt = new Map<string, { x: number; y: number }>();

/** The pieces in the dog's area as lines it cannot cross: each box's four edges. */
function blockLines(area: PetArea | null): FenceSegment[] {
  const out: FenceSegment[] = [];
  for (const b of area?.blocks ?? []) {
    const tl = { x: b.x, y: b.y };
    const tr = { x: b.x + b.width, y: b.y };
    const br = { x: b.x + b.width, y: b.y + b.height };
    const bl = { x: b.x, y: b.y + b.height };
    out.push({ a: tl, b: tr }, { a: tr, b: br }, { a: br, b: bl }, { a: bl, b: tl });
  }
  return out;
}

export function PetDog({ element }: { element: ShapeElement }) {
  // Reduced motion sends a trotting dog straight back to sleep in its bed.
  const still = useReducedMotion();
  const area = usePetArea(element.id);
  const leg = usePetWalk(still);
  const at = still ? dogOffset(element, null, 0) : dogOffset(element, area, leg);
  // Where it is going, on the canvas.
  const goal = { x: element.x + at.x, y: element.y + at.y };
  // The pieces it walks round (pet-wander.ts PetArea's blocks), as a walking grid, built once per change to them.
  const grid = useMemo(() => {
    const lines = blockLines(area);
    return lines.length > 0 ? buildNavGrid(lines, DOG_REACH) : null;
  }, [area]);
  // Where it stands now: where it was (kept across a re-mount) when that is near its bed, else where it is going.
  const start = (() => {
    const was = dogAt.get(element.id);
    const near =
      was && Math.hypot(was.x - goal.x, was.y - goal.y) < 4 * (PET_RADIUS + element.width);
    return near ? was : goal;
  })();
  // Where it last came to rest, for whether it is lying down: set as it arrives, the walk's one render after setting
  // off. Its place on the floor is written to the drawing alone (`place`), never rendered.
  const [rested, setRested] = useState(start);
  // Which way it faces and whether it trots are marks on the drawing (`data-pet-left`, `data-pet-trot`), written
  // straight to it rather than rendered, so setting off and turning cost no render; its stylesheet does the rest
  // (app/workday-motion.css). The way it faces outlives a re-mount (the view going 3D).
  const facingLeft = useRef(false);
  const node = useRef<HTMLDivElement>(null);
  const mark = (name: 'data-pet-left' | 'data-pet-trot', on: boolean) =>
    node.current?.toggleAttribute(name, on);
  // The drawing's transform that stands its feet on a canvas point.
  const offsetOf = (p: { x: number; y: number }) =>
    `translate(${p.x - element.x - DOG_FEET.x}px, ${p.y - element.y - DOG_FEET.y}px)`;
  const place = (p: { x: number; y: number }) => {
    dogAt.set(element.id, p);
    const el = node.current;
    if (el) el.style.transform = offsetOf(p);
  };
  // On mount it faces the way it last did and stands where it was; after that the walk places it.
  const settle = useEffectEvent(() => {
    node.current?.toggleAttribute('data-pet-left', facingLeft.current);
    place(still ? goal : start);
  });
  useLayoutEffect(() => settle(), []);
  // Walk to the goal along a route round the pieces: one animation of the drawing's transform along the route
  // (dog-trot.ts), which the browser's compositor plays, so nothing runs on the page per frame while it trots
  // (docs/specs/008-canvas/canvas-performance.md "A still Space does nothing"); a render only when it arrives. An
  // effect event, so the walk reads the latest position and goal but starts only when the goal, the
  // pieces in the way or the bed change.
  const walk = useEffectEvent((): (() => void) | undefined => {
    const from = dogAt.get(element.id) ?? start;
    // With reduced motion it is simply where it is going (drawn there by the render below); nothing walks.
    if (still) {
      place(goal);
      return;
    }
    const path =
      Math.hypot(goal.x - from.x, goal.y - from.y) < 1 ? [] : findWalkPath(grid, from, goal);
    if (path.length === 0) return;
    const trot = dogTrot(from, path, DOG_SPEED, facingLeft.current);
    const end = path[path.length - 1]!;
    const el = node.current;
    // A browser that cannot animate an element (a test's DOM) puts it straight there.
    if (!el || typeof el.animate !== 'function') {
      place(end);
      setRested(end);
      return;
    }
    const anim = el.animate(
      trot.points.map((p, i) => ({ transform: offsetOf(p), offset: trot.offsets[i] })),
      { duration: trot.ms, easing: 'linear', fill: 'forwards' },
    );
    mark('data-pet-trot', true);
    const turn = (left: boolean) => {
      facingLeft.current = left;
      mark('data-pet-left', left);
    };
    const timers = trot.turns.map((t) =>
      t.atMs === 0 ? (turn(t.left), 0) : setTimeout(() => turn(t.left), t.atMs),
    );
    let done = false;
    anim.onfinish = () => {
      done = true;
      // The drawing's own transform takes over from the animation where it ended.
      place(end);
      anim.cancel();
      mark('data-pet-trot', false);
      // It lies down where it got to and rests until its next walk.
      setRested(end);
    };
    return () => {
      for (const t of timers) clearTimeout(t);
      if (done) return;
      // Stopped on its way (a new goal, the view changing): it stands where it had got to.
      const here = dogAtTime(trot, Number(anim.currentTime ?? 0));
      anim.cancel();
      mark('data-pet-trot', false);
      place(here);
    };
  });
  useEffect(() => walk(), [goal.x, goal.y, grid, still, element.x, element.y]);
  // Lying down once it has come to rest where it was going, at a spot or in its bed; out of its bed it lies on the floor.
  const asleep = still ? at.asleep : Math.hypot(rested.x - goal.x, rested.y - goal.y) < 1;
  const home = asleep && at.asleep;
  const [pat, setPat] = useState(0);
  useEffect(() => {
    if (pat === 0) return;
    const t = setTimeout(() => setPat(0), PAT_MS);
    return () => clearTimeout(t);
  }, [pat]);
  const dog = (
    <div
      ref={node}
      className="pointer-events-none absolute left-0 top-0"
      style={{ width: DOG_W, height: DOG_H }}
      data-pet={asleep ? 'asleep' : 'awake'}
    >
      <div className="absolute inset-0" data-pet-stand="">
        <button
          type="button"
          aria-label="Pat the Dog"
          className="pointer-events-auto absolute inset-0 cursor-pointer rounded-full focus-visible:outline-2 focus-visible:outline-sky-500"
          {...pieceControlProps}
          onClick={(e) => {
            e.stopPropagation();
            track('Canvas', 'Used', 'PatPet');
            setPat((n) => n + 1);
          }}
        >
          <DogDrawing asleep={asleep} patted={pat > 0} />
        </button>
        {pat > 0 ? (
          <span
            key={pat}
            aria-hidden
            className="lh-pet-heart pointer-events-none absolute -top-2 left-1/2 text-[13px] leading-none text-rose-500"
            style={{ transform: 'translate(-50%, -14px)' }}
            data-pet-heart=""
          >
            ♥
          </span>
        ) : null}
      </div>
    </div>
  );
  // Out of its bed, the dog trots on the floor: in the 3D view its layer lies back down under the standing bed and
  // the dog stands up about its own feet (docs/specs/008-canvas/3d-view.md "The office dog"; app/space-3d.css). The
  // wrapper is always there, only its mark changes, so setting off or getting home never re-mounts the dog.
  return (
    <div className="pointer-events-none absolute inset-0" data-pet-floor={home ? undefined : ''}>
      {dog}
    </div>
  );
}

// A small sandy dog side on: body, head with a darker ear, snout and nose, legs, a red collar and a wagging tail. Asleep
// it curls up with its head on its paws and breathes.
//
// Drawn in layers, back to front, in its 44 x 32 box (one px a unit): what moves (the tail, each leg, the body's bob
// and a sleeping breath) is a box of its own between the still drawing's layers, so its motion is a transform on that
// box, which the browser's compositor plays with no work on the page each frame (docs/specs/008-canvas/
// canvas-performance.md "A still Space does nothing"; app/workday-motion.css).
// Memoised: a new leg re-renders the dog's place, never its drawing.
const DogDrawing = memo(function DogDrawing({
  asleep,
  patted,
}: {
  asleep: boolean;
  patted: boolean;
}) {
  const light = '#f0d2a8';
  // The tail wags fast for a pat; else a few wags as it stops, and all the way while it trots (its stylesheet, on the
  // dog's `data-pet-trot` mark). Keyed, so a pat and its end each wag afresh.
  const tail = patted ? 'fast' : 'calm';
  return (
    <div aria-hidden className="absolute inset-0" data-pet-drawing="">
      <div className="lh-pet-bob absolute inset-0">
        {asleep ? (
          <>
            <Layer>
              <ellipse cx={22} cy={30} rx={15} ry={2} fill="#000" opacity={0.14} />
              <path
                d="M8 26C4 22 8 16 14 17"
                stroke={T.dog}
                strokeWidth={2.6}
                fill="none"
                strokeLinecap="round"
              />
            </Layer>
            {/* The breath swells the body up from the floor: its foot (21, 29.5) holds still. */}
            <div
              className="lh-pet-breathe absolute inset-0"
              style={{ transformOrigin: '21px 29.5px' }}
            >
              <Layer>
                <ellipse cx={21} cy={23} rx={13} ry={6.5} fill={T.dog} />
              </Layer>
            </div>
            <Layer>
              <ellipse cx={32} cy={25} rx={6} ry={4.6} fill={T.dog} />
              <ellipse cx={36.5} cy={26.2} rx={3} ry={2.2} fill={light} />
              <circle cx={39.2} cy={25.6} r={1.1} fill={T.dogNose} />
              <path d="M29 21.5Q27 26 30 28Q32 25 31.5 21.5Z" fill={T.dogDeep} />
              <path
                d="M32.5 23.8q1.4 0.9 2.8 0"
                stroke={T.dogNose}
                strokeWidth={0.8}
                fill="none"
                strokeLinecap="round"
              />
              <text x={36} y={14} fontSize={6} fontWeight={700} fill="#64748b">
                z
              </text>
            </Layer>
          </>
        ) : (
          <>
            <Layer>
              <ellipse cx={22} cy={30} rx={13} ry={2} fill="#000" opacity={0.14} />
            </Layer>
            {/* The tail wags about its root (5.7, 16), keyed on what it is doing so each stop and each pat wags
                afresh. */}
            <div
              key={tail}
              className={`lh-pet-tail absolute inset-0${patted ? ' lh-pet-tail-fast' : ''}`}
              style={{ transformOrigin: '5.7px 16px' }}
              data-pet-tail={tail}
            >
              <Layer>
                <path
                  d="M10 16Q4.5 11 6 5"
                  stroke={T.dog}
                  strokeWidth={2.6}
                  fill="none"
                  strokeLinecap="round"
                />
              </Layer>
            </div>
            {/* The far legs, then the body, then the near legs: each diagonal pair steps together. */}
            <Leg x={11} height={9} fill={T.dogDeep} pair="a" />
            <Leg x={25} height={9} fill={T.dogDeep} pair="b" />
            <Layer>
              <ellipse cx={20} cy={18} rx={11.5} ry={6.5} fill={T.dog} />
            </Layer>
            <Leg x={14.5} height={9.5} fill={T.dog} pair="b" />
            <Leg x={28.5} height={9.5} fill={T.dog} pair="a" />
            <Layer>
              <path d="M29 9.5L30.6 18" stroke="#ef4444" strokeWidth={1.8} strokeLinecap="round" />
              <circle cx={34} cy={11} r={6.2} fill={T.dog} />
              <ellipse cx={39.6} cy={13} rx={3.4} ry={2.5} fill={light} />
              <circle cx={42.4} cy={12.2} r={1.2} fill={T.dogNose} />
              <circle cx={35.6} cy={9.6} r={1} fill={T.dogNose} />
              <path d="M30 5.5Q27 12 30.5 15.5Q33 11 32 5.5Z" fill={T.dogDeep} />
            </Layer>
          </>
        )}
      </div>
    </div>
  );
});

// One still layer of the drawing, over the whole box.
function Layer({ children }: { children: React.ReactNode }) {
  return (
    <svg
      viewBox={`0 0 ${DOG_W} ${DOG_H}`}
      className="absolute inset-0 h-full w-full overflow-visible"
      aria-hidden
    >
      {children}
    </svg>
  );
}

// A leg, hanging from its hip at (x, 20): its own box, so its step (while the dog trots) swings it there.
function Leg({
  x,
  height,
  fill,
  pair,
}: {
  x: number;
  height: number;
  fill: string;
  pair: 'a' | 'b';
}) {
  return (
    <span
      className={`lh-pet-leg lh-pet-leg-${pair} absolute block`}
      style={{
        left: x,
        top: 20,
        width: 2.8,
        height,
        borderRadius: 1.2,
        background: fill,
        transformOrigin: '50% 0',
      }}
      data-pet-leg={pair}
    />
  );
}
