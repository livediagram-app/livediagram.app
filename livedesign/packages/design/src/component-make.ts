// Make Component and Detach (docs/specs/009-elements/components.md "Making a component", "Detach"): a selection
// becomes a main plus one instance in its place, and an instance becomes plain elements again. Pure.
import type { Endpoint } from './arrow-types';
import { endpointPosition, elementIndexFor } from './geometry';
import { isBoxed, type Element } from './index';
import {
  INSTANCE_SHAPE,
  MAX_COMPONENT_ELEMENTS,
  isInstance,
  mayGoInComponent,
  type ComponentLookup,
  type DesignComponent,
  type InstanceElement,
} from './components';
import { resolveInstance } from './component-resolve';

export type MakeComponentOpts = {
  componentId: string;
  instanceId: string;
  name: string;
  now: number;
  // Mains of instances in the selection, which are detached into the new main.
  lookup?: ComponentLookup;
  // Ids for the elements a detached instance brings in.
  newId?: () => string;
};

export type MakeComponentRefusal = 'empty' | 'locked' | 'kind' | 'too_many' | 'missing_main';

export type MakeComponentResult =
  | { ok: true; component: DesignComponent; elements: Element[]; instance: InstanceElement }
  | { ok: false; reason: MakeComponentRefusal };

// What a main's element never keeps: where it sat on a tab, its lock, and what belongs to the original.
const DROPPED_ON_MAKE = [
  'layerId',
  'locked',
  'componentMember',
  'commentThread',
  'action',
  'actions',
  'addedBy',
];

function without<T extends object>(el: T, fields: readonly string[]): T {
  const out = { ...(el as Record<string, unknown>) };
  for (const f of fields) delete out[f];
  return out as T;
}

/** Why Make Component may not run on this selection, or null when it may. */
export function makeComponentRefusal(
  elements: readonly Element[],
  selectedIds: ReadonlySet<string>,
  lookup?: ComponentLookup,
): MakeComponentRefusal | null {
  const picked = elements.filter((e) => selectedIds.has(e.id));
  if (picked.length === 0) return 'empty';
  if (picked.some((e) => e.locked)) return 'locked';
  let count = 0;
  for (const el of picked) {
    if (isInstance(el)) {
      const main = lookup?.(el.componentId);
      if (!main) return 'missing_main';
      if (main.elements.some((m) => !mayGoInComponent(m))) return 'kind';
      count += main.elements.length;
      continue;
    }
    if (!mayGoInComponent(el)) return 'kind';
    count += 1;
  }
  return count > MAX_COMPONENT_ELEMENTS ? 'too_many' : null;
}

type Rect = { x: number; y: number; w: number; h: number };

function boundsOf(els: readonly Element[], all: readonly Element[]): Rect {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  const index = elementIndexFor(all);
  const take = (x: number, y: number) => {
    x0 = Math.min(x0, x);
    y0 = Math.min(y0, y);
    x1 = Math.max(x1, x);
    y1 = Math.max(y1, y);
  };
  for (const el of els) {
    if (isBoxed(el)) {
      take(el.x, el.y);
      take(el.x + el.width, el.y + el.height);
    } else {
      const a = endpointPosition(el.from, index);
      const b = endpointPosition(el.to, index);
      take(a.x, a.y);
      take(b.x, b.y);
    }
  }
  if (!Number.isFinite(x0)) return { x: 0, y: 0, w: 1, h: 1 };
  return { x: x0, y: y0, w: Math.max(1, x1 - x0), h: Math.max(1, y1 - y0) };
}

