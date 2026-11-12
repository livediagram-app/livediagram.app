// Who is where (wayfinding.ts, docs/specs/009-elements/directory.md "The list"): everyone the Directory can place,
// read from presence, and the list's by-value key. No React, no DOM. wayfinding.ts re-exports it.

import { type AvatarConfig } from '@livehuddle/avatar/config';
import type { WayPoint } from './wayfinding';

// --- Who is where --------------------------------------------------------------------------------------------

export type WayPerson = {
  id: string;
  name: string;
  color: string;
  tabId: string;
  /** The place they stand in on the current tab; null for Around (or another tab, where it is not known). */
  placeId: string | null;
  self?: boolean;
  /** The character they walk as, when this screen has seen it (the Team Photo Wall's portraits). */
  config?: AvatarConfig;
};

const lookKey = (c: AvatarConfig | undefined) =>
  c ? `${c.gender}.${c.clothing}.${c.hair}.${c.hairColour ?? ''}` : '';

/** A by-value key for a people list: what the Directory shows, so a walk inside one room changes nothing. */
export function peopleKey(people: readonly WayPerson[]): string {
  return people
    .map((p) => `${p.id}|${p.tabId}|${p.placeId ?? ''}|${p.name}|${p.color}|${lookKey(p.config)}`)
    .join('\n');
}

/**
 * Everyone the Directory can place (docs/specs/009-elements/directory.md "The list"): the characters on the current
 * tab, each in the place its feet stand in, then everyone the tab bar has on a tab who is not already listed, in no
 * place (Around on the current tab; on another tab, only that they are there).
 */
export function whoIsWhere(input: {
  activeTabId: string;
  findPlace: (at: WayPoint) => string | null;
  self: { id: string; name: string; color: string; feet: WayPoint | null; config?: AvatarConfig };
  peers: readonly {
    id: string;
    name: string;
    color: string;
    feet: WayPoint;
    config?: AvatarConfig;
  }[];
  byTab: ReadonlyMap<string, readonly { id: string; name: string; color: string }[]>;
}): WayPerson[] {
  const { activeTabId, findPlace, self, peers, byTab } = input;
  const out: WayPerson[] = [];
  const seen = new Set<string>();
  out.push({
    id: self.id,
    name: self.name,
    color: self.color,
    tabId: activeTabId,
    placeId: self.feet ? findPlace(self.feet) : null,
    self: true,
    ...(self.config ? { config: self.config } : null),
  });
  seen.add(self.id);
  for (const peer of peers) {
    if (seen.has(peer.id)) continue;
    seen.add(peer.id);
    out.push({
      id: peer.id,
      name: peer.name,
      color: peer.color,
      tabId: activeTabId,
      placeId: findPlace(peer.feet),
      ...(peer.config ? { config: peer.config } : null),
    });
  }
  for (const [tabId, people] of byTab) {
    for (const p of people) {
      if (seen.has(p.id)) continue;
      seen.add(p.id);
      out.push({ id: p.id, name: p.name, color: p.color, tabId, placeId: null });
    }
  }
  return out;
}
