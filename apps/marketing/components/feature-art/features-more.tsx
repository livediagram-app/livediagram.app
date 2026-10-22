// Feature illustrations: images, keyboard shortcuts and the session tools, split from ./features.
// Same stage and parts (./features-parts) as the rest of the features cards.

import type { ReactNode } from 'react';
import {
  Handles,
  PaletteTile,
  Photo,
  VoteSticky,
  KeyCap,
  MUTED,
  PANEL,
  PanelShadow,
  Pointer,
  STRONG,
  SUBTLE,
  to,
  VIEW,
} from './features-parts';
import { Frame, SKY } from './shared';

/** Images: a photo placed and selected on the canvas, and one dragged in from your gallery. */
export function ImagesArt() {
  return (
    <Frame canvas>
      <svg viewBox={VIEW} className="absolute inset-0 h-full w-full">
        <PanelShadow x={18} y={16} w={90} h={60} r={3} />
        <Photo x={18} y={16} w={90} h={60} id="fa-b-photo-a" />
        <Handles x={18} y={16} w={90} h={60} />

        {/* Where the dragged image lands: it arrives as an element of its own. */}
        <g className="fa-b-late">
          <PanelShadow x={124} y={38} w={50} h={36} r={3} />
          <Photo x={124} y={38} w={50} h={36} id="fa-b-photo-land" tint={1} />
        </g>

        {/* The gallery: every image you added, ready to reuse. */}
        <PanelShadow x={196} y={8} w={92} h={80} r={5} />
        <rect className={PANEL} x="196" y="8" width="92" height="80" rx="5" strokeWidth="1" />
        <text className={STRONG} x="204" y="20" fontSize="6.2" fontWeight="700">
          Your images
        </text>
        <Photo x={204} y={27} w={36} h={25} id="fa-b-photo-1" />
        <Photo x={244} y={27} w={36} h={25} id="fa-b-photo-2" tint={1} />
        <Photo x={204} y={56} w={36} h={25} id="fa-b-photo-3" tint={2} />
        <Photo x={244} y={56} w={36} h={25} id="fa-b-photo-4" tint={3} />
        <rect
          className="fa-b-pick"
          x="242.5"
          y="25.5"
          width="39"
          height="28"
          rx="3"
          fill="none"
          stroke={SKY}
          strokeWidth="1.4"
        />

        {/* The thumbnail in flight, under the pointer. */}
        <g className="fa-b-carry" style={to(-114, 14)}>
          <g opacity="0.85">
            <Photo x={244} y={27} w={36} h={25} id="fa-b-photo-fly" tint={1} />
          </g>
          <g transform="translate(270 44)">
            <Pointer color={SKY} />
          </g>
        </g>
      </svg>
    </Frame>
  );
}

