// Portal linking + travel geometry (spec/104): pure helpers for the portal.
//
// A portal carries `portalTarget`, the id of the portal it leads to. A LINK IS
// TWO-WAY: whatever you can step into, you can step back out of. Linking from
// the menu writes both ends (see useDataShapeSetters), and resolution below
// also honours an INCOMING link, so a portal someone points at leads back even
// if its own target was never written — by an older diagram, an import, or the
// API.
//
// Resolution is deliberately forgiving — a target that has been deleted,
// re-pointed at a non-portal, or points at itself resolves to "unlinked" rather
// than throwing — because a diagram is edited in any order and a half-wired
// portal is a normal intermediate state, not corrupt data.

import type { Element, ShapeElement, Tab } from '@livediagram/diagram';

export type PortalBox = { x: number; y: number; width: number; height: number; label?: string };

// Every portal on the tab, in element order — the candidate list the "where does
// this portal lead?" picker offers.
export function portalsOnTab(elements: Element[]): ShapeElement[] {
  return elements.filter((el): el is ShapeElement => el.type === 'shape' && el.shape === 'portal');
}

// A portal's display name for menus and tooltips: its own label, else a stable
// positional name ("Portal 2") so an unlabelled pair is still tellable apart.
export function portalName(elements: Element[], portal: ShapeElement): string {
  const label = portal.label?.trim();
  if (label) return label;
  const index = portalsOnTab(elements).findIndex((d) => d.id === portal.id);
  return index >= 0 ? `Portal ${index + 1}` : 'Portal';
}

// A portal together with the tab it lives on. Links cross tabs (spec/104): a
// portal on the Overview tab can drop you into the Detail tab, which is the
// cheapest way to build a walkable multi-tab presentation. Element ids are
// unique across the whole diagram, so the stored `portalTarget` needs no tab
// component — the tab is looked up, not recorded.
export type PortalSite = { tabId: string; tabName: string; portal: ShapeElement };

// Every portal in the diagram, tab by tab, in tab then element order.
export function portalSites(tabs: Tab[]): PortalSite[] {
  return tabs.flatMap((tab) =>
    portalsOnTab(tab.elements).map((portal) => ({
      tabId: tab.id,
      tabName: tab.name,
      portal,
    })),
  );
}

// The site a portal leads to, searched across every tab. Same rules as the
// single-tab resolve below: own target first, then whoever points at it.
export function resolvePortalSite(tabs: Tab[], portal: ShapeElement): PortalSite | null {
  const sites = portalSites(tabs);
  const own = sites.find((s) => s.portal.id === portal.portalTarget);
  if (portal.portalTarget && portal.portalTarget !== portal.id && own) return own;
  return (
    sites.find((s) => s.portal.id !== portal.id && s.portal.portalTarget === portal.id) ?? null
  );
}

// A portal's display name within its own tab, for the picker and tooltips.
export function portalSiteName(site: PortalSite, tabs: Tab[]): string {
  const tab = tabs.find((t) => t.id === site.tabId);
  return portalName(tab?.elements ?? [site.portal], site.portal);
}

// The portal `portal` leads to, or null when it is unlinked / mis-linked. Never
// returns the portal itself: a portal to where you already are is a no-op, and
// silently doing nothing on click is the confusing case we're avoiding.
//
// Its own target wins; failing that, the first portal pointing AT it, so the
// return trip works from either end of a one-sided link.
export function resolvePortalTarget(
  elements: Element[],
  portal: ShapeElement,
): ShapeElement | null {
  const own = isPortal(elements.find((el) => el.id === portal.portalTarget));
  if (portal.portalTarget && portal.portalTarget !== portal.id && own) return own;
  const incoming = portalsOnTab(elements).find(
    (p) => p.id !== portal.id && p.portalTarget === portal.id,
  );
  return incoming ?? null;
}

function isPortal(el: Element | undefined): ShapeElement | null {
  return el && el.type === 'shape' && el.shape === 'portal' ? el : null;
}

// Where a character stands when it comes OUT of a portal: centred on the ring,
// at its base (the bottom edge), since the avatar's position is its feet.
export function portalExitPoint(portal: PortalBox): { x: number; y: number } {
  return { x: portal.x + portal.width / 2, y: portal.y + portal.height };
}

// The viewport offset that centres `portal` in a viewport of `size` at `zoom`.
// The canvas transform is `scale(zoom) translate(offset)`, so the offset is in
// canvas px and the centring maths divides the viewport by the zoom.
export function viewportOffsetCentredOn(
  portal: PortalBox,
  size: { width: number; height: number },
  zoom: number,
): { x: number; y: number } {
  const z = zoom > 0 ? zoom : 1;
  return {
    x: size.width / (2 * z) - (portal.x + portal.width / 2),
    y: size.height / (2 * z) - (portal.y + portal.height / 2),
  };
}
