// `add <kind> [id=] key=value… [<placement>]` (docs/specs/024-agents/blueprints/edit-operations.md
// "Operations", EO15, EO17, EO26 to EO29): the kind's factory element, sized for its label as graph
// input sizes it, its fields written as `set` writes them, painted with the tab's theme, placed, put
// on the placement reference's layer (or the active one when that is locked) and appended.

import type { EditRejection } from '@liveplanner/api-schema';
import {
  SHAPE_DEFAULT_SIZE,
  SHAPE_KINDS,
  coerceShapeKind,
  createAnnotation,
  createLinkCard,
  createShape,
  createSticky,
  createTable,
  createText,
  kindWordOf,
  LABEL_FONT_PX,
  labelBoxSize,
  labelFontPx,
  recolourElementForTheme,
  resolveActiveLayerId,
  type BoxedElement,
  type Element,
  type ElementId,
  type TextSize,
  type ThemeDefinition,
} from '@liveplanner/document';
import { writeFieldsOnto } from '../fields';
import { newElementId } from '../ids';
import { layerLockOf } from '../locks';
import { growContainer, HOLD_PAD } from '../grow-container';
import { resolvePlacement, type Placed } from '../placement';
import { invalidValue } from '../rejections';
import { type EditState, holdersOf, refuseLocked, writeFields } from '../state';
import type { AddKindOperation, Fields } from '../types';

// Kinds an edit operation cannot make, and what to use instead.
export const NOT_ADDED: Readonly<Record<string, string>> = {
  arrow: 'use connect',
  image: 'liveplanner keeps no uploaded pictures',
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

// The kinds besides the shape kinds that `add` makes.
export const OTHER_KINDS: readonly string[] = Object.keys(FACTORIES);

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

// The look the tab's boxes of a shape share: their most common text size and their median size; null when the tab
// has none of that shape (frames and lanes never count, they are containers).
function peerLook(
  state: EditState,
  shape: string,
): { textSize: TextSize; width: number; height: number } | null {
  const peers = [...state.byId.values()].filter(
    (e): e is Extract<Element, { type: 'shape' }> =>
      e.type === 'shape' && e.shape === shape && shape !== 'frame' && shape !== 'lane',
  );
  if (peers.length === 0) return null;
  // A preset or an exact px size, counted as it is stored.
  const counts = new Map<TextSize, number>();
  for (const p of peers)
    counts.set(p.textSize ?? 'scale', (counts.get(p.textSize ?? 'scale') ?? 0) + 1);
  const textSize = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]![0];
  const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]!;
  return {
    textSize,
    width: median(peers.map((p) => p.width)),
    height: median(peers.map((p) => p.height)),
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
  if (el.type === 'shape' && !('width' in named) && !('height' in named)) {
    // A new box matches its siblings (docs/specs/024-agents/edit-operations.md "Layout on edit"): the text size most
    // boxes of its shape on the tab wear, and at least their usual size, so a step added to a drawn flow is not a
    // small box whose label wraps mid-word beside the others.
    // With no sibling of its shape, it takes the template's proportions, as graph input draws a box.
    const peers = peerLook(state, el.shape);
    if (peers && !('textSize' in named) && !('text' in named))
      el = { ...el, textSize: peers.textSize };
    // Measured at the box's own label size, whatever it is.
    const fontPx = labelFontPx(el.textSize);
    const look = { textSize: fontPx <= LABEL_FONT_PX.sm ? 'sm' : 'md', fontPx } as const;
    if (peers) {
      // Siblings shorter than the palette's box of their shape wear the template look (graph input, templates): the
      // new box is measured as that look measures, so a short label is not the palette's tall square beside them.
      const templated = peers.height < SHAPE_DEFAULT_SIZE[el.shape].height;
      const fit = templated
        ? labelBoxSize(el.label, el.shape, look, !!el.iconId, peers)
        : labelBoxSize(el.label, el.shape);
      el = {
        ...el,
        width: Math.max(fit.width, peers.width),
        height: Math.max(fit.height, peers.height),
      };
    } else {
      el = { ...el, ...labelBoxSize(el.label, el.shape, look, !!el.iconId) };
    }
  }
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

// Grows the container `inside:` filled, so the element sits in it (EO27): what sat under it moves on rather than
// being taken in (grow-container.ts).
function growInto(state: EditState, placed: Placed, held: ElementId, operation: number): void {
  if (!placed.grow) return;
  const { container, height } = placed.grow;
  if (container.type === 'arrow' || state.locked.has(container.id)) return;
  const { x, y, width } = container;
  growContainer(state, container, { x, y, width, height }, held, operation);
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
    resolvePlacement(state, operation.place, size, new Set(), index, undefined, {
      growsFrame: true,
    });
  const made = createKind(state, operation, index, place);
  if ('rejection' in made) return made.rejection;
  const refused = commitNew(state, made, 'add', index);
  if (refused) return refused;
  growInto(state, made.placed, made.el.id, index);
  if (operation.place && operation.place.rel !== 'at' && operation.place.rel !== 'inside')
    growToHold(state, made.placed.ref, made.el, index);
  return null;
}

// A box placed beside a member of a frame or lane joins it: the container grows to hold it, as an insertion grows
// one (docs/specs/024-agents/edit-operations.md "Layout on edit"), instead of the new box landing just outside, and
// what sat past it moves on rather than being taken in (grow-container.ts).
function growToHold(
  state: EditState,
  ref: Element | undefined,
  el: BoxedElement,
  operation: number,
): void {
  // Placement refuses an arrow as its reference (placement.ts), so a relative placement's ref is always a box.
  const holderId = holdersOf(state).get(ref!.id);
  const holder = holderId ? state.byId.get(holderId) : undefined;
  if (!holder || holder.type === 'arrow' || state.locked.has(holder.id)) return;
  const right = Math.max(holder.x + holder.width, el.x + el.width + HOLD_PAD);
  const bottom = Math.max(holder.y + holder.height, el.y + el.height + HOLD_PAD);
  const x = Math.min(holder.x, el.x - HOLD_PAD);
  const y = Math.min(holder.y, el.y - HOLD_PAD);
  if (
    x === holder.x &&
    y === holder.y &&
    right === holder.x + holder.width &&
    bottom === holder.y + holder.height
  )
    return;
  growContainer(
    state,
    holder,
    { x, y, width: Math.round(right - x), height: Math.round(bottom - y) },
    el.id,
    operation,
  );
}
