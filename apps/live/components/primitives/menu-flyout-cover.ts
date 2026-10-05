// Where a section's flyout sits on a phone (docs/specs/004-interface-design/flyout-height-stability.md
// "On a phone it covers the parent"): exactly over the menu that opened it, so it reads as having
// replaced it. Pure, from the host menu's rect, the flyout's own height and the viewport.
//
// Sideways it takes the host's own left and width, kept on screen but never inset further: the host
// already chose its inset (a floating menu its margin, a bottom sheet none, edge to edge), and a
// margin added here slid a full-width cover past the right edge. Vertically it starts at the host's
// top, pulled up just enough for a taller child to fit above the margin, and covers the host's whole
// height, bounded by the screen below its top. Rounded to whole pixels, so text stays crisp.

type Rect = { left: number; top: number; width: number; height: number };

export type FlyoutCover = { left: number; top: number; width: number; minHeight: number };

export function coverHost(
  host: Rect,
  panelHeight: number,
  viewport: { width: number; height: number },
  margin: number,
): FlyoutCover {
  const width = Math.round(Math.min(host.width, viewport.width));
  const left = Math.round(Math.max(0, Math.min(host.left, viewport.width - width)));
  const maxTop = Math.max(margin, viewport.height - panelHeight - margin);
  const top = Math.round(Math.max(margin, Math.min(host.top, maxTop)));
  const minHeight = Math.round(Math.min(host.height, viewport.height - top - margin));
  return { left, top, width, minHeight };
}
