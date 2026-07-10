// 12 px stroke-currentColor icons used exclusively by the editor's
// right-click context menu (element and canvas modes). They lived
// inline at the bottom of editor-page.tsx; pulled out here so the
// page file stays focused on orchestration rather than the SVG
// vocabulary. No behaviour change.
//
// All icons share the same visual contract: 12x12, 16-unit viewBox,
// stroke="currentColor", `aria-hidden`. The matching MenuItem in
// PortalMenu sets the colour via Tailwind's text-* utilities so
// each icon picks up the surrounding row's tone (default / danger
// / disabled) without needing per-icon variants.

import type {
  ArrowFlow,
  ElementAnimation,
  IconAnimation,
  ProgressAnim,
} from '@livediagram/diagram';

export function LayerUpIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="6" y="6" width="7" height="7" rx="1" fill="white" />
    </svg>
  );
}

export function LayerDownIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="6" y="6" width="7" height="7" rx="1" />
      <rect x="3" y="3" width="7" height="7" rx="1" fill="white" />
    </svg>
  );
}

export function NoteMenuIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3 2.5h7l3 3v8a0.5 0.5 0 0 1 -0.5 0.5h-9.5a0.5 0.5 0 0 1 -0.5 -0.5v-10.5a0.5 0.5 0 0 1 0.5 -0.5z" />
      <path d="M10 2.5v3h3" />
      <path d="M5.5 9h5M5.5 11.5h5" />
    </svg>
  );
}

// Clipboard-with-tick glyph for the Assign Action tile (spec/68), matching
// the element badge's ActionBadgeIcon.
export function ActionMenuIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M6 3h-1.5a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h7a1 1 0 0 0 1-1V4a1 1 0 0 0-1-1H10" />
      <rect x="6" y="1.75" width="4" height="2.5" rx="0.75" />
      <path d="M5.75 9.25 7.5 11l3-3.5" />
    </svg>
  );
}

export function CommentMenuIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M2.5 4a1.5 1.5 0 0 1 1.5-1.5h8A1.5 1.5 0 0 1 13.5 4v5A1.5 1.5 0 0 1 12 10.5H7l-3 2.5V10.5A1.5 1.5 0 0 1 2.5 9z" />
    </svg>
  );
}

export function LinkMenuIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M7 4.5l1.5-1.5a3.25 3.25 0 0 1 4.6 4.6L11 9.5" />
      <path d="M9 11.5l-1.5 1.5a3.25 3.25 0 0 1-4.6-4.6L5 7" />
      <line x1="6" y1="10" x2="10" y2="6" />
    </svg>
  );
}

export function SquareMenuIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      aria-hidden
    >
      <rect x="3" y="3" width="10" height="10" rx="1.5" />
    </svg>
  );
}

export function PaletteMenuIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M8 2a6 6 0 1 0 0 12 1.2 1.2 0 0 0 0-2.4 1.2 1.2 0 0 1 0-2.4h1.4A3.4 3.4 0 0 0 12.8 5.8 4 4 0 0 0 8 2z" />
      <circle cx="5" cy="6.5" r="0.6" fill="currentColor" />
      <circle cx="8" cy="5" r="0.6" fill="currentColor" />
      <circle cx="11" cy="7" r="0.6" fill="currentColor" />
    </svg>
  );
}

export function CanvasMenuIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="2.5" y="2.5" width="11" height="11" rx="1.5" />
      <circle cx="6" cy="6" r="0.6" fill="currentColor" />
      <circle cx="10" cy="6" r="0.6" fill="currentColor" />
      <circle cx="6" cy="10" r="0.6" fill="currentColor" />
      <circle cx="10" cy="10" r="0.6" fill="currentColor" />
    </svg>
  );
}

export function AutoAlignIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M2 4h12M2 8h12M2 12h12" />
    </svg>
  );
}

