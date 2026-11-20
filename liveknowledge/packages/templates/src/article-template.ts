// The Project Brief template (kind `article`, docs/specs/007-editor/article-pages.md "An article"): a tab that opens in
// Pages mode on one article page, written as a real project brief so the page shows what the writing does: a header
// with the document's name and page numbers, headings, the goals in a table, a numbered plan, open questions as a
// to-do list, a quote and a footnote on the figure it cites. Pure data: the tab's pages and writing, merged in by
// templateCanvasOverrides.
import {
  continuousPage,
  type ArticleBlock,
  type ArticleFlow,
  type ArticleStyle,
  type Page,
  type Tab,
} from '@liveknowledge/document';
import { markdownArticleBlocks } from './article-markdown-blocks';

const PAGE_ID = 'page-1';
const FLOW_ID = 'art-brief';

const BRIEF = `
# Self-Serve Returns

# Project brief · Customer team · Owner: Jordan Blake · April 2027

# Summary

Every return today starts with an email to support and takes three days to settle. We will let customers start a return from their order page and print a label in a minute, cutting support emails by a quarter by the end of June.

# Why now

Returns are the most common reason people write to us: one support email in four in the first quarter.[^1] Each takes an agent about eight minutes, and the customer waits three days for an answer.

# Goals

| Goal | Measure | By |
| --- | --- | --- |
| Customers return without writing to us | 80% of returns start on the order page | 30 June |
| Fewer emails for the team | Support emails down by 25% | 30 June |
| Refunds land sooner | Refunded in 2 days, down from 5 | 31 July |

# Plan

1. Talk to five customers who sent something back this year
2. Build a return button on the order page, behind a flag
3. Pilot it with subscribers for two weeks, then open it to everyone

# Not in scope

- Exchanges for a different size or grind
- Returns of opened bags, which stay a conversation with support

# Open questions

- [ ] Who signs off the refund rules?
- [ ] What would make us stop the pilot?

> A plan is a guess written down, so we can see when it is wrong.

[^1]: 1,860 of the 7,420 support emails from January to March 2027 were tagged "returns".
`;

// A real brief is passed round: a header with its name, page numbers at the foot.
const BRIEF_STYLE: ArticleStyle = { header: { left: '{name}', right: 'Draft' }, pageNumbers: true };

/** A written template's one page: the continuous page, holding the flow
 *  (docs/specs/030-knowledgebase/knowledgebases-and-pages.md "The continuous page"). */
export function articlePage(flow: string): Page {
  return continuousPage({ id: PAGE_ID, orientation: 'portrait', kind: 'article', flow });
}

// An article tab's overrides: one A4 portrait article page holding the flow, which the editor flows onto as many pages
// as the writing fills (docs/specs/007-editor/article-pages.md "An article"). The Project Brief, Working Backwards and
// the written templates are each one of these.
export function articleTabOverrides(
  flow: string,
  blocks: ArticleBlock[],
  style?: ArticleStyle,
): Partial<Tab> {
  // A knowledgebase page has no style of its own (docs/specs/030-knowledgebase/page-surface.md "What a page no
  // longer has"): a template's look, fonts, margins, header, footer and page numbers are left out, every page is
  // drawn in the knowledgebase's style, and a page break in its writing is dropped (the continuous page has no
  // paper pages).
  void style;
  const doc: ArticleFlow = { blocks: blocks.filter((b) => b.type !== 'pageBreak') };
  return { pages: [articlePage(flow)], articles: { [flow]: doc } };
}

/** The Project Brief template's pages and writing (opens in Pages). */
export function articleTemplateOverrides(): Partial<Tab> {
  return articleTabOverrides(
    FLOW_ID,
    markdownArticleBlocks('brief', BRIEF, [[0.4, 0.4, 0.2]]),
    BRIEF_STYLE,
  );
}
