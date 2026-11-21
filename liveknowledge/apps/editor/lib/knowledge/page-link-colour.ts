// A page link's colour (docs/specs/030-knowledgebase/links-and-embeds.md "Page links"): the brand's, not the article
// style's accent (sky blue by default), so a link to a page of this knowledgebase reads apart from a web link.
// brand-700 on light paper and the ramp's light step, brand-300, on dark paper (packages/tailwind-config/theme.css,
// the light ramp: the paper is the page's own colour, whatever the app's theme), each held to 4.5:1 on the paper it
// is drawn on, whatever colour a person gave the page.
import { legibleOn } from '@liveknowledge/document';

export const PAGE_LINK_ON_LIGHT = '#3f6212';
export const PAGE_LINK_ON_DARK = '#bef264';
// WCAG 2.2 AA for text.
export const PAGE_LINK_CONTRAST = 4.5;

/** The colour of a live page link on paper of `tone`. `themed` is the accent of a knowledgebase whose theme is not
 *  the product's own (docs/specs/030-knowledgebase/page-surface.md "The chrome follows the theme"): its page links
 *  take that accent, held to the same floor, as the rest of the chrome does. */
export function pageLinkColour(
  ink: { tone: string; dark: boolean },
  themed?: string | null,
): string {
  if (themed) return legibleOn(themed, ink.tone, PAGE_LINK_CONTRAST);
  return legibleOn(ink.dark ? PAGE_LINK_ON_DARK : PAGE_LINK_ON_LIGHT, ink.tone, PAGE_LINK_CONTRAST);
}
