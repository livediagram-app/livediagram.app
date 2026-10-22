// The emoji a preview draws (docs/specs/015-api/mcp-server.md §5 "Fonts"): a Worker has no colour-emoji font, so an
// emoji sticker or icon drew as a disc labelled "emoji" and an agent could not judge it. Each emoji the tab uses is
// drawn from its Twemoji SVG instead, fetched from a pinned release (graphics CC-BY 4.0, THIRD_PARTY_NOTICES.md) by
// its code points. Best effort, as fonts are: one that cannot be fetched in time draws as the disc. Each file is kept
// in the Cache API, so a project's previews fetch nothing after the first.
import {
  emojiArtOf,
  iconEmojiGlyph,
  stickerEmojiGlyph,
  twemojiFileName,
  type EmojiArt,
} from '@liveplanner/icons/resolve';
import type { Element } from '@liveplanner/project';
import { cached, type Fetcher } from './preview-fonts';

export const TWEMOJI_BASE = 'https://cdn.jsdelivr.net/gh/jdecked/twemoji@15.1.0/assets/svg/';
// The most emoji one preview fetches, how long it waits for them, and the largest file kept (Twemoji's run 0.3 to
// 10 kB; a flag or a detailed face is the largest).
export const PREVIEW_EMOJI_MAX = 40;
export const PREVIEW_EMOJI_TIMEOUT_MS = 2500;
const EMOJI_BYTES_MAX = 64_000;

// The emoji the elements draw: each emoji sticker's and emoji icon's, once each, in order.
export function emojiGlyphsOf(elements: readonly Element[]): string[] {
  const glyphs = new Set<string>();
  for (const el of elements) {
    if (el.type !== 'shape') continue;
    const glyph =
      el.shape === 'sticker' && el.stickerId
        ? stickerEmojiGlyph(el.stickerId)
        : el.shape === 'icon' && el.iconId
          ? iconEmojiGlyph(el.iconId)
          : undefined;
    if (glyph !== undefined) glyphs.add(glyph);
  }
  return [...glyphs];
}

async function artOf(glyph: string, fetcher: Fetcher): Promise<EmojiArt | null> {
  const res = await cached(`${TWEMOJI_BASE}${twemojiFileName(glyph)}.svg`, fetcher);
  if (!res) return null;
  const text = await res.text().catch(() => '');
  return text.length <= EMOJI_BYTES_MAX ? emojiArtOf(text) : null;
}

// The art of at most PREVIEW_EMOJI_MAX of `glyphs`, by glyph: whatever arrives within PREVIEW_EMOJI_TIMEOUT_MS.
export async function previewEmoji(
  glyphs: readonly string[],
  fetcher: Fetcher = (url) => fetch(url),
): Promise<Map<string, EmojiArt>> {
  const wanted = [...new Set(glyphs)].slice(0, PREVIEW_EMOJI_MAX);
  const out = new Map<string, EmojiArt>();
  if (wanted.length === 0) return out;
  const all = Promise.all(
    wanted.map(async (glyph) => {
      const art = await artOf(glyph, fetcher).catch(() => null);
      if (art) out.set(glyph, art);
    }),
  );
  let timer: ReturnType<typeof setTimeout> | undefined;
  const late = new Promise<void>((resolve) => {
    timer = setTimeout(() => {
      console.warn('[preview-emoji] emoji late; drawing discs', { emoji: wanted.length });
      resolve();
    }, PREVIEW_EMOJI_TIMEOUT_MS);
  });
  await Promise.race([all, late]);
  if (timer !== undefined) clearTimeout(timer);
  // A copy: an emoji arriving after the timeout must not change a render already under way.
  return new Map(out);
}
