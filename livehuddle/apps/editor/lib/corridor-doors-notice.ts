// The notice a corridor's Type change gives when some of its Doors or Windows fit none of its new walls
// (docs/specs/009-elements/office.md "A Corridor's Doors move to its new walls", Work Tracker 1453).
import type { RemovedWallPieces } from '@livehuddle/document';

const count = (n: number, one: string) => `${n} ${one}${n === 1 ? '' : 's'}`;

/** "1 Door didn't fit the new corridor's walls and was removed.", or null when nothing was removed. */
export function corridorDoorsNotice({ doors, windows }: RemovedWallPieces): string | null {
  const parts = [
    ...(doors > 0 ? [count(doors, 'Door')] : []),
    ...(windows > 0 ? [count(windows, 'Window')] : []),
  ];
  if (parts.length === 0) return null;
  const verb = doors + windows === 1 ? 'was' : 'were';
  return `${parts.join(' and ')} didn't fit the new corridor's walls and ${verb} removed.`;
}
