// Icons of the editor's context menus (element, multi-selection, canvas, layer row). One family
// (docs/specs/004-interface-design/iconography.md, "Size steps"): row and section icons render at
// MENU_ICON_PX, the pinned quick-action buttons at QUICK_ACTION_ICON_PX, all on the 24-unit grid so
// their ink reads the same size. Lucide where it has the meaning; in-house glyphs follow the same grid.
// Option tiles (animation kinds, layout styles, rotation) are previews and keep their own drawing.

import {
  ActionIcon,
  CommentIcon,
  CopyIcon as SharedCopyIcon,
  DuplicateIcon,
  Glyph,
  LinkIcon,
  lucideGlyph,
  MindmapIcon,
  NoteIcon,
  SparkleIcon,
  TrashIcon,
} from '@livediagram/ui';
import {
  lucideAlignStartVertical,
  lucideArrowRight,
  lucideBaseline,
  lucideBringToFront,
  lucideChartNoAxesColumnIncreasing,
  lucideCircleCheck,
  lucideClipboardPaste,
  lucideImage,
  lucideLayers,
  lucideNetwork,
  lucidePalette,
  lucidePaintbrush,
  lucideProportions,
  lucideRadio,
  lucideRotateCwSquare,
  lucideScaling,
  lucideScissors,
  lucideSendToBack,
  lucideShapes,
  lucideSquare,
  lucideStar,
  lucideStarOff,
  lucideTable,
  lucideTimer,
  lucideType,
  lucideUsers,
  lucideWandSparkles,
  lucideWrench,
} from '@livediagram/icons/lucide';
import type {
  ArrowFlow,
  ElementAnimation,
  IconAnimation,
  ProgressAnim,
} from '@livediagram/document';

/** Size step of every menu row and section icon. */
export const MENU_ICON_PX = 14;
/** Size step of the icon-only quick-action buttons pinned to the top of a menu. */
export const QUICK_ACTION_ICON_PX = 16;

export const LayerUpIcon = lucideGlyph(lucideBringToFront, MENU_ICON_PX);
export const LayerDownIcon = lucideGlyph(lucideSendToBack, MENU_ICON_PX);

// The note / action / comment / link glyphs are the shared element-affordance drawings
// (@livediagram/ui), the same ones the on-element badge pill shows, at the menu step.
export function NoteMenuIcon() {
  return <NoteIcon size={MENU_ICON_PX} />;
}

// Clipboard-with-tick glyph for the Assign Action tile (docs/specs/012-collaboration/assigned-actions.md).
export function ActionMenuIcon() {
  return <ActionIcon size={MENU_ICON_PX} />;
}

export function CommentMenuIcon() {
  return <CommentIcon size={MENU_ICON_PX} />;
}

export function LinkMenuIcon() {
  return <LinkIcon size={MENU_ICON_PX} />;
}

// The "Shape" section: the element's outline.
export const SquareMenuIcon = lucideGlyph(lucideShapes, MENU_ICON_PX);
export const PaletteMenuIcon = lucideGlyph(lucidePalette, MENU_ICON_PX);
// Auto align: shapes pulled to one edge.
export const AutoAlignIcon = lucideGlyph(lucideAlignStartVertical, MENU_ICON_PX);
// The Timer session-tool category glyph.
export const TimerMenuIcon = lucideGlyph(lucideTimer, MENU_ICON_PX);
// The Vote session-tool category glyph (a cast dot-vote).
export const VoteMenuIcon = lucideGlyph(lucideCircleCheck, MENU_ICON_PX);
// The Collaborate parent category glyph: the flyout grouping the live session tools.
export const CollaborateMenuIcon = lucideGlyph(lucideUsers, MENU_ICON_PX);
// The Poll session-tool category glyph (docs/specs/012-collaboration/live-poll.md, a live tally),
// distinct from Vote's check: a poll counts answers from people.
export const PollMenuIcon = lucideGlyph(lucideChartNoAxesColumnIncreasing, MENU_ICON_PX);

