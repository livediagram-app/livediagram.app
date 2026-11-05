import { useEffect, useEffectEvent, useMemo, useRef, useState, type Ref } from 'react';
import type { Element, Tab } from '@livehuddle/document';
import type { AvatarPresence } from '@livehuddle/api-schema';
import type { AvatarPoint } from '@liveworkspace/avatar/walk';
import { useLatest } from '@liveworkspace/workbench/hooks/ui/useLatest';
import { viewportOffsetCentredOn } from '@/lib/portals';
import { peopleKey, placeFinder, whoIsWhere, type WayPoint, type WayTab } from '@/lib/wayfinding';
import { createWayfindingStore, type Wayfinding } from './wayfinding-store';

// The Directory's and the Elevator's half of the canvas (docs/specs/009-elements/directory.md, elevator.md;
// blueprints/wayfinding.md): fills the store the faces read (the space's tabs and who is where), and owns what their
// rows do: Walk There, Go and a ride, the walk-in that opens an Elevator, and re-entering Avatar mode on another tab.
// Composed into useCanvasAvatar, which has the walk, the viewport and the tabs.

type Person = { id: string; name: string; color: string };

export type WayfindingInput = {
  walking: boolean;
  activeTabId: string | undefined;
  tabs: readonly Tab[] | undefined;
  /** The current tab's visible elements. */
  elements: readonly Element[];
  self: Person;
  remoteAvatars: readonly (Person & { avatar: AvatarPresence })[];
  /** The tab bar's people on each tab (docs/specs/009-elements/directory.md "Another tab"). */
  tabPresence?: ReadonlyMap<string, readonly Person[]>;
  avatar: {
    pos: AvatarPoint | null;
    standingOnId: string | null;
    walkTo: (point: AvatarPoint, onArrive?: () => void) => void;
    teleportTo: (point: AvatarPoint, arrivedPortalId?: string) => void;
  };
  /** Enters Avatar mode as the Avatar pick does. */
  enterWalking: () => void;
  onFollowLink: (link: { kind: 'tab'; tabId: string }) => void;
  /** Switches tab as travel, keeping Avatar mode (docs/specs/008-canvas/avatar-mode.md "Changing tab"). */
  onTravelToTab?: (tabId: string) => void;
  mainRef?: Ref<HTMLElement> | null;
  readZoom: () => number;
  setViewportOffset: (offset: { x: number; y: number }) => void;
};

type PendingGo = { tabId: string; point: WayPoint; ignoreId?: string };

const NO_PRESENCE: ReadonlyMap<string, readonly Person[]> = new Map();

