// A .vsdx's masters and colour table (docs/specs/020-import-export/blueprints/visio-import.md step 3): each master's
// universal name and its shapes by id, read from its own part through the masters' relationships.

import { VISIO_MAX_MASTERS } from './limits';
import type { VisioPackage } from './package';

export type VisioMaster = {
  id: string;
  /** `NameU`, else `Name`. */
  name: string;
  /** Every shape of the master, nested ones included, by id. */
  shapes: Map<string, Element>;
  /** The first top-level shape: what an instance of the master inherits from. */
  top: Element | null;
};

const MASTERS_PART = 'visio/masters/masters.xml';
const DOCUMENT_PART = 'visio/document.xml';

const childrenNamed = (el: Element | null | undefined, name: string) =>
  Array.from(el?.children ?? []).filter((c) => c.localName === name);

/** A `<Rel r:id="..."/>` child's id, whatever prefix the file gave the relationships namespace. */
export function relIdOf(el: Element): string | null {
  const rel = childrenNamed(el, 'Rel')[0];
  if (!rel) return null;
  for (const attr of Array.from(rel.attributes)) if (attr.localName === 'id') return attr.value;
  return null;
}

/** Every `<Shape>` under a `<Shapes>`, depth first, by id. */
export function collectShapes(shapes: Element | undefined, into: Map<string, Element>): void {
  const stack = childrenNamed(shapes, 'Shape').reverse();
  while (stack.length > 0) {
    const shape = stack.pop()!;
    const id = shape.getAttribute('ID');
    if (id) into.set(id, shape);
    const nested = childrenNamed(shape, 'Shapes')[0];
    stack.push(...childrenNamed(nested, 'Shape').reverse());
  }
}

export async function readMasters(pkg: VisioPackage): Promise<Map<string, VisioMaster>> {
  const out = new Map<string, VisioMaster>();
  const root = await pkg.part(MASTERS_PART);
  if (!root) return out;
  const rels = await pkg.rels(MASTERS_PART);
  for (const master of childrenNamed(root, 'Master').slice(0, VISIO_MAX_MASTERS)) {
    const id = master.getAttribute('ID');
    if (!id) continue;
    const relId = relIdOf(master);
    const path = relId ? rels.get(relId) : undefined;
    const contents = path ? await pkg.part(path) : null;
    const top = childrenNamed(contents, 'Shapes')[0];
    const shapes = new Map<string, Element>();
    collectShapes(top, shapes);
    out.set(id, {
      id,
      name: master.getAttribute('NameU') ?? master.getAttribute('Name') ?? '',
      shapes,
      top: childrenNamed(top, 'Shape')[0] ?? null,
    });
  }
  return out;
}

/** The document's colour table (`<Colors><ColorEntry IX RGB/>`), index to `#rrggbb`. */
export async function readColourTable(pkg: VisioPackage): Promise<Map<number, string>> {
  const out = new Map<number, string>();
  const root = await pkg.part(DOCUMENT_PART);
  for (const entry of childrenNamed(childrenNamed(root, 'Colors')[0], 'ColorEntry')) {
    const ix = Number(entry.getAttribute('IX'));
    const rgb = entry.getAttribute('RGB');
    if (Number.isInteger(ix) && rgb) out.set(ix, rgb);
  }
  return out;
}