// The Cleanup category glyph (tidy / auto-align / auto-layout): the one shared sparkle.
export function CleanupMenuIcon() {
  return <SparkleIcon size={MENU_ICON_PX} />;
}

// The Auto Layout action glyph: a hierarchy of connected nodes.
export const AutoLayoutMenuIcon = lucideGlyph(lucideNetwork, MENU_ICON_PX);

// Layout-style option previews (flowchart down / right, tree, mindmap). 16-unit drawings at the
// menu step.
function LayoutPreview({ children }: { children: React.ReactNode }) {
  return (
    <Glyph size={MENU_ICON_PX} units={16}>
      {children}
    </Glyph>
  );
}

// Two boxes joined by a downward arrow - the Flowchart (down) layout style.
export function FlowDownMenuIcon() {
  return (
    <LayoutPreview>
      <rect x="4.5" y="1.5" width="7" height="3.4" rx="0.8" />
      <rect x="4.5" y="11.1" width="7" height="3.4" rx="0.8" />
      <path d="M8 4.9v6.2M6.2 9.3L8 11.1l1.8-1.8" />
    </LayoutPreview>
  );
}

// Two boxes joined by a rightward arrow - the Flowchart (right) layout style.
export function FlowRightMenuIcon() {
  return (
    <LayoutPreview>
      <rect x="1.5" y="4.5" width="3.4" height="7" rx="0.8" />
      <rect x="11.1" y="4.5" width="3.4" height="7" rx="0.8" />
      <path d="M4.9 8h6.2M9.3 6.2L11.1 8l-1.8 1.8" />
    </LayoutPreview>
  );
}

// Root over three reports - the Tree (org chart) layout style.
export function TreeMenuIcon() {
  return (
    <LayoutPreview>
      <rect x="5.8" y="1.5" width="4.4" height="3" rx="0.8" />
      <rect x="1.2" y="11.5" width="3.6" height="3" rx="0.8" />
      <rect x="6.2" y="11.5" width="3.6" height="3" rx="0.8" />
      <rect x="11.2" y="11.5" width="3.6" height="3" rx="0.8" />
      <path d="M8 4.5v2M3 11.5V8.5h10v3M8 8.5v3" />
    </LayoutPreview>
  );
}

// Hub with four spokes - the Mindmap (radial) layout style, the shared mind map glyph.
export function MindmapMenuIcon() {
  return <MindmapIcon size={MENU_ICON_PX} />;
}

// A small arrow pointing in `dir` (one up-arrow path, rotated). Used by the
// inline-icon placement picker's cross of direction cells.
export function DirArrow({ dir }: { dir: 'up' | 'down' | 'left' | 'right' }) {
  const rot = { up: 0, right: 90, down: 180, left: 270 }[dir];
  return (
    <Glyph size={11} units={12} style={{ transform: `rotate(${rot}deg)` }}>
      <path d="M6 2.5V9.5M3 5.5 6 2.5 9 5.5" />
    </Glyph>
  );
}

// The Rotation category glyph: a turn arrow round a square.
export const RotationMenuIcon = lucideGlyph(lucideRotateCwSquare, MENU_ICON_PX);

// Orientation preview for a Rotation option: a square with a marker on its top edge, rotated by
// `deg` about its centre, so each option shows which way the element will face.
export function RotationGlyph({ deg }: { deg: number }) {
  return (
    <Glyph size={15} units={16}>
      <g transform={`rotate(${deg} 8 8)`}>
        <rect x="3.5" y="3.5" width="9" height="9" rx="1.5" />
        {/* Filled tab centred on the top edge marks "up". */}
        <circle cx="8" cy="3.5" r="1.3" fill="currentColor" stroke="none" />
      </g>
    </Glyph>
  );
}

// Diagonal stroke - the "Line" section glyph.
export function LineGlyph() {
  return (
    <Glyph size={MENU_ICON_PX} units={24}>
      <path d="M5 19 19 5" />
    </Glyph>
  );
}

