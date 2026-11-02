// Inspect (docs/specs/007-editor/wireframe-pages.md "Inspect"): what a wireframe element measures and how it is
// drawn, in the device's points, for the people who build it. Read through the export's own resolvers
// (describeBoxedExport, borderOf), so a value here is the value the canvas and every export draw, never a second
// reading of the model that could drift from them.
import { FONTS } from '@liveworkspace/model-core/fonts';
import { DEFAULT_BORDER_STYLE } from '@liveworkspace/model-core/border-style';
import type { CanvasSurface } from './colors';
import { elementFontId, resolveFinish, type Finish } from './finish';
import type { BoxedElement } from './index';
import { rotationOf } from './rotation';
import { borderOf } from './svg-render-border';
import { describeBoxedExport, finishOf } from './svg-render-describe';
import { LABEL_LINE_HEIGHT } from './svg-render-primitives';
import { resolvedFontWeight } from './wordmark';

/** A corner radius: px, or a circle (an ellipse's, written 50%). */
export type InspectRadius = number | 'circle';

export type InspectText = {
  // The face's name (Inter), and its CSS family as the canvas paints it.
  font: string;
  fontFamily: string;
  size: number;
  weight: number;
  italic: boolean;
  lineHeight: number;
  color: string;
  align: 'left' | 'center' | 'right';
};

/** One element, measured: its box from the origin (a wireframe page's screen), and its drawn style. */
export type InspectSpec = {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  opacity: number;
  // Null where the element paints none.
  fill: string | null;
  border: { color: string; width: number; style: string } | null;
  radius: InspectRadius | null;
  text: InspectText | null;
};

export type InspectContext = {
  // Where 0, 0 is: the top-left of the screen the element is on.
  origin: { x: number; y: number };
  tabFont?: string;
  tabFinish?: Finish;
  surface?: CanvasSurface;
};

// The UI sans every label falls back to when neither it nor its tab names a face.
// A bold label's weight, as the exporters draw it (svg-render-labels, svg-render-primitives).
const BOLD_LABEL_WEIGHT = 600;
const UI_SANS = { label: 'System Sans', stack: 'ui-sans-serif, system-ui, sans-serif' };

/** A colour as a builder reads it: a hex in capitals, anything else as stored; none for an unpainted part. */
export function inspectColour(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const v = raw.trim();
  if (v === '' || v === 'none' || v === 'transparent') return null;
  if (/^#[0-9a-f]{3}$/i.test(v)) {
    return `#${v
      .slice(1)
      .split('')
      .map((c) => c + c)
      .join('')}`.toUpperCase();
  }
  return /^#[0-9a-f]{6}([0-9a-f]{2})?$/i.test(v) ? v.toUpperCase() : v;
}

/** A measurement rounded to a tenth, a whole number bare: 12, 12.5. */
export function inspectNumber(n: number): number {
  const r = Math.round(n * 10) / 10;
  return Object.is(r, -0) ? 0 : r;
}

function fontOf(el: BoxedElement, ctx: InspectContext): { label: string; stack: string } {
  const id = el.font ?? elementFontId({ finish: finishOf(el) }, ctx.tabFont, ctx.tabFinish);
  const font = id ? FONTS.find((f) => f.id === id) : undefined;
  return font ? { label: font.label, stack: font.stack } : UI_SANS;
}

function radiusOf(
  el: BoxedElement,
  kind: string,
  finish: Finish,
  imageRadius: number,
): InspectRadius | null {
  if (kind === 'ellipse') return 'circle';
  // A 'full' image corner is stored as a huge radius; CSS clamps it to half the shorter side, so does this.
  if (kind === 'image')
    return inspectNumber(Math.min(imageRadius, Math.min(el.width, el.height) / 2));
  if (kind !== 'rect') return null;
  if (el.type === 'sticky') return 0;
  if (el.type === 'shape') {
    if (el.shape === 'stadium') return inspectNumber(Math.min(el.width, el.height) / 2);
    return inspectNumber(borderOf(el, finish).radius);
  }
  return 6;
}

export function inspectElement(el: BoxedElement, ctx: InspectContext): InspectSpec {
  const described = describeBoxedExport(el, {
    tabFont: ctx.tabFont,
    tabFinish: ctx.tabFinish,
    surface: ctx.surface,
  });
  const finish = resolveFinish(finishOf(el), ctx.tabFinish);
  const shape = described.shape;
  const paints = shape.kind === 'rect' || shape.kind === 'ellipse' || shape.kind === 'diamond';
  const fill = paints ? inspectColour(shape.fill) : null;
  const strokeColour = paints ? inspectColour(shape.stroke) : null;
  // A shape's border is its own; every other boxed kind is drawn with the export's 1.5px line.
  const borderWidth = el.type === 'shape' ? borderOf(el, finish).width : 1.5;
  const borderStyle =
    el.type === 'shape' ? (el.strokeStyle ?? DEFAULT_BORDER_STYLE) : DEFAULT_BORDER_STYLE;
  const border =
    strokeColour && borderWidth > 0
      ? { color: strokeColour, width: inspectNumber(borderWidth), style: borderStyle }
      : null;
  const label = described.label;
  const font = fontOf(el, ctx);
  const text: InspectText | null = label
    ? {
        font: font.label,
        fontFamily: font.stack,
        size: inspectNumber(label.size),
        weight: el.type === 'text' ? resolvedFontWeight(el) : label.bold ? BOLD_LABEL_WEIGHT : 400,
        italic: label.italic,
        lineHeight: inspectNumber(label.size * LABEL_LINE_HEIGHT),
        color: inspectColour(label.color) ?? label.color,
        align: label.anchor === 'start' ? 'left' : label.anchor === 'end' ? 'right' : 'center',
      }
    : null;
  return {
    x: inspectNumber(el.x - ctx.origin.x),
    y: inspectNumber(el.y - ctx.origin.y),
    width: inspectNumber(el.width),
    height: inspectNumber(el.height),
    rotation: inspectNumber(rotationOf(el)),
    opacity: inspectNumber(described.opacity),
    fill,
    border,
    radius: radiusOf(el, shape.kind, finish, shape.kind === 'image' ? shape.radius : 0),
    text,
  };
}

