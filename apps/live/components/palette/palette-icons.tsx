// Local glyph set for CommandPalette's accordions, toolbar rows and
// button tiles. Lifted out of CommandPalette.tsx (which was up over
// 2600 lines) so the panel file reads as panel logic and these stay
// as pure-render presentational components. Same pattern as
// background-pattern-icons.tsx, which already pulled the canvas
// pattern glyphs out for the same reason.
//
// All icons are internal to the live editor's palette: no consumer
// outside CommandPalette.tsx imports them today, but the exports
// make this file self-contained and testable in isolation. Adding a
// new palette glyph belongs here unless it's shared across panels
// (in which case it goes into a sibling icon module).

import type { TextAlignX, TextAlignY } from '@livediagram/document';
import {
  lucideArmchair,
  lucideChartNoAxesColumnIncreasing,
  lucideCircleCheck,
  lucideFileDown,
  lucideFileUp,
  lucideLightbulb,
  lucideScanEye,
  lucideSpade,
  lucideThermometer,
} from '@livediagram/icons/lucide';
import { Glyph, lucideGlyph, Prims } from '@livediagram/ui';

import { MENU_ICON_PX } from '@/components/palette/context-menu-icons';
import { MODE_GLYPHS } from '@livediagram/icons/mode-glyphs';

// Palette glyphs draw at 14px in toolbars and menus; the tile grid asks for its own step.
type IconSizeProps = { size?: number };

export function BoldIcon() {
  return (
    <span className="text-[13px] font-bold leading-none text-slate-700 dark:text-slate-200">B</span>
  );
}

export function ItalicIcon() {
  return (
    <span className="text-[13px] font-semibold italic leading-none text-slate-700 dark:text-slate-200">
      I
    </span>
  );
}

export function UnderlineIcon() {
  return (
    <span
      className="text-[13px] font-semibold leading-none text-slate-700 dark:text-slate-200"
      style={{ textDecoration: 'underline' }}
    >
      U
    </span>
  );
}

export function StrikethroughIcon() {
  return (
    <span
      className="text-[13px] font-semibold leading-none text-slate-700 dark:text-slate-200"
      style={{ textDecoration: 'line-through' }}
    >
      S
    </span>
  );
}

// Renders a short horizontal line at the given stroke-width inside the
// SizeButton frame so the user can pick a thickness preset visually
// rather than by name.
export function ResetIcon() {
  return (
    <Glyph size={12} units={16}>
      <path d="M3 8 a5 5 0 1 0 1.5 -3.5" />
      <polyline points="2,2 4,4.5 6.5,3.5" />
    </Glyph>
  );
}

// Import into / export out of a tab (the tab menu's Content rows).
export const FileImportIcon = lucideGlyph(lucideFileDown, MENU_ICON_PX);
export const FileExportIcon = lucideGlyph(lucideFileUp, MENU_ICON_PX);

export function PanIcon({ size = 14 }: IconSizeProps = {}) {
  return <ModeGlyphIcon mode="pan" size={size} />;
}

export function SelectIcon({ size = 14 }: IconSizeProps = {}) {
  return <ModeGlyphIcon mode="select" size={size} />;
}

export function LaserIcon({ size = 14 }: IconSizeProps = {}) {
  return <ModeGlyphIcon mode="laser" size={size} />;
}

// Isometric view tool (docs/specs/008-canvas/isometric-view.md): a cube drawn in isometric projection —
// a top rhombus plus the two front faces — signalling "see the diagram in
// 3-D, tilted". The shared vertical edge hints at the extruded depth.
export function IsometricIcon({ size = 14 }: IconSizeProps = {}) {
  return <ModeGlyphIcon mode="isometric" size={size} />;
}

// Eraser tool (docs/specs/008-canvas/canvas-and-palette.md): a tilted block eraser sitting on the canvas
// baseline. The diagonal band reads as the eraser's two-tone body.
// The Highlighter tool (docs/specs/008-canvas/highlighter.md), which is a canvas mode rather than a one-shot
// draw intent. A chisel-tip marker over the band it lays down: the band is what
// separates it from the pencil at 13px, where the two nibs are the same three
// strokes. Monochrome (unlike the old palette tile's fixed yellow) because this
// glyph rides the tool dropdown and a Mode Button face, both of which tint it.
export function HighlighterIcon({ size = 14 }: IconSizeProps = {}) {
  return <ModeGlyphIcon mode="highlighter" size={size} />;
}

