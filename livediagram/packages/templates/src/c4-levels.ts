// The C4 levels link to each other (docs/specs/008-canvas/canvas-and-palette.md "Templates", the C4 levels link to each
// other): the model's zoom. A card whose name is the name of a C4-style boundary on another tab zooms in to that tab
// (the System Context's platform opens the Container Diagram, the Container Diagram's Order service opens the
// Component Diagram), and the boundary zooms back out to the card's tab. Run when a template lands on a tab, and only
// links reaching that tab are made, so a link someone removed is never put back by another tab's template.
//
// Pure. Every tab it does not change comes back as the same object, so an untouched tab (a placeholder whose content
// has not loaded among them) never looks edited.

import type { Element, Tab } from '@livediagram/document';

type Shape = Extract<Element, { type: 'shape' }>;

// Names match ignoring case and spacing.
const key = (name: string | undefined) => (name ?? '').replace(/\s+/g, ' ').trim().toLowerCase();

const isC4Boundary = (el: Element): boolean =>
  el.type === 'shape' && el.shape === 'boundary' && el.boundaryStyle === 'c4' && !!key(el.label);
const isNamedCard = (el: Element): boolean =>
  el.type === 'shape' && el.shape === 'card' && !!key(el.pageTitle);

/** `tabs` with the C4 levels linked through the tab `landedId`: zoom-in links on cards, zoom-out links on boundaries,
 *  each only where the element has no link yet and one end is the landed tab. */
export function linkC4Levels(tabs: readonly Tab[], landedId: string): Tab[] {
  // Where each named boundary and card sits: the first tab holding it.
  const boundaryTab = new Map<string, string>();
  const cardTab = new Map<string, string>();
  for (const tab of tabs)
    for (const el of tab.elements) {
      if (el.type !== 'shape') continue;
      if (isC4Boundary(el) && !boundaryTab.has(key(el.label)))
        boundaryTab.set(key(el.label), tab.id);
      if (isNamedCard(el) && !cardTab.has(key(el.pageTitle)))
        cardTab.set(key(el.pageTitle), tab.id);
    }
  if (boundaryTab.size === 0) return [...tabs];
  // The tab an element on `tab` links to, if the pair reaches the landed tab.
  const target = (tab: Tab, el: Shape): string | undefined => {
    if (el.link) return undefined;
    const to = isC4Boundary(el)
      ? cardTab.get(key(el.label))
      : isNamedCard(el)
        ? boundaryTab.get(key(el.pageTitle))
        : undefined;
    if (!to || to === tab.id) return undefined;
    return tab.id === landedId || to === landedId ? to : undefined;
  };
  return tabs.map((tab) => {
    let changed = false;
    const elements = tab.elements.map((el) => {
      if (el.type !== 'shape') return el;
      const to = target(tab, el);
      if (!to) return el;
      changed = true;
      return { ...el, link: { kind: 'tab' as const, tabId: to } };
    });
    return changed ? { ...tab, elements } : tab;
  });
}
