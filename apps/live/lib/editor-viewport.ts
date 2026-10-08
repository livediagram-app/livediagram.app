// The box the editor's chrome lays out in (docs/specs/007-editor/split-view.md "How the editor fits
// in its pane"): the window, or, with a side by side split, the editor's pane. Chrome that sizes
// itself to the room it has asks here rather than reading the window, so it fits whichever.

export const EDITOR_VIEWPORT_ATTR = 'data-editor-viewport';

export type EditorViewportBox = { left: number; width: number; element: HTMLElement | null };

export function editorViewportOf(node: Element | null): EditorViewportBox {
  const element = node?.closest<HTMLElement>(`[${EDITOR_VIEWPORT_ATTR}]`) ?? null;
  // The pane only bounds the chrome while it is a split's pane (it carries the attribute's value).
  if (element && element.getAttribute(EDITOR_VIEWPORT_ATTR) === 'pane') {
    const rect = element.getBoundingClientRect();
    return { left: rect.left, width: rect.width, element };
  }
  return { left: 0, width: window.innerWidth, element };
}
