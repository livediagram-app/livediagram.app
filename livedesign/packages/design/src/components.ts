// Components (docs/specs/009-elements/components.md): a piece of a design made once and used on many screens. A main
// (`DesignComponent`) lives in the design's component library, never on a tab; an instance is ONE element
// (`shape: 'instance'`) that draws its main inside its box, with overrides as fields on it. This module holds the
// vocabulary: types, limits, the instance test, what may go in a main, names and the refs a tab holds. Pure.
//
// Why this is not a group again (the spec's "Why this is not a group again"): nothing on a tab lists the elements of
// a component, so no select, drag, delete, lock, layer or clipboard path branches on one.
import type { Element, ShapeElement } from './index';

/** The instance's shape kind. */
export const INSTANCE_SHAPE = 'instance' as const;
/** Elements one main may hold. */
export const MAX_COMPONENT_ELEMENTS = 200;
/** Mains one design's library may hold (archived ones included). */
export const MAX_COMPONENTS = 200;
/** A main's JSON, at most. */
export const MAX_COMPONENT_BYTES = 256 * 1024;
/** Overrides one instance may carry. */
export const MAX_COMPONENT_OVERRIDES = 200;
/** A main's name, at most (the tab name cap). */
export const COMPONENT_NAME_MAX = 60;
/** A main's id, at most. */
export const COMPONENT_ID_MAX = 64;
/** How long the editor waits after a main's last change before saving it. */
export const COMPONENT_SAVE_DEBOUNCE_MS = 400;
/** The separator between an instance's id and its main's element id in a resolved element's id. Never minted. */
export const INSTANCE_ID_SEPARATOR = '/';

/** What an instance changes about one element of its main, without detaching. */
export type ComponentOverride = {
  label?: string;
  fillColor?: string;
  strokeColor?: string;
  textColor?: string;
  iconId?: string;
};

/** The override fields, in the order the Overrides section lists them. */
export const COMPONENT_OVERRIDE_FIELDS = [
  'label',
  'fillColor',
  'strokeColor',
  'textColor',
  'iconId',
] as const satisfies readonly (keyof ComponentOverride)[];
export type ComponentOverrideField = (typeof COMPONENT_OVERRIDE_FIELDS)[number];

/** An element of an open edit session: the instance it is editing and the main element it stands for. */
export type ComponentMember = { instanceId: string; elementId: string };

/** A main: a name, a frame (its own box, top-left at 0, 0) and the elements it is made of, in the frame's space. */
export type DesignComponent = {
  id: string;
  name: string;
  width: number;
  height: number;
  elements: Element[];
  updatedAt: number;
  // Taken out of the palette's band; instances already placed keep drawing it.
  archived?: boolean;
};

/** The design's mains by id. */
export type ComponentLibrary = ReadonlyMap<string, DesignComponent>;

/** Finds a main by id, or undefined when the library has none (or has not loaded). */
export type ComponentLookup = (componentId: string) => DesignComponent | undefined;

export type InstanceElement = ShapeElement & { shape: typeof INSTANCE_SHAPE; componentId: string };

/** Whether an element is an instance (with a main to draw). */
export function isInstance(el: Element | undefined | null): el is InstanceElement {
  return (
    !!el && el.type === 'shape' && el.shape === INSTANCE_SHAPE && typeof el.componentId === 'string'
  );
}

/** Whether an element may go into a main: everything but images, videos and embeds, link cards, tab windows and
 *  instances (an instance in a selection is detached first). Their content lives outside the tab. */
export function mayGoInComponent(el: Element): boolean {
  if (el.type === 'image' || el.type === 'video' || el.type === 'link-card') return false;
  if (el.type === 'shape' && (el.shape === 'tab-window' || el.shape === INSTANCE_SHAPE))
    return false;
  return true;
}

/** A name as stored: whitespace collapsed, trimmed, at most COMPONENT_NAME_MAX characters. */
export function clampComponentName(name: string): string {
  return name.replace(/\s+/g, ' ').trim().slice(0, COMPONENT_NAME_MAX).trim();
}

/** The name Make Component gives: `Component <n>`, n one more than the library's size, unique in it. */
export function nextComponentName(library: Iterable<DesignComponent>): string {
  const names = new Set<string>();
  let count = 0;
  for (const c of library) {
    names.add(c.name);
    count += 1;
  }
  let n = count + 1;
  while (names.has(`Component ${n}`)) n += 1;
  return `Component ${n}`;
}

/** The mains a tab's instances use, each once, in first-use order. */
export function componentRefIds(elements: readonly Element[]): string[] {
  const seen = new Set<string>();
  for (const el of elements) if (isInstance(el)) seen.add(el.componentId);
  return [...seen];
}

/** The mains a stored tab body (`tabs.data` JSON) uses; [] for a body that does not parse. */
export function componentRefIdsFromData(data: string): string[] {
  // Most bodies hold no instance: skip the parse for them.
  if (!data.includes('"componentId"')) return [];
  try {
    const parsed = JSON.parse(data) as { elements?: unknown };
    return Array.isArray(parsed.elements) ? componentRefIds(parsed.elements as Element[]) : [];
  } catch {
    return [];
  }
}

/** A lookup over a library map (or nothing). */
export function libraryLookup(library: ComponentLibrary | undefined | null): ComponentLookup {
  return (id) => library?.get(id);
}

/** The library as a map, from a list (later entries win). */
export function libraryOf(components: readonly DesignComponent[]): Map<string, DesignComponent> {
  return new Map(components.map((c) => [c.id, c] as const));
}

/** The mains the palette's band offers: not archived, newest first. */
export function placeableComponents(library: Iterable<DesignComponent>): DesignComponent[] {
  return [...library].filter((c) => !c.archived).sort((a, b) => b.updatedAt - a.updatedAt);
}