// Clock - the Timer session-tool category glyph.
export function TimerMenuIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M6.5 2h3" />
      <circle cx="8" cy="9.5" r="5" />
      <path d="M8 9.5V6.8M8 9.5l2.1 1.3" />
    </svg>
  );
}

// Hourglass - the Countdown session-tool category glyph (time running out).
export function CountdownMenuIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M4 2h8M4 14h8" />
      <path d="M5 2v2.5c0 1.8 3 2.7 3 3.5s-3 1.7-3 3.5V14" />
      <path d="M11 2v2.5c0 1.8-3 2.7-3 3.5s3 1.7 3 3.5V14" />
    </svg>
  );
}

// Check-in-circle - the Vote session-tool category glyph (a cast dot-vote).
export function VoteMenuIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="8" cy="8" r="6" />
      <path d="M5.4 8.2l1.8 1.8 3.4-3.7" />
    </svg>
  );
}

// Two sparkles - the Cleanup category glyph (tidy / auto-align / auto-layout).
export function CleanupMenuIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M6.5 2.5l1.1 2.9 2.9 1.1-2.9 1.1-1.1 2.9-1.1-2.9L2.5 6.5l2.9-1.1z" />
      <path d="M12 9.5l.6 1.5 1.5.6-1.5.6-.6 1.5-.6-1.5-1.5-.6 1.5-.6z" />
    </svg>
  );
}

// Hierarchy of connected nodes - the Auto Layout action glyph.
export function AutoLayoutMenuIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="5.5" y="1.5" width="5" height="3.2" rx="0.8" />
      <rect x="1.5" y="11.3" width="5" height="3.2" rx="0.8" />
      <rect x="9.5" y="11.3" width="5" height="3.2" rx="0.8" />
      <path d="M8 4.7v2.8M4 11.3V8.5h8v2.8M12 11.3V8.5" />
    </svg>
  );
}

// Two boxes joined by a downward arrow - the Flowchart (down) layout style.
export function FlowDownMenuIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="4.5" y="1.5" width="7" height="3.4" rx="0.8" />
      <rect x="4.5" y="11.1" width="7" height="3.4" rx="0.8" />
      <path d="M8 4.9v6.2M6.2 9.3L8 11.1l1.8-1.8" />
    </svg>
  );
}

// Two boxes joined by a rightward arrow - the Flowchart (right) layout style.
export function FlowRightMenuIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="1.5" y="4.5" width="3.4" height="7" rx="0.8" />
      <rect x="11.1" y="4.5" width="3.4" height="7" rx="0.8" />
      <path d="M4.9 8h6.2M9.3 6.2L11.1 8l-1.8 1.8" />
    </svg>
  );
}

// Root over three reports - the Tree (org chart) layout style.
export function TreeMenuIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="5.8" y="1.5" width="4.4" height="3" rx="0.8" />
      <rect x="1.2" y="11.5" width="3.6" height="3" rx="0.8" />
      <rect x="6.2" y="11.5" width="3.6" height="3" rx="0.8" />
      <rect x="11.2" y="11.5" width="3.6" height="3" rx="0.8" />
      <path d="M8 4.5v2M3 11.5V8.5h10v3M8 8.5v3" />
    </svg>
  );
}

// Hub with four spokes - the Mindmap (radial) layout style.
export function MindmapMenuIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="8" cy="8" r="2.2" />
      <circle cx="2.8" cy="3" r="1.4" />
      <circle cx="13.2" cy="3" r="1.4" />
      <circle cx="2.8" cy="13" r="1.4" />
      <circle cx="13.2" cy="13" r="1.4" />
      <path d="M6.5 6.6L3.8 4M9.5 6.6L12.2 4M6.5 9.4L3.8 12M9.5 9.4L12.2 12" />
    </svg>
  );
}

