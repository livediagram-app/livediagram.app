// Building the livediagram element for a classified draw.io vertex
// (docs/specs/020-import-export/blueprints/drawio-import.md steps 9-14):
// shapes, text, notes, lines, images, icons, frames and labelled boxes.
// Containers with a meaning (lanes, entities, tables) live in containers.ts.

import {
  ICON_SIZE_PX,
  type ArrowElement,
  type Element,
  type IconSize,
  type ImageElement,
  type ShapeElement,
  type StickyElement,
  type TextElement,
} from '@livediagram/diagram';
import type { PendingImage } from '@/lib/import-report';
import type { DrawioCell, Rect } from './cells';
import { readLabel } from './label';
import { DRAWIO_CAPTION_CHAR_PX, DRAWIO_CAPTION_LINE_PX } from './limits';
import { shapeTurn, type VertexClass } from './shapes';
import { boxedProps, radiusPreset, textProps, type ConvertContext } from './vertex-props';

export type PageContext = ConvertContext & {
  tabId: string;
  images: PendingImage[];
  /** One key per distinct embedded image, across the whole import. */
  imageKeys: Map<string, string>;
};

export type BuiltVertex = Element | null;

const LABEL = { scale: 'label', rich: true, outsideMovesIn: true } as const;

function buildShape(
  cell: DrawioCell,
  rect: Rect,
  cls: Extract<VertexClass, { kind: 'shape' }>,
  ctx: PageContext,
  id: string,
): ShapeElement {
  const turn = shapeTurn(cell, cls.shape);
  if (cls.approximated || turn.approximated) ctx.tally.add('shape-approximated');
  const box = turn.swap
    ? {
        x: rect.x + (rect.width - rect.height) / 2,
        y: rect.y + (rect.height - rect.width) / 2,
        width: rect.height,
        height: rect.width,
      }
    : rect;
  const { rotation: own, ...props } = boxedProps(cell, ctx);
  const rotation = ((own ?? 0) + turn.rotation) % 360;
  if (cell.style.str('image')) ctx.tally.add('image-unavailable');
  return {
    id,
    type: 'shape',
    shape: cls.shape,
    ...box,
    ...props,
    ...(rotation !== 0 ? { rotation } : {}),
    ...(cls.shape === 'square'
      ? { borderRadius: radiusPreset(cell.style, rect.width, rect.height) }
      : {}),
    ...textProps(cell, ctx, LABEL),
  };
}

function buildText(cell: DrawioCell, rect: Rect, ctx: PageContext, id: string): TextElement {
  const { fillColor, strokeColor, opacity, rotation, locked, link, note } = boxedProps(cell, ctx);
  return {
    id,
    type: 'text',
    ...rect,
    ...(fillColor && fillColor !== 'transparent' ? { fillColor } : {}),
    ...(strokeColor ? { strokeColor } : {}),
    ...(opacity !== undefined ? { opacity } : {}),
    ...(rotation !== undefined ? { rotation } : {}),
    ...(locked ? { locked } : {}),
    ...(link ? { link } : {}),
    ...(note ? { note } : {}),
    ...textProps(cell, ctx, LABEL),
  };
}

function buildSticky(cell: DrawioCell, rect: Rect, ctx: PageContext, id: string): StickyElement {
  const { fillColor, strokeColor, opacity, rotation, shadow, locked, link, note } = boxedProps(
    cell,
    ctx,
  );
  return {
    id,
    type: 'sticky',
    ...rect,
    ...(fillColor ? { fillColor } : {}),
    ...(strokeColor ? { strokeColor } : {}),
    ...(opacity !== undefined ? { opacity } : {}),
    ...(rotation !== undefined ? { rotation } : {}),
    ...(shadow ? { shadow } : {}),
    ...(locked ? { locked } : {}),
    ...(link ? { link } : {}),
    ...(note ? { note } : {}),
    ...textProps(cell, ctx, { scale: 'note', rich: true, outsideMovesIn: true }),
  };
}

