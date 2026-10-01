// Boxed kinds on the whiteboard profile (docs/specs/020-import-export/board-scene.md "Kinds"):
// shapes, text boxes, sticky notes, images and frames.
import {
  createShape,
  type ImageElement,
  type ShapeElement,
  type StickyElement,
  type TextElement,
} from '@livediagram/document';
import type { ImportImageRequest } from '@/lib/import-images';
import { colourAlpha, lineColourFields, resolveFill, resolveStickyFill } from './colour';
import { commonFields } from './common';
import type { LandContext } from './context';
import type {
  SceneAsset,
  SceneFrame,
  SceneImage,
  SceneShape,
  SceneSticky,
  SceneTextItem,
} from './scene';
import { sceneImageSource } from './attach';
import { labelFields, textBoxFields } from './text';
import { borderStrokeOf } from './width';

const SHAPE_KINDS = {
  rectangle: 'square',
  ellipse: 'circle',
  diamond: 'diamond',
  triangle: 'triangle',
} as const;

const boxOf = (item: { x: number; y: number; width: number; height: number }) => ({
  x: item.x,
  y: item.y,
  width: item.width,
  height: item.height,
});

/** A shape with its border, fill and label; unfilled stays unset, so the board draws it unfilled. */
export function landShape(item: SceneShape, id: string, ctx: LandContext): ShapeElement {
  const { stroke } = item;
  const fill = resolveFill(item.fill);
  const opacity = stroke
    ? (stroke.opacity ?? 1) * colourAlpha(stroke.colour)
    : colourAlpha(item.fill);
  const width = stroke ? borderStrokeOf(stroke.widthPx) : 'none';
  return {
    id,
    type: 'shape',
    shape: SHAPE_KINDS[item.shape],
    ...boxOf(item),
    ...(item.rounded ? { borderRadius: 'md' as const } : {}),
    ...(width !== 'medium' ? { strokeWidth: width } : {}),
    ...(stroke?.dash === 'dashed' || stroke?.dash === 'dotted' ? { strokeStyle: stroke.dash } : {}),
    ...(stroke ? lineColourFields(ctx.colour(stroke.colour)) : {}),
    ...(fill ? { fillColor: fill } : {}),
    ...(item.label && item.label.text.trim() !== ''
      ? labelFields(item.label, ctx, { onFill: fill !== undefined })
      : {}),
    ...commonFields(item, ctx, opacity),
  };
}

/** A text box that hugs its text; null for empty text (counted by the caller). */
export function landText(item: SceneTextItem, id: string, ctx: LandContext): TextElement | null {
  if (item.text.text.trim() === '') return null;
  return {
    id,
    type: 'text',
    ...boxOf(item),
    ...(item.autoWidth ? { autoWidth: true } : {}),
    ...textBoxFields(item.text, ctx),
    ...commonFields(item, ctx, 1),
  };
}

/** A sticky note on the nearest sticky preset's paper, its text in that preset's ink. */
export function landSticky(item: SceneSticky, id: string, ctx: LandContext): StickyElement {
  const paper = resolveStickyFill(item.fill);
  const text =
    item.text && item.text.text.trim() !== ''
      ? labelFields(item.text, ctx, { onFill: true })
      : undefined;
  // Ink text takes the paper's own readable ink; any other colour is kept exactly.
  const ownColour = text?.textColor !== undefined;
  return {
    id,
    type: 'sticky',
    ...boxOf(item),
    fillColor: paper.fillColor,
    ...(text ?? {}),
    ...(ownColour ? {} : { textColor: paper.textColor }),
    ...commonFields(item, ctx, colourAlpha(item.fill)),
  };
}

/** An image placeholder and its request for the image pipeline. */
export function landImage(
  item: SceneImage,
  id: string,
  ctx: LandContext,
  assets: ReadonlyMap<string, SceneAsset>,
): { element: ImageElement; request: ImportImageRequest } {
  return {
    element: {
      id,
      type: 'image',
      imageId: null,
      ...boxOf(item),
      ...(item.crop ? { objectFit: 'cover' as const } : {}),
      ...commonFields(item, ctx, 1),
    },
    request: {
      elementId: id,
      key: item.asset,
      source: sceneImageSource(assets.get(item.asset)),
      hint: { width: item.width, height: item.height },
    },
  };
}

/**
 * A frame with the palette frame's own look (createShape: its title top-right, padded in off the
 * border, at the Medium size), named after the source's frame; an unnamed one keeps "Frame".
 */
export function landFrame(item: SceneFrame, id: string, ctx: LandContext): ShapeElement {
  const name = item.name?.trim();
  return {
    ...createShape('frame', item.x, item.y),
    id,
    ...boxOf(item),
    ...(name ? { label: name } : {}),
    ...commonFields(item, ctx, 1),
  };
}
