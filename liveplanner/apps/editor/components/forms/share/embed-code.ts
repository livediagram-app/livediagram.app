// Share Form's Embed (docs/specs/030-forms/forms.md "Publishing and the form link"): the `<iframe>` snippet a website
// pastes to show the form. The editor worker lets `/form/…` alone be framed.

// Short, Medium and Tall; Medium by default (blueprint DEFAULTS D20): a short form shows whole, a longer one scrolls.
export const EMBED_HEIGHTS = { short: 520, medium: 720, tall: 960 } as const;
export type EmbedHeight = keyof typeof EMBED_HEIGHTS;
export const EMBED_HEIGHT_DEFAULT: EmbedHeight = 'medium';

// An attribute's value, so a heading with quotes or angle brackets cannot break out of it.
const attr = (v: string) =>
  v.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function embedCode(url: string, heading: string, height: EmbedHeight): string {
  return `<iframe src="${attr(url)}" title="${attr(heading.trim() || 'Form')}" width="100%" height="${EMBED_HEIGHTS[height]}" style="border:0;max-width:640px" loading="lazy"></iframe>`;
}