export function useWayfinding(input: WayfindingInput): Wayfinding {
  const { walking, activeTabId, tabs, elements, self, remoteAvatars, avatar } = input;
  const tabPresence = input.tabPresence ?? NO_PRESENCE;
  const [store] = useState(createWayfindingStore);

  // The space as the faces read it: the current tab with only what is on visible layers.
  const wayTabs = useMemo<WayTab[]>(
    () =>
      tabs && tabs.length > 0
        ? tabs.map((t) => ({
            id: t.id,
            name: t.name,
            elements: t.id === activeTabId ? elements : t.elements,
          }))
        : [{ id: activeTabId ?? '', name: 'This Floor', elements }],
    [tabs, activeTabId, elements],
  );
  useEffect(() => {
    store.set({ tabs: wayTabs, activeTabId: activeTabId ?? wayTabs[0]?.id ?? '' });
  }, [store, wayTabs, activeTabId]);

  // Who is where, from presence (docs/specs/009-elements/directory.md "The list"). A few box tests per person, per
  // frame of a walk; published only when the by-value key changes, so an open list re-renders on a move between
  // places, never on a step.
  const findPlace = useMemo(() => placeFinder(elements), [elements]);
  const selfFeet = walking ? avatar.pos : null;
  const people = useMemo(
    () =>
      whoIsWhere({
        activeTabId: activeTabId ?? '',
        findPlace,
        self: { ...self, feet: selfFeet },
        peers: remoteAvatars.map((p) => ({
          id: p.id,
          name: p.name,
          color: p.color,
          feet: { x: p.avatar.x, y: p.avatar.y },
        })),
        byTab: tabPresence,
      }),
    [activeTabId, findPlace, self, selfFeet, remoteAvatars, tabPresence],
  );
  const key = peopleKey(people);
  const peopleNow = useLatest(people);
  useEffect(() => {
    store.set({ people: peopleNow.current });
  }, [store, key, peopleNow]);

  // --- Moving ------------------------------------------------------------------------------------------------
  const latest = useLatest(input);
  const centreOn = (point: WayPoint) => {
    const { mainRef, readZoom, setViewportOffset } = latest.current;
    const node = mainRef && 'current' in mainRef ? mainRef.current : null;
    const rect = node?.getBoundingClientRect();
    if (!rect) return;
    setViewportOffset(
      viewportOffsetCentredOn(
        { x: point.x, y: point.y, width: 0, height: 0 },
        { width: rect.width, height: rect.height },
        readZoom(),
      ),
    );
  };
  // The Elevator just stepped out of, ignored until the character steps off it (elevator.md "Riding").
  const ignoreRef = useRef<string | null>(null);
  const arrive = (elevatorId: string | undefined) => {
    if (elevatorId)
      store.set({ arrivalElevatorId: elevatorId, arrivalSeq: store.get().arrivalSeq + 1 });
  };
  const startWalk = (to: { approach: WayPoint | null; arrival: WayPoint }) => {
    const walk = latest.current.avatar.walkTo;
    if (to.approach) walk(to.approach, () => latest.current.avatar.walkTo(to.arrival));
    else walk(to.arrival);
  };
  const pendingWalkRef = useRef<{ approach: WayPoint | null; arrival: WayPoint } | null>(null);
  const pendingGoRef = useRef<PendingGo | null>(null);

  // A walk asked for before Avatar mode was on starts once the character stands somewhere (directory.md
  // "Walk There"); a jump to another tab finishes once that tab is showing (directory.md "Go").
  const settle = useEffectEvent(() => {
    const { walking: on, activeTabId: tabNow, avatar: walk } = latest.current;
    const wanted = pendingWalkRef.current;
    if (wanted && on && walk.pos) {
      pendingWalkRef.current = null;
      startWalk(wanted);
    }
    const go = pendingGoRef.current;
    if (!go || go.tabId !== tabNow) return;
    pendingGoRef.current = null;
    // The character was placed with the switch, and the walk's camera centres it at 100% (useAvatarCamera); not
    // walking, the view lands on the point here.
    if (!latest.current.walking) centreOn(go.point);
    arrive(go.ignoreId);
  });
  useEffect(() => {
    settle();
  }, [walking, activeTabId, avatar.pos]);

  // Walking into an Elevator opens its floor panel, once on arrival; stepping off closes a panel the walk opened
  // (elevator.md "The floor panel").
  const lastOnRef = useRef<string | null>(null);
  const walkOpenedRef = useRef(false);
  const arriveOn = useEffectEvent((on: string | null) => {
    const prev = lastOnRef.current;
    lastOnRef.current = on;
    if (on === prev) return;
    if (ignoreRef.current && on !== ignoreRef.current) ignoreRef.current = null;
    if (walkOpenedRef.current && prev && store.get().openElevatorId === prev) {
      walkOpenedRef.current = false;
      store.set({ openElevatorId: null });
    }
    if (!on || on === ignoreRef.current) return;
    const el = latest.current.elements.find((e) => e.id === on);
    if (el?.type === 'shape' && el.shape === 'elevator') {
      walkOpenedRef.current = true;
      store.set({ openElevatorId: on });
    }
  });
  useEffect(() => {
    arriveOn(walking ? avatar.standingOnId : null);
  }, [walking, avatar.standingOnId]);

  const [wayfinding] = useState<Wayfinding>(() => ({
    store,
    actions: {
      walkThere: (to) => {
        const { walking: on, avatar: walk } = latest.current;
        if (on && walk.pos) {
          startWalk(to);
          return;
        }
        pendingWalkRef.current = to;
        latest.current.enterWalking();
      },
      go: ({ tabId, point, ignoreId }) => {
        const {
          walking: on,
          activeTabId: tabNow,
          avatar: walk,
          onFollowLink,
          onTravelToTab,
        } = latest.current;
        pendingWalkRef.current = null;
        // Travel keeps Avatar mode (avatar-mode.md "Changing tab"): the character is placed at the destination in
        // the same update as the switch, so the new tab never draws it anywhere else.
        if (on) {
          ignoreRef.current = ignoreId ?? null;
          walk.teleportTo(point, ignoreId);
        }
        if (!tabNow || tabId === tabNow) {
          centreOn(point);
          arrive(ignoreId);
          return;
        }
        pendingGoRef.current = { tabId, point, ignoreId };
        if (onTravelToTab) onTravelToTab(tabId);
        else onFollowLink({ kind: 'tab', tabId });
      },
      closeElevator: () => {
        walkOpenedRef.current = false;
        store.set({ openElevatorId: null });
      },
    },
  }));
  return wayfinding;
}