/** Make Component: the selection becomes a main, and one instance takes its place. */
export function makeComponent(
  elements: Element[],
  selectedIds: ReadonlySet<string>,
  opts: MakeComponentOpts,
): MakeComponentResult {
  const refusal = makeComponentRefusal(elements, selectedIds, opts.lookup);
  if (refusal) return { ok: false, reason: refusal };
  // Instances in the selection are detached first, their elements joining the selection.
  let working = elements;
  const selected = new Set(selectedIds);
  for (const el of elements) {
    if (!selectedIds.has(el.id) || !isInstance(el)) continue;
    const main = opts.lookup!(el.componentId)!;
    const before = new Set(working.map((e) => e.id));
    working = detachInstance(working, el.id, main, opts.newId ?? (() => crypto.randomUUID()));
    selected.delete(el.id);
    for (const e of working) if (!before.has(e.id)) selected.add(e.id);
  }
  const picked = working.filter((e) => selected.has(e.id));
  const frame = boundsOf(picked, working);
  const index = elementIndexFor(working);
  const freeAt = (end: Endpoint): Endpoint => ({ kind: 'free', ...endpointPosition(end, index) });
  const shift = (end: Endpoint): Endpoint =>
    end.kind === 'free' ? { kind: 'free', x: end.x - frame.x, y: end.y - frame.y } : end;
  const inside = (end: Endpoint): boolean =>
    end.kind === 'free' ||
    (end.kind === 'pinned' && selected.has(end.elementId)) ||
    (end.kind === 'on-arrow' && selected.has(end.arrowId));
  const mainElements: Element[] = picked.map((el) => {
    const bare = without(el, DROPPED_ON_MAKE);
    if (bare.type === 'arrow') {
      const from = inside(bare.from) ? bare.from : freeAt(bare.from);
      const to = inside(bare.to) ? bare.to : freeAt(bare.to);
      return { ...bare, from: shift(from), to: shift(to) };
    }
    return { ...bare, x: bare.x - frame.x, y: bare.y - frame.y };
  });
  const component: DesignComponent = {
    id: opts.componentId,
    name: opts.name,
    width: frame.w,
    height: frame.h,
    elements: mainElements,
    updatedAt: opts.now,
  };
  const firstAt = working.findIndex((e) => selected.has(e.id));
  const first = working[firstAt]!;
  const instance: InstanceElement = {
    id: opts.instanceId,
    type: 'shape',
    shape: INSTANCE_SHAPE,
    componentId: component.id,
    x: frame.x,
    y: frame.y,
    width: frame.w,
    height: frame.h,
    ...(first.layerId ? { layerId: first.layerId } : {}),
  };
  const repin = (end: Endpoint): Endpoint =>
    end.kind === 'pinned' && selected.has(end.elementId)
      ? { kind: 'pinned', elementId: instance.id, anchor: end.anchor }
      : end.kind === 'on-arrow' && selected.has(end.arrowId)
        ? freeAt(end)
        : end;
  const out: Element[] = [];
  working.forEach((el, i) => {
    if (i === firstAt) out.push(instance);
    if (selected.has(el.id)) return;
    if (el.type === 'arrow') {
      const from = repin(el.from);
      const to = repin(el.to);
      out.push(from === el.from && to === el.to ? el : { ...el, from, to });
      return;
    }
    // A badge or pointer note left outside attaches to the instance its host went into.
    const host = (el as { attachedTo?: unknown }).attachedTo;
    out.push(
      typeof host === 'string' && selected.has(host)
        ? ({ ...el, attachedTo: instance.id } as Element)
        : el,
    );
  });
  return { ok: true, component, elements: out, instance };
}

/** Detach: the instance replaced, in its place, by the main as it draws there (overrides applied, its scale,
 *  rotation and layer), with fresh ids. An arrow pinned to the instance keeps that end as a free point. */
export function detachInstance(
  elements: Element[],
  instanceId: string,
  main: DesignComponent,
  newId: () => string,
): Element[] {
  const at = elements.findIndex((e) => e.id === instanceId);
  const instance = elements[at];
  if (at < 0 || !instance || instance.type !== 'shape') return elements;
  const ids = new Map<string, string>();
  for (const m of main.elements) ids.set(m.id, newId());
  const placed = resolveInstance(instance, main, {
    rotate: true,
    ids: (id) => ids.get(id) ?? newId(),
  }).map((el) => {
    const out = { ...el };
    delete out.locked;
    return out;
  });
  const index = elementIndexFor(elements);
  const free = (end: Endpoint): Endpoint =>
    (end.kind === 'pinned' && end.elementId === instanceId) ||
    (end.kind === 'on-arrow' && end.arrowId === instanceId)
      ? { kind: 'free', ...endpointPosition(end, index) }
      : end;
  const out: Element[] = [];
  elements.forEach((el, i) => {
    if (i === at) {
      out.push(...placed);
      return;
    }
    if (el.type === 'arrow') {
      const from = free(el.from);
      const to = free(el.to);
      out.push(from === el.from && to === el.to ? el : { ...el, from, to });
      return;
    }
    out.push(el);
  });
  return out;
}
