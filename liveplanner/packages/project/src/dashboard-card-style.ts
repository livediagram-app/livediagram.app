// A Dashboard card's style (docs/specs/026-plan/plan-tabs.md "Card style"): the look an Editor gives a Utility
// (Note, Title, Status, Checklist, Key Date, Links) from its Slot Options' Style row. A style preset is the shapes'
// own (theme-presets.ts shapeColorPresets), stored by id and resolved against the tab's theme when drawn, so a card
// tracks a theme change the way a preset-styled shape does; colours, border and shadow set by hand sit over it. A
// Title is drawn bare on the page, so its style is its text colour alone. Pure: read safely, never trusted as stored.

import type { DashboardContent, DashboardLayout } from './dashboard';
import {
  BORDER_DASH_ARRAY,
  BORDER_STROKE_PX,
  type BorderStroke,
  type BorderStyle,
} from '@liveworkspace/model-core/border-style';
import {
  MIN_TEXT_CONTRAST,
  canvasSurface,
  contrastRatio,
  inkOn,
  type CanvasSurface,
} from './colors';
import { clampShadow, type ElementShadow } from './shadow';
import { isHexColour } from './standard-colours';
import { mixHex } from './svg-render-face-kit';
import { shapeColorPresets } from './theme-presets';
import type { ThemeDefinition } from './themes';

// The slot contents that take a style: the Utilities.
export const DASHBOARD_STYLED_TYPES = [
  'note',
  'title',
  'status',
  'checklist',
  'key-date',
  'links',
] as const satisfies readonly DashboardContent['type'][];
export type DashboardStyledType = (typeof DASHBOARD_STYLED_TYPES)[number];

export function isDashboardStyledType(t: unknown): t is DashboardStyledType {
  return (DASHBOARD_STYLED_TYPES as readonly unknown[]).includes(t);
}

// `preset`: a shape style preset's id ('theme', 'soft', 'branch-0', 'info', ...). `fill`, `stroke` and `text`:
// `#rrggbb` or 'transparent', over the preset's. `borderWidth` / `borderStyle`: over the preset's border. `shadow`:
// the card's own in place of the Dashboard's soft lift, or 'none'.
export type DashboardCardStyle = {
  preset?: string;
  fill?: string;
  stroke?: string;
  text?: string;
  borderWidth?: BorderStroke;
  borderStyle?: BorderStyle;
  shadow?: ElementShadow | 'none';
};

const PRESET_ID = /^[a-z][a-z0-9-]{0,31}$/;
const readColour = (v: unknown) => (v === 'transparent' || isHexColour(v) ? v : undefined);
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

function readShadow(v: unknown): ElementShadow | 'none' | undefined {
  if (v === 'none') return 'none';
  if (!v || typeof v !== 'object') return undefined;
  const s = v as Record<string, unknown>;
  const [x, y, blur, opacity] = [
    num(s['offsetX']),
    num(s['offsetY']),
    num(s['blur']),
    num(s['opacity']),
  ];
  if (x === null || y === null || blur === null || opacity === null) return undefined;
  return clampShadow({ offsetX: x, offsetY: y, blur, opacity });
}

// A stored style, read safely for a card of `type`: unknown fields and values dropped, a Title keeping its text
// colour only. Undefined when nothing is left.
export function readDashboardCardStyle(
  v: unknown,
  type: DashboardStyledType,
): DashboardCardStyle | undefined {
  if (!v || typeof v !== 'object') return undefined;
  const s = v as Record<string, unknown>;
  const text = readColour(s['text']);
  const out: DashboardCardStyle =
    type === 'title'
      ? { ...(text ? { text } : {}) }
      : {
          ...(typeof s['preset'] === 'string' && PRESET_ID.test(s['preset'])
            ? { preset: s['preset'] }
            : {}),
          ...(readColour(s['fill']) ? { fill: readColour(s['fill'])! } : {}),
          ...(readColour(s['stroke']) ? { stroke: readColour(s['stroke'])! } : {}),
          ...(text ? { text } : {}),
          ...(typeof s['borderWidth'] === 'string' && s['borderWidth'] in BORDER_STROKE_PX
            ? { borderWidth: s['borderWidth'] as BorderStroke }
            : {}),
          ...(typeof s['borderStyle'] === 'string' && s['borderStyle'] in BORDER_DASH_ARRAY
            ? { borderStyle: s['borderStyle'] as BorderStyle }
            : {}),
          ...(readShadow(s['shadow']) ? { shadow: readShadow(s['shadow'])! } : {}),
        };
  return Object.keys(out).length > 0 ? out : undefined;
}

