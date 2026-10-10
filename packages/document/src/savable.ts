// What an import may put on a tab (docs/specs/020-import-export/board-import.md "What lands"): only elements the
// api will save. An element the validator refuses would make every later save of the tab fail
// (`invalid tab`), so an import keeps each valid element, once per id, up to the tab's cap, and counts
// the rest. Pure.
import { isValidElement, MAX_ELEMENTS_PER_TAB } from './validate';
import type { Element } from './index';

export function savableElements(elements: readonly unknown[]): {
  elements: Element[];
  dropped: number;
} {
  const ids = new Set<string>();
  const out: Element[] = [];
  for (const el of elements) {
    if (out.length >= MAX_ELEMENTS_PER_TAB) break;
    if (!isValidElement(el) || ids.has(el.id)) continue;
    ids.add(el.id);
    out.push(el);
  }
  return { elements: out, dropped: elements.length - out.length };
}
