// Sticker identity, as a lightweight first-load module — the catalogue itself
// (art + words) loads async. Two jobs.
//
// 1. `isStickerId` tells a sticker id from an icon id. Sticker ids carry no
//    single prefix (`emoji-*` and `badge-*`), so both are listed here.
//
// 2. `isLegacyEmojiIconId` is the compatibility hinge. Under spec/85 these
//    emoji shipped as ICONS: real diagrams out there hold
//    `{ shape: 'icon', iconId: 'emoji-thumbs-up' }`. Spec/116 made stickers
//    their own element kind, and those elements are NOT migrated — silently
//    restyling somebody's saved diagram with a plate, a shadow and a tilt is
//    not ours to do. So the icon catalogue keeps rendering them exactly as it
//    did, and only the palette moved.

export const STICKER_ID_PREFIXES = ['emoji-', 'badge-'] as const;

// The prefix the emoji half carries. Kept as its own export because the
// legacy-icon path below keys off precisely that set and not the badges,
// which never existed as icons.
export const LEGACY_EMOJI_ID_PREFIX = 'emoji-';

export function isStickerId(id: string): boolean {
  return STICKER_ID_PREFIXES.some((p) => id.startsWith(p));
}

// True for an `iconId` that predates spec/116 — an emoji placed back when the
// palette offered them in the Icons tab. Such an element stays an icon.
export function isLegacyEmojiIconId(id: string | undefined): boolean {
  return !!id && id.startsWith(LEGACY_EMOJI_ID_PREFIX);
}
