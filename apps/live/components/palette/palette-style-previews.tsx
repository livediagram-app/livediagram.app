// Style-value previews for the palette and context menus: each draws the value it picks (a border
// weight, dash, radius, line thickness, arrow style, head shape or ends) at its real proportions, so
// they keep their own strokes rather than the house icon weight
// (docs/specs/004-interface-design/iconography.md, "Art").

import { BORDER_STROKE_PX } from '@livediagram/document';
import type {
  ArrowEnds,
  ArrowheadShape,
  ArrowStyle,
  BorderRadius,
  BorderStroke,
  BorderStyle,
} from '@livediagram/document';
import { Glyph } from '@livediagram/ui';

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
  // Reuse the renderer's canonical stroke-weight scale so the preview line
  // can't drift from the real border widths. `value` is never 'none' here
  // (handled above), so the px is always defined.
  const sw = BORDER_STROKE_PX[value];
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

// Icon-scale dash patterns (tuned for an 18px line at strokeWidth 2),
// not the renderer's user-unit BORDER_DASH_ARRAY.
const BORDER_ICON_DASH: Record<BorderStyle, string | undefined> = {
  solid: undefined,
  dashed: '4 3',
  // round linecap (below) turns the ~0-length segment into a true dot
  dotted: '0.5 3',
  'long-dash': '9 4',
  'dash-dot': '5 2.5 0.5 2.5',
  'dash-dot-dot': '5 2.5 0.5 2.5 0.5 2.5',
};

export function BorderStyleIcon({ value }: { value: BorderStyle }) {
  const dash = BORDER_ICON_DASH[value];
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
  // 'full' → half the 12-wide rect, so the preview reads as a circle/pill.
  const rx = { none: 0, sm: 2, md: 4.5, lg: 7, full: 6 }[value];
  return (
    <Glyph size={18} units={18}>
      <rect x="3" y="3" width="12" height="12" rx={rx} />
    </Glyph>
  );
}

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
export function ArrowheadShapeIcon({ shape }: { shape: ArrowheadShape }) {
  // A short line with the head shape at the right end, mirroring the
  // marker geometry ArrowView paints. Hollow variants draw as an
  // outline (fill="none") so they read as hollow on light and dark
  // buttons alike.
  const head = () => {
    switch (shape) {
      case 'triangle':
        return <path d="M13 3 L21 7 L13 11 z" fill="currentColor" />;
      case 'triangle-hollow':
        return (
          <path d="M13 3 L21 7 L13 11 z" fill="none" stroke="currentColor" strokeWidth="1.4" />
        );
      case 'line':
        return (
          <path
            d="M13 3 L21 7 L13 11"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        );
      case 'circle':
        return <circle cx="17" cy="7" r="4" fill="currentColor" />;
      case 'circle-hollow':
        return (
          <circle cx="17" cy="7" r="3.4" fill="none" stroke="currentColor" strokeWidth="1.4" />
        );
      case 'diamond':
        return <path d="M13 7 L17 3 L21 7 L17 11 z" fill="currentColor" />;
      case 'diamond-hollow':
        return (
          <path
            d="M13 7 L17 3 L21 7 L17 11 z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.4"
          />
        );
    }
  };
  return (
    <svg width="24" height="14" viewBox="0 0 24 14" fill="none" aria-hidden>
      <line x1="2" y1="7" x2="13" y2="7" stroke="currentColor" strokeWidth="1.6" />
      {head()}
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