// A vertex drawn as a line: a headless arrow across the box's middle,
// vertical when draw.io turned it north or south.
function buildLine(cell: DrawioCell, rect: Rect, ctx: PageContext, id: string): ArrowElement {
  const direction = cell.style.str('direction');
  const vertical = direction === 'north' || direction === 'south';
  const cx = rect.x + rect.width / 2;
  const cy = rect.y + rect.height / 2;
  const { strokeColor, strokeStyle, opacity, locked, link } = boxedProps(cell, ctx);
  const text = textProps(cell, ctx, { scale: 'arrow', rich: false, outsideMovesIn: false });
  return {
    id,
    type: 'arrow',
    from: vertical ? { kind: 'free', x: cx, y: rect.y } : { kind: 'free', x: rect.x, y: cy },
    to: vertical
      ? { kind: 'free', x: cx, y: rect.y + rect.height }
      : { kind: 'free', x: rect.x + rect.width, y: cy },
    arrowEnds: 'none',
    ...(strokeColor ? { strokeColor } : {}),
    strokeWidth: cell.style.num('strokeWidth') ?? 1,
    ...(strokeStyle ? { strokeStyle } : {}),
    ...(opacity !== undefined ? { opacity } : {}),
    ...(locked ? { locked } : {}),
    ...(link ? { link } : {}),
    ...(text.label ? { label: text.label, textSize: text.textSize } : {}),
  };
}

// draw.io writes an embedded image as `data:<type>,<base64>` (the `;` of
// `;base64` would end the style pair), so restore the standard form when the
// payload is base64; a percent-encoded or raw payload stays as it is.
function normaliseDataUrl(url: string): string {
  const m = /^data:([^,;]+),(.*)$/s.exec(url);
  return m && /^[A-Za-z0-9+/]+=*$/.test(m[2]!) ? `data:${m[1]};base64,${m[2]}` : url;
}

function buildImage(cell: DrawioCell, rect: Rect, ctx: PageContext, id: string): ImageElement {
  const source = cell.style.str('image') ?? '';
  if (source.startsWith('data:')) {
    const dataUrl = normaliseDataUrl(source);
    let key = ctx.imageKeys.get(dataUrl);
    if (!key) {
      key = `drawio-image-${ctx.imageKeys.size + 1}`;
      ctx.imageKeys.set(dataUrl, key);
    }
    ctx.images.push({
      tabId: ctx.tabId,
      elementId: id,
      key,
      source: { kind: 'data-url', dataUrl },
      hint: { width: rect.width, height: rect.height },
    });
    ctx.tally.add('image-placeholder');
  } else {
    // A web or library URL: never fetched from a third party.
    ctx.tally.add('image-unavailable');
  }
  const { opacity, rotation, locked, link, note } = boxedProps(cell, ctx);
  const alt = readLabel(cell.value, cell.html).plain;
  return {
    id,
    type: 'image',
    imageId: null,
    ...rect,
    ...(alt ? { alt } : {}),
    ...(opacity !== undefined ? { opacity } : {}),
    ...(rotation !== undefined ? { rotation } : {}),
    ...(locked ? { locked } : {}),
    ...(link ? { link } : {}),
    ...(note ? { note } : {}),
  };
}

const ICON_SIZES: readonly IconSize[] = ['sm', 'md', 'lg', 'xl'];
const nearestIconSize = (px: number): IconSize =>
  ICON_SIZES.reduce((best, k) =>
    Math.abs(ICON_SIZE_PX[k] - px) < Math.abs(ICON_SIZE_PX[best] - px) ? k : best,
  );

