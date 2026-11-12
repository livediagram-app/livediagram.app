'use client';

// The office dog over a Pet Bed (docs/specs/009-elements/blueprints/workday-pieces.md): asleep on its bed, or out
// at its spot in the bed's area, its legs pattering while it walks and a pat answered. WorkdayFace (WorkdayFaces.tsx)
// draws it; WorkdayFaces.tsx re-exports dogOffset.

import { useEffect, useRef, useState } from 'react';
import {
  msToNextLeg,
  petLeg,
  petLegAt,
  WORKDAY_TONES,
  type PetArea,
  type ShapeElement,
} from '@livehuddle/document';
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

export function PetDog({ element }: { element: ShapeElement }) {
  // Reduced motion sends a trotting dog straight back to sleep in its bed.
  const still = useReducedMotion();
  const area = usePetArea(element.id);
  const leg = usePetLeg(still);
  const at = still ? dogOffset(element, null, 0) : dogOffset(element, area, leg);
  // Which way it faces: the way it last trotted.
  const last = useRef(at.x);
  const [facingLeft, setFacingLeft] = useState(false);
  useEffect(() => {
    if (Math.abs(at.x - last.current) > 1) setFacingLeft(at.x < last.current);
    last.current = at.x;
  }, [at.x]);
  const [pat, setPat] = useState(0);
  useEffect(() => {
    if (pat === 0) return;
    const t = setTimeout(() => setPat(0), PAT_MS);
    return () => clearTimeout(t);
  }, [pat]);
  return (
    <div
      className="lh-pet-trot pointer-events-none absolute left-0 top-0"
      style={{
        width: DOG_W,
        height: DOG_H,
        transform: `translate(${at.x - DOG_FEET.x}px, ${at.y - DOG_FEET.y}px)`,
      }}
      data-pet={at.asleep ? 'asleep' : 'awake'}
    >
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
        <DogDrawing asleep={at.asleep} facingLeft={facingLeft} patted={pat > 0} />
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
  );
}

// A small sandy dog side on: body, head with a darker ear, snout and nose, legs, a red collar and a wagging tail. Asleep
// it curls up with its head on its paws and breathes.
function DogDrawing({
  asleep,
  facingLeft,
  patted,
}: {
  asleep: boolean;
  facingLeft: boolean;
  patted: boolean;
}) {
  const light = '#f0d2a8';
  return (
    <svg
      viewBox={`0 0 ${DOG_W} ${DOG_H}`}
      className="absolute inset-0 h-full w-full overflow-visible"
      aria-hidden
    >
      <g transform={facingLeft ? `translate(${DOG_W} 0) scale(-1 1)` : undefined}>
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
            <rect x={11} y={20} width={2.8} height={9} rx={1.2} fill={T.dogDeep} />
            <rect x={25} y={20} width={2.8} height={9} rx={1.2} fill={T.dogDeep} />
            <ellipse cx={20} cy={18} rx={11.5} ry={6.5} fill={T.dog} />
            <rect x={14.5} y={20} width={2.8} height={9.5} rx={1.2} fill={T.dog} />
            <rect x={28.5} y={20} width={2.8} height={9.5} rx={1.2} fill={T.dog} />
            <path d="M29 9.5L30.6 18" stroke="#ef4444" strokeWidth={1.8} strokeLinecap="round" />
            <circle cx={34} cy={11} r={6.2} fill={T.dog} />
            <ellipse cx={39.6} cy={13} rx={3.4} ry={2.5} fill={light} />
            <circle cx={42.4} cy={12.2} r={1.2} fill={T.dogNose} />
            <circle cx={35.6} cy={9.6} r={1} fill={T.dogNose} />
            <path d="M30 5.5Q27 12 30.5 15.5Q33 11 32 5.5Z" fill={T.dogDeep} />
          </>
        )}
      </g>
    </svg>
  );
}
