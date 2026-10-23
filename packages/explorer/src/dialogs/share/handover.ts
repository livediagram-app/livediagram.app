// The other ways to hand a link over, besides its address: an embed (an <iframe> of the item at the link's level)
// and a live image (an <img>-able SVG that redraws as the item changes). Each app serves its own, so the host says
// where (ShareHandOver); these build the snippets from that, the one source of truth for their shape.

import type { ShareLink } from '@liveworkspace/index-client';

export type ShareHandOver = {
  /** The embed's address for a link; without it the pass offers no Embed. Embeds honour the link's level. */
  embedUrl?: (link: ShareLink) => string;
  /** The live image's address for a link, of one tab (undefined: the item's first, its cached snapshot). Without
   *  it the pass offers no Live image. An image can't send a password, so it is never offered while one is set. */
  liveImageUrl?: (link: ShareLink, tabId?: string) => string;
  /** The live image's alt text in the Markdown and HTML snippets ("liveplanner tab"). */
  liveImageAlt?: string;
};

// Sized for a docs or wiki column: wide enough to read, short enough not to take the page over. The hairline border
// keeps the frame from looking like a hole in the page; full screen is the natural "let me read this properly".
export function embedSnippet(url: string): string {
  return (
    `<iframe src="${escapeAttr(url)}" width="800" height="500" ` +
    `style="border:1px solid #e2e8f0;border-radius:8px" allowfullscreen></iframe>`
  );
}

export function liveImageMarkdown(url: string, alt: string): string {
  return `![${alt.replace(/[[\]]/g, '')}](${url})`;
}

export function liveImageHtml(url: string, alt: string): string {
  return `<img src="${escapeAttr(url)}" alt="${escapeAttr(alt)}" />`;
}

function escapeAttr(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}
