// Feature illustrations for the editor's own surfaces: the tab bar, copying a tab, undo, locking,
// shift-drag, layers, images, keyboard shortcuts and the session tools. Each is a small,
// faithful mock of what the editor draws, on the Default scheme's canvas (--art-*) with panel
// chrome that has a light and a dark half, moving on a shared 6s loop (fa-b-* in
// app/feature-art-animations.css). Under reduced motion every scene shows its finished state.
//
// Split from FeatureArt.tsx; see ./shared for Frame and the colour constants, ./features-parts
// for the pointer, window, node, arrow and key cap the scenes are drawn from.

import type { CSSProperties, ReactNode } from 'react';
import {
  Arrow,
  Eye,
  Handles,
  PaletteTile,
  Photo,
  Plane,
  RoadmapBars,
  TabPill,
  UndoCluster,
  VoteSticky,
  WindowTab,
  KeyCap,
  MiniWindow,
  MUTED,
  Node,
  PANEL,
  PanelShadow,
  Pointer,
  STRONG,
  SUBTLE,
} from './features-parts';
import { Frame, PINK, SKY } from './shared';

// Every scene in this file is drawn on a 300 by 96 stage, the card's art frame at its usual width.
const VIEW = '0 0 300 96';

// A CSS custom property set for a moving piece's destination (fa-b-go, fa-b-drag, fa-b-carry).
const to = (x: number, y: number, extra?: Record<string, string>) =>
  ({ '--tx': `${x}px`, '--ty': `${y}px`, ...extra }) as CSSProperties;

// The tab accents the editor's colour-coded tabs take, legible on its light and dark bars.
const TAB = {
  sky: '#0ea5e9',
  violet: '#8b5cf6',
  emerald: '#10b981',
  amber: '#f59e0b',
  rose: '#f43f5e',
  indigo: '#6366f1',
};

const VIOLET = '#8b5cf6';
const AMBER = '#f59e0b';
const EMERALD = '#10b981';

/** The tab bar: colour-coded tabs, the people on the active one, and a new tab added with +. */
export function UnlimitedTabsArt() {
  return (
    <Frame canvas>
      <svg viewBox={VIEW} className="absolute inset-0 h-full w-full">
        {/* The tab's canvas above the bar: a small system diagram. */}
        <Node x={58} y={14} w={46} h={18} label="Gateway" />
        <Node x={128} y={14} w={42} h={18} label="Auth" />
        <Node x={194} y={14} w={46} h={18} label="Billing" />
        <Arrow d="M104 23 H122" head={[127, 23, 0]} />
        <Arrow d="M170 23 H188" head={[193, 23, 0]} />

        {/* The bottom tab bar. */}
        <rect className="fill-white dark:fill-slate-900" x="0" y="63" width="300" height="33" />
        <path className="stroke-slate-200 dark:stroke-slate-700" d="M0 63.5 H300" strokeWidth="1" />
        <text className={SUBTLE} x="8" y="81.3" fontSize="5.5" fontWeight="700" letterSpacing="0.5">
          TABS
        </text>
        <TabPill x={26} name="Overview" color={TAB.sky} w={72} active />
        {/* The people on the active tab, as its presence stack. */}
        <circle cx="80.5" cy="79" r="4.2" fill={TAB.sky} stroke="#fff" strokeWidth="1" />
        <circle cx="87" cy="79" r="4.2" fill={PINK} stroke="#fff" strokeWidth="1" />
        <TabPill x={102} name="Backend" color={TAB.violet} w={46} />
        <TabPill x={148} name="Data" color={TAB.emerald} w={34} />
        <TabPill x={180} name="Auth" color={TAB.amber} w={34} />
        <TabPill x={212} name="API" color={TAB.rose} w={30} />
        <TabPill x={242} name="Billing" color={TAB.indigo} w={38} className="fa-b-late" />

        {/* The + that adds a tab, pressed as the pointer reaches it. */}
        <circle className="fa-b-press" cx="286" cy="79" r="7" fill={SKY} fillOpacity="0.18" />
        <path
          className="stroke-slate-500 dark:stroke-slate-400"
          d="M283 79 H289 M286 76 V82"
          strokeWidth="1.3"
          strokeLinecap="round"
        />

        <g className="fa-b-go" style={to(76, 34)}>
          <g transform="translate(212 46)">
            <Pointer color={PINK} />
          </g>
        </g>
      </svg>
    </Frame>
  );
}

