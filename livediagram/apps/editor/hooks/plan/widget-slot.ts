// Where in a board header's widget zone a point falls (docs/specs/026-plan/board-widgets.md "Placing and arranging
// widgets"): the place before the first widget whose middle is right of it, counting the widgets as they are (the
// dragged one, `except`, is skipped as a landmark). Read by a widget's drag to reorder it.
export function widgetSlotAt(zone: HTMLElement, clientX: number, except?: string): number {
  const els = [...zone.querySelectorAll<HTMLElement>('[data-widget]')];
  let slot = 0;
  els.forEach((el, i) => {
    if (el.dataset.widget === except) return;
    const r = el.getBoundingClientRect();
    if (r.left + r.width / 2 < clientX) slot = i + 1;
  });
  return slot;
}
