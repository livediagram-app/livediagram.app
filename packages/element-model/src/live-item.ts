// A live embed (liveworkspace/docs/specs/004-index/live-embeds.md): the Embed element showing another app's item live,
// read-only. The element keeps the link (`liveItem`, the item's app and index id, not secret and opening nothing by
// itself) and a snapshot beside it (`liveName`, `livePoster`), so it draws without the item: for a reader who cannot
// open it, an export and a Community copy. Pure, and free of the index client (its guards are restated here).
import { stringRule, type FieldCheck } from '@liveworkspace/model-core/validate-primitives';

// The apps that serve a workbench frame, so the ones a live embed can show.
export const LIVE_EMBED_APPS = [
  'livediagram',
  'liveplanner',
  'livedocuments',
  'livedesign',
] as const;
export type LiveEmbedApp = (typeof LIVE_EMBED_APPS)[number];

export type LiveItem = { app: LiveEmbedApp; itemId: string };

// The snapshot's caps: a name as the index keeps one, and a small raster picture.
export const LIVE_NAME_MAX = 200;
export const LIVE_POSTER_MAX_CHARS = 60_000;
export const LIVE_POSTER_MAX_EDGE = 480;

// The index's item id shape (@liveworkspace/index-client).
const ITEM_ID = /^[A-Za-z0-9_-]{1,64}$/;
// Only a raster picture, so a poster can never carry a script (an SVG can).
const POSTER_PREFIXES = [
  'data:image/webp;base64,',
  'data:image/jpeg;base64,',
  'data:image/png;base64,',
];
const BASE64 = /^[A-Za-z0-9+/]*={0,2}$/;

export const isLiveEmbedApp = (v: unknown): v is LiveEmbedApp =>
  (LIVE_EMBED_APPS as readonly unknown[]).includes(v);

export function isLiveItem(v: unknown): v is LiveItem {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return false;
  const { app, itemId, ...rest } = v as Record<string, unknown>;
  return (
    Object.keys(rest).length === 0 &&
    isLiveEmbedApp(app) &&
    typeof itemId === 'string' &&
    ITEM_ID.test(itemId)
  );
}

export const isLiveName = (v: unknown): v is string =>
  typeof v === 'string' && v.length <= LIVE_NAME_MAX;

export function isLivePoster(v: unknown): v is string {
  if (typeof v !== 'string' || v.length > LIVE_POSTER_MAX_CHARS) return false;
  const prefix = POSTER_PREFIXES.find((p) => v.startsWith(p));
  return prefix !== undefined && v.length > prefix.length && BASE64.test(v.slice(prefix.length));
}

// The Embed element's live fields, for each host's validator (its `case 'video'`).
export const LIVE_EMBED_CHECKS: readonly FieldCheck[] = [
  {
    field: 'liveItem',
    valid: isLiveItem,
    rule: `{ app, itemId }, app one of ${LIVE_EMBED_APPS.join(', ')}`,
  },
  { field: 'liveName', valid: isLiveName, rule: stringRule(LIVE_NAME_MAX) },
  {
    field: 'livePoster',
    valid: isLivePoster,
    rule: `a webp, jpeg or png data URL of at most ${LIVE_POSTER_MAX_CHARS} characters`,
  },
];

// A Community copy keeps the snapshot and loses the link (live-embeds.md "Snapshots"), so a stranger is told of no
// other item and nothing can open it.
export function withoutLiveItem<T extends { liveItem?: unknown }>(el: T): T {
  if (el.liveItem === undefined) return el;
  const { liveItem: _drop, ...rest } = el;
  return rest as T;
}