/** A tab copied into another document: the Roadmap tab lifts out of one and lands in the next. */
export function TabCopyArt() {
  return (
    <Frame>
      <svg viewBox={VIEW} className="absolute inset-0 h-full w-full">
        <MiniWindow x={14} y={8} w={112} h={80} title="Platform">
          <RoadmapBars x={26} y={26} />
          <path
            className="stroke-slate-100 dark:stroke-slate-800"
            d="M14 74.5 H126"
            strokeWidth="1"
          />
          <WindowTab x={18} y={77} name="Roadmap" color={SKY} active />
          <WindowTab x={58} y={77} name="Risks" color={AMBER} />
        </MiniWindow>

        <MiniWindow x={174} y={8} w={112} h={80} title="Q3 planning">
          {/* Its own tab's content, until the copied tab takes the stage. */}
          <g className="fa-b-early">
            <rect x="188" y="26" width="26" height="22" rx="1.5" fill="#fde68a" />
            <rect x="218" y="30" width="26" height="22" rx="1.5" fill="#fbcfe8" />
            <rect x="248" y="26" width="26" height="22" rx="1.5" fill="#bbf7d0" />
            <rect x="192" y="32" width="16" height="2" rx="1" fill="#92400e" fillOpacity="0.45" />
            <rect x="222" y="36" width="16" height="2" rx="1" fill="#9d174d" fillOpacity="0.45" />
            <rect x="252" y="32" width="16" height="2" rx="1" fill="#166534" fillOpacity="0.45" />
          </g>
          <g className="fa-b-late">
            <RoadmapBars x={186} y={26} />
          </g>
          <path
            className="stroke-slate-100 dark:stroke-slate-800"
            d="M174 74.5 H286"
            strokeWidth="1"
          />
          <WindowTab x={178} y={77} name="Kickoff" color={EMERALD} />
          <WindowTab x={212} y={77} name="Roadmap" color={SKY} active className="fa-b-late" />
        </MiniWindow>

        {/* The route the copy takes. */}
        <path
          className="stroke-slate-300 dark:stroke-slate-600"
          d="M132 48 C 146 38, 154 38, 168 48"
          fill="none"
          strokeWidth="1"
          strokeDasharray="2.5 2.5"
        />
        <path className="fill-slate-300 dark:fill-slate-600" d="M168 48 l-4.6 -0.4 l2.6 -3.6 z" />

        {/* The copy in flight: the tab, carried from one window's foot to the other's. */}
        <g className="fa-b-carry" style={to(194, 0)}>
          <PanelShadow x={16} y={74} w={42} h={13} r={3.5} />
          <rect
            className="fill-white dark:fill-slate-800"
            x="16"
            y="74"
            width="42"
            height="13"
            rx="3.5"
            stroke={SKY}
            strokeWidth="1"
          />
          <circle cx="23" cy="80.5" r="1.8" fill={SKY} />
          <text x="27" y="82.6" fontSize="5.6" fontWeight="700" fill={SKY}>
            Roadmap
          </text>
        </g>
      </svg>
    </Frame>
  );
}