// Serif "A" - the Font section glyph.
export function FontMenuIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="currentColor"
      aria-hidden
      fontSize="12"
      fontWeight="600"
      fontFamily="Georgia, serif"
    >
      <text x="8" y="12.5" textAnchor="middle">
        A
      </text>
    </svg>
  );
}

// A small arrow pointing in `dir` (one up-arrow path, rotated). Used by the
// inline-icon placement picker's cross of direction cells.
export function DirArrow({ dir }: { dir: 'up' | 'down' | 'left' | 'right' }) {
  const rot = { up: 0, right: 90, down: 180, left: 270 }[dir];
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 12 12"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      style={{ transform: `rotate(${rot}deg)` }}
    >
      <path d="M6 2.5V9.5M3 5.5 6 2.5 9 5.5" />
    </svg>
  );
}

// Orientation preview for the Rotation category: a small square with a
// marker on its top edge, rotated by `deg` about its centre. The tilt shows
// at a glance which way the element will end up facing.
export function RotationGlyph({ deg }: { deg: number }) {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <g transform={`rotate(${deg} 8 8)`}>
        <rect x="3.5" y="3.5" width="9" height="9" rx="1.5" />
        {/* Filled tab centred on the top edge marks "up". */}
        <circle cx="8" cy="3.5" r="1.3" fill="currentColor" stroke="none" />
      </g>
    </svg>
  );
}

// Diagonal stroke — the "Line" section glyph.
export function LineGlyph() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      aria-hidden
    >
      <path d="M3 13L13 3" />
    </svg>
  );
}

// Arrow → glyph — the "Pointer" section.
export function PointerGlyph() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M2.5 8h10M9 4.5 12.5 8 9 11.5" />
    </svg>
  );
}

// Grid glyph — the "Table" section.
export function TableGlyph() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="2.5" y="3" width="11" height="10" rx="1.5" />
      <path d="M2.5 6.5h11M6.5 6.5V13M2.5 9.8h11" />
    </svg>
  );
}

// Picture glyph — the "Image" section.
export function ImageGlyph() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="2.5" y="3" width="11" height="10" rx="1.5" />
      <circle cx="6" cy="6.5" r="1" />
      <path d="M3 12l3-3 2.5 2.5L11 8l2 2" />
    </svg>
  );
}

// Rounded-square outline — the "Border" section glyph.
export function BorderGlyph() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden
    >
      <rect x="2.5" y="2.5" width="11" height="11" rx="2.5" />
    </svg>
  );
}

// Stacked diamonds — the "Layer" section glyph. 12x12 stroke style of the
// shared context-menu icons.
export function LayersGlyph() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M8 2 14 5.5 8 9 2 5.5z" />
      <path d="m3.5 8 4.5 2.6L12.5 8M3.5 11l4.5 2.6L12.5 11" />
    </svg>
  );
}

// Animation section glyph (spec/09): a dot with a couple of "motion" arcs,
// reading as "this element animates".
export function AnimationMenuGlyph() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="8" cy="8" r="2" />
      <path d="M11.5 4.5a5 5 0 0 1 0 7" />
      <path d="M4.5 11.5a5 5 0 0 1 0-7" />
    </svg>
  );
}

// A magic wand with a sparkle tip — the "Presets" category glyph (spec/48):
// one-click styled looks. 12x12 stroke style of the shared context-menu icons.
// The "Style" flyout row's glyph (spec/09): a paintbrush, distinct from
// the Colours child's palette and the Presets child's wand so the parent
// row and its children never wear the same icon side by side.
// The "Tools" flyout row's glyph (spec/09): slider knobs, for the band
// folding the data-shape controls (progress / rating / chart / rail).
export function ToolsMenuGlyph() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M2.5 5h11M2.5 11h11" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="6" cy="5" r="1.8" fill="#fff" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="10.5" cy="11" r="1.8" fill="#fff" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

