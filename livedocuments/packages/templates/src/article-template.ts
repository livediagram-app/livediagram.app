// The Project Brief template (kind `article`, docs/specs/007-editor/article-pages.md "An article"): a tab that opens in
// Pages mode on one article page, written as a real project brief so the page shows what the writing does: a header
// with the document's name and page numbers, headings, the goals in a table, a numbered plan, open questions as a
// to-do list, a quote and a footnote on the figure it cites. Pure data: the tab's pages and writing, merged in by
// templateCanvasOverrides.
import type { ArticleBlock, ArticleFlow, ArticleStyle, Page, Tab } from '@livedocuments/document';
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

/** An article tab's one page: A4 portrait, holding the flow (docs/specs/007-editor/article-pages.md "An article"). */
export function articlePage(flow: string): Page {
  return { id: PAGE_ID, orientation: 'portrait', kind: 'article', flow };
}

// An article tab's overrides: one A4 portrait article page holding the flow, which the editor flows onto as many pages
// as the writing fills (docs/specs/007-editor/article-pages.md "An article"). The Project Brief, Working Backwards and
// the written templates are each one of these.
export function articleTabOverrides(
  flow: string,
  blocks: ArticleBlock[],
  style?: ArticleStyle,
): Partial<Tab> {
  const doc: ArticleFlow = { blocks, ...(style ? { style } : {}) };
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
