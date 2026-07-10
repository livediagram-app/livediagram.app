// DOM plumbing for the interactive editor tour (spec/79). The tour drives
// the real chrome (panels, dropdowns, menus) through the same buttons a
// user would press, so these helpers resolve tour anchors (`data-tour-id`)
// and wait out lazy-loaded menus instead of assuming synchronous DOM.

function tourSelector(tourId: string): string {
  return `[data-tour-id="${tourId}"]`;
}

export function findTour(tourId: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(tourSelector(tourId));
}

// Click a tour anchor via a synthetic .click(). Deliberately NOT a full
// pointer sequence: pointerdown-based outside-close listeners (dropdowns,
// mobile panel auto-collapse) must not fire from a tour-driven click.
export function clickTour(tourId: string): boolean {
  const el = findTour(tourId);
  if (!el) return false;
  el.click();
  return true;
}

// Poll (rAF) for a selector until it appears or the timeout passes. Several
// tour targets are lazy-loaded chunks (the tab menu, the element context
// menu), so a one-shot querySelector would race the network on first open.
export function waitForSelector(selector: string, timeoutMs = 3000): Promise<HTMLElement | null> {
  return new Promise((resolve) => {
    const started = performance.now();
    const tick = () => {
      const el = document.querySelector<HTMLElement>(selector);
      if (el) return resolve(el);
      if (performance.now() - started > timeoutMs) return resolve(null);
      requestAnimationFrame(tick);
    };
    tick();
  });
}

export function waitForTour(tourId: string, timeoutMs = 3000): Promise<HTMLElement | null> {
  return waitForSelector(tourSelector(tourId), timeoutMs);
}

// Expand a collapsed MovablePanel by clicking its header's expand button
// (aria-label "Expand <title>"). No-op when the panel is already expanded
// (the button then reads "Collapse <title>").
export function expandPanelIfCollapsed(tourId: string, title: string) {
  const panel = findTour(tourId);
  const expand = panel?.querySelector<HTMLElement>(
    `button[aria-label="Expand ${title.toLowerCase()}"]`,
  );
  expand?.click();
}