// The "Pointer" section.
export const PointerGlyph = lucideGlyph(lucideArrowRight, MENU_ICON_PX);
export const TableGlyph = lucideGlyph(lucideTable, MENU_ICON_PX);
export const ImageGlyph = lucideGlyph(lucideImage, MENU_ICON_PX);
// The "Border" section: the outline alone.
export const BorderGlyph = lucideGlyph(lucideSquare, MENU_ICON_PX);

// The "Shadow" category glyph (docs/specs/008-canvas/element-shadows.md): a box with an offset
// shade behind.
export function ShadowMenuGlyph() {
  return (
    <Glyph size={MENU_ICON_PX} units={24}>
      <rect
        x="6"
        y="6"
        width="16"
        height="16"
        rx="2"
        fill="currentColor"
        stroke="none"
        opacity="0.35"
      />
      <rect x="2" y="2" width="16" height="16" rx="2" />
    </Glyph>
  );
}

// The "Layer" section glyph.
export const LayersGlyph = lucideGlyph(lucideLayers, MENU_ICON_PX);
// Animation section glyph (docs/specs/008-canvas/canvas-and-palette.md): a dot with motion arcs.
export const AnimationMenuGlyph = lucideGlyph(lucideRadio, MENU_ICON_PX);
// The "Tools" / "Session" / "Scale" rows: a wrench (sliders are Settings).
export const ToolsMenuGlyph = lucideGlyph(lucideWrench, MENU_ICON_PX);
// The "Style" flyout row (docs/specs/008-canvas/canvas-and-palette.md): a paintbrush, distinct from
// the Colours child's palette and the Presets child's wand.
export const StyleMenuGlyph = lucideGlyph(lucidePaintbrush, MENU_ICON_PX);
// The "Presets" category (docs/specs/010-palette/style-presets.md): one-click styled looks.
export const PresetsMenuGlyph = lucideGlyph(lucideWandSparkles, MENU_ICON_PX);

