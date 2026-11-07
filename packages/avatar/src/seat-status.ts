// The status a seat piece shows while you sit in it (livehuddle's docs/specs/009-elements/workday-pieces.md "Statuses a
// piece sets"): a Nap Pod Focusing, a Treadmill or a Weight Bench On a Break, a Phone Booth Busy. It is laid over your
// own status, never written over it, so standing up, being stood up, the piece going and leaving the mode all show your
// own again with nothing to put back; a status picked while sitting wins for as long as you stay. Pure: no React.

import type { AvatarStatus } from './status';

const PIECE_STATUS: Readonly<Partial<Record<string, AvatarStatus>>> = {
  'nap-pod': 'focus',
  treadmill: 'break',
  'weight-bench': 'break',
  'phone-booth': 'busy',
};

/** The status sitting in a piece of this kind shows, or null for a piece that sets none. */
export function pieceStatusOf(kind: string | null | undefined): AvatarStatus | null {
  return (kind && PIECE_STATUS[kind]) || null;
}

/**
 * The status that shows: the piece's while you sit in one that sets a status and have not picked one since sitting
 * there, else your own. `pickedOn` is the seat you sat on when you last picked (null: picked standing, or never).
 */
export function shownStatus(
  own: AvatarStatus | null,
  pickedOn: string | null,
  seatedOn: string | null,
  piece: AvatarStatus | null,
): AvatarStatus | null {
  return piece && seatedOn !== null && pickedOn !== seatedOn ? piece : own;
}
