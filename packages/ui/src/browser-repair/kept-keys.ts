// What a browser repair never clears (docs/specs/007-editor/load-recovery.md "Repairing a browser").
// One list for every surface that repairs, the editor's recovery card and the help centre's Repair page,
// so the two clear exactly the same set. Kept means losing it loses work or identity: the guest id is
// the key to every document a guest owns, and the per-browser keys are what past answers and likes are
// matched against. apps/live's local-identity test fails if one of its identity keys is not listed here.

/** The prefixes a repair considers at all. Anything else (the sign-in provider's own keys) is never touched. */
export const REPAIR_SCOPE_PREFIXES = ['livediagram:', 'livediagram-'] as const;

/** Exact keys a repair keeps. */
export const REPAIR_KEPT_KEYS: readonly string[] = [
  // Guest identity (apps/live/lib/local-identity.ts).
  'livediagram:v2:self-id',
  'livediagram:v2:self-sig',
  'livediagram:v2:pending-signed-id',
  'livediagram:v2:name-confirmed',
  // Per-browser keys that recorded answers and likes are matched against.
  'livediagram:v2:collab-key',
  'livediagram:v2:community-key',
];

/** Key prefixes a repair keeps: the Google Drive mirror's state. */
export const REPAIR_KEPT_PREFIXES: readonly string[] = [
  'livediagram:v2:drive-',
  'livediagram:drive-mirror',
];

/** True when a repair clears this storage key. */
export function isRepairClearable(key: string): boolean {
  if (!REPAIR_SCOPE_PREFIXES.some((p) => key.startsWith(p))) return false;
  if (REPAIR_KEPT_KEYS.includes(key)) return false;
  return !REPAIR_KEPT_PREFIXES.some((p) => key.startsWith(p));
}
