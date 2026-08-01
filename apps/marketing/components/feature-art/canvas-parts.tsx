// The small drawing parts the canvas feature illustrations are built from:
// a labelled presence cursor, a pixel walker, and the glyphs the scenes hang
// on their rows and pills.
//
// Split out of canvas.tsx, where these sat between the illustrations that use
// them — you read TabFoldersArt, then a FolderIcon, then PresenceArt. Keeping
// the parts here leaves that file a uniform list of complete scenes.
//
// Canvas-specific on purpose: ./shared holds what every feature-art file uses
// (Frame and the colour constants), and none of these are wanted elsewhere.

import { BLUE_STROKE } from './shared';

export function Cursor({ color, label }: { color: string; label?: string }) {
  return (
    <span className="relative">
      <svg width="13" height="13" viewBox="0 0 16 16" fill={color} stroke="white" strokeWidth="1">
        <path d="M2 1 L14 8 L8 9 L11 14 L9 15 L6 10 L2 14 Z" />
      </svg>
      {label ? (
        <span
          className="absolute -top-2.5 left-3 whitespace-nowrap rounded px-1 py-0.5 text-[8px] font-semibold text-white"
          style={{ backgroundColor: color }}
        >
          {label}
        </span>
      ) : null}
    </span>
  );
}

export function FolderIcon({ muted = false }: { muted?: boolean }) {
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 16 16"
      fill={muted ? '#cbd5e1' : '#7dd3fc'}
      stroke={muted ? '#94a3b8' : BLUE_STROKE}
      strokeWidth="1"
    >
      <path d="M1.5 4 L6 4 L7.5 5.5 L14.5 5.5 L14.5 13 L1.5 13 Z" strokeLinejoin="round" />
    </svg>
  );
}

export function DiagramIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="#94a3b8" strokeWidth="1.4">
      <rect x="2" y="2" width="12" height="12" rx="2" />
      <line x1="5" y1="6" x2="11" y2="6" />
      <line x1="5" y1="9" x2="9" y2="9" />
    </svg>
  );
}

export function LinkIcon() {
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 16 16"
      fill="none"
      stroke={BLUE_STROKE}
      strokeWidth="1.5"
    >
      <path
        d="M6.5 9.5 L9.5 6.5 M7 4.5 L9 2.5 a3 3 0 0 1 4 4 L11 8.5 M9 11.5 L7 13.5 a3 3 0 0 1 -4 -4 L5 7.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function RevertIcon() {
  return (
    <svg
      width="8"
      height="8"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
    >
      <path d="M3 8 a5 5 0 1 1 1.5 3.6" strokeLinecap="round" />
      <path d="M3 4 L3 8 L7 8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function TeamIcon() {
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 16 16"
      fill="none"
      stroke={BLUE_STROKE}
      strokeWidth="1.5"
    >
      <circle cx="5.5" cy="5" r="2.2" />
      <circle cx="11" cy="6" r="1.7" />
      <path d="M1.5 13 a4 4 0 0 1 8 0 M10 13 a3.5 3.5 0 0 1 4.5 -3.3" strokeLinecap="round" />
    </svg>
  );
}

export function ClockIcon() {
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 16 16"
      fill="none"
      stroke={BLUE_STROKE}
      strokeWidth="1.5"
    >
      <circle cx="8" cy="8" r="6" />
      <path d="M8 4.5 L8 8 L10.5 9.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Avatar mode (spec/101): a little pixel character stands in the diagram and
// walks to whatever the presenter is talking about. Two characters here — the
// presenter's and a peer's, in a second colour — so the art carries the "you
// can all walk around together" half of the feature. Pure rects on a coarse
// grid, matching the editor's sprite look.
export function PixelWalker({
  x,
  shirt,
  flag = false,
}: {
  x: number;
  shirt: string;
  flag?: boolean;
}) {
  const s = 2.2; // pixel size
  const p = (n: number) => n * s;
  return (
    <g transform={`translate(${x} 34)`} shapeRendering="crispEdges">
      <ellipse cx={p(8)} cy={p(23)} rx={p(4.6)} ry={p(1.1)} fill="rgba(15,23,42,0.22)" />
      {/* legs + shoes */}
      <rect x={p(5)} y={p(15)} width={p(3)} height={p(6)} fill="#3f4c63" />
      <rect x={p(9)} y={p(15)} width={p(3)} height={p(6)} fill="#3f4c63" />
      <rect x={p(5)} y={p(21)} width={p(3)} height={p(2)} fill="#1e293b" />
      <rect x={p(9)} y={p(21)} width={p(3)} height={p(2)} fill="#1e293b" />
      {/* torso + sleeves in the participant's colour */}
      <rect x={p(4)} y={p(9)} width={p(8)} height={p(6)} fill={shirt} />
      <rect x={p(2)} y={p(9)} width={p(2)} height={p(4)} fill={shirt} />
      <rect x={p(12)} y={p(9)} width={p(2)} height={p(4)} fill={shirt} />
      {/* head, hair, eyes */}
      <rect x={p(4)} y={p(1)} width={p(8)} height={p(8)} fill="#f4c99b" />
      <rect x={p(3)} y={0} width={p(10)} height={p(3)} fill="#6b4423" />
      <rect x={p(6)} y={p(5)} width={s} height={s} fill="#243044" />
      <rect x={p(9)} y={p(5)} width={s} height={s} fill="#243044" />
      {flag ? (
        <>
          <rect x={p(12)} y={p(-3)} width={s} height={p(12)} fill="#b8845a" />
          <rect x={p(13)} y={p(-3)} width={p(5)} height={p(3)} fill="#f43f5e" />
        </>
      ) : null}
    </g>
  );
}

export function SlidersIcon() {
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 16 16"
      fill="none"
      stroke={BLUE_STROKE}
      strokeWidth="1.5"
    >
      <path d="M2 4 H14 M2 8 H14 M2 12 H14" strokeLinecap="round" />
      <circle cx="5" cy="4" r="1.6" fill="white" />
      <circle cx="11" cy="8" r="1.6" fill="white" />
      <circle cx="7" cy="12" r="1.6" fill="white" />
    </svg>
  );
}
