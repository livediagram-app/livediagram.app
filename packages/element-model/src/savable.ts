// What an import may put on a tab (each product's board-import spec, "What lands"): only elements the
// api will save. An element the validator refuses would make every later save of the tab fail
// (`invalid tab`), so an import keeps each valid element, once per id, up to the tab's cap, and counts
// the rest. Pure; each product binds its own validator and cap.

export function savableElementsOf<E extends { id: string }>(
  elements: readonly unknown[],
  isValidElement: (el: unknown) => el is E,
  maxElementsPerTab: number,
): { elements: E[]; dropped: number } {
  const ids = new Set<string>();
  const out: E[] = [];
  for (const el of elements) {
    if (out.length >= maxElementsPerTab) break;
    if (!isValidElement(el) || ids.has(el.id)) continue;
    ids.add(el.id);
    out.push(el);
  }
  return { elements: out, dropped: elements.length - out.length };
}
