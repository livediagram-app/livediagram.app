// `add <kind> [id=] key=value… [<placement>]` (docs/specs/024-agents/blueprints/edit-operations.md
// "Operations", EO15, EO17, EO26 to EO29): the kind's factory element, sized for its label as graph
// input sizes it, its fields written as `set` writes them, painted with the tab's theme, placed, put
// on the placement reference's layer (or the active one when that is locked) and appended.

import type { EditRejection } from '@livediagram/api-schema';
import {
  SHAPE_KINDS,
  coerceShapeKind,
  createAnnotation,
  createLinkCard,
  createShape,
  createSticky,
  createTable,
  createText,
  kindWordOf,
  labelBoxSize,
  recolourElementForTheme,
  resolveActiveLayerId,
  type BoxedElement,
  type Element,
  type ThemeDefinition,
} from '@livediagram/document';
import { writeFieldsOnto } from '../fields';
import { newElementId } from '../ids';
import { layerLockOf } from '../locks';
import { resolvePlacement, type Placed } from '../placement';
import { invalidValue } from '../rejections';
import { type EditState, putElement, refuseLocked, touch, writeFields } from '../state';
import type { AddKindOperation, Fields } from '../types';

// Kinds an edit operation cannot make, and what to use instead.
const NOT_ADDED: Readonly<Record<string, string>> = {
  arrow: 'use connect',
  image: 'images are uploaded in the editor',
  video: 'videos are added in the editor',
  freehand: 'strokes are drawn in the editor',
  path: 'paths are drawn in the editor',
};

const FACTORIES: Readonly<Record<string, () => BoxedElement>> = {
  text: () => createText(0, 0),
  sticky: () => createSticky(0, 0),
  table: () => createTable(0, 0),
  annotation: () => createAnnotation(0, 0),
  'link-card': () => createLinkCard(0, 0),
};

export type Built = { el: BoxedElement; coerced: string | null };

// The factory element of a kind, unplaced and without an id; an unknown kind is coerced to a shape
// kind (EO17).
export function buildKind(kind: string): Built | { refusal: string } {
  const refused = NOT_ADDED[kind];
  if (refused !== undefined) return { refusal: refused };
  const factory = FACTORIES[kind];
  if (factory) return { el: { ...factory(), textSize: 'sm' }, coerced: null };
  const shape = kind === 'shape' ? 'square' : coerceShapeKind(kind);
  return {
    el: { ...createShape(shape, 0, 0), textSize: 'sm' },
    coerced: kind === 'shape' || SHAPE_KINDS.has(kind) ? null : shape,
  };
}

// The theme's colours on an element; recolouring keeps its type.
function paint<T extends Element>(el: T, theme: ThemeDefinition): T {
  return recolourElementForTheme(el, theme) as T;
}

// A new element of `kind` with its fields, sized for its label, painted and placed; shared by
// `add` and `insert`, which places it itself.
export function createKind(
  state: EditState,
  spec: { kind: string; id?: string; fields?: Fields },
  operation: number,
  place: (size: { width: number; height: number }) => Placed | { rejection: EditRejection },
): { el: BoxedElement; placed: Placed } | { rejection: EditRejection } {
  const built = buildKind(spec.kind);
  if ('refusal' in built)
    return { rejection: invalidValue(operation, 'kind', spec.kind, built.refusal) };
  const label = spec.fields?.label;
  const id = newElementId(
    state,
    {
      given: spec.id,
      label: typeof label === 'string' ? label : undefined,
      kind: kindWordOf(built.el),
    },
    operation,
  );
  if (typeof id !== 'string') return { rejection: id };
  const written = writeFieldsOnto(
    { ...built.el, id },
    spec.fields ?? {},
    state.theme,
    id,
    operation,
  );
  if ('code' in written) return { rejection: written };
  const named = spec.fields ?? {};
  let el = paint(written.next, state.theme);
  if (el.type === 'shape' && !('width' in named) && !('height' in named))
    el = { ...el, ...labelBoxSize(el.label, el.shape) };
  const placed = place({ width: el.width, height: el.height });
  if ('rejection' in placed) return placed;
  el = {
    ...el,
    x: typeof named.x === 'number' ? named.x : placed.x,
    y: typeof named.y === 'number' ? named.y : placed.y,
  };
  state.warnings.push(...written.warnings);
  if (built.coerced) {
    state.warnings.push({
      code: 'shape_coerced',
      ref: id,
      message: `${id} kind ${JSON.stringify(spec.kind)} drawn as ${built.coerced}`,
    });
    state.log('[edit-ops] coerced', { operation, field: 'kind' });
  }
  return { el, placed };
}

// The layer a new element goes on: its placement reference's, unless that layer is locked (EO29).
export function layerFor(state: EditState, ref: Element | undefined): string | undefined {
  const layers = state.tab.layers;
  if (!layers || layers.length === 0) return undefined;
  if (ref?.layerId !== undefined && !layerLockOf(layers, ref.layerId)) return ref.layerId;
  return resolveActiveLayerId(layers, null);
}

// Grows the container `inside:` filled, so the element sits in it (EO27).
export function growInto(state: EditState, placed: Placed, operation: number): void {
  if (!placed.grow) return;
  const { container, height } = placed.grow;
  if (container.type === 'arrow' || state.locked.has(container.id)) return;
  putElement(state, { ...container, height }, operation);
  const touched = touch(state, container.id, operation);
  touched.fit = { ...touched.fit, taller: [container.height, height] };
}

// A made element onto its layer, refused when that layer is locked, then added.
export function commitNew(
  state: EditState,
  made: { el: BoxedElement; placed: Placed },
  verb: 'add' | 'insert',
  index: number,
): EditRejection | null {
  const layerId = made.el.layerId ?? layerFor(state, made.placed.ref);
  const el = layerId === undefined ? made.el : { ...made.el, layerId };
  const lock = layerLockOf(state.tab.layers, el.layerId);
  if (lock) return refuseLocked(state, verb, index, el, lock);
  writeFields(state, el, index, []);
  state.created.push(el.id);
  return null;
}

export function applyAddKind(
  state: EditState,
  operation: AddKindOperation,
  index: number,
): EditRejection | null {
  const place = (size: { width: number; height: number }) =>
    resolvePlacement(state, operation.place, size, new Set(), index);
  const made = createKind(state, operation, index, place);
  if ('rejection' in made) return made.rejection;
  const refused = commitNew(state, made, 'add', index);
  if (refused) return refused;
  growInto(state, made.placed, index);
  return null;
}
