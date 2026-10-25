// The recent-designs note (docs/specs/019-marketing/returning-visitor.md "The old note"): the editor used to
// leave a note of your recent designs, and their snapshots in Cache Storage, for the landing page's hero. Neither
// is written or read now; the names stay so signing out can clear what an older editor left behind.

// The localStorage key the note lived under.
export const RECENT_DESIGNS_KEY = 'livedesign:recent-designs:v1';

// The Cache Storage caches that held the noted designs' snapshot SVGs (v1 before October 2026's v2).
export const RECENT_THUMBS_CACHE = 'livedesign-recent-thumbs-v2';
export const RECENT_THUMBS_CACHE_LEGACY = 'livedesign-recent-thumbs-v1';