/** Undo that is yours alone: your move steps back, a teammate's edit beside it stays. */
export function UndoRedoArt() {
  return (
    <Frame canvas>
      <svg viewBox={VIEW} className="absolute inset-0 h-full w-full">
        {/* A teammate's node, edited by them, untouched by your undo. */}
        <g>
          <rect
            className="fill-pink-50 stroke-pink-400 dark:fill-pink-500/15 dark:stroke-pink-400"
            x="34"
            y="52"
            width="58"
            height="22"
            rx="4"
            strokeWidth="1.6"
          />
          <text
            className="fill-pink-700 dark:fill-pink-200"
            x="63"
            y="65.3"
            textAnchor="middle"
            fontSize="6.5"
            fontWeight="600"
          >
            Pricing
          </text>
          <g transform="translate(86 68)">
            <Pointer color={PINK} name="JR" />
          </g>
        </g>

        {/* Your node: dragged across, then undone back to where it was. */}
        <path
          className="stroke-(--art-ink-stroke)"
          d="M60 14 h50 a4 4 0 0 1 4 4 v14 a4 4 0 0 1 -4 4 h-50 a4 4 0 0 1 -4 -4 v-14 a4 4 0 0 1 4 -4 z"
          fill="none"
          strokeWidth="1"
          strokeDasharray="2.5 2.5"
          strokeOpacity="0.5"
        />
        <g className="fa-b-drag" style={to(92, 6)}>
          <Node x={56} y={14} w={58} h={22} label="Checkout" />
        </g>

        <UndoCluster x={242} y={62} />
        <g className="fa-b-undo" style={to(92, 6, { '--ux': '156px', '--uy': '40px' })}>
          <g transform="translate(96 30)">
            <Pointer color={SKY} name="You" />
          </g>
        </g>
        <g className="fa-b-tip">
          <rect
            className="fill-slate-800 dark:fill-slate-100"
            x="212"
            y="46"
            width="50"
            height="11"
            rx="3"
          />
          <text
            className="fill-white dark:fill-slate-900"
            x="237"
            y="53.4"
            textAnchor="middle"
            fontSize="5.5"
            fontWeight="600"
          >
            Undo ⌘Z
          </text>
        </g>
      </svg>
    </Frame>
  );
}

/** Lock: a finished frame stays put. A drag on it only shakes it, and a tip says why. */
export function LockArt() {
  return (
    <Frame canvas>
      <svg viewBox={VIEW} className="absolute inset-0 h-full w-full">
        {/* A loose sticky beside it, still free to move. */}
        <g>
          <rect x="26" y="30" width="38" height="36" rx="2" fill="#fde68a" />
          <rect x="31" y="38" width="26" height="2.4" rx="1.2" fill="#92400e" fillOpacity="0.45" />
          <rect x="31" y="44" width="20" height="2.4" rx="1.2" fill="#92400e" fillOpacity="0.45" />
        </g>

        {/* The locked frame and its contents, which a drag only nudges. */}
        <g className="fa-b-shake">
          <rect
            className="stroke-(--art-ink-stroke)"
            x="96"
            y="16"
            width="148"
            height="66"
            rx="5"
            fill="none"
            strokeWidth="1.1"
            strokeDasharray="4 3"
          />
          <text className="fill-(--art-ink-text)" x="102" y="25" fontSize="6" fontWeight="700">
            Checkout · final
          </text>
          <Node x={108} y={38} w={46} h={20} label="Cart" />
          <Node x={186} y={38} w={46} h={20} label="Pay" />
          <Arrow d="M154 48 H180" head={[185, 48, 0]} />
          {/* The padlock badge a locked element carries. */}
          <g transform="translate(236 10)">
            <circle
              className="fill-white stroke-slate-300 dark:fill-slate-800 dark:stroke-slate-600"
              r="8"
              strokeWidth="1"
            />
            <rect
              className="fill-slate-600 dark:fill-slate-200"
              x="-3.6"
              y="-1"
              width="7.2"
              height="5.6"
              rx="1.2"
            />
            <path
              className="stroke-slate-600 dark:stroke-slate-200"
              d="M-2.2 -1 V-2.8 a2.2 2.2 0 0 1 4.4 0 V-1"
              fill="none"
              strokeWidth="1.2"
            />
          </g>
        </g>

        <g className="fa-b-go" style={to(-56, -34)}>
          <g transform="translate(200 84)">
            <Pointer color={SKY} />
          </g>
        </g>
        <g className="fa-b-tip">
          <rect
            className="fill-slate-800 dark:fill-slate-100"
            x="150"
            y="63"
            width="84"
            height="12"
            rx="3"
          />
          <text
            className="fill-white dark:fill-slate-900"
            x="192"
            y="71"
            textAnchor="middle"
            fontSize="5.8"
            fontWeight="600"
          >
            Locked: unlock to edit
          </text>
        </g>
      </svg>
    </Frame>
  );
}

