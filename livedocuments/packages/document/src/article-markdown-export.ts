// An article tab's Markdown export (docs/specs/020-import-export/markdown-import.md "Markdown export"): every
// article's writing in page order, in the form articleFromMarkdown reads back, and a count of what Markdown cannot hold.
import { articlesOf, type ArticleBlock } from './article-flow';
import { articleToMarkdown } from './article-markdown-io';
import { pageUnits } from './article-pages';
import { pagesOf } from './page';
import type { Tab } from './index';

/** What an article's Markdown leaves out: the pictures and other items beside the writing, and the spots in the text
 *  where a drawing sat (a `[zone id]` line names a drawing only its own article has, so it is not written). */
export type ArticleMarkdownLeftOut = { pictures: number; other: number; zones: number };

export type ArticleTabMarkdown = {
  markdown: string;
  /** How many articles the tab holds, written one after another. */
  articles: number;
  leftOut: ArticleMarkdownLeftOut;
};

// A later article has no front matter (it belongs only at the top of the file): its title and subtitle read as headings.
const asHeading = (b: ArticleBlock): ArticleBlock =>
  b.type === 'paragraph' && (b.style === 'title' || b.style === 'subtitle')
    ? { ...b, style: b.style === 'title' ? 'h1' : 'h2' }
    : b;

/** The tab's articles as one Markdown text, in the order their pages run, a `\pagebreak` line between them. */
export function articleTabMarkdown(tab: Tab): ArticleTabMarkdown {
  const written = articlesOf(tab);
  const flows = pageUnits(pagesOf(tab)).flatMap((u) => (u.flow && written[u.flow] ? [u.flow] : []));
  let zones = 0;
  const texts = flows.map((flow, i) => {
    const own = written[flow]!;
    const blocks = own.blocks
      .filter((b) => b.type !== 'zone')
      .map((b) => (i > 0 ? asHeading(b) : b));
    zones += own.blocks.length - blocks.length;
    return articleToMarkdown({ blocks });
  });
  let pictures = 0;
  for (const el of tab.elements) if (el.type === 'image') pictures++;
  return {
    markdown: texts.join('\n\\pagebreak\n\n'),
    articles: flows.length,
    leftOut: { pictures, other: tab.elements.length - pictures, zones },
  };
}

const count = (n: number, one: string, many: string) =>
  `${n.toLocaleString('en-GB')} ${n === 1 ? one : many}`;

/** The panel's line naming what the Markdown leaves out, or '' when it leaves nothing. */
export function articleLeftOutNote({ pictures, other, zones }: ArticleMarkdownLeftOut): string {
  const parts = [
    ...(pictures ? [count(pictures, 'picture', 'pictures')] : []),
    ...(other ? [count(other, 'other item', 'other items')] : []),
    ...(zones ? [count(zones, 'drawing spot in the text', 'drawing spots in the text')] : []),
  ];
  if (parts.length === 0) return '';
  const list = parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts.at(-1)}` : parts[0];
  const single = parts.length === 1 && pictures + other + zones === 1;
  return `Markdown holds text only, so ${list} ${single ? 'is' : 'are'} left out. Export JSON to keep everything.`;
}
