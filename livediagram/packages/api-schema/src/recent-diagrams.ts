// The returning-visitor note the editor used to leave for the landing page (docs/specs/019-marketing/returning-visitor.md).
// Nothing writes or reads it now; its storage names stay so sign-out can clear what an
// older visit left behind.

// The localStorage key the note lived under.
export const RECENT_DIAGRAMS_KEY = 'livediagram:recent-diagrams:v1';

// The Cache Storage caches that held each noted diagram's snapshot SVG (v1, then v2).
export const RECENT_THUMBS_CACHE = 'livediagram-recent-thumbs-v2';
export const RECENT_THUMBS_CACHE_LEGACY = 'livediagram-recent-thumbs-v1';

// The snapshot SVG helpers behind the Explorer's thumbnails are liveworkspace's.
export { scalableSnapshotSvg, svgBackgroundColor } from '@liveworkspace/api-schema/snapshot-svg';
