// How an instance draws (docs/specs/009-elements/components.md "How an instance draws", "Overrides", "Exports"):
// its main's elements placed in its box, overrides applied, and a tab with every instance expanded for an export.
// Pure and linear: one pass over the main's elements per instance, one lookup per instance.
import type { ArrowElement, Endpoint } from './arrow-types';
import type { BoxedElement, Element, ShapeElement } from './index';
import {
  INSTANCE_ID_SEPARATOR,
  type ComponentLookup,
  type ComponentOverride,
  type DesignComponent,
  type InstanceElement,
} from './components';

/** How a resolve places the main: `rotate` turns it with the instance (exports; the canvas's wrapper turns it
 *  itself), `overrides: false` draws the main as it is (an edit session), `ids` names each element. */
export type ResolveOptions = {
  rotate?: boolean;
  overrides?: boolean;
  ids?: (mainElementId: string) => string;
};

type Vec = { x: number; y: number };

/** The id a main element takes inside an instance. */
export function resolvedElementId(instanceId: string, mainElementId: string): string {
  return `${instanceId}${INSTANCE_ID_SEPARATOR}${mainElementId}`;
}

/** The instance's scale on each axis (a zero frame side reads as 1). */
export function instanceScale(
  instance: { width: number; height: number },
  main: DesignComponent,
): { sx: number; sy: number } {
  return {
    sx: main.width > 0 ? instance.width / main.width : 1,
    sy: main.height > 0 ? instance.height / main.height : 1,
  };
}

// Fields a drawn copy never carries: they belong to the main's element as authored, or to an edit session.
const DROPPED_ON_RESOLVE = ['componentMember', 'commentThread', 'action', 'actions', 'addedBy'];

function dropFields<T extends object>(el: T, fields: readonly string[]): T {
  let out: Record<string, unknown> | null = null;
  for (const f of fields) {
    if (f in el) {
      out ??= { ...(el as Record<string, unknown>) };
      delete out[f];
    }
  }
  return (out ?? el) as T;
}

/** An override applied to one element: text replaces the label (and its rich runs); a colour replaces the field and
 *  drops the bindings that would win over it (a preset, a quick swatch, a stock colour name); an icon swaps only an
 *  element that has one. */
export function applyOverride<E extends Element>(el: E, o: ComponentOverride | undefined): E {
  if (!o) return el;
  const out = { ...el } as Record<string, unknown>;
  let changed = false;
  if (typeof o.label === 'string') {
    out.label = o.label;
    delete out.richText;
    changed = true;
  }
  if (typeof o.fillColor === 'string') {
    out.fillColor = o.fillColor;
    delete out.fillSwatch;
    delete out.colorPreset;
    changed = true;
  }
  if (typeof o.strokeColor === 'string') {
    out.strokeColor = o.strokeColor;
    delete out.strokeSwatch;
    delete out.penColour;
    delete out.colorPreset;
    changed = true;
  }
  if (typeof o.textColor === 'string') {
    out.textColor = o.textColor;
    delete out.textSwatch;
    delete out.penTextColour;
    changed = true;
  }
  if (typeof o.iconId === 'string' && typeof (el as { iconId?: unknown }).iconId === 'string') {
    out.iconId = o.iconId;
    changed = true;
  }
  return changed ? (out as E) : el;
}

function rotateAbout(p: Vec, c: Vec, deg: number): Vec {
  if (!deg) return p;
  const r = (deg * Math.PI) / 180;
  const cos = Math.cos(r);
  const sin = Math.sin(r);
  const dx = p.x - c.x;
  const dy = p.y - c.y;
  return { x: c.x + dx * cos - dy * sin, y: c.y + dx * sin + dy * cos };
}

function rotateVec(v: { dx: number; dy: number }, deg: number): { dx: number; dy: number } {
  if (!deg) return v;
  const r = (deg * Math.PI) / 180;
  const cos = Math.cos(r);
  const sin = Math.sin(r);
  return { dx: v.dx * cos - v.dy * sin, dy: v.dx * sin + v.dy * cos };
}

