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

import type {
  ArrowEnds,
  ArrowStyle,
  BorderRadius,
  BorderStroke,
  BorderStyle,
  TextAlignX,
  TextAlignY,
} from '@livediagram/diagram';

export function BorderStrokeIcon({ value }: { value: BorderStroke }) {
  if (value === 'none') {
    // "No border" glyph: a small dashed outline rendered at low
    // opacity so it reads as "absence of a border" rather than as
    // a fifth thickness preset.
    return (
      <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
        <rect
          x="3"
          y="3"
          width="12"
          height="12"
          rx="2"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeDasharray="2 2"
          opacity="0.55"
        />
      </svg>
    );
  }
  const sw = { thin: 1, medium: 2, thick: 4, 'extra-thick': 7 }[value];
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
      <line
        x1="2"
        y1="9"
        x2="16"
        y2="9"
        stroke="currentColor"
        strokeWidth={sw}
        strokeLinecap="round"
      />
    </svg>
  );
}

export function BorderStyleIcon({ value }: { value: BorderStyle }) {
  const dash = value === 'solid' ? undefined : value === 'dashed' ? '4 3' : '1.5 2.5';
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
      <line
        x1="2"
        y1="9"
        x2="16"
        y2="9"
        stroke="currentColor"
        strokeWidth="2"
        strokeDasharray={dash}
        strokeLinecap="round"
      />
    </svg>
  );
}

export function BorderRadiusIcon({ value }: { value: BorderRadius }) {
  const rx = { none: 0, sm: 2, md: 4.5, lg: 7 }[value];
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
      <rect
        x="3"
        y="3"
        width="12"
        height="12"
        rx={rx}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
      />
    </svg>
  );
}

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
export function ThicknessIcon({ px }: { px: number }) {
  return (
    <svg width="22" height="14" viewBox="0 0 22 14" fill="none" aria-hidden>
      <line
        x1="3"
        y1="7"
        x2="19"
        y2="7"
        stroke="currentColor"
        strokeWidth={px}
        strokeLinecap="round"
      />
    </svg>
  );
}

// Mini chevron sized to the preset px so users can compare the
// pointer sizes visually before picking. Uses the same path shape as
// the real arrowhead marker so what you see is what you get.
export function ArrowheadSizeIcon({ px }: { px: number }) {
  return (
    <svg width="22" height="14" viewBox="0 0 22 14" fill="none" aria-hidden>
      <line x1="3" y1="7" x2="14" y2="7" stroke="currentColor" strokeWidth="1.6" />
      <path d={`M 14 ${7 - px / 2} L ${14 + px} 7 L 14 ${7 + px / 2} z`} fill="currentColor" />
    </svg>
  );
}

// 22×14 thumbnail of each path style. Reuses currentColor so the icon
// follows the SizeButton's active/inactive colour.
export function ArrowStyleIcon({ style }: { style: ArrowStyle }) {
  if (style === 'straight') {
    return (
      <svg width="22" height="14" viewBox="0 0 22 14" fill="none" aria-hidden>
        <path d="M 3 7 L 19 7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    );
  }
  if (style === 'curved') {
    return (
      <svg width="22" height="14" viewBox="0 0 22 14" fill="none" aria-hidden>
        <path
          d="M 3 10 Q 11 -1 19 10"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  return (
    <svg width="22" height="14" viewBox="0 0 22 14" fill="none" aria-hidden>
      <path
        d="M 3 11 L 11 11 L 11 3 L 19 3"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// Small circular-arrow glyph used by the "Reset elements to theme"
// button under the Theme accordion. 12×12 inside a 14×14 box.
export function ResetIcon() {
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
      <path d="M3 8 a5 5 0 1 0 1.5 -3.5" />
      <polyline points="2,2 4,4.5 6.5,3.5" />
    </svg>
  );
}

export function ArrowEndsIcon({ ends }: { ends: ArrowEnds }) {
  // Same shape language as the arrowhead used in ArrowView, scaled
  // down to fit a 14×14 button. Line spans the middle; chevrons sit
  // on the appropriate end(s). 'none' renders a plain line, a
  // connector with no pointer at either end.
  const showStart = ends === 'from' || ends === 'both';
  const showEnd = ends === 'to' || ends === 'both';
  return (
    <svg
      width="16"
      height="14"
      viewBox="0 0 20 12"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <line x1={showStart ? 4 : 2} y1="6" x2={showEnd ? 16 : 18} y2="6" />
      {showStart ? <path d="M2 6 L5 3 M2 6 L5 9" /> : null}
      {showEnd ? <path d="M18 6 L15 3 M18 6 L15 9" /> : null}
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
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {/* Two rectangles snapped to a common edge, the icon language
          for "align" used by most drawing tools. */}
      <rect x="2.5" y="3" width="5" height="4" rx="0.6" />
      <rect x="2.5" y="9" width="9" height="4" rx="0.6" />
      <path d="M2.5 14.5h11" />
    </svg>
  );
}

export function FileImportIcon() {
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
      <path d="M8 13.5V5.5" />
      <path d="M5 10.5l3 3 3-3" />
      <path d="M2.5 3v-0.5h11V3" />
    </svg>
  );
}

export function FileExportIcon() {
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
      <path d="M8 2v8" />
      <path d="M5 5l3-3 3 3" />
      <path d="M2.5 11v2.5h11V11" />
    </svg>
  );
}

export function PanIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M8 14V7" />
      <path d="M5 11V5a1.25 1.25 0 0 1 2.5 0v3" />
      <path d="M7.5 8V4a1.25 1.25 0 0 1 2.5 0v4" />
      <path d="M10 8V5a1.25 1.25 0 0 1 2.5 0v6a3.5 3.5 0 0 1-3.5 3.5H7" />
      <path d="M5 11l-1-1.5" />
    </svg>
  );
}

