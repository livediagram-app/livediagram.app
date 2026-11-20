// What the page picker offers (docs/specs/030-knowledgebase/links-and-embeds.md "Page links"): the knowledgebase's
// pages filtered by what is typed after `[[` (a title starting with it before one containing it, tree order within
// each), then Create Page at the foot for someone who may add pages. Pure, in the slash menu's own entry shape, so
// the same popover draws it. Also: the page a pasted address names, and a page's first lines for its hover card.
import { articleRunsText, pageAncestors, type ArticleBlock } from '@liveknowledge/document';
import type { SlashItem } from '@/lib/article/article-slash-items';

export type PickPage = { id: string; name: string; parent?: string | undefined };

/** The most pages the picker lists at once. */
export const PAGE_PICK_MAX = 8;
const UNTITLED = 'Untitled Page';

export function pagePickItems(
  pages: readonly PickPage[],
  query: string,
  opts: { exclude?: string | undefined; canCreate: boolean },
): SlashItem[] {
  const q = query.trim().toLowerCase();
  const starts: PickPage[] = [];
  const contains: PickPage[] = [];
  for (const page of pages) {
    if (page.id === opts.exclude) continue;
    const name = (page.name || UNTITLED).toLowerCase();
    if (!q || name.startsWith(q)) starts.push(page);
    else if (name.includes(q)) contains.push(page);
  }
  const items: SlashItem[] = [...starts, ...contains].slice(0, PAGE_PICK_MAX).map((page) => {
    const title = page.name || UNTITLED;
    return {
      id: `page-${page.id}`,
      label: title,
      group: 'Pages',
      keywords: '',
      // Where the page is, so two pages of one title are told apart.
      hint: pageAncestors(pages, page.id)
        .map((p) => p.name || UNTITLED)
        .join(' / '),
      action: { kind: 'page', page: page.id, title },
    };
  });
  const title = query.trim();
  if (opts.canCreate && title)
    items.push({
      id: 'create-page',
      label: 'Create Page',
      group: 'New',
      keywords: '',
      hint: `"${title}"`,
      action: { kind: 'create-page', title },
    });
  return items;
}

/** The page of this knowledgebase a pasted address names: the knowledgebase's own address with the page in its
 *  fragment (`#t=<page>`, what Copy Link copies). Undefined for any other text. */
export function pageOfPastedUrl(
  text: string,
  here: { origin: string; documentId: string; pages: readonly { id: string }[] },
): string | undefined {
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    return undefined;
  }
  if (url.origin !== here.origin) return undefined;
  if (!url.pathname.split('/').includes(here.documentId)) return undefined;
  const page = new URLSearchParams(url.hash.replace(/^#/, '')).get('t');
  return page && here.pages.some((p) => p.id === page) ? page : undefined;
}

/** How much of a page its hover card shows. */
export const FIRST_LINES_CHARS = 180;

/** The first words of a page's writing after its Title, on one line, for its hover card. */
export function firstLines(blocks: readonly ArticleBlock[]): string {
  let text = '';
  for (const block of blocks) {
    if (block.type !== 'paragraph' && block.type !== 'list') continue;
    if (block.type === 'paragraph' && block.style === 'title') continue;
    const words = articleRunsText(block.runs).replace(/\s+/g, ' ').trim();
    if (!words) continue;
    text = text ? `${text} ${words}` : words;
    if (text.length >= FIRST_LINES_CHARS) break;
  }
  return text.length > FIRST_LINES_CHARS ? `${text.slice(0, FIRST_LINES_CHARS).trimEnd()}…` : text;
}
