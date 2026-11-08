import type { UserPreferences } from '@/lib/user-preferences';
import { withTracksAnswered } from '@/lib/tour-tracks';
import type { ReplayMode } from '@/lib/replay/topic';
import { CURRICULUM } from '@/lib/replay/curriculum';

// Which Watch It Built topics a person has taken (docs/specs/007-editor/watch-it-built.md "The start panel"): the
// synced `watchTopics` list of topic ids, written as a topic is picked. The older `tourSeen` (the first Watch It Built,
// one replay) counts as The Basics taken; the stepped Draw and Workshop tours' flags count as nothing.

export const BASICS_ID = 'diagram-basics';

export function topicTaken(prefs: UserPreferences | null | undefined, id: string): boolean {
  if ((prefs?.watchTopics ?? []).includes(id)) return true;
  return id === BASICS_ID && prefs?.tourSeen === true;
}

/** The mode's topics not yet taken. */
export function topicsOwed(prefs: UserPreferences | null | undefined, mode: ReplayMode) {
  return CURRICULUM[mode].filter((t) => !topicTaken(prefs, t.id));
}

export function markTopicTaken(prefs: UserPreferences, id: string): UserPreferences {
  return { ...prefs, watchTopics: withTracksAnswered(prefs.watchTopics, [id]) };
}

/** Offers a topic again: off the list, and for The Basics the older flag cleared too. */
export function offerTopicAgain(prefs: UserPreferences, id: string): UserPreferences {
  const next: UserPreferences = {
    ...prefs,
    watchTopics: (prefs.watchTopics ?? []).filter((t) => t !== id),
  };
  if (id === BASICS_ID) next.tourSeen = false;
  return next;
}

/** Every topic of a mode taken (Settings' mode switch, off) or offered again (on). */
export function setModeTopics(prefs: UserPreferences, mode: ReplayMode, taken: boolean) {
  const ids = CURRICULUM[mode].map((t) => t.id);
  return taken
    ? { ...prefs, watchTopics: withTracksAnswered(prefs.watchTopics, ids) }
    : ids.reduce(offerTopicAgain, prefs);
}