// The slot's card given `style` (undefined clears it): the same layout when the slot holds no Utility or nothing
// changes, so a change that changes nothing is no undo step.
export function setDashboardCardStyle(
  layout: DashboardLayout,
  slotId: string,
  style: DashboardCardStyle | undefined,
): DashboardLayout {
  let changed = false;
  const rows = layout.rows.map((row) => {
    if (!row.slots.some((s) => s.id === slotId)) return row;
    return {
      ...row,
      slots: row.slots.map((s) => {
        const c = s.content;
        if (s.id !== slotId || !c || !isDashboardStyledType(c.type)) return s;
        const before = (c as { style?: DashboardCardStyle }).style;
        const next = style ? readDashboardCardStyle(style, c.type) : undefined;
        if (JSON.stringify(before ?? null) === JSON.stringify(next ?? null)) return s;
        changed = true;
        const { style: _drop, ...rest } = c as typeof c & { style?: DashboardCardStyle };
        return { ...s, content: (next ? { ...rest, style: next } : rest) as DashboardContent };
      }),
    };
  });
  return changed ? { ...layout, rows } : layout;
}

// What a card is drawn with: its fill, border, inks and shadow, each absent where the Dashboard's own look stands.
// `ink` is the text; `inkSoft` the quieter lines (a note's text, "Updated 3 days ago"), the ink leaning toward the
// fill while it still reads at 4.5:1.
export type DashboardCardLook = {
  fill?: string;
  stroke?: string;
  borderWidth?: number;
  borderStyle?: 'solid' | 'dashed' | 'dotted';
  ink?: string;
  inkSoft?: string;
  shadow?: ElementShadow | 'none';
  // The paper the fill is, so what the card holds draws in that appearance's colours (a Status light, a link).
  surface?: CanvasSurface;
};

// CSS draws three border patterns: a dash-dot or long dash is drawn dashed.
const cssBorder = (s: BorderStyle): 'solid' | 'dashed' | 'dotted' =>
  s === 'solid' || s === 'dotted' ? s : 'dashed';

const opaque = (c: string | undefined): c is string => !!c && c !== 'transparent';

export function dashboardCardLook(
  style: DashboardCardStyle | undefined,
  theme: ThemeDefinition,
): DashboardCardLook {
  if (!style) return {};
  const preset = style.preset
    ? shapeColorPresets(theme).find((p) => p.id === style.preset)
    : undefined;
  const fill = style.fill ?? preset?.fill;
  const stroke = style.stroke ?? preset?.stroke;
  const width = style.borderWidth ?? preset?.borderStroke;
  const pattern = style.borderStyle ?? preset?.borderStyle;
  // The text: as set, else the preset's while its fill stands, else what reads on a fill set by hand.
  const ink =
    style.text ?? (preset && !style.fill ? preset.text : opaque(fill) ? inkOn(fill) : undefined);
  const soft =
    ink && opaque(fill) && isHexColour(ink) && isHexColour(fill)
      ? mixHex(ink, fill, 0.72)
      : undefined;
  const inkSoft = ink && soft && contrastRatio(soft, fill!) >= MIN_TEXT_CONTRAST ? soft : ink;
  return {
    ...(fill ? { fill } : {}),
    ...(stroke ? { stroke } : {}),
    ...(width ? { borderWidth: BORDER_STROKE_PX[width] } : {}),
    ...(pattern ? { borderStyle: cssBorder(pattern) } : {}),
    ...(ink ? { ink, inkSoft } : {}),
    ...(opaque(fill) && isHexColour(fill) ? { surface: canvasSurface(fill) } : {}),
    ...(style.shadow ? { shadow: style.shadow } : {}),
  };
}