// Illustrations for the Animation + Flow context-menu tiles (docs/specs/008-canvas/canvas-and-palette.md), so
// each option reads at a glance. 16-unit viewBox, currentColor; filled dots
// set their own fill since the wrapping <svg> is stroke-only.
function AnimSvg({ children }: { children: React.ReactNode }) {
  return (
    <Glyph size={16} units={16}>
      {children}
    </Glyph>
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

// Heartbeat — a tile with an ECG lub-dub spike across it.
function AnimHeartbeatGlyph() {
  return (
    <AnimSvg>
      <rect x="2.5" y="3.5" width="11" height="9" rx="1.5" opacity="0.5" />
      <path d="M2.5 8h2.5l1.2-2.4L8 10.4 9.6 5.9 10.7 8h2.8" />
    </AnimSvg>
  );
}

// Breathe — a tile gently swelling, hinted by outward corner ticks.
function AnimBreatheGlyph() {
  return (
    <AnimSvg>
      <rect x="4.5" y="4.5" width="7" height="7" rx="1.5" />
      <path d="M2 2l1.7 1.7M14 2l-1.7 1.7M2 14l1.7-1.7M14 14l-1.7-1.7" opacity="0.55" />
    </AnimSvg>
  );
}

// Shimmer — a tile catching the light: a diagonal sheen + a spark.
function AnimShimmerGlyph() {
  return (
    <AnimSvg>
      <rect x="3" y="4.5" width="10" height="7" rx="1.5" />
      <path d="M6.2 11.5 9 4.5" opacity="0.55" />
      <path d="M12.5 2.2v2M11.5 3.2h2" />
    </AnimSvg>
  );
}

// Highlight — a lit tile radiating short rays.
function AnimHighlightGlyph() {
  return (
    <AnimSvg>
      <rect x="4" y="6" width="8" height="6.5" rx="1.5" />
      <path d="M8 1.8v2M4 3l1.3 1.5M12 3l-1.3 1.5" opacity="0.7" />
    </AnimSvg>
  );
}

// Flow: an ECG lub-dub spike riding the line toward an arrowhead.
function FlowHeartbeatGlyph() {
  return (
    <AnimSvg>
      <path d="M2 8h2l1-2 1.6 4L8.2 6l1 2h1.3" />
      <path d="M10.5 5.5 13.5 8 10.5 10.5" />
    </AnimSvg>
  );
}

// Flow: a line swelling gently at its middle (soft echo strokes).
function FlowBreatheGlyph() {
  return (
    <AnimSvg>
      <path d="M2 8 H10" />
      <path d="M4 6.4h4.5M4 9.6h4.5" opacity="0.35" />
      <path d="M10 5 13.5 8 10 11" />
    </AnimSvg>
  );
}

// Flow: a line glinting — a spark above it, toward an arrowhead.
function FlowShimmerGlyph() {
  return (
    <AnimSvg>
      <path d="M2 8 H10" />
      <path d="M6.5 3v2M5.5 4h2" opacity="0.75" />
      <path d="M10 5 13.5 8 10 11" />
    </AnimSvg>
  );
}

// Flow: a single packet (one solid dash) travelling a faint line.
function FlowSignalGlyph() {
  return (
    <AnimSvg>
      <path d="M2 8h2.5M9 8h1.5" opacity="0.3" />
      <path d="M5.5 8H8" strokeWidth="2.6" />
      <path d="M10.5 5.5 13.5 8 10.5 10.5" />
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
  if (kind === 'heartbeat') return <AnimHeartbeatGlyph />;
  if (kind === 'breathe') return <AnimBreatheGlyph />;
  if (kind === 'shimmer') return <AnimShimmerGlyph />;
  if (kind === 'highlight') return <AnimHighlightGlyph />;
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
  if (kind === 'heartbeat') return <FlowHeartbeatGlyph />;
  if (kind === 'breathe') return <FlowBreatheGlyph />;
  if (kind === 'shimmer') return <FlowShimmerGlyph />;
  if (kind === 'signal') return <FlowSignalGlyph />;
  if (kind === 'draw') return <FlowDrawGlyph />;
  if (kind === 'comet') return <FlowCometGlyph />;
  if (kind === 'rainbow') return <FlowRainbowGlyph />;
  if (kind === 'strobe') return <FlowStrobeGlyph />;
  if (kind === 'wind') return <FlowWindGlyph />;
  return <AnimNoneGlyph />;
}

// Icon-animation tile glyphs (docs/specs/008-canvas/canvas-and-palette.md). Small pictograms hinting at each
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

// Glow — a dot wearing a soft halo ring.
function IconAnimGlowGlyph() {
  return (
    <AnimSvg>
      <circle cx="8" cy="8" r="2.2" fill="currentColor" stroke="none" />
      <circle cx="8" cy="8" r="4.8" opacity="0.45" />
    </AnimSvg>
  );
}
// Ping — a dot emitting expanding rings.
function IconAnimPingGlyph() {
  return (
    <AnimSvg>
      <circle cx="8" cy="8" r="1.6" fill="currentColor" stroke="none" />
      <circle cx="8" cy="8" r="3.6" opacity="0.6" />
      <circle cx="8" cy="8" r="5.8" opacity="0.3" />
    </AnimSvg>
  );
}
// Breathe — a circle gently swelling, hinted by outward corner ticks.
function IconAnimBreatheGlyph() {
  return (
    <AnimSvg>
      <circle cx="8" cy="8" r="3.2" />
      <path
        d="M2.5 2.5l1.6 1.6M13.5 2.5l-1.6 1.6M2.5 13.5l1.6-1.6M13.5 13.5l-1.6-1.6"
        opacity="0.55"
      />
    </AnimSvg>
  );
}
// Shimmer — a four-point sparkle (a glint of light).
function IconAnimShimmerGlyph() {
  return (
    <AnimSvg>
      <path d="M8 2.5 9.2 6.8 13.5 8 9.2 9.2 8 13.5 6.8 9.2 2.5 8 6.8 6.8Z" />
      <path d="M12.5 3v1.6M11.7 3.8h1.6" opacity="0.6" />
    </AnimSvg>
  );
}

export function IconAnimKindGlyph({ kind }: { kind: IconAnimation | null }) {
  if (kind === 'spin') return <IconAnimSpinGlyph />;
  if (kind === 'beat') return <IconAnimBeatGlyph />;
  if (kind === 'pulse') return <IconAnimPulseGlyph />;
  if (kind === 'glow') return <IconAnimGlowGlyph />;
  if (kind === 'ping') return <IconAnimPingGlyph />;
  if (kind === 'breathe') return <IconAnimBreatheGlyph />;
  if (kind === 'shimmer') return <IconAnimShimmerGlyph />;
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

// Progress section icon (docs/specs/009-elements/progress.md): a half-filled pill.
export function ProgressMenuGlyph() {
  return (
    <Glyph size={MENU_ICON_PX} units={24}>
      <rect x="2" y="8" width="20" height="8" rx="4" />
      <path d="M6 8h5v8H6a4 4 0 0 1 0-8Z" fill="currentColor" stroke="none" />
    </Glyph>
  );
}

// Progress fill-animation tile glyphs (docs/specs/009-elements/progress.md): a partly-filled bar for Fill,
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

// The Size category glyph (docs/specs/008-canvas/element-size.md): "how big", against the
// aspect-lock mark below which reads as "keep the proportion".
export const SizeMenuIcon = lucideGlyph(lucideScaling, MENU_ICON_PX);
// The "lock aspect ratio" row glyph.
export const AspectLockMenuIcon = lucideGlyph(lucideProportions, MENU_ICON_PX);
// The "Text" category glyph.
export const TextGlyph = lucideGlyph(lucideType, MENU_ICON_PX);
// The "Icon" category glyph, and its struck-through sibling "remove the inline icon".
export const IconCategoryGlyph = lucideGlyph(lucideStar, MENU_ICON_PX);
export const RemoveIconGlyph = lucideGlyph(lucideStarOff, MENU_ICON_PX);

// Quick-action verbs (cut / copy / duplicate / remove / paste): the shared glyphs where one exists.
export const CutIcon = lucideGlyph(lucideScissors, QUICK_ACTION_ICON_PX);

export function CopyIcon() {
  return <SharedCopyIcon size={QUICK_ACTION_ICON_PX} />;
}

export function DuplicateMenuIcon() {
  return <DuplicateIcon size={QUICK_ACTION_ICON_PX} />;
}

export function RemoveIcon() {
  return <TrashIcon size={QUICK_ACTION_ICON_PX} />;
}

// Paste: a clipboard with a sheet lifting off it, so it never reads as Copy's two sheets.
export const PasteMenuIcon = lucideGlyph(lucideClipboardPaste, QUICK_ACTION_ICON_PX);

// Colour-category marks (docs/specs/008-canvas/canvas-and-palette.md Colours). "Text",
// "Background", "Border" and "Heading" are four labels of similar length; the glyph separates them
// at a glance. Each draws the SURFACE it paints, not a generic paint pot.

/** Text colour: a letterform over a baseline. */
export const TextColourIcon = lucideGlyph(lucideBaseline, MENU_ICON_PX);

const BOX = 'M5 4h14a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3Z';

/** Background: the box, its whole face flooded. */
export function FillColourIcon() {
  return (
    <Glyph size={MENU_ICON_PX} units={24}>
      <path d={BOX} fill="currentColor" />
    </Glyph>
  );
}

/** Border: the same box with only its edge drawn. */
export function BorderColourIcon() {
  return (
    <Glyph size={MENU_ICON_PX} units={24}>
      <path d={BOX} />
    </Glyph>
  );
}

/** Heading: the box again, with just its top band filled. */
export function HeadingColourIcon() {
  return (
    <Glyph size={MENU_ICON_PX} units={24}>
      <path d={BOX} />
      <path d="M5 4h14a3 3 0 0 1 3 3v2H2V7a3 3 0 0 1 3-3Z" fill="currentColor" />
    </Glyph>
  );
}

/** Pointer: an arrowhead, for the colour of the heads rather than the line. */
export function PointerColourIcon() {
  return (
    <Glyph size={MENU_ICON_PX} units={24}>
      <path d="M2 12h11" />
      <path d="M13 6.5 22 12l-9 5.5Z" fill="currentColor" />
    </Glyph>
  );
}
