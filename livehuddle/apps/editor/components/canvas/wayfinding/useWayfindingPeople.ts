import { useEffect, useMemo } from 'react';
import type { Element } from '@livehuddle/document';
import type { AvatarPresence } from '@livehuddle/api-schema';
import type { AvatarPoint } from '@livehuddle/avatar/walk';
import type { AvatarConfig } from '@livehuddle/avatar/config';
import { useLatest } from '@liveworkspace/workbench/hooks/ui/useLatest';
import { peopleKey, placeFinder, whoIsWhere } from '@/lib/wayfinding';
import type { Wayfinding } from './wayfinding-store';

type Person = { id: string; name: string; color: string };

const NO_PRESENCE: ReadonlyMap<string, readonly Person[]> = new Map();

// Who is where, from presence (docs/specs/009-elements/directory.md "The list"), for the Directory, the Signpost and
// the Team Photo Wall. Run beside the characters (CanvasCharactersLayer), which follows every step, rather than in the
// canvas (docs/specs/008-canvas/canvas-performance.md "Walking renders the characters, not the canvas"). A few box
// tests per person, per frame of a walk; published only when the by-value key changes, so an open list re-renders on
// a move between places, never on a step.
export function useWayfindingPeople({
  store,
  activeTabId,
  elements,
  self,
  selfConfig,
  selfFeet,
  remoteAvatars,
  tabPresence = NO_PRESENCE,
}: {
  store: Wayfinding['store'];
  activeTabId: string | undefined;
  /** The current tab's visible elements. */
  elements: readonly Element[];
  self: Person;
  /** Your own character, for the Team Photo Wall's portrait of you. */
  selfConfig?: AvatarConfig;
  /** Your feet while walking, else null. */
  selfFeet: AvatarPoint | null;
  remoteAvatars: readonly (Person & { avatar: AvatarPresence })[];
  /** The tab bar's people on each tab (docs/specs/009-elements/directory.md "Another tab"). */
  tabPresence?: ReadonlyMap<string, readonly Person[]>;
}): void {
  const findPlace = useMemo(() => placeFinder(elements), [elements]);
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
}
