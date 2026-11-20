// The slash menu's entries (docs/specs/007-editor/article-pages.md "The slash menu"), in groups,
// and the filter: entries whose name matches what is typed come first (a name starting with it
// before one containing it), then entries matched by a keyword.
import type { ArticleListKind, ArticleParagraphStyle } from '@liveknowledge/document';

export type SlashAction =
  | { kind: 'style'; style: ArticleParagraphStyle | 'code' }
  | { kind: 'list'; list: ArticleListKind }
  | { kind: 'block'; block: 'divider' | 'pageBreak' | 'table' | 'toc' | 'footnote' }
  | {
      kind: 'insert';
      what: 'image' | 'chart' | 'pie' | 'line' | 'drawing' | 'callout' | 'sticky' | 'embed';
    }
  // Page links (docs/specs/030-knowledgebase/links-and-embeds.md): the slash menu's Link to Page opens the page
  // picker, whose own entries are a page to link to and Create Page.
  | { kind: 'page-link' }
  | { kind: 'page'; page: string; title: string }
  | { kind: 'create-page'; title: string };

export type SlashItem = {
  id: string;
  label: string;
  group: 'Text' | 'Lists' | 'Blocks' | 'Insert' | 'Pages' | 'New';
  keywords: string;
  hint: string;
  action: SlashAction;
};

const SLASH_ITEMS: readonly SlashItem[] = [
  {
    id: 'text',
    label: 'Text',
    group: 'Text',
    keywords: 'paragraph body plain normal',
    hint: 'Plain writing',
    action: { kind: 'style', style: 'body' },
  },
  {
    id: 'title',
    label: 'Title',
    group: 'Text',
    keywords: 'heading big',
    hint: 'The page title',
    action: { kind: 'style', style: 'title' },
  },
  {
    id: 'subtitle',
    label: 'Subtitle',
    group: 'Text',
    keywords: 'standfirst lead',
    hint: 'A line under the title',
    action: { kind: 'style', style: 'subtitle' },
  },
  {
    id: 'h1',
    label: 'Heading 1',
    group: 'Text',
    keywords: 'h1 section title',
    hint: 'A big section heading',
    action: { kind: 'style', style: 'h1' },
  },
  {
    id: 'h2',
    label: 'Heading 2',
    group: 'Text',
    keywords: 'h2 subsection',
    hint: 'A medium heading',
    action: { kind: 'style', style: 'h2' },
  },
  {
    id: 'h3',
    label: 'Heading 3',
    group: 'Text',
    keywords: 'h3 small',
    hint: 'A small heading',
    action: { kind: 'style', style: 'h3' },
  },
  {
    id: 'bullet',
    label: 'Bulleted List',
    group: 'Lists',
    keywords: 'ul unordered points dots',
    hint: 'A simple list',
    action: { kind: 'list', list: 'bullet' },
  },
  {
    id: 'numbered',
    label: 'Numbered List',
    group: 'Lists',
    keywords: 'ol ordered steps 123',
    hint: 'A list with numbers',
    action: { kind: 'list', list: 'numbered' },
  },
  {
    id: 'todo',
    label: 'To-Do List',
    group: 'Lists',
    keywords: 'checklist tasks checkbox tick',
    hint: 'Tasks to tick off',
    action: { kind: 'list', list: 'todo' },
  },
  {
    id: 'quote',
    label: 'Quote',
    group: 'Blocks',
    keywords: 'blockquote citation pull',
    hint: 'A quotation',
    action: { kind: 'style', style: 'quote' },
  },
  {
    id: 'code',
    label: 'Code',
    group: 'Blocks',
    keywords: 'pre monospace snippet',
    hint: 'Code, as typed',
    action: { kind: 'style', style: 'code' },
  },
  {
    id: 'divider',
    label: 'Divider',
    group: 'Blocks',
    keywords: 'rule line hr separator',
    hint: 'A line across',
    action: { kind: 'block', block: 'divider' },
  },
  // No Page Break: a knowledgebase page is one continuous page (docs/specs/030-knowledgebase/
  // knowledgebases-and-pages.md "The continuous page").
  {
    id: 'table',
    label: 'Table',
    group: 'Blocks',
    keywords: 'grid rows columns cells spreadsheet',
    hint: 'Rows and columns in the text',
    action: { kind: 'block', block: 'table' },
  },
  {
    id: 'toc',
    label: 'Table of Contents',
    group: 'Blocks',
    keywords: 'contents toc outline headings index',
    hint: 'The headings, with their pages',
    action: { kind: 'block', block: 'toc' },
  },
  {
    id: 'footnote',
    label: 'Footnote',
    group: 'Blocks',
    keywords: 'note reference citation source endnote',
    hint: 'A numbered note at the foot of the page',
    action: { kind: 'block', block: 'footnote' },
  },
  {
    id: 'page-link',
    label: 'Link to Page',
    group: 'Insert',
    keywords: 'page link mention reference',
    hint: 'A page of this knowledgebase',
    action: { kind: 'page-link' },
  },
  {
    id: 'image',
    label: 'Image',
    group: 'Insert',
    keywords: 'picture photo upload',
    hint: 'A picture in the text',
    action: { kind: 'insert', what: 'image' },
  },

  {
    id: 'chart',
    label: 'Bar Chart',
    group: 'Insert',
    keywords: 'graph bars data',
    hint: 'Compare values',
    action: { kind: 'insert', what: 'chart' },
  },
  {
    id: 'pie',
    label: 'Pie Chart',
    group: 'Insert',
    keywords: 'graph slices share donut',
    hint: 'Parts of a whole',
    action: { kind: 'insert', what: 'pie' },
  },
  {
    id: 'line',
    label: 'Line Chart',
    group: 'Insert',
    keywords: 'graph trend time series',
    hint: 'A trend over time',
    action: { kind: 'insert', what: 'line' },
  },
  {
    id: 'drawing',
    label: 'Drawing',
    group: 'Insert',
    keywords: 'diagram shapes flowchart sketch canvas',
    hint: 'Shapes and arrows',
    action: { kind: 'insert', what: 'drawing' },
  },
  {
    id: 'callout',
    label: 'Callout',
    group: 'Insert',
    keywords: 'note tip warning box',
    hint: 'A highlighted note',
    action: { kind: 'insert', what: 'callout' },
  },
  {
    id: 'sticky',
    label: 'Sticky Note',
    group: 'Insert',
    keywords: 'post-it note',
    hint: 'A sticky note',
    action: { kind: 'insert', what: 'sticky' },
  },
  {
    id: 'embed',
    label: 'Embed',
    group: 'Insert',
    keywords:
      'livediagram liveplanner livedocuments livedesign livehuddle diagram plan board design file live',
    hint: "Another app's file, live",
    action: { kind: 'insert', what: 'embed' },
  },
];

/** The entries matching `query`, best first. Empty query: every entry, in order. */
export function filterSlashItems(query: string): SlashItem[] {
  const items = SLASH_ITEMS;
  const q = query.trim().toLowerCase();
  if (!q) return [...items];
  const starts: SlashItem[] = [];
  const contains: SlashItem[] = [];
  const keyword: SlashItem[] = [];
  for (const item of items) {
    const name = item.label.toLowerCase();
    if (name.startsWith(q)) starts.push(item);
    else if (name.includes(q)) contains.push(item);
    else if (item.keywords.split(' ').some((k) => k.startsWith(q))) keyword.push(item);
  }
  return [...starts, ...contains, ...keyword];
}
