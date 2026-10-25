// Local glyph set for the palette's accordions, toolbar rows and
// button tiles. Lifted out of the old CommandPalette.tsx (which was up over
// 2600 lines) so the panel file reads as panel logic and these stay
// as pure-render presentational components. Same pattern as
// background-pattern-icons.tsx, which already pulled the canvas
// pattern glyphs out for the same reason.
//
// All icons are internal to the live editor's palette: no consumer
// outside the palette imports them today, but the exports
// make this file self-contained and testable in isolation. Adding a
// new palette glyph belongs here unless it's shared across panels
// (in which case it goes into a sibling icon module).

import type { TextAlignX, TextAlignY } from '@livedesign/design';
import { lucideFileDown, lucideFileUp, lucidePenTool } from '@liveworkspace/icons/lucide';
import { Glyph, lucideGlyph, Prims } from '@livedesign/ui';

import { MENU_ICON_PX } from '@liveworkspace/workbench/components/palette/context-menu-icons';
import { MODE_GLYPHS } from '@liveworkspace/icons/mode-glyphs';

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

// Import into / export out of a tab (the tab menu's Content rows).
export const FileImportIcon = lucideGlyph(lucideFileDown, MENU_ICON_PX);
export const FileExportIcon = lucideGlyph(lucideFileUp, MENU_ICON_PX);

export function PanIcon({ size = 14 }: IconSizeProps = {}) {
  return <ModeGlyphIcon mode="pan" size={size} />;
}

// The Shape Pen (docs/specs/008-canvas/two-pens.md): its palette tile and the Pen
// (docs/specs/023-draw-mode/path-tool.md "Where it lives") wear this one icon, each at its size.
export function ShapePenIcon({ size = 14 }: IconSizeProps = {}) {
  return (
    <Glyph size={size} units={24}>
      <Prims prims={lucidePenTool} />
    </Glyph>
  );
}

// Edit points (docs/specs/023-draw-mode/path-tool.md "Editing"): a curve through a corner node
// (square, selected) and another, with one handle. On the selection toolbar.
export function EditPointsIcon({ size = 14 }: IconSizeProps = {}) {
  return (
    <Glyph size={size} units={24}>
      <path d="M4.5 19.5 C4.5 9 19.5 15 19.5 4.5" />
      <path d="M4.5 19.5 V10" strokeWidth={1} />
      <circle cx="4.5" cy="10" r="1.3" fill="currentColor" stroke="none" />
      <rect x="2.7" y="17.7" width="3.6" height="3.6" fill="currentColor" />
      <rect x="17.7" y="2.7" width="3.6" height="3.6" />
    </Glyph>
  );
}

export function SelectIcon({ size = 14 }: IconSizeProps = {}) {
  return <ModeGlyphIcon mode="select" size={size} />;
}

export function LaserIcon({ size = 14 }: IconSizeProps = {}) {
  return <ModeGlyphIcon mode="laser" size={size} />;
}

// Eraser tool (docs/specs/008-canvas/canvas-and-palette.md): a tilted block eraser sitting on the canvas
// baseline. The diagonal band reads as the eraser's two-tone body.
// The Highlighter tile (docs/specs/008-canvas/highlighter.md), in the Draw category beside the pens.
// A chisel-tip marker over the band it lays down: the band is what separates it
// from the pencil at 13px, where the two nibs are the same three strokes.
// Monochrome, tinted like the Shape Pen's glyph beside it. The drawing is the
// one it wore as a selection mode, kept in MODE_GLYPHS.
export function HighlighterIcon({ size = 14 }: IconSizeProps = {}) {
  return <ModeGlyphIcon mode="highlighter" size={size} />;
}

export function EraserIcon({ size = 14 }: IconSizeProps = {}) {
  return <ModeGlyphIcon mode="eraser" size={size} />;
}

// The bottom-dock "Theme & canvas" button (docs/specs/011-theme/canvas-and-theme-dialog.md): a paintbrush on the
// 20-unit dock grid (matching LayersStackIcon's stroke weight) that opens
// the CanvasThemeDialog. Distinct from FormatPainterIcon below (the
// element-to-element format tool): this one styles the whole tab.
export { ThemeLookIcon } from '@livedesign/ui';

// Format tool (docs/specs/008-canvas/canvas-and-palette.md): a paintbrush, the same glyph as the top-centre
// "Copy formatting" chip (drawn once in @livedesign/ui): picks one
// element's style and paints it onto others. Two-phase persistent mode
// (pick a base, then tap targets).
export { FormatPainterIcon } from '@livedesign/ui';

// Spotlight tool (docs/specs/008-canvas/canvas-and-palette.md): a focus glyph — a bright centre dot ringed
// by a circle with short rays beaming outward, reading as "the cursor
// emits light" without copying the laser-pointer beam.
export function SpotlightIcon({ size = 14 }: IconSizeProps = {}) {
  return <ModeGlyphIcon mode="spotlight" size={size} />;
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

// A selection-mode glyph drawn from the shared data (MODE_GLYPHS in
// @liveworkspace/icons), the ONE drawing the palette and the export use.
function ModeGlyphIcon({ mode, size }: { mode: string; size: number }) {
  const g = MODE_GLYPHS[mode]!;
  return (
    <Glyph size={size} units={g.units}>
      <Prims prims={g.prims} />
    </Glyph>
  );
}