export function StyleMenuGlyph() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M13.5 2.5c-2.4.8-5.1 2.9-6.6 4.9l1.7 1.7c2-1.5 4.1-4.2 4.9-6.6z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path
        d="M6.4 8.1c-1 .2-1.8 1-2 2-.2 1-.9 1.6-1.9 1.9 1.2 1.3 3.4 1.4 4.6.2.8-.8 1-2 .6-3z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function PresetsMenuGlyph() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M10 2.2l0.9 1.9 1.9 0.9-1.9 0.9-0.9 1.9-0.9-1.9-1.9-0.9 1.9-0.9z" />
      <path d="M3 13l5-5" />
    </svg>
  );
}

// Illustrations for the Animation + Flow context-menu tiles (spec/09), so
// each option reads at a glance. 16-unit viewBox, currentColor; filled dots
// set their own fill since the wrapping <svg> is stroke-only.
function AnimSvg({ children }: { children: React.ReactNode }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {children}
    </svg>
  );
}

// "No animation" — a hollow dot struck through.
function AnimNoneGlyph() {
  return (
    <AnimSvg>
      <circle cx="8" cy="8" r="3.6" />
      <path d="M4.5 11.5 11.5 4.5" />
    </AnimSvg>
  );
}

// Pulse — a bright core ringed by expanding circles.
function AnimPulseGlyph() {
  return (
    <AnimSvg>
      <circle cx="8" cy="8" r="1.6" fill="currentColor" stroke="none" />
      <circle cx="8" cy="8" r="4" />
      <circle cx="8" cy="8" r="6.4" opacity="0.45" />
    </AnimSvg>
  );
}

// Blink — a dot with a twinkle of short ticks.
function AnimBlinkGlyph() {
  return (
    <AnimSvg>
      <circle cx="8" cy="8" r="2.1" fill="currentColor" stroke="none" />
      <path d="M8 1.4v1.8M8 12.8v1.8M1.4 8h1.8M12.8 8h1.8" />
    </AnimSvg>
  );
}

// Glow — a core with a soft halo.
function AnimGlowGlyph() {
  return (
    <AnimSvg>
      <circle cx="8" cy="8" r="6" fill="currentColor" stroke="none" opacity="0.22" />
      <circle cx="8" cy="8" r="2.4" fill="currentColor" stroke="none" />
    </AnimSvg>
  );
}

// Flow: marching dashes toward an arrowhead.
function FlowDashesGlyph() {
  return (
    <AnimSvg>
      <path d="M2 8 H10.5" strokeDasharray="2.4 2" />
      <path d="M10 5 13 8 10 11" />
    </AnimSvg>
  );
}

// Flow: a dot travelling a line toward an arrowhead.
function FlowDotsGlyph() {
  return (
    <AnimSvg>
      <path d="M2 8 H13.5" />
      <path d="M10.5 5.5 13.5 8 10.5 10.5" />
      <circle cx="5.5" cy="8" r="1.7" fill="currentColor" stroke="none" />
    </AnimSvg>
  );
}

// Trace — a light running a rounded outline.
function AnimTraceGlyph() {
  return (
    <AnimSvg>
      <rect x="3" y="3" width="10" height="10" rx="2.5" />
      <circle cx="13" cy="5.5" r="1.6" fill="currentColor" stroke="none" />
    </AnimSvg>
  );
}

// Gradient — a tile washed by a diagonal blend.
function AnimGradientGlyph() {
  return (
    <AnimSvg>
      <rect x="3" y="3" width="10" height="10" rx="2.5" />
      <path d="M3.5 12.5 12.5 3.5" opacity="0.55" />
      <path d="M6.5 13 13 6.5" opacity="0.3" />
    </AnimSvg>
  );
}

// Bounce — a ball hopping above a line.
function AnimBounceGlyph() {
  return (
    <AnimSvg>
      <circle cx="8" cy="5" r="2.2" fill="currentColor" stroke="none" />
      <path d="M3 12.5 H13" />
      <path d="M6 9.2 8 7.2 10 9.2" opacity="0.6" />
    </AnimSvg>
  );
}

