// The slash menu's entries (docs/specs/030-knowledgebase/page-surface.md "The slash menu"): only the blocks a
// knowledgebase page has, in five groups, each with a short line, keywords, and the shortcut its preview shows.
// The menu's sections (Recent, the groups, filtering) are slash-menu-model.ts's.
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

/** The slash menu's groups, in order. */
export const SLASH_GROUPS = ['Text', 'Lists', 'Media and Embeds', 'Knowledge', 'Layout'] as const;
export type SlashGroup = (typeof SLASH_GROUPS)[number];

export type SlashItem = {
  id: string;
  label: string;
  // A slash entry's group; the page picker's are its own ('Pages', 'New').
  group: SlashGroup | 'Pages' | 'New';
  keywords: string;
  hint: string;
  action: SlashAction;
  // The shortcut the preview names: a key chord (keyLabel's form) or the Markdown typed at a block's start.
  keys?: string;
  markdown?: string;
};

export const SLASH_ITEMS: readonly SlashItem[] = [
  {
    id: 'text',
    label: 'Text',
    group: 'Text',
    keywords: 'paragraph body plain normal',
    hint: 'Plain writing',
    action: { kind: 'style', style: 'body' },
    keys: 'Mod-Alt-0',
  },
  {
    id: 'h1',
    label: 'Heading 1',
    group: 'Text',
    keywords: 'h1 section title big',
    hint: 'A big section heading',
    action: { kind: 'style', style: 'h1' },
    keys: 'Mod-Alt-1',
    markdown: '#',
  },
  {
    id: 'h2',
    label: 'Heading 2',
    group: 'Text',
    keywords: 'h2 subsection',
    hint: 'A medium heading',
    action: { kind: 'style', style: 'h2' },
    keys: 'Mod-Alt-2',
    markdown: '##',
  },
  {
    id: 'h3',
    label: 'Heading 3',
    group: 'Text',
    keywords: 'h3 small',
    hint: 'A small heading',
    action: { kind: 'style', style: 'h3' },
    keys: 'Mod-Alt-3',
    markdown: '###',
  },
  {
    id: 'subtitle',
    label: 'Subtitle',
    group: 'Text',
    keywords: 'standfirst lead summary intro',
    hint: 'A line that sums up the page',
    action: { kind: 'style', style: 'subtitle' },
  },
  {
    id: 'quote',
    label: 'Quote',
    group: 'Text',
    keywords: 'blockquote citation pull',
    hint: 'A quotation, set apart',
    action: { kind: 'style', style: 'quote' },
    markdown: '>',
  },
  {
    id: 'code',
    label: 'Code',
    group: 'Text',
    keywords: 'pre monospace snippet command',
    hint: 'Code, exactly as typed',
    action: { kind: 'style', style: 'code' },
    markdown: '```',
  },
  {
    id: 'bullet',
    label: 'Bulleted List',
    group: 'Lists',
    keywords: 'ul unordered points dots',
    hint: 'A simple list of points',
    action: { kind: 'list', list: 'bullet' },
    keys: 'Mod-Shift-8',
    markdown: '-',
  },
  {
    id: 'numbered',
    label: 'Numbered List',
    group: 'Lists',
    keywords: 'ol ordered steps 123',
    hint: 'Steps, in order',
    action: { kind: 'list', list: 'numbered' },
    keys: 'Mod-Shift-7',
    markdown: '1.',
  },
  {
    id: 'todo',
    label: 'To-Do List',
    group: 'Lists',
    keywords: 'todo checklist tasks checkbox tick',
    hint: 'Tasks to tick off',
    action: { kind: 'list', list: 'todo' },
    keys: 'Mod-Shift-9',
    markdown: '[]',
  },
  {
    id: 'image',
    label: 'Image',
    group: 'Media and Embeds',
    keywords: 'picture photo upload screenshot',
    hint: 'A picture in the text',
    action: { kind: 'insert', what: 'image' },
  },
  {
    id: 'chart',
    label: 'Bar Chart',
    group: 'Media and Embeds',
    keywords: 'graph bars data column',
    hint: 'Compare values side by side',
    action: { kind: 'insert', what: 'chart' },
  },
  {
    id: 'pie',
    label: 'Pie Chart',
    group: 'Media and Embeds',
    keywords: 'graph slices share donut',
    hint: 'Parts of a whole',
    action: { kind: 'insert', what: 'pie' },
  },
  {
    id: 'line',
    label: 'Line Chart',
    group: 'Media and Embeds',
    keywords: 'graph trend time series',
    hint: 'A trend over time',
    action: { kind: 'insert', what: 'line' },
  },
  {
    id: 'drawing',
    label: 'Drawing',
    group: 'Media and Embeds',
    keywords: 'diagram shapes flowchart sketch arrows',
    hint: 'Shapes and arrows, drawn in place',
    action: { kind: 'insert', what: 'drawing' },
  },
  {
    id: 'page-link',
    label: 'Link to Page',
    group: 'Knowledge',
    keywords: 'page link mention wiki backlink',
    hint: 'Another page of this knowledgebase',
    action: { kind: 'page-link' },
    markdown: '[[',
  },
  {
    id: 'embed',
    label: 'Embed',
    group: 'Knowledge',
    keywords:
      'livediagram liveplanner livedocuments livedesign livehuddle plan board design file app live',
    hint: 'A live file from another app',
    action: { kind: 'insert', what: 'embed' },
  },
  {
    id: 'footnote',
    label: 'Footnote',
    group: 'Knowledge',
    keywords: 'note reference citation source endnote',
    hint: 'A numbered note on a source',
    action: { kind: 'block', block: 'footnote' },
    keys: 'Mod-Alt-f',
  },
  {
    id: 'toc',
    label: 'Table of Contents',
    group: 'Knowledge',
    keywords: 'contents toc outline headings index',
    hint: "The page's headings, linked",
    action: { kind: 'block', block: 'toc' },
  },
  {
    id: 'table',
    label: 'Table',
    group: 'Layout',
    keywords: 'grid rows columns cells spreadsheet',
    hint: 'Rows and columns in the text',
    action: { kind: 'block', block: 'table' },
  },
  {
    id: 'divider',
    label: 'Divider',
    group: 'Layout',
    keywords: 'rule line hr separator',
    hint: 'A line across the page',
    action: { kind: 'block', block: 'divider' },
    markdown: '---',
  },
];

const BY_ID = new Map(SLASH_ITEMS.map((item) => [item.id, item]));
/** The entry of `id`, or undefined when the menu has none (a Recent pick since taken out). */
export const slashItemById = (id: string): SlashItem | undefined => BY_ID.get(id);
