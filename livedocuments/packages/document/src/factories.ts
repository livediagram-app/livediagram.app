// Factories for every element type EXCEPT shapes, one copy for every product in
// @liveworkspace/element-model/factories, typed here as this product's elements. The shape kind table and
// createShape live in './shape-factory', re-exported here so every `from './factories'` import and the
// package barrel resolve exactly as before.
import * as shared from '@liveworkspace/element-model/factories';
import type {
  Anchor,
  ArrowElement,
  Element,
  ElementId,
  EmbedProvider,
  FreehandElement,
  ImageElement,
  LinkCardElement,
  StickyElement,
  TableElement,
  TextElement,
  VideoElement,
} from './index';

export { SHAPE_DEFAULT_SIZE, createShape } from './shape-factory';

export const createText: (x: number, y: number) => TextElement = shared.createText;
export const createTable: (x: number, y: number) => TableElement = shared.createTable;
export const createSticky: (x: number, y: number) => StickyElement = shared.createSticky;
export const createLinkCard: (x: number, y: number) => LinkCardElement = shared.createLinkCard;
export const createVideo: (x: number, y: number, provider?: EmbedProvider) => VideoElement =
  shared.createVideo;
export const scaleElements: (elements: Element[], ox: number, oy: number, s: number) => Element[] =
  shared.scaleElements;
export const createImage: (x: number, y: number) => ImageElement = shared.createImage;
export const createFreehand: (
  rawPoints: readonly { x: number; y: number }[],
  closed: boolean,
  pressures?: readonly number[],
) => FreehandElement = shared.createFreehand;
export const createArrow: (fromX: number, fromY: number, toX: number, toY: number) => ArrowElement =
  shared.createArrow;
export const createPinnedArrow: (
  fromId: ElementId,
  fromAnchor: Anchor,
  toId: ElementId,
  toAnchor: Anchor,
) => ArrowElement = shared.createPinnedArrow;
