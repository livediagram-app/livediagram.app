// The photo's limits and sizes (docs/specs/031-photo/blueprints/photo-engine.md "Constants and
// configuration"); each named once and shared by the editor, the api and the tests.

/** A tile's side, in pixels. */
export const PHOTO_TILE = 512;
/** The most pixels a side may have on a desktop. */
export const PHOTO_PIXEL_CAP = 8192;
/** The most pixels a side may have on a phone or tablet (a coarse pointer). */
export const PHOTO_PIXEL_CAP_COARSE = 4096;
/** The most pixels a photo may have in all. */
export const PHOTO_MAX_AREA = 40_000_000;
/** The longer side of a photo page's sheet on the canvas, in canvas px, at most. */
export const PHOTO_SHEET_MAX = 2048;
export const PHOTO_MAX_LAYERS = 100;
export const PHOTO_MAX_PAGES = 10;
export const PHOTO_HISTORY_STEPS = 50;
export const PHOTO_MAX_GROUP_DEPTH = 5;
export const PHOTO_LAYER_NAME_MAX = 60;
export const PHOTO_TEXT_MAX = 2000;
export const PHOTO_PREVIEW_MAX = 2048;
export const PHOTO_PREVIEW_DELAY_MS = 3000;
/** The most characters of ops one `photo` frame carries, inside the room's 256K message cap. */
export const PHOTO_FRAME_CHARS = 200_000;
export const PHOTO_BATCH_BLOBS = 64;
export const PHOTO_BATCH_BYTES = 24 * 1024 * 1024;
export const PHOTO_BLOB_MAX_BYTES = 10 * 1024 * 1024;
export const PHOTO_HAS_MAX_IDS = 500;
export const PHOTO_ADOPT_MAX_IDS = 2000;
export const PHOTO_SWEEP_GRACE_MS = 24 * 60 * 60 * 1000;
export const PHOTO_ADJUST_COMMIT_MS = 500;
/** A new blank photo's size when nothing else says. */
export const PHOTO_DEFAULT_WIDTH = 1920;
export const PHOTO_DEFAULT_HEIGHT = 1080;
/** The most tiles a side may span: the cap over the tile, rounded up. */
export const PHOTO_MAX_TILES_PER_SIDE = Math.ceil(PHOTO_PIXEL_CAP / PHOTO_TILE);