/** Keyboard shortcuts: hold ⌘ and every tile in the palette shows the key that drops it. */
export function ShortcutsArt() {
  const tiles: [string, ReactNode][] = [
    ['V', <path key="v" d="M-3 -4 L-3 3.5 L-1 1.6 L0.6 4.6 L1.8 4 L0.3 1.1 L3 1 Z" />],
    ['R', <rect key="r" x="-4.5" y="-3.5" width="9" height="7" rx="1" />],
    ['O', <ellipse key="o" rx="4.8" ry="3.6" />],
    ['D', <path key="d" d="M0 -4.5 L4.5 0 L0 4.5 L-4.5 0 Z" />],
    ['T', <path key="t" d="M-3.5 -3.5 H3.5 M0 -3.5 V4" />],
    ['A', <path key="a" d="M-4 3 L3.5 -3 M0 -3 H3.5 V0.5" />],
    ['N', <path key="n" d="M-4 -4 H4 V1.5 L1.5 4 H-4 Z M1.5 4 V1.5 H4" />],
    ['P', <path key="p" d="M-3.5 4 L-3 1.5 L2.5 -4 L4 -2.5 L-1.5 3 Z" />],
  ];
  const stripX = 96;
  return (
    <Frame canvas>
      <svg viewBox={VIEW} className="absolute inset-0 h-full w-full">
        {/* ⌘, held down. */}
        <KeyCap x={24} y={32} w={26} label="⌘" pressed />
        <text className={SUBTLE} x="37" y="64" textAnchor="middle" fontSize="5.5" fontWeight="600">
          hold
        </text>
        <path
          className="stroke-slate-300 dark:stroke-slate-600"
          d="M58 41 H86"
          strokeWidth="1"
          strokeDasharray="2 2"
        />

        {/* The palette strip. */}
        <PanelShadow x={stripX} y={34} w={tiles.length * 22 + 8} h={22} r={5} />
        <rect
          className={PANEL}
          x={stripX}
          y="34"
          width={tiles.length * 22 + 8}
          height="22"
          rx="5"
          strokeWidth="1"
        />
        <rect
          x={stripX + 4 + 22}
          y="37"
          width="20"
          height="16"
          rx="3"
          fill={SKY}
          fillOpacity="0.14"
        />
        {tiles.map(([k, glyph], i) => (
          <PaletteTile key={k} x={stripX + 4 + i * 22} glyph={glyph} keyLabel={k} i={i} />
        ))}

        <text className={SUBTLE} x={stripX} y="72" fontSize="5.8">
          Undo
        </text>
        <text className={STRONG} x={stripX + 22} y="72" fontSize="5.8" fontWeight="700">
          ⌘ Z
        </text>
        <text className={SUBTLE} x={stripX + 50} y="72" fontSize="5.8">
          Duplicate
        </text>
        <text className={STRONG} x={stripX + 82} y="72" fontSize="5.8" fontWeight="700">
          ⌘ D
        </text>
        <text className={SUBTLE} x={stripX + 110} y="72" fontSize="5.8">
          All keys
        </text>
        <text className={STRONG} x={stripX + 139} y="72" fontSize="5.8" fontWeight="700">
          ?
        </text>
      </svg>
    </Frame>
  );
}

/** The session tools: a timer draining on the canvas and dot votes landing. */
export function SessionToolsArt() {
  return (
    <Frame canvas>
      <svg viewBox={VIEW} className="absolute inset-0 h-full w-full">
        {/* The timer element. */}
        <PanelShadow x={14} y={14} w={92} h={68} r={6} />
        <rect className={PANEL} x="14" y="14" width="92" height="68" rx="6" strokeWidth="1" />
        <g
          className="stroke-slate-500 dark:stroke-slate-400"
          fill="none"
          strokeWidth="1"
          transform="translate(23 24)"
        >
          <circle r="3.2" />
          <path d="M0 -1.6 V0 L1.2 0.9" strokeLinecap="round" />
        </g>
        <text className={SUBTLE} x="30" y="26.2" fontSize="6" fontWeight="600">
          Timer
        </text>
        <text
          className={STRONG}
          x="60"
          y="52"
          textAnchor="middle"
          fontSize="19"
          fontWeight="700"
          letterSpacing="-0.4"
        >
          04:12
        </text>
        <rect className={MUTED} x="24" y="60" width="72" height="3.5" rx="1.75" />
        <rect className="fa-b-drain" x="24" y="60" width="72" height="3.5" rx="1.75" fill={SKY} />
        <g transform="translate(52 73)">
          <circle r="5" fill={SKY} />
          <path d="M-1.4 -2 V2 M1.4 -2 V2" stroke="#fff" strokeWidth="1.1" strokeLinecap="round" />
        </g>
        <g
          transform="translate(68 73)"
          className="stroke-slate-500 dark:stroke-slate-400"
          fill="none"
          strokeWidth="1"
        >
          <circle r="5" className="fill-slate-100 stroke-none dark:fill-slate-800" />
          <path d="M1.8 -1.6 A2.4 2.4 0 1 0 2.4 0.6" strokeLinecap="round" />
          <path d="M2.4 -2.8 V-1.2 H0.8" strokeLinecap="round" strokeLinejoin="round" />
        </g>

        {/* Dot votes on the ideas. */}
        <VoteSticky x={124} fill="#fde68a" ink="#78350f" label="Ship v2" votes={4} i={0} />
        <VoteSticky x={174} fill="#fbcfe8" ink="#831843" label="Onboarding" votes={2} i={1} />
        <VoteSticky x={224} fill="#bbf7d0" ink="#14532d" label="Dark mode" votes={3} i={2} />
      </svg>
    </Frame>
  );
}
