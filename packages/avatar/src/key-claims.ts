// Keys a piece takes from the walk for a while (livehuddle's docs/specs/009-elements/social-pieces.md "Controls"): a
// game at the table you sit at moves your paddle on W/S and Up/Down, so for as long as it runs those keys neither
// steer the character (which would stand you up, the Chair rule) nor play an action (W waves, S spins). Whoever
// claims a key handles it; the walk's keys and the action keys ask here first and stand aside. Read at event time,
// outside React. A product that never claims a key (livediagram) walks exactly as before.

/** A key press as the claims read it. */
export type ClaimedKey = {
  key: string;
  metaKey?: boolean;
  ctrlKey?: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
};

/** Whether a claimer wants this key now. */
export type KeyClaim = (e: ClaimedKey) => boolean;

const claims = new Set<KeyClaim>();

/** Take keys from the walk while `claim` says so; returns the way to give them back. */
export function claimAvatarKeys(claim: KeyClaim): () => void {
  claims.add(claim);
  return () => {
    claims.delete(claim);
  };
}

/** Whether a piece holds this key right now: the walk's keys and the action keys leave it alone. */
export function avatarKeyClaimed(e: ClaimedKey): boolean {
  for (const claim of claims) if (claim(e)) return true;
  return false;
}
