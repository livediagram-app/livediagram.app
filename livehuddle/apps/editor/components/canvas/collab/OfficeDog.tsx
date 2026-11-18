'use client';

// The office dog over a Pet Bed (docs/specs/009-elements/blueprints/workday-pieces.md): asleep on its bed, or out
// at its spot in the bed's area, its legs pattering while it walks and a pat answered. WorkdayFace (WorkdayFaces.tsx)
// draws it; WorkdayFaces.tsx re-exports dogOffset.

import { useEffect, useEffectEvent, useMemo, useRef, useState } from 'react';
import {
  msToNextLeg,
  petLeg,
  petLegAt,
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

// --- The office dog -------------------------------------------------------------------------------------------------

const T = WORKDAY_TONES;

// The dog's drawing box, in canvas px, and where its feet are in it.
const DOG_W = 44;
const DOG_H = 32;
const DOG_FEET = { x: 22, y: 30 };
const PAT_MS = 1500;

/** The leg the dog is on now, ticking once a leg (one timer per dog); never under reduced motion. */
function usePetLeg(still: boolean): number {
  const [leg, setLeg] = useState(() => petLegAt(Date.now()));
  useEffect(() => {
    if (still) return;
    let t: ReturnType<typeof setTimeout>;
    const arm = () => {
      t = setTimeout(
        () => {
          setLeg(petLegAt(Date.now()));
          arm();
        },
        msToNextLeg(Date.now()) + 20,
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
  const leg = usePetLeg(still);
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
  const [pos, setPos] = useState(start);
  const [facingLeft, setFacingLeft] = useState(false);
  const [trotting, setTrotting] = useState(false);
  const node = useRef<HTMLDivElement>(null);
  const place = (p: { x: number; y: number }) => {
    dogAt.set(element.id, p);
    const el = node.current;
    if (el)
      el.style.transform = `translate(${p.x - element.x - DOG_FEET.x}px, ${p.y - element.y - DOG_FEET.y}px)`;
  };
  // Walk to the goal along a route round the pieces, a frame at a time, writing the position straight to the drawing
  // (no render a frame); a render only when it sets off, turns or arrives.
  // An effect event, so the walk reads the latest position and goal but starts only when the goal, the pieces in the
  // way or the bed change.
  const walk = useEffectEvent((): (() => void) | undefined => {
    const from = dogAt.get(element.id) ?? pos;
    // With reduced motion it is simply where it is going (drawn there by the render below); nothing walks.
    if (still) {
      place(goal);
      return;
    }
    const path =
      Math.hypot(goal.x - from.x, goal.y - from.y) < 1 ? [] : findWalkPath(grid, from, goal);
    if (path.length === 0) return;
    let here = from;
    let next = 0;
    let last = performance.now();
    let frame = 0;
    let left: boolean | null = null;
    let started = false;
    const step = (now: number) => {
      // It sets off on the first frame, so the effect itself sets no state.
      if (!started) {
        started = true;
        setTrotting(true);
      }
      let budget = (DOG_SPEED * Math.min(100, now - last)) / 1000;
      last = now;
      while (budget > 0 && next < path.length) {
        const to = path[next]!;
        const d = Math.hypot(to.x - here.x, to.y - here.y);
        if (Math.abs(to.x - here.x) > 0.5) {
          const goingLeft = to.x < here.x;
          if (goingLeft !== left) {
            left = goingLeft;
            setFacingLeft(goingLeft);
          }
        }
        if (d <= budget) {
          here = to;
          next += 1;
          budget -= d;
        } else {
          here = {
            x: here.x + ((to.x - here.x) * budget) / d,
            y: here.y + ((to.y - here.y) * budget) / d,
          };
          budget = 0;
        }
      }
      place(here);
      if (next < path.length) frame = requestAnimationFrame(step);
      else {
        setPos(here);
        setTrotting(false);
      }
    };
    frame = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(frame);
      setPos(dogAt.get(element.id) ?? here);
    };
  });
  // A new goal, a moved bed or new pieces in the way start a fresh walk from where it stands.
  useEffect(() => walk(), [goal.x, goal.y, grid, still, element.x, element.y]);
  // Asleep only once home: on its way back it trots, awake.
  const asleep = still
    ? at.asleep
    : at.asleep && !trotting && Math.hypot(pos.x - goal.x, pos.y - goal.y) < 1;
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
      style={{
        width: DOG_W,
        height: DOG_H,
        transform: `translate(${(still ? goal : pos).x - element.x - DOG_FEET.x}px, ${(still ? goal : pos).y - element.y - DOG_FEET.y}px)`,
      }}
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
          <DogDrawing
            asleep={asleep}
            facingLeft={facingLeft}
            patted={pat > 0}
            trotting={trotting && !still}
          />
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
    <div className="pointer-events-none absolute inset-0" data-pet-floor={asleep ? undefined : ''}>
      {dog}
    </div>
  );
}

// A small sandy dog side on: body, head with a darker ear, snout and nose, legs, a red collar and a wagging tail. Asleep
// it curls up with its head on its paws and breathes.
function DogDrawing({
  asleep,
  facingLeft,
  patted,
  trotting,
}: {
  asleep: boolean;
  facingLeft: boolean;
  patted: boolean;
  // On its way: the legs step in diagonal pairs and the body bobs (app/workday-motion.css).
  trotting: boolean;
}) {
  const light = '#f0d2a8';
  const leg = (pair: 'a' | 'b') => (trotting ? `lh-pet-leg lh-pet-leg-${pair}` : undefined);
  return (
    <svg
      viewBox={`0 0 ${DOG_W} ${DOG_H}`}
      className="absolute inset-0 h-full w-full overflow-visible"
      aria-hidden
    >
      <g transform={facingLeft ? `translate(${DOG_W} 0) scale(-1 1)` : undefined}>
        {/* The bob is CSS on a group of its own: on the mirrored group it would replace the mirror. */}
        <g className={trotting ? 'lh-pet-bob' : undefined}>
          <ellipse cx={22} cy={30} rx={asleep ? 15 : 13} ry={2} fill="#000" opacity={0.14} />
          {asleep ? (
            <>
              <path
                d="M8 26C4 22 8 16 14 17"
                stroke={T.dog}
                strokeWidth={2.6}
                fill="none"
                strokeLinecap="round"
              />
              <ellipse className="lh-pet-breathe" cx={21} cy={23} rx={13} ry={6.5} fill={T.dog} />
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
            </>
          ) : (
            <>
              <path
                className={`lh-pet-tail${patted ? ' lh-pet-tail-fast' : ''}`}
                d="M10 16Q4.5 11 6 5"
                stroke={T.dog}
                strokeWidth={2.6}
                fill="none"
                strokeLinecap="round"
              />
              {/* The far legs, then the body, then the near legs: each diagonal pair steps together. */}
              <rect
                className={leg('a')}
                x={11}
                y={20}
                width={2.8}
                height={9}
                rx={1.2}
                fill={T.dogDeep}
              />
              <rect
                className={leg('b')}
                x={25}
                y={20}
                width={2.8}
                height={9}
                rx={1.2}
                fill={T.dogDeep}
              />
              <ellipse cx={20} cy={18} rx={11.5} ry={6.5} fill={T.dog} />
              <rect
                className={leg('b')}
                x={14.5}
                y={20}
                width={2.8}
                height={9.5}
                rx={1.2}
                fill={T.dog}
              />
              <rect
                className={leg('a')}
                x={28.5}
                y={20}
                width={2.8}
                height={9.5}
                rx={1.2}
                fill={T.dog}
              />
              <path d="M29 9.5L30.6 18" stroke="#ef4444" strokeWidth={1.8} strokeLinecap="round" />
              <circle cx={34} cy={11} r={6.2} fill={T.dog} />
              <ellipse cx={39.6} cy={13} rx={3.4} ry={2.5} fill={light} />
              <circle cx={42.4} cy={12.2} r={1.2} fill={T.dogNose} />
              <circle cx={35.6} cy={9.6} r={1} fill={T.dogNose} />
              <path d="M30 5.5Q27 12 30.5 15.5Q33 11 32 5.5Z" fill={T.dogDeep} />
            </>
          )}
        </g>
      </g>
    </svg>
  );
}
