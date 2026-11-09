// Join and leave sounds (docs/specs/012-collaboration/join-and-leave-sounds.md; blueprint
// blueprints/join-and-leave-sounds.md): a soft chime when another person arrives in the Space, a softer one when
// someone has left. One watcher per room (useRoomConnection), fed every presence list the room sends: nothing per
// frame, nothing subscribed.
//
// A person is their collaboration key (stable per browser) or, with none, their presence id, so two tabs of one
// browser are one person. Your own key is never a person. The first roster learns who is there and greets your own
// arrival with the arrival chime, once, if sound can be heard within OWN_ARRIVAL_GRACE_MS; a reconnect of your own
// socket keeps what was learnt and greets nothing. A leave waits out JOIN_LEAVE_FLAP_MS, so a reload or a network blip plays
// nothing, and a kind played inside JOIN_LEAVE_BURST_MS of the last plays nothing, so a team arriving together is one
// chime. An arrival plays at once, from the room's message, which is what lets it sound in a hidden tab.

import { playTones, whenAudible, type Note } from './audio';
import { quietForDoNotDisturb } from './quiet';
import { readUserPreferences } from '@/lib/user-preferences';

/** How long someone must stay off the roster before their leave plays: a reconnect inside it is silent. */
export const JOIN_LEAVE_FLAP_MS = 5_000;
/** After a chime of one kind, more of that kind inside this window play nothing. */
export const JOIN_LEAVE_BURST_MS = 1_000;
/** Your own arrival chimes only if sound can be heard this soon after the first roster; later it is dropped. */
export const OWN_ARRIVAL_GRACE_MS = 3_000;

/** Arrival: G5 then C6, rising, at a low volume. */
const ARRIVE_NOTES: readonly Note[] = [
  { hz: 783.99, at: 0 },
  { hz: 1046.5, at: 0.14 },
];
/** Leaving: C6 then G5, falling, softer still. */
const LEAVE_NOTES: readonly Note[] = [
  { hz: 1046.5, at: 0 },
  { hz: 783.99, at: 0.14 },
];
const CHIME_S = 0.6;
const ARRIVE_GAIN = 0.08;
const LEAVE_GAIN = 0.05;

export type PresenceChime = 'arrive' | 'leave';

/** Play one of the two chimes now. */
export function playPresenceChime(kind: PresenceChime): void {
  if (kind === 'arrive') playTones(ARRIVE_NOTES, CHIME_S, ARRIVE_GAIN);
  else playTones(LEAVE_NOTES, CHIME_S, LEAVE_GAIN);
}

/** Whether the chimes may play now: Join and Leave Sounds on, and not on Do Not Disturb. Read at play time. */
export function presenceChimesWanted(): boolean {
  return readUserPreferences().joinLeaveSounds !== false && !quietForDoNotDisturb();
}

type Roster = readonly { id: string; key?: string }[];

export type PresenceChimes = {
  /** Every presence list the room sends, as sent. */
  update: (participants: Roster) => void;
  /** Clear the pending leaves (the room's effect cleanup). */
  dispose: () => void;
};

export function createPresenceChimes(deps: {
  /** Your own collaboration key: never a person, so your other tabs are silent. */
  selfKey: string | null | undefined;
  play?: (kind: PresenceChime) => void;
  wanted?: () => boolean;
  now?: () => number;
  /** Runs a sound once it can be heard within a time, or never; answers the way to stop waiting. */
  whenAudible?: (withinMs: number, play: () => void) => () => void;
}): PresenceChimes {
  const play = deps.play ?? playPresenceChime;
  const wanted = deps.wanted ?? presenceChimesWanted;
  const now = deps.now ?? Date.now;
  const audible = deps.whenAudible ?? whenAudible;
  let stopOwnArrival: (() => void) | null = null;
  let present = new Set<string>();
  let seeded = false;
  const leaving = new Map<string, ReturnType<typeof setTimeout>>();
  const lastPlayed: Record<PresenceChime, number> = { arrive: -Infinity, leave: -Infinity };

  const chime = (kind: PresenceChime) => {
    const at = now();
    if (at - lastPlayed[kind] < JOIN_LEAVE_BURST_MS) return;
    lastPlayed[kind] = at;
    if (wanted()) play(kind);
  };

  return {
    update(participants) {
      const next = new Set<string>();
      for (const p of participants) {
        const person = p.key ?? p.id;
        if (person !== deps.selfKey) next.add(person);
      }
      if (!seeded) {
        seeded = true;
        present = next;
        // Your own arrival: the same chime the others hear, so you know you are in.
        stopOwnArrival = audible(OWN_ARRIVAL_GRACE_MS, () => chime('arrive'));
        return;
      }
      let arrived = false;
      for (const person of next) {
        if (present.has(person)) continue;
        const pending = leaving.get(person);
        if (pending !== undefined) {
          // Back inside the flap window: a reconnect, not an arrival, and no leave either.
          clearTimeout(pending);
          leaving.delete(person);
        } else {
          arrived = true;
        }
      }
      for (const person of present) {
        if (next.has(person) || leaving.has(person)) continue;
        leaving.set(
          person,
          setTimeout(() => {
            leaving.delete(person);
            if (!present.has(person)) chime('leave');
          }, JOIN_LEAVE_FLAP_MS),
        );
      }
      present = next;
      if (arrived) chime('arrive');
    },
    dispose() {
      stopOwnArrival?.();
      for (const timer of leaving.values()) clearTimeout(timer);
      leaving.clear();
    },
  };
}
