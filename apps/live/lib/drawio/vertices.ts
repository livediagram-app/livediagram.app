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
} from '@livediagram/document';
import type { ImportImageRequest } from '@/lib/import-images';
import type { DrawioCell, Rect } from './cells';
import { readLabel } from './label';
import {
  DRAWIO_CAPTION_CHAR_PX,
  DRAWIO_CAPTION_LINE_PX,
  DRAWIO_CAPTION_PADDING_PX,
} from './limits';
import { shapeTurn, type VertexClass } from './shapes';
import { boxedProps, radiusPreset, textProps, type ConvertContext } from './vertex-props';

export type PageContext = ConvertContext & {
  images: ImportImageRequest[];
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
  // A UML actor's name sits under the figure, like an icon's caption.
  const vside = cell.style.str('verticalLabelPosition');
  const actorCaption = cls.shape === 'actor' && (vside === 'bottom' || vside === 'top');
  const text = textProps(cell, ctx, {
    ...LABEL,
    onFill: props.fillColor,
    outsideMovesIn: !actorCaption,
  });
  const caption = actorCaption ? captionBox(cell, box, text.label) : null;
  return {
    id,
    type: 'shape',
    shape: cls.shape,
    ...(caption ? caption.box : box),
    ...props,
    ...(rotation !== 0 ? { rotation } : {}),
    ...(cls.shape === 'square'
      ? { borderRadius: radiusPreset(cell.style, rect.width, rect.height) }
      : {}),
    ...text,
    ...(caption ? { textAlignX: caption.textAlignX, textAlignY: caption.textAlignY } : {}),
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
    ...textProps(cell, ctx, { ...LABEL, onFill: fillColor }),
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
    // The shared import image pipeline stores it and reports how it came across.
    ctx.images.push({
      elementId: id,
      key,
      source: { kind: 'data-url', dataUrl },
      hint: { width: rect.width, height: rect.height },
    });
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

type CaptionBox = {
  box: Rect;
  textAlignX: NonNullable<ShapeElement['textAlignX']>;
  textAlignY: NonNullable<ShapeElement['textAlignY']>;
};

// An icon or actor carries its label OUTSIDE its figure in draw.io (below by
// default); livediagram keeps the caption inside the element's box, beside the
// figure. So the box grows by the caption towards its side (blueprint step 14):
// by a line per line above or below, widening about its centre to hold the
// longest line unwrapped, or by the line's width beside it.
function captionBox(cell: DrawioCell, rect: Rect, label: string | undefined): CaptionBox {
  const box = { ...rect };
  const lines = label ? label.split('\n') : [];
  if (lines.length === 0) return { box, textAlignX: 'center', textAlignY: 'bottom' };
  const side = cell.style.str('labelPosition');
  const vside = cell.style.str('verticalLabelPosition');
  const across = Math.max(...lines.map((l) => l.length)) * DRAWIO_CAPTION_CHAR_PX;
  if (side === 'left' || side === 'right') {
    box.width += across + DRAWIO_CAPTION_PADDING_PX;
    if (side === 'left') box.x -= across + DRAWIO_CAPTION_PADDING_PX;
    return { box, textAlignX: side, textAlignY: 'middle' };
  }
  const grow = lines.length * DRAWIO_CAPTION_LINE_PX;
  box.height += grow;
  if (vside === 'top') box.y -= grow;
  const wide = across + DRAWIO_CAPTION_PADDING_PX;
  if (wide > box.width) {
    box.x -= (wide - box.width) / 2;
    box.width = wide;
  }
  return { box, textAlignX: 'center', textAlignY: vside === 'top' ? 'top' : 'bottom' };
}

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
  const { box, textAlignX, textAlignY } = captionBox(cell, rect, label);
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
    // No caption colour: vendor stencils hard-code one for white paper, which
    // disappears on a dark canvas; the caption takes the theme's text colour.
    ...(label ? { label } : {}),
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
    // A container's title sits in its top corner, as the palette's frame does.
    textAlignX: text.textAlignX === 'right' ? 'right' : 'left',
    textAlignY: 'top',
    padding: 'lg',
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
  const props = boxedProps(cell, ctx);
  const text = textProps(cell, ctx, { ...LABEL, onFill: props.fillColor });
  return {
    id,
    type: 'shape',
    shape: 'square',
    ...rect,
    ...props,
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
