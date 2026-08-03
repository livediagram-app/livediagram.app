import type { Ref } from 'react';
import type { Element, ShapeElement, Tab } from '@livediagram/diagram';
import {
  portalExitPoint,
  portalName,
  resolvePortalDestination,
  viewportOffsetCentredOn,
} from '@/lib/portals';

// What happens when somebody goes through a portal (spec/104).
//
// Travelling means two things at once: the CAMERA centres on the paired portal,
// and — if the traveller is walking around in Avatar mode — their character
// steps out of it. One function behind both the portal face's click and the
// avatar's walk-in, so the two can't drift apart.
//
// A plain factory rather than a hook, called on each render with fresh values.
// That is deliberate: the avatar hook needs `enterPortal` (for the walk-in) and
// `enterPortal` needs the avatar hook (to place the character), so the canvas
// breaks the cycle with a ref it repoints every render. A hook here would have
// to own that ref and would still be called after the avatar hook, which is the
// half of the cycle that cannot move. Keeping it a factory leaves the ref
// visible at the seam where the cycle actually is.

export type PortalTravelDeps = {
  /** The active tab's elements — the fallback when there are no tabs to search. */
  elements: Element[];
  /** Every tab, when the surface has them: portals link across tabs. */
  tabs?: Tab[];
  activeTabId?: string;
  /** Switches tab, through the same path a tab link uses. */
  onFollowLink: (link: { kind: 'tab'; tabId: string }) => void;
  /**
   * The scrolling viewport, measured to centre the far portal in it. Typed as
   * the broad `Ref` the canvas is handed, which may be a callback ref with no
   * `current` to read — hence the `'current' in mainRef` guard below.
   */
  mainRef?: Ref<HTMLElement> | null;
  viewportZoom: number;
  setViewportOffset: (offset: { x: number; y: number }) => void;
  /** Places the walking character, and names the portal to ignore on arrival. */
  teleportTo: (point: { x: number; y: number }, ignorePortalId: string) => void;
};

export function makePortalTravel({
  elements,
  tabs,
  activeTabId,
  onFollowLink,
  mainRef,
  viewportZoom,
  setViewportOffset,
  teleportTo,
}: PortalTravelDeps) {
  const destination = (from: ShapeElement) =>
    resolvePortalDestination(from, { elements, tabs, activeTabId });

  const enterPortal = (from: ShapeElement) => {
    const to = destination(from);
    if (!to) return;
    // A link across tabs switches tab first, through the same follow-a-link
    // path a tab link uses, so selection / edit state is cleaned up the same
    // way. The camera + character then land on the far side.
    if (activeTabId && to.tabId && to.tabId !== activeTabId) {
      onFollowLink({ kind: 'tab', tabId: to.tabId });
    }
    const node = mainRef && 'current' in mainRef ? mainRef.current : null;
    const rect = node?.getBoundingClientRect();
    if (rect) {
      setViewportOffset(
        viewportOffsetCentredOn(
          to.portal,
          { width: rect.width, height: rect.height },
          viewportZoom,
        ),
      );
    }
    // Step out of the far portal, and tell the walk hook to ignore that portal until
    // the character leaves it, so it doesn't bounce straight back.
    teleportTo(portalExitPoint(to.portal), to.portal.id);
  };

  // What the portal face needs: the far portal's name for the tooltip, and the
  // travel action — absent when the portal is unlinked, which is what makes the
  // face render inert and say so.
  const resolvePortal = (element: ShapeElement) => {
    const to = destination(element);
    return {
      targetName: to ? portalName(to.elements, to.portal) : null,
      travel: to ? () => enterPortal(element) : undefined,
    };
  };

  return { enterPortal, resolvePortal };
}
