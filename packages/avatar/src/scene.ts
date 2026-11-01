// What Avatar mode reads of a board's elements (livediagram's docs/specs/008-canvas/avatar-mode.md "Where the code
// lives"). The package never imports a product's element union: it reads only an element's id and type and, for a
// shape, its kind and box. Every product's union has these, so its own `Element` passes as it is, and what the
// package hands back (a pad, a chair) comes back as the product's own type.
import type { RoomDoor } from './office-geometry';

/** Any element on the board: the package reads only its id and type. */
export type AvatarSceneElement = { readonly id: string; readonly type: string };

/** A shape element as the walk reads it: its kind and its box (and a room's doorway). */
export type AvatarSceneShape = {
  readonly id: string;
  readonly type: 'shape';
  readonly shape: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly roomDoor?: RoomDoor;
};

/** An element with a box: every product's boxed kinds (a shape, a sticky, a text, an image, ...), never an arrow. */
export type AvatarSceneBox = {
  readonly id: string;
  readonly type: string;
  readonly shape?: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
};

/** The product's own element narrowed to a shape: its `ShapeElement`, for a product's `Element`. */
export type SceneShapeOf<E extends AvatarSceneElement> = E & AvatarSceneShape;

/**
 * Whether an element is a shape. Every product's union gives a `type: 'shape'` element a `shape` kind and a box, so
 * the narrowing is the product's own (its `ShapeElement`).
 */
export function isSceneShape<E extends AvatarSceneElement>(el: E): el is SceneShapeOf<E> {
  return el.type === 'shape';
}

/**
 * Whether an element has a box: numbers for its place and size. Every product's boxed kinds have one and an arrow,
 * drawn between two ends, has none, so this reads as each product's `isBoxed` without importing its union.
 */
export function hasSceneBox<E extends AvatarSceneElement>(el: E): el is E & AvatarSceneBox {
  const box = el as Partial<Record<'x' | 'y' | 'width' | 'height', unknown>>;
  return (
    typeof box.x === 'number' &&
    typeof box.y === 'number' &&
    typeof box.width === 'number' &&
    typeof box.height === 'number'
  );
}
