// The Article template (docs/specs/007-editor/article-pages.md "An article"): a tab that opens in
// Illustrate mode on one article page, written as a short project brief so the page shows what
// the writing does (a title and subtitle, headings, lists, a quote) rather than an empty sheet.
// Pure data: the tab's pages and writing, merged in by templateCanvasOverrides.
import type { ArticleBlock, ArticleFlow, IllustratePage, Tab } from '@livediagram/document';

const PAGE_ID = 'page-1';
const FLOW_ID = 'art-brief';

let n = 0;
const id = () => `b-brief-${++n}`;
const p = (text: string, style?: 'title' | 'subtitle' | 'h1' | 'h2' | 'quote'): ArticleBlock => ({
  id: id(),
  type: 'paragraph',
  ...(style ? { style } : {}),
  runs: [{ text }],
});
const li = (list: 'bullet' | 'numbered' | 'todo', text: string): ArticleBlock => ({
  id: id(),
  type: 'list',
  list,
  runs: [{ text }],
});

function briefBlocks(): ArticleBlock[] {
  n = 0;
  return [
    p('Project brief', 'title'),
    p('What we are doing, why, and how we will know it worked', 'subtitle'),
    p('Summary', 'h1'),
    p(
      'One paragraph a busy reader can stop after: what changes, for whom, and by when. Keep it to three sentences.',
    ),
    p('Goals', 'h1'),
    li('bullet', 'A measurable outcome, with a number and a date'),
    li('bullet', 'A second one, only if it matters as much as the first'),
    p('Plan', 'h1'),
    li('numbered', 'Talk to five customers about the problem'),
    li('numbered', 'Build the smallest version that tests the idea'),
    li('numbered', 'Launch it to a pilot group and measure'),
    p('Open questions', 'h1'),
    li('todo', 'Who signs off the launch?'),
    li('todo', 'What would make us stop?'),
    p('A plan is a guess written down, so we can see when it is wrong.', 'quote'),
  ];
}

/** The Article template's pages and writing (opens in Illustrate). */
export function articleTemplateOverrides(): Partial<Tab> {
  const pages: IllustratePage[] = [
    { id: PAGE_ID, orientation: 'portrait', kind: 'article', flow: FLOW_ID },
  ];
  const doc: ArticleFlow = { blocks: briefBlocks() };
  return { opensIn: 'illustrate', pages, articles: { [FLOW_ID]: doc } };
}
