// The edit session (docs/specs/009-elements/components.md "Editing the main: the edit session"): a main put on the
// tab as plain elements at an instance's place and scale, edited with the ordinary tools, derived back into the main
// after each change, and folded away on Done. The session is data on the tab (`componentEditBy` on the instance,
// `componentMember` on each member), so it survives a reload, reaches peers and moves with undo. Pure.
import type { Endpoint } from './arrow-types';
import { endpointPosition, elementIndexFor } from './geometry';
import type { Element, ShapeElement } from './index';
import {
  isInstance,
  mayGoInComponent,
  type ComponentMember,
  type DesignComponent,
  type InstanceElement,
} from './components';
import { instanceScale, resolveInstance } from './component-resolve';

/** The instances on a tab with an edit session open. */
export function activeComponentSessions(elements: readonly Element[]): InstanceElement[] {
  return elements.filter((e): e is InstanceElement => isInstance(e) && !!e.componentEditBy);
}

/** The members of one session, in array order. */
export function sessionMembers(elements: readonly Element[], instanceId: string): Element[] {
  return elements.filter((e) => e.componentMember?.instanceId === instanceId);
}

/** Starts a session: the instance hidden (`componentEditBy`), the main's elements after it as plain elements at its
 *  place and scale, without its overrides, each marked as a member. Ids are `<instanceId>-<elementId>`, made unique
 *  against the tab. Returns `elements` when the instance is not there or already has a session. */
export function startComponentEdit(
  elements: Element[],
  instanceId: string,
  main: DesignComponent,
  by: string,
): Element[] {
  const at = elements.findIndex((e) => e.id === instanceId);
  const instance = elements[at];
  if (at < 0 || !isInstance(instance) || instance.componentEditBy) return elements;
  const taken = new Set(elements.map((e) => e.id));
  const ids = new Map<string, string>();
  for (const m of main.elements) {
    let id = `${instanceId}-${m.id}`;
    for (let n = 2; taken.has(id); n += 1) id = `${instanceId}-${m.id}-${n}`;
    taken.add(id);
    ids.set(m.id, id);
  }
  const members = resolveInstance({ ...instance, rotation: 0 }, main, {
    overrides: false,
    ids: (id) => ids.get(id) ?? id,
  }).map((el, i) => {
    const member: ComponentMember = { instanceId, elementId: main.elements[i]!.id };
    return { ...el, componentMember: member };
  });
  const out = [...elements];
  out[at] = { ...instance, componentEditBy: by };
  out.splice(at + 1, 0, ...members);
  return out;
}

/** Marks every element `next` adds over `prev` (allowed in a main, not already marked) as a member of the one
 *  session open on the tab, so what is drawn during a session joins it. Returns `next` when nothing joins, or when
 *  no session, or more than one, is open. */
export function stampSessionMembers(prev: readonly Element[], next: Element[]): Element[] {
  const sessions = activeComponentSessions(next);
  if (sessions.length !== 1) return next;
  const instanceId = sessions[0]!.id;
  const before = new Set(prev.map((e) => e.id));
  let out: Element[] | null = null;
  next.forEach((el, i) => {
    if (before.has(el.id) || el.componentMember || !mayGoInComponent(el)) return;
    out ??= [...next];
    out[i] = { ...el, componentMember: { instanceId, elementId: el.id } };
  });
  return out ?? next;
}

/** The main as the session's members now stand: each member back in the frame's space (at the instance's scale),
 *  under the main element id it stands for; arrow ends pinned to a member re-target that id, to anything else turn
 *  free. The frame stays as made. Null with no members. */
export function deriveComponentFromSession(
  elements: readonly Element[],
  instanceId: string,
  main: DesignComponent,
  now: number,
): DesignComponent | null {
  const instance = elements.find((e) => e.id === instanceId);
  if (!isInstance(instance)) return null;
  const members = sessionMembers(elements, instanceId);
  if (members.length === 0) return null;
  const { sx, sy } = instanceScale(instance, main);
  const ix = instance.x;
  const iy = instance.y;
  const toMain = new Map(members.map((m) => [m.id, m.componentMember!.elementId] as const));
  const index = elementIndexFor(elements);
  const back = (p: { x: number; y: number }) => ({ x: (p.x - ix) / sx, y: (p.y - iy) / sy });
  const mapEnd = (end: Endpoint): Endpoint => {
    if (end.kind === 'pinned') {
      const id = toMain.get(end.elementId);
      return id
        ? { ...end, elementId: id }
        : { kind: 'free', ...back(endpointPosition(end, index)) };
    }
    if (end.kind === 'on-arrow') {
      const id = toMain.get(end.arrowId);
      return id ? { ...end, arrowId: id } : { kind: 'free', ...back(endpointPosition(end, index)) };
    }
    if (end.kind === 'free') return { kind: 'free', ...back(end) };
    return end;
  };
  const unscale = (v: { dx: number; dy: number }) => ({ dx: v.dx / sx, dy: v.dy / sy });
  const derived: Element[] = members.map((m) => {
    const bare = { ...(m as Record<string, unknown>) };
    for (const f of ['componentMember', 'layerId', 'locked', 'commentThread', 'addedBy'])
      delete bare[f];
    bare.id = m.componentMember!.elementId;
    if (m.type === 'arrow') {
      return {
        ...bare,
        from: mapEnd(m.from),
        to: mapEnd(m.to),
        ...(m.curveOffset ? { curveOffset: unscale(m.curveOffset) } : {}),
        ...(m.elbowOffset ? { elbowOffset: unscale(m.elbowOffset) } : {}),
        ...(m.curvePoints ? { curvePoints: m.curvePoints.map(unscale) } : {}),
      } as Element;
    }
    const b = m;
    const host = (b as { attachedTo?: unknown }).attachedTo;
    return {
      ...bare,
      x: (b.x - ix) / sx,
      y: (b.y - iy) / sy,
      width: b.width / sx,
      height: b.height / sy,
      ...(typeof host === 'string' && toMain.has(host) ? { attachedTo: toMain.get(host) } : {}),
    } as Element;
  });
  return { ...main, elements: derived, updatedAt: now };
}

/** Done: the members removed and the instance shown again. With no members left the instance goes too (the person
 *  deleted everything in it). */
export function finishComponentEdit(elements: Element[], instanceId: string): Element[] {
  const hasMembers = elements.some((e) => e.componentMember?.instanceId === instanceId);
  const out: Element[] = [];
  for (const el of elements) {
    if (el.componentMember?.instanceId === instanceId) continue;
    if (el.id === instanceId && isInstance(el)) {
      if (!hasMembers) continue;
      const shown = { ...el } as ShapeElement;
      delete shown.componentEditBy;
      out.push(shown);
      continue;
    }
    out.push(el);
  }
  return out;
}