// Shift-drag duplicate (docs/specs/008-canvas/shift-drag-duplicate.md): the original pair stays
// put while a translucent copy, arrow and all, follows the pointer and lands solid.
export function DragDuplicateArt() {
  return (
    <Frame canvas>
      <svg viewBox={VIEW} className="absolute inset-0 h-full w-full">
        {/* The selection: two nodes and the arrow between them. */}
        <rect
          className="stroke-(--art-ink-stroke)"
          x="40"
          y="14"
          width="104"
          height="34"
          rx="4"
          fill="none"
          strokeWidth="0.9"
          strokeDasharray="3 2"
        />
        <Node x={46} y={20} w={38} h={22} label="Order" />
        <Node x={102} y={20} w={38} h={22} label="Invoice" />
        <Arrow d="M84 31 H96" head={[101, 31, 0]} />

        {/* The copy, carried by the pointer and dropped. */}
        <g className="fa-b-dup" style={to(116, 36)}>
          <Node x={46} y={20} w={38} h={22} label="Order" />
          <Node x={102} y={20} w={38} h={22} label="Invoice" />
          <Arrow d="M84 31 H96" head={[101, 31, 0]} />
          <g transform="translate(124 38)">
            <Pointer color={SKY} />
          </g>
        </g>

        {/* Shift, held for the length of the drag. */}
        <KeyCap x={14} y={68} w={34} label="⇧ Shift" pressed />
      </svg>
    </Frame>
  );
}