const px = (n: number) => `${inspectNumber(n)}px`;
const radiusCss = (r: InspectRadius) => (r === 'circle' ? '50%' : px(r));
const CSS_BORDER_STYLE: Record<string, string> = { solid: 'solid', dotted: 'dotted' };

/** The element as CSS declarations, one per line, in px. */
export function inspectCss(spec: InspectSpec): string {
  const lines: string[] = [
    `width: ${px(spec.width)};`,
    `height: ${px(spec.height)};`,
    `left: ${px(spec.x)};`,
    `top: ${px(spec.y)};`,
  ];
  if (spec.rotation) lines.push(`transform: rotate(${spec.rotation}deg);`);
  if (spec.opacity !== 1) lines.push(`opacity: ${spec.opacity};`);
  if (spec.fill) lines.push(`background: ${spec.fill};`);
  if (spec.border) {
    // CSS draws solid, dashed and dotted; every other dash pattern reads as dashed.
    const style = CSS_BORDER_STYLE[spec.border.style] ?? 'dashed';
    lines.push(`border: ${px(spec.border.width)} ${style} ${spec.border.color};`);
  }
  if (spec.radius) lines.push(`border-radius: ${radiusCss(spec.radius)};`);
  const t = spec.text;
  if (t) {
    lines.push(
      `color: ${t.color};`,
      `font-family: ${t.fontFamily};`,
      `font-size: ${px(t.size)};`,
      `font-weight: ${t.weight};`,
    );
    if (t.italic) lines.push('font-style: italic;');
    lines.push(`line-height: ${px(t.lineHeight)};`, `text-align: ${t.align};`);
  }
  return lines.join('\n');
}

/** One named value the panel shows and Copy Values copies. */
export type InspectValue = { group: InspectGroup; name: string; value: string };
export type InspectGroup = 'layout' | 'colours' | 'border' | 'text';

const STYLE_NAME: Record<string, string> = {
  solid: 'Solid',
  dashed: 'Dashed',
  dotted: 'Dotted',
  'dash-dot': 'Dash Dot',
  'long-dash': 'Long Dash',
  'dash-dot-dot': 'Dash Dot Dot',
};
const ALIGN_NAME = { left: 'Left', center: 'Centre', right: 'Right' } as const;

/** Every value, named and grouped, in the panel's order: what the rows show and Copy Values copies. */
export function inspectValues(spec: InspectSpec): InspectValue[] {
  const out: InspectValue[] = [
    { group: 'layout', name: 'W', value: String(spec.width) },
    { group: 'layout', name: 'H', value: String(spec.height) },
    { group: 'layout', name: 'X', value: String(spec.x) },
    { group: 'layout', name: 'Y', value: String(spec.y) },
  ];
  if (spec.rotation) out.push({ group: 'layout', name: 'Rotation', value: `${spec.rotation}°` });
  if (spec.opacity !== 1)
    out.push({
      group: 'layout',
      name: 'Opacity',
      value: `${inspectNumber(spec.opacity * 100)}%`,
    });
  out.push(
    { group: 'colours', name: 'Fill', value: spec.fill ?? 'None' },
    { group: 'colours', name: 'Border', value: spec.border?.color ?? 'None' },
  );
  if (spec.border) {
    out.push(
      { group: 'border', name: 'Width', value: String(spec.border.width) },
      { group: 'border', name: 'Style', value: STYLE_NAME[spec.border.style] ?? spec.border.style },
    );
  }
  if (spec.radius !== null) {
    out.push({
      group: 'border',
      name: 'Radius',
      value: spec.radius === 'circle' ? '50%' : String(spec.radius),
    });
  }
  const t = spec.text;
  if (t) {
    out.push(
      { group: 'text', name: 'Font', value: t.italic ? `${t.font} Italic` : t.font },
      { group: 'text', name: 'Size', value: String(t.size) },
      { group: 'text', name: 'Weight', value: String(t.weight) },
      { group: 'text', name: 'Line Height', value: String(t.lineHeight) },
      { group: 'text', name: 'Colour', value: t.color },
      { group: 'text', name: 'Align', value: ALIGN_NAME[t.align] },
    );
  }
  return out;
}

/** Copy Values' text: every value as `Name: value`, a line each, prefixed by its group where names repeat. */
export function inspectValuesText(values: readonly InspectValue[]): string {
  const prefix: Record<InspectGroup, string> = {
    layout: '',
    colours: '',
    border: 'Border ',
    text: 'Text ',
  };
  return values
    .map((v) => {
      // "Border Width", "Text Size": a name alone could be either part's.
      const named =
        v.group === 'border' || v.group === 'text' ? `${prefix[v.group]}${v.name}` : v.name;
      return `${named}: ${v.value}`;
    })
    .join('\n');
}