/** The main's elements placed in the instance's box, in the main's order. Linear in the main's elements. */
export function resolveInstance(
  instance: ShapeElement,
  main: DesignComponent,
  opts: ResolveOptions = {},
): Element[] {
  const { sx, sy } = instanceScale(instance, main);
  const ix = instance.x;
  const iy = instance.y;
  const deg = opts.rotate ? (instance.rotation ?? 0) : 0;
  const centre = { x: ix + instance.width / 2, y: iy + instance.height / 2 };
  const alpha = instance.opacity ?? 1;
  const overrides = opts.overrides === false ? undefined : instance.componentOverrides;
  const idOf = opts.ids ?? ((id: string) => resolvedElementId(instance.id, id));
  const place = (p: Vec): Vec => rotateAbout({ x: ix + p.x * sx, y: iy + p.y * sy }, centre, deg);
  const scaleVec = (v: { dx: number; dy: number }) =>
    rotateVec({ dx: v.dx * sx, dy: v.dy * sy }, deg);
  const mapEnd = (end: Endpoint): Endpoint => {
    if (end.kind === 'free') return { kind: 'free', ...place(end) };
    if (end.kind === 'pinned') return { ...end, elementId: idOf(end.elementId) };
    if (end.kind === 'on-arrow') return { ...end, arrowId: idOf(end.arrowId) };
    return end;
  };
  const out: Element[] = [];
  for (const source of main.elements) {
    const el = applyOverride(dropFields(source, DROPPED_ON_RESOLVE), overrides?.[source.id]);
    const opacity = (el.opacity ?? 1) * alpha;
    const common = {
      id: idOf(source.id),
      ...(instance.layerId ? { layerId: instance.layerId } : {}),
      ...(opacity < 1 ? { opacity } : {}),
    };
    if (el.type === 'arrow') {
      const arrow: ArrowElement = {
        ...el,
        ...common,
        from: mapEnd(el.from),
        to: mapEnd(el.to),
        ...(el.curveOffset ? { curveOffset: scaleVec(el.curveOffset) } : {}),
        ...(el.elbowOffset ? { elbowOffset: scaleVec(el.elbowOffset) } : {}),
        ...(el.curvePoints ? { curvePoints: el.curvePoints.map(scaleVec) } : {}),
      };
      if (!instance.layerId) delete arrow.layerId;
      out.push(arrow);
      continue;
    }
    const boxed = el;
    const w = boxed.width * sx;
    const h = boxed.height * sy;
    const at = { x: ix + boxed.x * sx, y: iy + boxed.y * sy };
    const c = rotateAbout({ x: at.x + w / 2, y: at.y + h / 2 }, centre, deg);
    const rotation = (boxed.rotation ?? 0) + deg;
    const placed = {
      ...boxed,
      ...common,
      x: c.x - w / 2,
      y: c.y - h / 2,
      width: w,
      height: h,
      ...(rotation ? { rotation } : {}),
      ...(attachedRef(boxed, idOf) ?? {}),
    } as BoxedElement;
    if (!instance.layerId) delete placed.layerId;
    if (!rotation) delete (placed as { rotation?: number }).rotation;
    out.push(placed);
  }
  return out;
}

// An attached badge or pointer note names its host by id (docs/specs/009-elements/badge.md); inside an instance the
// host is its resolved copy.
function attachedRef(
  el: BoxedElement,
  idOf: (id: string) => string,
): { attachedTo: string } | null {
  const host = (el as { attachedTo?: unknown }).attachedTo;
  return typeof host === 'string' ? { attachedTo: idOf(host) } : null;
}

/** The dashed frame an export draws for an instance whose main is missing. */
export function missingComponentFrame(
  instance: ShapeElement,
  label = 'Missing component',
): ShapeElement {
  return {
    id: instance.id,
    type: 'shape',
    shape: 'square',
    x: instance.x,
    y: instance.y,
    width: instance.width,
    height: instance.height,
    label,
    fillColor: 'transparent',
    strokeColor: '#94a3b8',
    textColor: '#64748b',
    strokeStyle: 'dashed',
    ...(instance.layerId ? { layerId: instance.layerId } : {}),
    ...(instance.rotation ? { rotation: instance.rotation } : {}),
  };
}