// Wobble — a tile tilting between two angles.
function AnimWobbleGlyph() {
  return (
    <AnimSvg>
      <rect x="4.5" y="4.5" width="7" height="7" rx="1.5" transform="rotate(12 8 8)" />
      <path d="M2.6 6 A 6 6 0 0 1 5 3.2" opacity="0.6" />
      <path d="M13.4 10 A 6 6 0 0 1 11 12.8" opacity="0.6" />
    </AnimSvg>
  );
}

// Flow: a row of beads marching toward an arrowhead.
function FlowBeadsGlyph() {
  return (
    <AnimSvg>
      <path d="M10.5 5.5 13.5 8 10.5 10.5" />
      <circle cx="2.5" cy="8" r="1.3" fill="currentColor" stroke="none" />
      <circle cx="6" cy="8" r="1.3" fill="currentColor" stroke="none" />
      <circle cx="9.5" cy="8" r="1.3" fill="currentColor" stroke="none" />
    </AnimSvg>
  );
}

// Flow: a line whose opacity pulses (drawn as fading segments).
function FlowPulseGlyph() {
  return (
    <AnimSvg>
      <path d="M2 8 H4.5" />
      <path d="M6.5 8 H9" opacity="0.55" />
      <path d="M10.5 5.5 13.5 8 10.5 10.5" opacity="0.3" />
    </AnimSvg>
  );
}

// Flow: a line that breathes its thickness.
function FlowGrowGlyph() {
  return (
    <AnimSvg>
      <path d="M2 8 H10" strokeWidth="2.8" />
      <path d="M10 5 13.5 8 10 11" />
    </AnimSvg>
  );
}

// Flow: a line haloed by a soft glow.
function FlowGlowGlyph() {
  return (
    <AnimSvg>
      <path d="M2 8 H10" strokeWidth="3.6" opacity="0.3" />
      <path d="M2 8 H10" />
      <path d="M10 5 13.5 8 10 11" />
    </AnimSvg>
  );
}

// Shake — a tile with horizontal motion ticks either side.
function AnimShakeGlyph() {
  return (
    <AnimSvg>
      <rect x="5" y="4.5" width="6" height="7" rx="1.5" />
      <path d="M2 8h1.6M12.4 8H14" opacity="0.7" />
    </AnimSvg>
  );
}

// Jelly — a squashed blob (wider than tall) with squeeze ticks.
function AnimJellyGlyph() {
  return (
    <AnimSvg>
      <ellipse cx="8" cy="8.5" rx="5.3" ry="3.6" />
      <path d="M8 1.6v1.6M8 12.8v1.6" opacity="0.55" />
    </AnimSvg>
  );
}

// Float — a tile drifting, hinted by an arc above it.
function AnimFloatGlyph() {
  return (
    <AnimSvg>
      <rect x="4.5" y="6" width="7" height="7" rx="1.5" />
      <path d="M3 4.5q5-3 10 0" opacity="0.55" />
    </AnimSvg>
  );
}

// Swing — a pendulum: a pivot, an arm, a bob, and a swept arc.
function AnimSwingGlyph() {
  return (
    <AnimSvg>
      <path d="M8 2.5V9" />
      <circle cx="8" cy="10.8" r="2.2" fill="currentColor" stroke="none" />
      <path d="M4.5 4.2a5 5 0 0 1 7 0" opacity="0.5" />
    </AnimSvg>
  );
}

// Flow: a line being drawn on — solid, then a faint dashed remainder.
function FlowDrawGlyph() {
  return (
    <AnimSvg>
      <path d="M2 8H8" />
      <path d="M8 8h3" opacity="0.3" strokeDasharray="1.6 1.6" />
      <path d="M10 5 13 8 10 11" />
    </AnimSvg>
  );
}

