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

import type { TextAlignX, TextAlignY } from '@liveplanner/project';
import {
  lucideCircleCheck,
  lucideFileDown,
  lucideFileUp,
  lucideThermometer,
} from '@liveplanner/icons/lucide';
import { Glyph, lucideGlyph, Prims } from '@liveplanner/ui';

import { MENU_ICON_PX } from '@/components/palette/context-menu-icons';

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

// The bottom-dock "Theme & canvas" button (docs/specs/011-theme/canvas-and-theme-dialog.md): a paintbrush on the
// 20-unit dock grid (matching LayersStackIcon's stroke weight) that opens
// the CanvasThemeDialog: it styles the whole tab.
export { ThemeLookIcon } from '@liveplanner/ui';

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

// The Timer counts down, so it wears an hourglass; the Stopwatch counts up, so it wears the stopwatch. One
// clock face for both left the two tiles side by side in the palette looking identical.
export function TimerIcon({ size = 14 }: IconSizeProps = {}) {
  return (
    <Glyph size={size} units={16}>
      {/* an hourglass: two caps, the glass pinched at the waist, sand settled at the bottom */}
      <path d="M4 1.6h8" />
      <path d="M4 14.4h8" />
      <path d="M5.2 1.6c0 3.2 2.8 4.4 2.8 6.4s-2.8 3.2-2.8 6.4" />
      <path d="M10.8 1.6c0 3.2-2.8 4.4-2.8 6.4s2.8 3.2 2.8 6.4" />
      <path d="M6.4 13.6h3.2L8 11.6z" fill="currentColor" stroke="none" />
    </Glyph>
  );
}

export function StopwatchIcon({ size = 14 }: IconSizeProps = {}) {
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

// Vote: the same glyph as its context-menu category.
export const VoteIcon = lucideGlyph(lucideCircleCheck, 14);

// --- Picker (docs/specs/012-collaboration/picker.md) ------------------------------

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

// --- The collaboration family (docs/specs/012-collaboration/temperature-check.md): Lucide's thermometer.

export function TemperatureIcon({ size = 14 }: IconSizeProps = {}) {
  return (
    <Glyph size={size} units={24}>
      <Prims prims={lucideThermometer} />
    </Glyph>
  );
}