/** A tab with every instance expanded, for an export: an instance whose main resolves stays (the box arrows pin to;
 *  renderers draw nothing for it) followed by its resolved elements; one with its edit session open is dropped (its
 *  members draw); one with no main becomes the missing frame. Returns `tab` itself when it holds no instance.
 *  Linear in the tab's elements plus the elements of the mains it shows. Expanding twice is expanding once. */
export function expandInstances<T extends { elements: Element[] }>(
  tab: T,
  lookup: ComponentLookup,
): T {
  if (!tab.elements.some(isUnexpanded)) return tab;
  const out: Element[] = [];
  for (const el of tab.elements) {
    if (!isUnexpanded(el)) {
      out.push(el);
      continue;
    }
    if (el.componentEditBy) continue;
    const main = el.componentId ? lookup(el.componentId) : undefined;
    if (!main) {
      out.push(missingComponentFrame(el));
      continue;
    }
    // Kept unseen, as the box its arrows pin to; svgBoxed draws nothing for it.
    out.push({ ...el, opacity: 0 });
    for (const child of resolveInstance(el, main, { rotate: true })) out.push(child);
  }
  return { ...tab, elements: out };
}

// An instance-kind shape (with or without a main id) not yet expanded. An expanded one is kept at opacity 0, so a
// second pass (an SVG export expands, then renders) leaves it be; an instance a person faded to nothing draws
// nothing either way.
function isUnexpanded(el: Element): el is ShapeElement {
  return el.type === 'shape' && el.shape === 'instance' && el.opacity !== 0;
}

/** One element of a main an instance may override, and what it takes: text, colours and an icon. */
export type OverrideTarget = {
  elementId: string;
  name: string;
  fields: ('label' | 'fillColor' | 'strokeColor' | 'textColor' | 'iconId')[];
  main: Element;
};

/** The main's elements that take an override, in the main's order, each named by its text or kind. */
export function componentOverrideTargets(main: DesignComponent): OverrideTarget[] {
  const out: OverrideTarget[] = [];
  for (const el of main.elements) {
    const fields: OverrideTarget['fields'] = [];
    const anyEl = el as { label?: unknown; iconId?: unknown; type: string };
    const hasText =
      el.type !== 'freehand' &&
      el.type !== 'path' &&
      el.type !== 'table' &&
      typeof anyEl.label === 'string' &&
      anyEl.label.trim() !== '';
    if (hasText) fields.push('label');
    const glyph = el.type === 'shape' && el.shape === 'icon';
    if (el.type !== 'arrow' && el.type !== 'text' && !glyph) fields.push('fillColor');
    if (el.type !== 'text') fields.push('strokeColor');
    if (hasText || el.type === 'text') fields.push('textColor');
    if (typeof anyEl.iconId === 'string') fields.push('iconId');
    if (fields.length === 0) continue;
    const label = typeof anyEl.label === 'string' ? anyEl.label.replace(/\s+/g, ' ').trim() : '';
    out.push({ elementId: el.id, name: label.slice(0, 40) || kindName(el), fields, main: el });
  }
  return out;
}

function kindName(el: Element): string {
  if (el.type === 'shape') return el.shape === 'icon' ? 'Icon' : 'Shape';
  if (el.type === 'arrow') return 'Arrow';
  if (el.type === 'freehand') return 'Drawing';
  return el.type.charAt(0).toUpperCase() + el.type.slice(1);
}

/** The instance's overrides with one field set or (value undefined) cleared; empty entries drop out. */
export function withOverride(
  instance: InstanceElement,
  elementId: string,
  field: keyof ComponentOverride,
  value: string | undefined,
): InstanceElement {
  const all = { ...(instance.componentOverrides ?? {}) };
  const entry = { ...(all[elementId] ?? {}) };
  if (value === undefined) delete entry[field];
  else entry[field] = value;
  if (Object.keys(entry).length) all[elementId] = entry;
  else delete all[elementId];
  const next = { ...instance };
  if (Object.keys(all).length) next.componentOverrides = all;
  else delete next.componentOverrides;
  return next;
}
