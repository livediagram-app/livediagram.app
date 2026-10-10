// The Illustrate tools' input and output shapes (docs/specs/024-agents/illustrate-for-agents.md,
// docs/specs/015-api/mcp-server.md §4.9d): change_pages and write_article. Pages are named by id, place
// or name; articles by flow id or title. The layout ids each kind offers come from the catalogue the
// editor's page panel shows, so the two never disagree.
import { z } from 'zod';
import { PAGE_CHANGES_MAX } from '@livediagram/api-schema';
import {
  ARTICLE_LOOK_IDS,
  ARTICLE_MARKDOWN_MAX,
  PAGE_NAME_MAX,
  PAGE_SIZE_IDS,
  type ArticleLookId,
  type PageKind,
  type PageSizeId,
} from '@livediagram/document';
import { layoutCatalogueFor } from '@livediagram/templates';

const layoutIds = (kind: Exclude<PageKind, 'article'>) =>
  layoutCatalogueFor(kind)
    .layouts.map((l) => l.id)
    .join(', ');

const url = z.string().describe('Link that opens the document in the livediagram editor.');
const documentId = z.string().describe('The document (from find_documents).');
const tabId = z
  .string()
  .optional()
  .describe(
    'The tab. Absent: the first tab in Illustrate mode. Naming a tab in another mode switches it into Illustrate.',
  );
const pageRef = z
  .union([z.string(), z.number().int().min(1)])
  .describe('A page: its id, its place (1 is the first, as a number or text) or its name.');
const size = z
  .enum(PAGE_SIZE_IDS as [PageSizeId, ...PageSizeId[]])
  .describe(
    'Page size: a4, letter, a3, square, social (4:5), wide (9:16, or 16:9 turned) for infographic and article ' +
      'pages; slide (16:9) or slide-classic (4:3) for slides; logo (1024) for logo pages. fit is never chosen.',
  );
const orientation = z
  .enum(['portrait', 'landscape'])
  .describe('Portrait or landscape. Slides and logo pages have none.');
const hex = z.string().describe('A hex colour such as #0f172a.');
const background = z
  .object({
    color: hex.optional().describe('A solid fill, a hex colour.'),
    gradient: z
      .tuple([hex, hex])
      .optional()
      .describe('A two-stop gradient: the colours it runs from and to.'),
    angle: z.number().optional().describe('The gradient’s angle in degrees (default 160).'),
    pattern: z
      .enum(['dots', 'grid', 'lines', 'none'])
      .optional()
      .describe('A pattern over the fill: dots, grid, lines, or none. Logo pages take none.'),
    paper: z.literal(true).optional().describe('Back to the plain paper.'),
  })
  .describe('The page’s background: one of color, gradient or paper, and optionally a pattern.');
const layout = z
  .string()
  .describe(
    `A ready-made arrangement put onto the page in place of what is on it. Infographic: ${layoutIds('infographic')}. ` +
      `Slide: ${layoutIds('slide')}. Logo: ${layoutIds('logo')}. Article pages take none.`,
  );
const name = z
  .string()
  .max(PAGE_NAME_MAX)
  .describe(`The page’s name, up to ${PAGE_NAME_MAX} characters.`);

const pageChange = z
  .discriminatedUnion('op', [
    z
      .object({
        op: z.literal('add').describe('Add a page.'),
        kind: z
          .enum(['infographic', 'slide', 'logo'])
          .describe('What the page is for. Article pages are made by write_article.'),
        size: size.optional(),
        orientation: orientation.optional(),
        name: name.optional(),
        background: background.optional(),
        layout: layout.optional(),
        at: z.number().int().min(1).optional().describe('The place it goes to (default: the end).'),
      })
      .describe('A new page; on a fresh tab its empty first page becomes it.'),
    z
      .object({
        op: z.literal('set').describe('Change a page.'),
        page: pageRef,
        name: name.optional(),
        size: size.optional(),
        orientation: orientation.optional(),
        background: background.optional(),
        locked: z.boolean().optional().describe('Lock or unlock the page (unlocking comes first).'),
      })
      .describe(
        'A page’s name, size, orientation, background or lock; on an article, all its pages.',
      ),
    z
      .object({ op: z.literal('layout').describe('Lay a page out.'), page: pageRef, layout })
      .describe('Replace what is on a page with a layout.'),
    z
      .object({
        op: z.literal('move').describe('Move a page.'),
        page: pageRef,
        to: z.number().int().min(1).describe('The place to move it to.'),
      })
      .describe('Move a page (an article page: its whole article), with its content.'),
    z
      .object({ op: z.literal('duplicate').describe('Copy a page.'), page: pageRef })
      .describe('A copy after it, content and all (an article: the whole article).'),
    z
      .object({ op: z.literal('delete').describe('Delete a page.'), page: pageRef })
      .describe(
        'Delete a page and what is on it (an article page: the whole article). Never the last.',
      ),
  ])
  .describe('One page change.');

