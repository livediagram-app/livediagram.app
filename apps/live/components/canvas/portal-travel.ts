import { useCallback } from 'react';
import { useLatest } from '@/hooks/ui/useLatest';
import type { Ref } from 'react';
import type { Element, ShapeElement, Tab } from '@livediagram/document';
import {
  portalExitPoint,
  portalName,
  resolvePortalDestination,
  viewportOffsetCentredOn,
} from '@/lib/portals';

// What happens when somebody goes through a portal (docs/specs/009-elements/portal-element.md).
//
// Travelling means two things at once: the CAMERA centres on the paired portal,
// and — if the traveller is walking around in Avatar mode — their character
// steps out of it. One function behind both the portal face's click and the
// avatar's walk-in, so the two can't drift apart.
//
// A hook that owns no state: it builds the two actions from this render's values.
// It is a hook because it is handed the viewport ref, which it reads only when
// somebody travels, never while rendering; a hook boundary is where that is
// allowed (docs/specs/003-system-architecture/react-state-and-effects.md). The
// avatar hook needs `enterPortal` (for the walk-in) and `enterPortal` needs the
// avatar hook (to place the character), so the canvas breaks that cycle with a
// latest-value ref, visible at the seam where the cycle actually is.

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
  /** The zoom now, read when a portal is entered (docs/specs/008-canvas/blueprints/viewport-store.md). */
  readZoom: () => number;
  setViewportOffset: (offset: { x: number; y: number }) => void;
  /** Places the walking character, and names the portal to ignore on arrival. */
  teleportTo: (point: { x: number; y: number }, ignorePortalId: string) => void;
};

export function usePortalTravel({
  elements,
  tabs,
  activeTabId,
  onFollowLink,
  mainRef,
  readZoom,
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
        viewportOffsetCentredOn(to.portal, { width: rect.width, height: rect.height }, readZoom()),
      );
    }
    // Step out of the far portal, and tell the walk hook to ignore that portal until
    // the character leaves it, so it doesn't bounce straight back.
    teleportTo(portalExitPoint(to.portal), to.portal.id);
  };

  // What the portal face needs: the far portal's name for the hover card, and the
  // travel action — absent when the portal is unlinked, which is what makes the
  // face render inert and say so.
  // Element views take it as a prop: it changes only with the board it resolves against, and travel
  // calls the newest enterPortal, so a canvas render (a zoom, a pan) hands every portal the same one.
  const enterLatest = useLatest(enterPortal);
  const resolvePortal = useCallback(
    (element: ShapeElement) => {
      const to = resolvePortalDestination(element, { elements, tabs, activeTabId });
      return {
        targetName: to ? portalName(to.elements, to.portal) : null,
        travel: to ? () => enterLatest.current(element) : undefined,
      };
    },
    [elements, tabs, activeTabId, enterLatest],
  );

  return { enterPortal, resolvePortal };
}