// Flow: a glowing dot trailing a fading tail toward an arrowhead.
function FlowCometGlyph() {
  return (
    <AnimSvg>
      <path d="M2 8H6.5" opacity="0.4" />
      <circle cx="8" cy="8" r="1.9" fill="currentColor" stroke="none" />
      <path d="M10.5 5.5 13.5 8 10.5 10.5" />
    </AnimSvg>
  );
}

// Flow: nested rainbow arcs (colour cycling).
function FlowRainbowGlyph() {
  return (
    <AnimSvg>
      <path d="M2 11.5a6 6 0 0 1 12 0" />
      <path d="M4.2 11.5a3.8 3.8 0 0 1 7.6 0" opacity="0.6" />
      <path d="M6.4 11.5a1.6 1.6 0 0 1 3.2 0" opacity="0.35" />
    </AnimSvg>
  );
}

// Flow: a hard-blinking line (full segment, faint gap, a spark).
function FlowStrobeGlyph() {
  return (
    <AnimSvg>
      <path d="M2 8H5.5" />
      <path d="M8.5 8h2" opacity="0.25" />
      <path d="M10.5 5.5 13.5 8 10.5 10.5" />
      <path d="M7 5.4v1.3M7 9.3v1.3" opacity="0.7" />
    </AnimSvg>
  );
}

// Flow: fast speed lines toward an arrowhead.
function FlowWindGlyph() {
  return (
    <AnimSvg>
      <path d="M2 5.5H8" />
      <path d="M2 8H10" />
      <path d="M2 10.5H7.5" />
      <path d="M10 5 13 8 10 11" />
    </AnimSvg>
  );
}

// Dispatchers used by the context menu's Animation / Flow tiles. `null` is the
// "None" option.
export function AnimationKindGlyph({ kind }: { kind: ElementAnimation | null }) {
  if (kind === 'pulse') return <AnimPulseGlyph />;
  if (kind === 'blink') return <AnimBlinkGlyph />;
  if (kind === 'glow') return <AnimGlowGlyph />;
  if (kind === 'trace') return <AnimTraceGlyph />;
  if (kind === 'gradient') return <AnimGradientGlyph />;
  if (kind === 'bounce') return <AnimBounceGlyph />;
  if (kind === 'wobble') return <AnimWobbleGlyph />;
  if (kind === 'shake') return <AnimShakeGlyph />;
  if (kind === 'jelly') return <AnimJellyGlyph />;
  if (kind === 'float') return <AnimFloatGlyph />;
  if (kind === 'swing') return <AnimSwingGlyph />;
  return <AnimNoneGlyph />;
}

export function FlowKindGlyph({ kind }: { kind: ArrowFlow | null }) {
  if (kind === 'dashes') return <FlowDashesGlyph />;
  if (kind === 'dots') return <FlowDotsGlyph />;
  if (kind === 'beads') return <FlowBeadsGlyph />;
  if (kind === 'pulse') return <FlowPulseGlyph />;
  if (kind === 'grow') return <FlowGrowGlyph />;
  if (kind === 'glow') return <FlowGlowGlyph />;
  if (kind === 'draw') return <FlowDrawGlyph />;
  if (kind === 'comet') return <FlowCometGlyph />;
  if (kind === 'rainbow') return <FlowRainbowGlyph />;
  if (kind === 'strobe') return <FlowStrobeGlyph />;
  if (kind === 'wind') return <FlowWindGlyph />;
  return <AnimNoneGlyph />;
}