// Slide Deck (docs/specs/012-collaboration/presentation-mode.md): a card with a smaller one behind it, which is what a
// deck IS. Deliberately not a "play" triangle — the tool opens the workbench
// where you build slides, and only the Start button inside it presents.
export function SlideDeckIcon() {
  return (
    <Glyph size={14} units={16}>
      <rect x="1.5" y="4.5" width="10" height="7.5" rx="1.2" />
      <path d="M4.5 2.5h8a1.2 1.2 0 0 1 1.2 1.2v6.3" />
    </Glyph>
  );
}

export function EraserIcon({ size = 14 }: IconSizeProps = {}) {
  return <ModeGlyphIcon mode="eraser" size={size} />;
}

// The bottom-dock "Theme & canvas" button (docs/specs/011-theme/canvas-and-theme-dialog.md): a paintbrush on the
// 20-unit dock grid (matching LayersStackIcon's stroke weight) that opens
// the CanvasThemeDialog. Distinct from FormatPainterIcon below (the
// element-to-element format tool): this one styles the whole tab.
export function ThemeBrushIcon({ size = 20 }: { size?: number }) {
  return (
    <Glyph size={size} units={20}>
      <path d="M17 3c-3 1-6.4 3.6-8.3 6.1l2.2 2.2C13.4 9.4 16 6 17 3z" />
      <path d="M8.7 9.1 6.5 11.3" />
      <path d="M8 13.4a2.6 2.6 0 1 1-3.7-2.3c.8-.4 1.9-.2 2.6.5.7.7.9 1.3 1.1 1.8z" />
    </Glyph>
  );
}

// Format tool (docs/specs/008-canvas/canvas-and-palette.md): a paintbrush, the same glyph as the top-centre
// "Copy formatting" chip (drawn once in @livediagram/ui): picks one
// element's style and paints it onto others. Two-phase persistent mode
// (pick a base, then tap targets).
export { FormatPainterIcon } from '@livediagram/ui';

// Spotlight tool (docs/specs/008-canvas/canvas-and-palette.md): a focus glyph — a bright centre dot ringed
// by a circle with short rays beaming outward, reading as "the cursor
// emits light" without copying the laser-pointer beam.
export function SpotlightIcon({ size = 14 }: IconSizeProps = {}) {
  return <ModeGlyphIcon mode="spotlight" size={size} />;
}

// Avatar mode (docs/specs/008-canvas/avatar-mode.md): footprints, so the picker entry reads as "a
// character that walks" rather than a person / profile photo (which is what the
// palette's Avatar ELEMENT tile means).
export function AvatarModeIcon({ size = 14 }: IconSizeProps = {}) {
  return <ModeGlyphIcon mode="avatar" size={size} />;
}

// Zen / focus mode (docs/specs/007-editor/zen-mode.md): an "expand to fullscreen" glyph (four
// corner arrows pushing outward) for the palette enter button.
export function ZenIcon() {
  return (
    <Glyph size={14} units={16}>
      <path d="M6 2H2v4" />
      <path d="M10 2h4v4" />
      <path d="M14 10v4h-4" />
      <path d="M2 10v4h4" />
    </Glyph>
  );
}

// "Exit fullscreen" / compress glyph (corner arrows pulling inward) for
// the exit-zen control next to the zoom controls.
export function ZenExitIcon() {
  return (
    <Glyph size={14} units={16}>
      <path d="M2 6h4V2" />
      <path d="M14 6h-4V2" />
      <path d="M14 10h-4v4" />
      <path d="M2 10h4v4" />
    </Glyph>
  );
}

export function NonePaddingIcon() {
  return (
    <Glyph size={14} units={16} strokeLinejoin="miter">
      <rect x="2" y="2" width="12" height="12" rx="1.5" />
      <path d="M4 4l8 8M12 4l-8 8" />
    </Glyph>
  );
}

