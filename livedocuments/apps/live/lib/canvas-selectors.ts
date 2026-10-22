// The DOM selectors overlays, tours and pointer handlers find the canvas by.

// The canvas surface, the `<main>` Canvas renders with `data-canvas-a11y-root`: what overlays measure,
// portal into or test a pointer against, and what a slide transition captures.
export const CANVAS_ROOT_SELECTOR = '[data-canvas-a11y-root]';

// An id made safe for an attribute selector.
export function escapeId(id: string): string {
  return typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(id) : id;
}

// An element's rendered node, or one of its parts (`part` is a descendant selector), by element id.
export function elementSelector(elementId: string, part = ''): string {
  return `[data-element-id="${escapeId(elementId)}"]${part ? ` ${part}` : ''}`;
}