export function SelectIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinejoin="round"
      strokeLinecap="round"
      aria-hidden
    >
      <rect x="2" y="2" width="9" height="9" strokeDasharray="2 1.5" />
      <path d="M11 11l3 3" />
      <path d="M11 11l-1.5 -0.5l-0.5 -1.5" />
    </svg>
  );
}

export function LaserIcon() {
  // Stylised laser pointer: a beam emerging from a small body in the
  // bottom-left toward a glowing dot in the top-right.
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M2.5 13.5l8-8" />
      <circle cx="11.5" cy="4.5" r="1.4" fill="currentColor" stroke="none" />
      <path d="M10 3.2l.7-1" strokeWidth="1.2" />
      <path d="M12.8 3l1-.4" strokeWidth="1.2" />
      <path d="M12.8 6l1 .4" strokeWidth="1.2" />
    </svg>
  );
}

export function NonePaddingIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      aria-hidden
    >
      <rect x="2" y="2" width="12" height="12" rx="1.5" />
      <path d="M4 4l8 8M12 4l-8 8" />
    </svg>
  );
}

export function PaddingIcon({ size }: { size: 'sm' | 'md' | 'lg' }) {
  // Outer box stays at 14x14; the inner box shrinks to visualise the
  // padding amount. Mirrors the scale in PADDING_PX.
  const inset = size === 'sm' ? 2.5 : size === 'md' ? 4 : 5.5;
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="2" y="2" width="12" height="12" rx="1.5" strokeDasharray="1.5 1.5" />
      <rect x={2 + inset} y={2 + inset} width={12 - 2 * inset} height={12 - 2 * inset} rx="1" />
    </svg>
  );
}

export function ScaleIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3 8h10" />
      <path d="M3 8l2 -2M3 8l2 2" />
      <path d="M13 8l-2 -2M13 8l-2 2" />
    </svg>
  );
}

export function DotsIcon({ count }: { count: 1 | 2 | 3 }) {
  // Concentric size cue: 1 small dot, 2 mid dots, 3 larger dots. Each
  // dot's radius scales with `count` so the visual weight reads as
  // "size" at a glance.
  const radii = count === 1 ? [1.4] : count === 2 ? [1.8, 1.8] : [2.2, 2.2, 2.2];
  const spacing = count === 1 ? [8] : count === 2 ? [5, 11] : [3.5, 8, 12.5];
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
      {radii.map((r, i) => (
        <circle key={i} cx={spacing[i]} cy={8} r={r} />
      ))}
    </svg>
  );
}

export function AlignIcon({ x, y }: { x: TextAlignX; y: TextAlignY }) {
  const ix = x === 'left' ? 2 : x === 'right' ? 9 : 5.5;
  const iy = y === 'top' ? 3 : y === 'bottom' ? 10 : 6.5;
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden>
      <rect
        x="1"
        y="1"
        width="14"
        height="14"
        rx="1.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1"
      />
      <rect x={ix} y={iy} width="5" height="3" rx="0.5" fill="currentColor" />
    </svg>
  );
}

export function BringToFrontIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="2.5" y="2.5" width="7" height="7" rx="1" />
      <rect x="6.5" y="6.5" width="7" height="7" rx="1" fill="currentColor" fillOpacity="0.18" />
    </svg>
  );
}

export function SendToBackIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="2.5" y="2.5" width="7" height="7" rx="1" fill="currentColor" fillOpacity="0.18" />
      <rect x="6.5" y="6.5" width="7" height="7" rx="1" />
    </svg>
  );
}