export function PaddingIcon({ size }: { size: 'sm' | 'md' | 'lg' }) {
  // Outer box stays at 14x14; the inner box shrinks to visualise the
  // padding amount. Mirrors the scale in PADDING_PX.
  const inset = size === 'sm' ? 2.5 : size === 'md' ? 4 : 5.5;
  return (
    <Glyph size={14} units={16} strokeLinecap="butt">
      <rect x="2" y="2" width="12" height="12" rx="1.5" strokeDasharray="1.5 1.5" />
      <rect x={2 + inset} y={2 + inset} width={12 - 2 * inset} height={12 - 2 * inset} rx="1" />
    </Glyph>
  );
}

export function ScaleIcon() {
  return (
    <Glyph size={14} units={16}>
      <path d="M3 8h10" />
      <path d="M3 8l2 -2M3 8l2 2" />
      <path d="M13 8l-2 -2M13 8l-2 2" />
    </Glyph>
  );
}

export function DotsIcon({ count }: { count: 1 | 2 | 3 }) {
  // Concentric size cue: 1 small dot, 2 mid dots, 3 larger dots. Each
  // dot's radius scales with `count` so the visual weight reads as
  // "size" at a glance.
  const radii = count === 1 ? [1.4] : count === 2 ? [1.8, 1.8] : [2.2, 2.2, 2.2];
  const spacing = count === 1 ? [8] : count === 2 ? [5, 11] : [3.5, 8, 12.5];
  return (
    <Glyph size={14} units={16} filled>
      {radii.map((r, i) => (
        <circle key={i} cx={spacing[i]} cy={8} r={r} />
      ))}
    </Glyph>
  );
}

export function AlignIcon({ x, y }: { x: TextAlignX; y: TextAlignY }) {
  const ix = x === 'left' ? 2 : x === 'right' ? 9 : 5.5;
  const iy = y === 'top' ? 3 : y === 'bottom' ? 10 : 6.5;
  return (
    <Glyph size={14} units={16}>
      <rect x="1.5" y="1.5" width="13" height="13" rx="1.5" />
      <rect x={ix} y={iy} width="5" height="3" rx="0.5" fill="currentColor" stroke="none" />
    </Glyph>
  );
}

// --- Session tools (docs/specs/012-collaboration/session-button.md) ------------------------------------------------
// 14px, not 13, like every small glyph in this file: an odd size centred in
// an even tile lands on a half pixel and its strokes blur (docs/specs/007-editor/toolbar-layout.md).
// The three glyphs a Session button wears, in the same 16-grid, 1.4-stroke
// house style as the mode icons above so a row of Behaviour tiles matches.

export function TimerIcon({ size = 14 }: IconSizeProps = {}) {
  return (
    <Glyph size={size} units={16}>
      {/* a stopwatch: crown, dial, and a hand at ten past */}
      <path d="M6.4 1.6h3.2" />
      <path d="M8 1.6v1.6" />
      <circle cx="8" cy="9" r="5" />
      <path d="M8 9V6.4" />
      <path d="M8 9l2 1.6" />
    </Glyph>
  );
}

// Vote and Poll: the same glyphs as their context-menu categories.
export const VoteIcon = lucideGlyph(lucideCircleCheck, 14);

export const PollIcon = lucideGlyph(lucideChartNoAxesColumnIncreasing, 14);

// --- Reveal zone (docs/specs/009-elements/reveal-zone.md) + Picker (docs/specs/012-collaboration/picker.md) ------------------------------

export function RevealIcon({ size = 14 }: IconSizeProps = {}) {
  return (
    <Glyph size={size} units={24}>
      <Prims prims={lucideScanEye} />
    </Glyph>
  );
}

export function PickerIcon({ size = 14 }: IconSizeProps = {}) {
  return (
    <Glyph size={size} units={16}>
      {/* a die mid-roll */}
      <rect x="2.6" y="2.6" width="10.8" height="10.8" rx="2.2" />
      <circle cx="5.8" cy="5.8" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="10.2" cy="10.2" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="8" cy="8" r="0.9" fill="currentColor" stroke="none" />
    </Glyph>
  );
}

// --- Chair + the collaboration family (docs/specs/009-elements/chair.md, docs/specs/012-collaboration/estimate-card.md to docs/specs/012-collaboration/roll-call.md) -----
// In-house members share one 16-unit frame; the rest are Lucide (chair, estimate card, thermometer,
// light bulb).

function CollabGlyph({ size, children }: { size: number; children: React.ReactNode }) {
  return (
    <Glyph size={size} units={16}>
      {children}
    </Glyph>
  );
}