// Icon-animation tile glyphs (spec/09). Small pictograms hinting at each
// motion: a circular arrow for Spin, a heart for Beat, signal arcs for Pulse,
// an up-chevron-over-baseline for Bounce, a tilde for Wiggle, a spark for
// Flash, a burst for Tada.
function IconAnimSpinGlyph() {
  return (
    <AnimSvg>
      <path d="M13 8a5 5 0 1 1-1.6-3.7" />
      <path d="M13 3.2 13 5.4 10.8 5.4" />
    </AnimSvg>
  );
}
function IconAnimBeatGlyph() {
  return (
    <AnimSvg>
      <path
        d="M8 13.2 3.4 8.6a2.6 2.6 0 0 1 3.7-3.7l.9.9.9-.9a2.6 2.6 0 0 1 3.7 3.7z"
        fill="currentColor"
        stroke="none"
      />
    </AnimSvg>
  );
}
function IconAnimPulseGlyph() {
  return (
    <AnimSvg>
      <circle cx="8" cy="8" r="1.6" fill="currentColor" stroke="none" />
      <path d="M4.6 11.4a4.8 4.8 0 0 1 0-6.8" />
      <path d="M11.4 4.6a4.8 4.8 0 0 1 0 6.8" />
    </AnimSvg>
  );
}
function IconAnimBounceGlyph() {
  return (
    <AnimSvg>
      <circle cx="8" cy="6" r="2" fill="currentColor" stroke="none" />
      <path d="M5.5 8.5 8 6 10.5 8.5" opacity="0.6" />
      <path d="M3.5 13 H12.5" />
    </AnimSvg>
  );
}
function IconAnimWiggleGlyph() {
  return (
    <AnimSvg>
      <path d="M2.5 9.5C4 6 5.5 6 7 8s2.5 2 4 -1.5 2.5 -1.5 2.5 -1.5" />
    </AnimSvg>
  );
}
function IconAnimFlashGlyph() {
  return (
    <AnimSvg>
      <path d="M9 2 4 9h3l-1 5 5-7H8z" fill="currentColor" stroke="none" />
    </AnimSvg>
  );
}
function IconAnimTadaGlyph() {
  return (
    <AnimSvg>
      <circle cx="8" cy="8" r="1.8" fill="currentColor" stroke="none" />
      <path d="M8 2.2v1.8M8 12v1.8M2.2 8h1.8M12 8h1.8M4 4l1.3 1.3M11 11l1.3 1.3M12 4l-1.3 1.3M4 12l1.3-1.3" />
    </AnimSvg>
  );
}

// Flip — a coin flip, hinted by an edge-on ellipse + mirroring arrows.
function IconAnimFlipGlyph() {
  return (
    <AnimSvg>
      <ellipse cx="8" cy="8" rx="2.6" ry="5" />
      <path d="M2 8h1.4M12.6 8H14M3 6.6 1.6 8 3 9.4M13 6.6 14.4 8 13 9.4" opacity="0.7" />
    </AnimSvg>
  );
}
// Jump — a squashed base with an up arrow (squash-and-stretch hop).
function IconAnimJumpGlyph() {
  return (
    <AnimSvg>
      <ellipse cx="8" cy="12" rx="3.2" ry="1.4" opacity="0.6" />
      <path d="M8 9.5V3.5M5.5 6 8 3.5 10.5 6" />
    </AnimSvg>
  );
}
// Swing — a pendulum from the top (matches the boxed Swing glyph).
function IconAnimSwingGlyph() {
  return (
    <AnimSvg>
      <path d="M8 2.5V9" />
      <circle cx="8" cy="10.8" r="2.2" fill="currentColor" stroke="none" />
      <path d="M4.5 4.2a5 5 0 0 1 7 0" opacity="0.5" />
    </AnimSvg>
  );
}
// Float — a glyph drifting along a dashed orbit.
function IconAnimFloatGlyph() {
  return (
    <AnimSvg>
      <circle cx="8" cy="8" r="1.8" fill="currentColor" stroke="none" />
      <ellipse cx="8" cy="8" rx="5.5" ry="3" strokeDasharray="2 2" opacity="0.5" />
    </AnimSvg>
  );
}

