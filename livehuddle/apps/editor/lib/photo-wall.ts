// The Team Photo Wall's frames (docs/specs/009-elements/team-pieces.md "Team Photo Wall"): who fills them, from the
// Directory's people (you first, then this tab, then the other tabs), and the words a screen reader hears. Bounded by
// the wall's frames, so a big Space never makes a big wall. Pure.
import type { WayPerson } from './wayfinding';

export type PhotoWallFrames = {
  /** The people in frames, in order. */
  shown: readonly WayPerson[];
  /** Everyone left over, named by the last frame's +N; empty when everyone has a frame. */
  rest: readonly WayPerson[];
};

/** Who fills `frames` frames: all of them up to `frames`, else `frames - 1` and a +N in the last. */
export function photoWallFrames(people: readonly WayPerson[], frames: number): PhotoWallFrames {
  if (people.length <= frames) return { shown: people, rest: [] };
  const keep = Math.max(0, frames - 1);
  return { shown: people.slice(0, keep), rest: people.slice(keep) };
}

/** A person's name on the wall: "(you)" after your own. */
export function photoName(person: WayPerson): string {
  const name = person.name.trim() || 'Someone';
  return person.self ? `${name} (you)` : name;
}

/** "Sam, Priya and Jo". */
export function listNames(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/** The wall's label for a screen reader: "Team photo wall: Sam (you), Priya and Jo". */
export function photoWallLabel(people: readonly WayPerson[]): string {
  if (people.length === 0) return 'Team photo wall, empty frames';
  return `Team photo wall: ${listNames(people.map(photoName))}`;
}
