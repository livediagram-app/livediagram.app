import { useEffect, useEffectEvent, useMemo, useRef, useState, type Ref } from 'react';
import type { Element, Tab } from '@livehuddle/document';
import type { AvatarPresence } from '@livehuddle/api-schema';
import type { AvatarPoint } from '@liveworkspace/avatar/walk';
import type { AvatarConfig } from '@liveworkspace/avatar/config';
import { useLatest } from '@liveworkspace/workbench/hooks/ui/useLatest';
import { prefersReducedMotion } from '@liveworkspace/workbench/lib/motion-preference';
import { viewportOffsetCentredOn } from '@/lib/portals';
import {
  peopleKey,
  placeFinder,
  stairsFootPoint,
  stairsTopPoint,
  walkThereRoute,
  whoIsWhere,
  type WayPoint,
  type WayTab,
} from '@/lib/wayfinding';
import {
  createWayfindingStore,
  type WalkTarget,
  type Wayfinding,
  type WayfindingActions,
} from './wayfinding-store';

// The Directory's, the Elevator's and the Stairs' half of the canvas (docs/specs/009-elements/directory.md,
// elevator.md, stairs.md; blueprints/wayfinding.md): fills the store the faces read (the space's tabs and who is
// where), and owns what their rows do: Walk There, Go, a ride and a climb, the walk-in that opens an Elevator's or a
// Stairs' panel, and re-entering Avatar mode on another tab.
// Composed into useCanvasAvatar, which has the walk, the viewport and the tabs.

type Person = { id: string; name: string; color: string };

export type WayfindingInput = {
  walking: boolean;
  activeTabId: string | undefined;
  tabs: readonly Tab[] | undefined;
  /** Which tabs have their content (lazy tabs); unset reads every tab as loaded. */
  loadedTabIds?: ReadonlySet<string>;
  /** Fetches the tabs not loaded yet (the editor's loadAllTabs), for the Elevator panel's floors. */
  loadFloors?: () => void;
  /** The current tab's visible elements. */
  elements: readonly Element[];
  self: Person;
  /** Your own character, for the Team Photo Wall's portrait of you. */
  selfConfig?: AvatarConfig;
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

type PendingGo = { tabId: string; point: WayPoint; ignoreId?: string; then?: WayPoint };

// A climb (docs/specs/009-elements/stairs.md "Taking them"): taken from the Stairs or this near their foot, and the
// floor changes this long after it starts whatever happens (a wall in the way, a key pressed).
export const CLIMB_NEAR = 160;
export const CLIMB_MAX_MS = 1500;

// The pieces a walk-in opens the panel of.
const PANEL_KINDS: ReadonlySet<string> = new Set(['elevator', 'stairs']);

const NO_PRESENCE: ReadonlyMap<string, readonly Person[]> = new Map();

export function useWayfinding(input: WayfindingInput): Wayfinding {
  const { walking, activeTabId, tabs, elements, self, selfConfig, remoteAvatars, avatar } = input;
  const { loadedTabIds } = input;
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
            ...(loadedTabIds && t.id !== activeTabId && !loadedTabIds.has(t.id)
              ? { loaded: false }
              : null),
          }))
        : [{ id: activeTabId ?? '', name: 'This Floor', elements }],
    [tabs, activeTabId, elements, loadedTabIds],
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
        self: { ...self, feet: selfFeet, config: selfConfig },
        peers: remoteAvatars.map((p) => ({
          id: p.id,
          name: p.name,
          color: p.color,
          feet: { x: p.avatar.x, y: p.avatar.y },
          config: p.avatar.config,
        })),
        byTab: tabPresence,
      }),
    [activeTabId, findPlace, self, selfConfig, selfFeet, remoteAvatars, tabPresence],
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
    if (elevatorId) store.set({ arrivalId: elevatorId, arrivalSeq: store.get().arrivalSeq + 1 });
  };
  // Leg by leg (directory.md "Walk There"): round the place's own walls when its doorway is on the far side, then the
  // approach and the arrival, each leg's arrival starting the next. A leg a wall stops ends the walk there.
  const startWalk = (to: WalkTarget) => {
    // Started only once the character stands somewhere (walkThere, settle); the arrival stands in for a missing one.
    const route = walkThereRoute(latest.current.avatar.pos ?? to.arrival, to);
    const leg = (i: number) => {
      const next = i + 1 < route.length ? () => leg(i + 1) : undefined;
      latest.current.avatar.walkTo(route[i]!, next);
    };
    leg(0);
  };
  const pendingWalkRef = useRef<WalkTarget | null>(null);
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
    else if (go.then) latest.current.avatar.walkTo(go.then);
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
    if (walkOpenedRef.current && prev && store.get().openPanelId === prev) {
      walkOpenedRef.current = false;
      store.set({ openPanelId: null });
    }
    if (!on || on === ignoreRef.current) return;
    const el = latest.current.elements.find((e) => e.id === on);
    if (el?.type === 'shape' && PANEL_KINDS.has(el.shape)) {
      walkOpenedRef.current = true;
      store.set({ openPanelId: on });
    }
  });
  useEffect(() => {
    arriveOn(walking ? avatar.standingOnId : null);
  }, [walking, avatar.standingOnId]);

  // The climb's fallback timer, cleared when the travel runs and when the canvas goes.
  const climbTimerRef = useRef<number | null>(null);
  useEffect(
    () => () => {
      if (climbTimerRef.current !== null) window.clearTimeout(climbTimerRef.current);
    },
    [],
  );

  // A jump (the Directory's Go, a ride, a climb's travel), the one the actions share.
  const goTo: WayfindingActions['go'] = ({ tabId, point, ignoreId, then }) => {
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
    pendingGoRef.current = { tabId, point, ignoreId, then };
    if (onTravelToTab) onTravelToTab(tabId);
    else onFollowLink({ kind: 'tab', tabId });
  };

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
      go: goTo,
      climb: ({ from, flight }) => {
        const { walking: on, avatar: walk } = latest.current;
        const moving = on && !prefersReducedMotion();
        const { landing } = flight;
        // Walking with motion, the character lands on the top step and walks off; else it stands at the foot.
        const travel = () => {
          if (climbTimerRef.current !== null) window.clearTimeout(climbTimerRef.current);
          climbTimerRef.current = null;
          goTo(
            moving && landing.top
              ? {
                  tabId: flight.tabId,
                  point: landing.top,
                  ignoreId: landing.id,
                  then: landing.foot,
                }
              : { tabId: flight.tabId, point: landing.foot, ignoreId: landing.id },
          );
        };
        const feet = walk.pos;
        const foot = stairsFootPoint(from);
        const near =
          feet !== null &&
          ((feet.x >= from.x &&
            feet.x <= from.x + from.width &&
            feet.y >= from.y &&
            feet.y <= from.y + from.height) ||
            Math.hypot(feet.x - foot.x, feet.y - foot.y) <= CLIMB_NEAR);
        if (!moving || !near) {
          travel();
          return;
        }
        // The walk up: the Stairs climbed are ignored, so reaching them never reopens their panel.
        ignoreRef.current = from.id;
        let done = false;
        const once = () => {
          if (done) return;
          done = true;
          travel();
        };
        climbTimerRef.current = window.setTimeout(once, CLIMB_MAX_MS);
        walk.walkTo(stairsTopPoint(from), once);
      },
      loadFloors: () => latest.current.loadFloors?.(),
      closePanel: () => {
        walkOpenedRef.current = false;
        store.set({ openPanelId: null });
      },
    },
  }));
  return wayfinding;
}