export function IconAnimKindGlyph({ kind }: { kind: IconAnimation | null }) {
  if (kind === 'spin') return <IconAnimSpinGlyph />;
  if (kind === 'beat') return <IconAnimBeatGlyph />;
  if (kind === 'pulse') return <IconAnimPulseGlyph />;
  if (kind === 'bounce') return <IconAnimBounceGlyph />;
  if (kind === 'wiggle') return <IconAnimWiggleGlyph />;
  if (kind === 'flash') return <IconAnimFlashGlyph />;
  if (kind === 'tada') return <IconAnimTadaGlyph />;
  if (kind === 'flip') return <IconAnimFlipGlyph />;
  if (kind === 'jump') return <IconAnimJumpGlyph />;
  if (kind === 'swing') return <IconAnimSwingGlyph />;
  if (kind === 'float') return <IconAnimFloatGlyph />;
  return <AnimNoneGlyph />;
}

// Progress section icon (spec/46): a half-filled pill.
export function ProgressMenuGlyph() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="2" y="6" width="12" height="4" rx="2" />
      <rect x="2" y="6" width="6" height="4" rx="2" fill="currentColor" stroke="none" />
    </svg>
  );
}

// Progress fill-animation tile glyphs (spec/46): a partly-filled bar for Fill,
// a faded fill for Pulse, diagonal hatching for Stripes.
function ProgAnimFillGlyph() {
  return (
    <AnimSvg>
      <rect x="2" y="6" width="12" height="4" rx="2" />
      <rect x="2" y="6" width="6" height="4" rx="2" fill="currentColor" stroke="none" />
      <path d="M8.5 8 H11" opacity="0.5" />
    </AnimSvg>
  );
}
function ProgAnimPulseGlyph() {
  return (
    <AnimSvg>
      <rect x="2" y="6" width="12" height="4" rx="2" />
      <rect
        x="2"
        y="6"
        width="7"
        height="4"
        rx="2"
        fill="currentColor"
        stroke="none"
        opacity="0.5"
      />
    </AnimSvg>
  );
}
function ProgAnimStripesGlyph() {
  return (
    <AnimSvg>
      <rect x="2" y="6" width="12" height="4" rx="2" />
      <path d="M4 10 6 6M6.5 10 8.5 6M9 10 11 6" strokeWidth="1" opacity="0.7" />
    </AnimSvg>
  );
}
export function ProgressAnimKindGlyph({ kind }: { kind: ProgressAnim | null }) {
  if (kind === 'fill') return <ProgAnimFillGlyph />;
  if (kind === 'pulse') return <ProgAnimPulseGlyph />;
  if (kind === 'stripes') return <ProgAnimStripesGlyph />;
  return <AnimNoneGlyph />;
}

// Rectangle with corner ticks - the "lock aspect ratio" Layer-row glyph.
export function AspectLockMenuIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="2.5" y="2.5" width="11" height="11" rx="1.5" />
      <path d="M5 8.5v2.5h2.5M11 7.5V5H8.5" />
    </svg>
  );
}

// A serif "A" - the "Text" category glyph.
export function TextGlyph() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
      <text
        x="8"
        y="12"
        textAnchor="middle"
        fontSize="13"
        fontWeight="600"
        fontFamily="Georgia, serif"
      >
        A
      </text>
    </svg>
  );
}

// A star - the "Icon" category glyph (the un-slashed sibling of RemoveIconGlyph).
export function IconCategoryGlyph() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M8 2.5l1.6 3.3 3.6.5-2.6 2.5.6 3.6L8 11.2 4.8 12.9l.6-3.6L2.8 6.8l3.6-.5z" />
    </svg>
  );
}

// A star glyph with a slash - "remove the inline icon".
export function RemoveIconGlyph() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M8 2.5l1.6 3.3 3.6.5-2.6 2.5.6 3.6L8 11.2 4.8 12.9l.6-3.6L2.8 6.8l3.6-.5z" />
      <path d="M2.5 13.5l11-11" />
    </svg>
  );
}