/** Layers: a stack of planes and the panel that runs it; hiding Notes lifts its plane away. */
export function LayersArt() {
  const rows = [
    { name: 'Notes', swatch: AMBER, hides: true },
    { name: 'Flow', swatch: SKY, selected: true },
    { name: 'Background', swatch: '#94a3b8', locked: true },
  ];
  return (
    <Frame canvas>
      <svg viewBox={VIEW} className="absolute inset-0 h-full w-full">
        <Plane
          y={66}
          fill="fill-slate-100 dark:fill-slate-800"
          stroke="stroke-slate-300 dark:stroke-slate-600"
        >
          <rect
            className="fill-slate-300 dark:fill-slate-600"
            x="-10"
            y="-4"
            width="20"
            height="8"
            rx="1.5"
            transform="skewY(0)"
          />
        </Plane>
        <Plane y={48} fill="fill-sky-50/90 dark:fill-sky-950/80" stroke="stroke-sky-400">
          <rect x="-24" y="-4" width="16" height="8" rx="1.5" fill={SKY} />
          <rect x="6" y="-4" width="16" height="8" rx="1.5" fill={SKY} fillOpacity="0.55" />
          <path d="M-8 0 H6" stroke={SKY} strokeWidth="1.2" />
        </Plane>
        <Plane
          y={30}
          fill="fill-amber-50/90 dark:fill-amber-950/70"
          stroke="stroke-amber-400"
          className="fa-b-early"
        >
          <rect x="-8" y="-5" width="14" height="10" rx="1" fill="#fcd34d" />
        </Plane>

        {/* The Layers panel. */}
        <PanelShadow x={166} y={10} w={118} h={76} r={5} />
        <rect className={PANEL} x="166" y="10" width="118" height="76" rx="5" strokeWidth="1" />
        <text className={STRONG} x="174" y="22.5" fontSize="6.5" fontWeight="700">
          Layers
        </text>
        <path
          className="stroke-slate-400"
          d="M273 19.5 H279 M276 16.5 V22.5"
          strokeWidth="1.1"
          strokeLinecap="round"
        />
        {rows.map((row, i) => {
          const y = 30 + i * 18;
          return (
            <g key={row.name}>
              {row.selected ? (
                <rect
                  x="169"
                  y={y - 1}
                  width="112"
                  height="16"
                  rx="3"
                  fill={SKY}
                  fillOpacity="0.12"
                />
              ) : null}
              <rect
                className="fill-white stroke-slate-200 dark:fill-slate-800 dark:stroke-slate-600"
                x="174"
                y={y + 1.5}
                width="18"
                height="11"
                rx="1.5"
                strokeWidth="0.8"
              />
              <rect x="178" y={y + 4.5} width="10" height="5" rx="1" fill={row.swatch} />
              <text
                className={row.selected ? undefined : STRONG}
                x="198"
                y={y + 9.4}
                fontSize="6"
                fontWeight={row.selected ? 700 : 500}
                fill={row.selected ? SKY : undefined}
              >
                {row.name}
              </text>
              {row.locked ? (
                <g
                  transform={`translate(262 ${y + 7})`}
                  className="stroke-slate-500 dark:stroke-slate-400"
                  fill="none"
                  strokeWidth="0.9"
                >
                  <rect x="-2.6" y="-0.8" width="5.2" height="4" rx="0.8" />
                  <path d="M-1.6 -0.8 V-2 a1.6 1.6 0 0 1 3.2 0 V-0.8" />
                </g>
              ) : null}
              <Eye x={274} y={y + 7} hides={row.hides} />
            </g>
          );
        })}
        <circle className="fa-b-press" cx="274" cy="37" r="5.5" fill={SKY} fillOpacity="0.2" />
        <g className="fa-b-go" style={to(49, -19)}>
          <g transform="translate(228 60)">
            <Pointer color={SKY} />
          </g>
        </g>
      </svg>
    </Frame>
  );
}

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

/** The session tools: a timer draining on the canvas, dot votes landing, and the Done check. */
export function SessionToolsArt() {
  const people = [SKY, PINK, VIOLET, EMERALD, AMBER];
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

        {/* The Done check: who has marked themselves finished. */}
        <PanelShadow x={124} y={62} w={144} h={20} r={10} />
        <rect className={PANEL} x="124" y="62" width="144" height="20" rx="10" strokeWidth="1" />
        <circle cx="134" cy="72" r="5" fill={EMERALD} />
        <path
          d="M131.8 72 L133.5 73.7 L136.3 70.5"
          fill="none"
          stroke="#fff"
          strokeWidth="1.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <text className={STRONG} x="143" y="74.2" fontSize="6.2" fontWeight="700">
          Done?
        </text>
        {people.map((c, i) => (
          <g key={c} transform={`translate(${184 + i * 15} 72)`}>
            <circle r="5" fill={c} opacity={i === 4 ? 0.35 : 1} />
            {i < 4 ? (
              <g className="fa-pop" style={{ animationDelay: `${1.6 + i * 0.3}s` }}>
                <circle cx="3.6" cy="3.4" r="2.6" fill={EMERALD} stroke="#fff" strokeWidth="0.8" />
                <path
                  d="M2.5 3.4 L3.3 4.2 L4.7 2.7"
                  fill="none"
                  stroke="#fff"
                  strokeWidth="0.8"
                  strokeLinecap="round"
                />
              </g>
            ) : null}
          </g>
        ))}
      </svg>
    </Frame>
  );
}