export const changePagesShape = {
  documentId,
  tabId,
  changes: z
    .array(pageChange)
    .min(1)
    .max(PAGE_CHANGES_MAX)
    .describe(
      `Up to ${PAGE_CHANGES_MAX} page changes, applied in order as one edit; places count the pages as earlier changes left them.`,
    ),
};

const pageOut = z
  .object({
    place: z.number().describe('Its place in the row, 1 first.'),
    id: z.string().describe('The page id.'),
    name: z.string().nullable().describe('Its name, or null.'),
    kind: z.string().describe('infographic, article, slide or logo.'),
    size: z.string().describe('Its size id.'),
    orientation: z.string().nullable().describe('portrait, landscape, or null for none.'),
    rect: z
      .object({
        x: z.number().describe('Left edge, canvas px.'),
        y: z.number().describe('Top edge, canvas px.'),
        width: z.number().describe('Width, canvas px.'),
        height: z.number().describe('Height, canvas px.'),
      })
      .describe('Where the page sits on the canvas: put elements inside it with update_document.'),
    background: z.string().nullable().describe('Its background in words, or null for the paper.'),
    locked: z.boolean().describe('Whether it is locked.'),
    flow: z.string().nullable().describe('The article it is a page of, or null.'),
    elements: z.number().describe('How many elements are on it.'),
  })
  .describe('A page as it is now.');

const articleOut = z
  .object({
    flow: z.string().describe('The article id.'),
    title: z.string().describe('Its title.'),
    pages: z.array(z.number()).describe('The places of its pages.'),
    blocks: z.number().describe('How many blocks its writing has.'),
    words: z.number().describe('How many words.'),
    look: z.string().nullable().describe('Its look, or null for the default.'),
  })
  .describe('An article.');

const answerOut = {
  documentId: z.string().describe('The document id.'),
  tabId: z.string().describe('The tab changed.'),
  switched: z.boolean().describe('Whether the tab was switched into Illustrate mode.'),
  lines: z.array(z.string()).describe('What was done, one line each.'),
  pages: z.array(pageOut).describe('Every page of the tab as it now is.'),
  articles: z.array(articleOut).describe('Every article of the tab.'),
  rev: z.number().describe('The tab revision written.'),
  url,
};

export const changePagesOutput = answerOut;

export const writeArticleShape = {
  documentId,
  tabId,
  markdown: z
    .string()
    .max(ARTICLE_MARKDOWN_MAX)
    .describe(
      'The text, in Markdown: # ## ### headings, paragraphs, - and 1. lists (indent two spaces a level), ' +
        '- [ ] to-dos, > quotes, ``` code, --- dividers, **bold**, *italic*, ~~strike~~, `code`, [links](https://…). ' +
        'Front matter sets the title and subtitle: a first line ---, then title: …, subtitle: …, then ---. ' +
        'A line \\pagebreak starts a new page; a line [zone <id>] keeps an existing zone there. ' +
        'An article holds no tables: a Markdown table is written as a list.',
    ),
  article: z
    .string()
    .optional()
    .describe(
      'Which article, by id or title. Absent: the tab’s only one, or a new one if it has none.',
    ),
  new: z.boolean().optional().describe('Always start a new article.'),
  mode: z
    .enum(['replace', 'append'])
    .optional()
    .describe('replace (default) writes the text anew; append adds it after the last block.'),
  size: size
    .optional()
    .describe('A new article’s paper: a4 (default), letter, a3, square, social or wide.'),
  orientation: orientation.optional(),
  look: z
    .enum(ARTICLE_LOOK_IDS as [ArticleLookId, ...ArticleLookId[]])
    .optional()
    .describe('The article’s look: clean, classic, report, notebook or bold.'),
  accent: hex.optional().describe('The accent colour, a hex.'),
  pageNumbers: z.boolean().optional().describe('Page numbers in the bottom margin on or off.'),
};

export const writeArticleOutput = {
  ...answerOut,
  article: articleOut
    .extend({ created: z.boolean().describe('Whether the article is new.') })
    .describe('The article written.'),
};
