// DOM-based canvas hit-testing. The canvas marks every element wrapper (and
// each arrow's hit band) with a `data-element-id`, so `document.elementsFromPoint`
// resolves what's under a screen point without re-deriving per-element geometry.
// Lives in its own module (no `@livediagram/diagram` import) so the DOM `Element`
// type isn't shadowed by the diagram model's `Element`.

// The `[data-element-id]` wrappers under a screen point, topmost first, as
// { id, host } pairs. Shared by the eraser and the icon-drop-on-shape gesture.
// One entry per matching node in the hit stack (the same id can repeat for a
// child + its wrapper); callers dedupe or break as they need.
export function elementHostsAtPoint(
  clientX: number,
  clientY: number,
): { id: string; host: Element }[] {
  const out: { id: string; host: Element }[] = [];
  for (const node of document.elementsFromPoint(clientX, clientY)) {
    const host = node.closest('[data-element-id]');
    const id = host?.getAttribute('data-element-id');
    if (id && host) out.push({ id, host });
  }
  return out;
}