function buildIcon(
  cell: DrawioCell,
  rect: Rect,
  cls: Extract<VertexClass, { kind: 'icon' }>,
  ctx: PageContext,
  id: string,
): ShapeElement {
  ctx.tally.add('icon-substituted');
  const text = textProps(cell, ctx, { scale: 'label', rich: false, outsideMovesIn: false });
  const label = text.label ?? cls.caption;
  const lines = label ? label.split('\n') : [];
  const box = { ...rect };
  let textAlignX = 'center' as ShapeElement['textAlignX'];
  let textAlignY = 'bottom' as ShapeElement['textAlignY'];
  if (lines.length > 0) {
    const side = cell.style.str('labelPosition');
    const vside = cell.style.str('verticalLabelPosition');
    const grow = lines.length * DRAWIO_CAPTION_LINE_PX;
    const across = Math.max(...lines.map((l) => l.length)) * DRAWIO_CAPTION_CHAR_PX;
    if (side === 'left' || side === 'right') {
      textAlignX = side;
      textAlignY = 'middle';
      box.width += across;
      if (side === 'left') box.x -= across;
    } else if (vside === 'top') {
      textAlignY = 'top';
      box.height += grow;
      box.y -= grow;
    } else if (vside === 'bottom' || vside === undefined) {
      box.height += grow;
    }
  }
  const { strokeColor, opacity, rotation, locked, link, note } = boxedProps(cell, ctx);
  return {
    id,
    type: 'shape',
    shape: 'icon',
    iconId: cls.iconId,
    ...box,
    ...(cls.tech
      ? nearestIconSize(Math.min(rect.width, rect.height)) !== 'md'
        ? { iconSize: nearestIconSize(Math.min(rect.width, rect.height)) }
        : {}
      : strokeColor
        ? { strokeColor }
        : {}),
    ...(opacity !== undefined ? { opacity } : {}),
    ...(rotation !== undefined ? { rotation } : {}),
    ...(locked ? { locked } : {}),
    ...(link ? { link } : {}),
    ...(note ? { note } : {}),
    ...(label ? { label } : {}),
    ...(text.textColor ? { textColor: text.textColor } : {}),
    ...(text.textBold ? { textBold: true } : {}),
    textSize: text.textSize,
    textAlignX,
    textAlignY,
  };
}

function buildFrame(
  cell: DrawioCell,
  rect: Rect,
  approximated: boolean,
  ctx: PageContext,
  id: string,
): ShapeElement {
  if (approximated) ctx.tally.add('shape-approximated');
  const { fillColor: _fill, ...props } = boxedProps(cell, ctx);
  void _fill;
  const text = textProps(cell, ctx, { scale: 'label', rich: false, outsideMovesIn: false });
  return {
    id,
    type: 'shape',
    shape: 'frame',
    ...rect,
    ...props,
    ...(text.label ? { label: text.label } : {}),
    ...(text.textColor ? { textColor: text.textColor } : {}),
    textSize: text.textSize,
  };
}

function buildUnmatched(
  cell: DrawioCell,
  rect: Rect,
  name: string,
  ctx: PageContext,
  id: string,
): ShapeElement {
  ctx.tally.add('shape-unmatched');
  ctx.tally.name('shape-unmatched', name);
  const text = textProps(cell, ctx, LABEL);
  return {
    id,
    type: 'shape',
    shape: 'square',
    ...rect,
    ...boxedProps(cell, ctx),
    borderRadius: radiusPreset(cell.style, rect.width, rect.height),
    ...text,
    ...(text.label ? {} : { label: name }),
  };
}

/** The element for a simple vertex; null for kinds built elsewhere. */
export function buildVertex(
  cell: DrawioCell,
  rect: Rect,
  cls: VertexClass,
  ctx: PageContext,
  id: string,
): BuiltVertex {
  switch (cls.kind) {
    case 'shape':
      return buildShape(cell, rect, cls, ctx, id);
    case 'text':
      if (cls.approximated) ctx.tally.add('shape-approximated');
      return buildText(cell, rect, ctx, id);
    case 'sticky':
      return buildSticky(cell, rect, ctx, id);
    case 'line':
      return buildLine(cell, rect, ctx, id);
    case 'image':
      return buildImage(cell, rect, ctx, id);
    case 'icon':
      return buildIcon(cell, rect, cls, ctx, id);
    case 'frame':
      return buildFrame(cell, rect, cls.approximated, ctx, id);
    case 'unmatched':
      return buildUnmatched(cell, rect, cls.name, ctx, id);
    default:
      return null;
  }
}