export function ChairIcon({ size = 14 }: IconSizeProps = {}) {
  return (
    <Glyph size={size} units={24}>
      <Prims prims={lucideArmchair} />
    </Glyph>
  );
}

export function EstimateIcon({ size = 14 }: IconSizeProps = {}) {
  return (
    <Glyph size={size} units={24}>
      <Prims prims={lucideSpade} />
    </Glyph>
  );
}

export function TemperatureIcon({ size = 14 }: IconSizeProps = {}) {
  return (
    <Glyph size={size} units={24}>
      <Prims prims={lucideThermometer} />
    </Glyph>
  );
}

export function IdeaBoxIcon({ size = 14 }: IconSizeProps = {}) {
  return (
    <Glyph size={size} units={24}>
      <Prims prims={lucideLightbulb} />
    </Glyph>
  );
}

export function QaBoardIcon({ size = 14 }: IconSizeProps = {}) {
  return (
    <CollabGlyph size={size}>
      {/* a ranked list with an upvote chevron on the top row */}
      <path d="M2.4 5.6l1.6-1.6 1.6 1.6" />
      <path d="M7.4 4.8h6.2" />
      <path d="M7.4 8.4h5" />
      <path d="M7.4 12h3.6" />
      <path d="M3.4 8.6v.1" />
      <path d="M3.4 12.2v.1" />
    </CollabGlyph>
  );
}

export function AgendaIcon({ size = 14 }: IconSizeProps = {}) {
  return (
    <CollabGlyph size={size}>
      {/* a run of segments, each with its time against it */}
      <path d="M2.6 4.4h6.2" />
      <path d="M2.6 8h6.2" />
      <path d="M2.6 11.6h6.2" />
      <circle cx="12.6" cy="8" r="2.6" />
      <path d="M12.6 6.8V8l.9.7" />
    </CollabGlyph>
  );
}

export function DecisionIcon({ size = 14 }: IconSizeProps = {}) {
  return (
    <CollabGlyph size={size}>
      {/* a record card with a tick in its corner chip */}
      <rect x="2.4" y="2.8" width="11.2" height="10.4" rx="1.6" />
      <path d="M4.8 6.2h4.4" />
      <path d="M4.8 9h2.6" />
      <path d="M9.4 10.6l1.3 1.3 2.2-2.6" />
    </CollabGlyph>
  );
}

export function RollCallIcon({ size = 14 }: IconSizeProps = {}) {
  return (
    <CollabGlyph size={size}>
      {/* three heads: who was here, not who is here */}
      <circle cx="5" cy="5.6" r="2" />
      <circle cx="11.2" cy="5.6" r="2" />
      <path d="M1.8 12.4a3.4 3.4 0 0 1 6.4 0" />
      <path d="M8.6 12.4a3.4 3.4 0 0 1 5.6-1.5" />
    </CollabGlyph>
  );
}

/** Session tools (docs/specs/012-collaboration/session-button.md): dot voting, drawn as dots landing on a card. */
export function SessionVoteIcon() {
  return (
    <Glyph size={18} units={24}>
      <rect x="3" y="5" width="18" height="14" rx="2.2" />
      <circle cx="8.5" cy="11" r="1.9" fill="currentColor" stroke="none" />
      <circle cx="14" cy="11" r="1.9" fill="currentColor" stroke="none" />
      <circle cx="11.2" cy="15.4" r="1.9" fill="currentColor" stroke="none" />
    </Glyph>
  );
}

/** Session tools (docs/specs/012-collaboration/session-button.md): a poll, drawn as answer bars of different lengths. */
export function SessionPollIcon() {
  return (
    <Glyph size={18} units={24} strokeLinejoin="miter">
      <path d="M4 6.5h15M4 12h9.5M4 17.5h12.5" />
    </Glyph>
  );
}

// A selection-mode glyph drawn from the shared data (MODE_GLYPHS in
// @livediagram/icons), the ONE drawing the palette, the Mode button face and
// the export all use (docs/specs/009-elements/mode-button.md).
function ModeGlyphIcon({ mode, size }: { mode: string; size: number }) {
  const g = MODE_GLYPHS[mode]!;
  return (
    <Glyph size={size} units={g.units}>
      <Prims prims={g.prims} />
    </Glyph>
  );
}
