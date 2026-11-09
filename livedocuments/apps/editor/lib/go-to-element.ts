import type { Element } from '@livedocuments/document';

type Scroll = (x: number, y: number, w: number, h: number, opts?: { center?: boolean }) => void;

// A Collaborate panel row goes to its card (docs/specs/012-collaboration/assigned-actions.md "Row click goes to the
// conversation"): selected and brought to the middle of the view, as a deep link does, so a thread on a page out of
// sight opens where it can be seen. An element with no box (an arrow) is selected only.
export function goToElement(
  elements: readonly Element[],
  id: string,
  select: (id: string) => void,
  scrollIntoView: Scroll,
): void {
  select(id);
  const el = elements.find((e) => e.id === id);
  if (el && 'width' in el) scrollIntoView(el.x, el.y, el.width, el.height, { center: true });
}
