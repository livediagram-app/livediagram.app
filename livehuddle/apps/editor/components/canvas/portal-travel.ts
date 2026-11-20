import { useCallback, useState } from 'react';
import { useLatest } from '@liveworkspace/workbench/hooks/ui/useLatest';
import type { Ref } from 'react';
import type { Element, ShapeElement, Tab } from '@livehuddle/document';
import {
  portalExitPoint,
  portalName,
  portalsOnTab,
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
  /** Switches tab as travel, keeping Avatar mode (docs/specs/008-canvas/avatar-mode.md "Changing tab"). */
  onTravelToTab?: (tabId: string) => void;
  /**
   * The scrolling viewport, measured to centre the far portal in it. Typed as
   * the broad `Ref` the canvas is handed, which may be a callback ref with no
   * `current` to read — hence the `'current' in mainRef` guard below.
   */
  mainRef?: Ref<HTMLElement> | null;
  setViewportOffset: (offset: { x: number; y: number }) => void;
  /** Places the walking character, and names the portal to ignore on arrival. */
  teleportTo: (point: { x: number; y: number }, ignorePortalId: string) => void;
};

// The board a portal face resolves against: the portals alone, on the active tab and on every tab. Its identity
// changes only when what resolution reads does (a portal's id, link or label, a tab's id or name), never on a drag,
// a zoom or another element's edit, so the resolver built from it can go to the element views as a plain prop
// (docs/specs/008-canvas/blueprints/canvas-performance.md): every portal redraws the moment a link is made, and
// nothing else redraws. Re-seeded during render when the signature moves, so this render already reads the new one.
type PortalBoard = { key: string; elements: Element[]; tabs?: Tab[] };

const portalKey = (portals: ShapeElement[]) =>
  portals.map((p) => `${p.id}\u0001${p.portalTarget ?? ''}\u0001${p.label ?? ''}`).join('\u0002');

export function usePortalBoard(elements: Element[], tabs: Tab[] | undefined): PortalBoard {
  const own = portalsOnTab(elements);
  const tabPortals = tabs?.map((tab) => ({ tab, portals: portalsOnTab(tab.elements) }));
  const key = [
    portalKey(own),
    ...(tabPortals ?? []).map(
      ({ tab, portals }) => `${tab.id}\u0003${tab.name}\u0003${portalKey(portals)}`,
    ),
    tabs ? 'tabs' : 'no-tabs',
  ].join('\u0004');
  const [board, setBoard] = useState<PortalBoard>(() => ({
    key,
    elements: own,
    tabs: tabPortals?.map(({ tab, portals }) => ({ ...tab, elements: portals })),
  }));
  if (board.key === key) return board;
  const next: PortalBoard = {
    key,
    elements: own,
    tabs: tabPortals?.map(({ tab, portals }) => ({ ...tab, elements: portals })),
  };
  setBoard(next);
  return next;
}

export function usePortalTravel({
  elements,
  tabs,
  activeTabId,
  onFollowLink,
  onTravelToTab,
  mainRef,
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
    // Travel keeps Avatar mode: the switch is marked as travel, and the character is placed in the same update.
    if (activeTabId && to.tabId && to.tabId !== activeTabId) {
      if (onTravelToTab) onTravelToTab(to.tabId);
      else onFollowLink({ kind: 'tab', tabId: to.tabId });
    }
    const node = mainRef && 'current' in mainRef ? mainRef.current : null;
    const rect = node?.getBoundingClientRect();
    if (rect) {
      setViewportOffset(
        viewportOffsetCentredOn(to.portal, { width: rect.width, height: rect.height }),
      );
    }
    // Step out of the far portal, and tell the walk hook to ignore that portal until
    // the character leaves it, so it doesn't bounce straight back.
    teleportTo(portalExitPoint(to.portal), to.portal.id);
  };

  // What the portal face needs: the far portal's name for the hover card, and the
  // travel action — absent when the portal is unlinked, which is what makes the
  // face render inert and say so.
  // Element views take it as a prop: it changes only with the portal board it resolves against (usePortalBoard), and
  // travel calls the newest enterPortal, so a canvas render (a zoom, a pan, a drag) hands every portal the same one.
  const enterLatest = useLatest(enterPortal);
  const board = usePortalBoard(elements, tabs);
  const resolvePortal = useCallback(
    (element: ShapeElement) => {
      const to = resolvePortalDestination(element, {
        elements: board.elements,
        tabs: board.tabs,
        activeTabId,
      });
      return {
        targetName: to ? portalName(to.elements, to.portal) : null,
        travel: to ? () => enterLatest.current(element) : undefined,
      };
    },
    [board, activeTabId, enterLatest],
  );

  return { enterPortal, resolvePortal };
}
