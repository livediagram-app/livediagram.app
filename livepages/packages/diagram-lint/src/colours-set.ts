// The elements whose colours a write set (docs/specs/024-agents/diagram-lint.md "Where it runs"): those it added with a
// fill or stroke, and those whose fill or stroke it changed. A changeset's lint judges colour-on-themed on these alone.
import type { Element } from '@livepages/document';

const colourOf = (el: Element) =>
  `${Reflect.get(el, 'fillColor') ?? ''}|${Reflect.get(el, 'strokeColor') ?? ''}`;

export function coloursSet(before: readonly Element[], after: readonly Element[]): Set<string> {
  const was = new Map(before.map((el) => [el.id, colourOf(el)]));
  const out = new Set<string>();
  for (const el of after) {
    const now = colourOf(el);
    const prior = was.get(el.id);
    if (prior === undefined ? now !== '|' : prior !== now) out.add(el.id);
  }
  return out;
}
