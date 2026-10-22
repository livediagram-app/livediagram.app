// Arrow ends named by ref (docs/specs/015-api/mcp-server.md §4.4 "Arrow ends by ref"): an arrow the model writes may
// pin its ends with the short refs read_document prints (`4aeb`), as an op's elementId may. Each pinned end is
// resolved to the element's id among the ids the result will hold (the tab's, plus this call's new elements); an end
// that names nothing there is refused, never stored as an arrow to nowhere.

import { computeRefs, resolveRef } from '@livedesign/document';

type Rec = Record<string, unknown>;

const isRec = (v: unknown): v is Rec => typeof v === 'object' && v !== null && !Array.isArray(v);

// The pinned end's element name, or null when the end is not a pinned one.
function pinnedName(end: unknown): string | null {
  return isRec(end) && end.kind === 'pinned' && typeof end.elementId === 'string'
    ? end.elementId
    : null;
}

// Every arrow end in `elements` resolved against `ids`: the elements with their ends rewritten to ids, or the
// first end that names nothing (or more than one element), as a sentence naming the arrow and what is there.
export function resolveArrowEnds(
  elements: readonly unknown[],
  ids: readonly string[],
): { elements: unknown[] } | { error: string } {
  const table = computeRefs(ids);
  const out: unknown[] = [];
  for (const el of elements) {
    if (!isRec(el) || el.type !== 'arrow') {
      out.push(el);
      continue;
    }
    let next: Rec = el;
    for (const side of ['from', 'to'] as const) {
      const name = pinnedName(el[side]);
      if (name === null) continue;
      const found = resolveRef(name, table);
      if (found.kind !== 'found') {
        const what = typeof el.id === 'string' ? `arrow "${el.id}"` : 'an arrow';
        const why =
          found.kind === 'ambiguous'
            ? `matches more than one element (${found.candidates.slice(0, 4).join(', ')})`
            : 'is no element on the tab or in this call';
        return {
          error:
            `${what}: "${side}" is pinned to "${name}", which ${why}. Pin each end to an element's id ` +
            '(or the ref read_document printed for it), or use a free end { "kind": "free", "x", "y" }.',
        };
      }
      if (found.id !== name) {
        next = { ...next, [side]: { ...(el[side] as Rec), elementId: found.id } };
      }
    }
    out.push(next);
  }
  return { elements: out };
}

// The ids of the elements in `elements` that carry a string id.
export function idsOf(elements: readonly unknown[]): string[] {
  return elements.flatMap((el) => (isRec(el) && typeof el.id === 'string' ? [el.id] : []));
}
