// What a page link reads as (docs/specs/030-knowledgebase/links-and-embeds.md "Page links"): always the page's
// current title, never the words stored with the link. The writing draws a link as `a.article-page-link[data-page]`
// with its stored words hidden; here each page of the knowledgebase gets one CSS rule that writes its title into
// the link and gives it a live link's look, in the brand's colour (page-link-colour.ts). A link no rule names keeps
// the base look: "Deleted Page", struck through, in the writing's own ink and inert. So a rename shows in every link at once with no change to any writing, and typing costs nothing.

export type LinkedPage = { id: string; name: string };

const UNTITLED = 'Untitled Page';

/** A CSS string literal for any text: backslashes, quotes and line breaks escaped. */
export function cssString(text: string): string {
  const escaped = text.replace(/[\\"\n\r\f]/g, (c) => `\\${c.codePointAt(0)!.toString(16)} `);
  return `"${escaped}"`;
}

/** The rules for a page list: its links' look once, then a title each. */
export function pageLinkCss(pages: readonly LinkedPage[]): string {
  if (pages.length === 0) return '';
  const link = (id: string) => `.article-flow a.article-page-link[data-page=${cssString(id)}]`;
  const live = pages.map((page) => link(page.id)).join(',');
  const titles = pages
    .map((page) => `${link(page.id)}::before{content:${cssString(page.name.trim() || UNTITLED)}}`)
    .join('');
  return `${live}{color:var(--article-page-link,var(--article-accent));opacity:1;text-decoration:underline;text-decoration-thickness:1px;text-underline-offset:2px;cursor:pointer}${titles}`;
}

/** The rules for the pages in the knowledgebase's Trash (knowledgebases-and-pages.md "The page Trash"): a link to
 *  one reads "In the Trash", struck through, and can be pressed (it opens the Trash at the page). Only a session that
 *  may see the Trash reads it, so for anyone else such a link keeps the base look, "Deleted Page". */
export function trashedLinkCss(ids: readonly string[]): string {
  if (ids.length === 0) return '';
  const link = (id: string) => `.article-flow a.article-page-link[data-page=${cssString(id)}]`;
  const all = ids.map(link).join(',');
  const words = ids.map((id) => `${link(id)}::before`).join(',');
  return `${all}{cursor:pointer}${words}{content:"In the Trash"}`;
}

/** The pages as one string a reader compares by value: a typing commit changes no page's id or name. */
export const linkedPagesKey = (pages: readonly LinkedPage[]): string =>
  pages.map((page) => `${page.id}\u0000${page.name}`).join('\u0001');

const STYLE_ID = 'page-link-titles';

/** Write the rules into the document, replacing the last ones. */
export function installPageLinkTitles(css: string, doc: Document = document): void {
  let style = doc.getElementById(STYLE_ID) as HTMLStyleElement | null;
  if (!style) {
    style = doc.createElement('style');
    style.id = STYLE_ID;
    doc.head.append(style);
  }
  if (style.textContent !== css) style.textContent = css;
}
