// The writing's ProseMirror schema (docs/specs/007-editor/article-pages.md "Blocks"): one node type
// per block type, each top-level and flat (a list item is a block with a level, not a nested
// list), every one carrying its block id, so the writing converts to and from `ArticleBlock`s one to
// one (article-convert.ts). The DOM each node draws carries the classes the writing's stylesheet
// (article-styles.ts) styles; nothing here is user HTML.
import { Schema, type Attrs, type DOMOutputSpec, type Mark } from 'prosemirror-model';
import {
  ARTICLE_ALIGNS,
  ARTICLE_LIST_KINDS,
  ARTICLE_PARAGRAPH_STYLES,
  isArticleHex,
  isSafeArticleHref,
  type ArticleAlign,
  type ArticleListKind,
  type ArticleParagraphStyle,
} from '@livedocuments/document';

const PARAGRAPH_TAG: Record<ArticleParagraphStyle, string> = {
  body: 'p',
  title: 'h1',
  subtitle: 'p',
  h1: 'h2',
  h2: 'h3',
  h3: 'h4',
  quote: 'blockquote',
};

const alignAttr = (align: ArticleAlign) => (align === 'left' ? {} : { 'data-align': align });

const readAlign = (el: HTMLElement): ArticleAlign => {
  const raw = el.getAttribute('data-align') ?? el.style.textAlign;
  return ARTICLE_ALIGNS.includes(raw as ArticleAlign) ? (raw as ArticleAlign) : 'left';
};

// A pasted heading or quote, read as the style it is.
const tagStyle = (tag: string): ArticleParagraphStyle | null =>
  tag === 'h1'
    ? 'h1'
    : tag === 'h2'
      ? 'h2'
      : tag === 'h3' || tag === 'h4' || tag === 'h5' || tag === 'h6'
        ? 'h3'
        : tag === 'blockquote'
          ? 'quote'
          : null;

// Pasted HTML whose blocks are wrapped in another block (a quote's paragraphs, a table cell's): the
// wrapper is read through to its blocks rather than as a block of its own, which would leave it empty.
const BLOCK_TAGS = new Set([
  'P',
  'DIV',
  'H1',
  'H2',
  'H3',
  'H4',
  'H5',
  'H6',
  'UL',
  'OL',
  'PRE',
  'BLOCKQUOTE',
  'TABLE',
]);
const hasBlockChild = (el: HTMLElement): boolean =>
  Array.from(el.children).some((child) => BLOCK_TAGS.has(child.tagName));

// Word's list paragraphs (`<p style="mso-list:l0 level2 lfo1">`): no list markup, the level in the
// style and the marker typed out in a span Word marks `mso-list:Ignore`.
const WORD_MARKER = 'span[style*="mso-list:Ignore" i]';
const wordListLevel = (style: string): number => {
  const at = style.toLowerCase().indexOf('level');
  let level = 0;
  for (
    let i = at + 5;
    at >= 0 && i < style.length && style.charAt(i) >= '0' && style.charAt(i) <= '9';
    i++
  ) {
    level = level * 10 + Number(style.charAt(i));
  }
  return Math.min(4, Math.max(0, level - 1));
};
// A numbered marker is a number or a letter run then "." or ")" ("1.", "b)", "iv."); anything else
// (·, o, §, a dash) is a bullet.
const isNumberedMarker = (marker: string): boolean => {
  const last = marker.charAt(marker.length - 1);
  if (marker.length < 2 || (last !== '.' && last !== ')')) return false;
  for (let i = 0; i < marker.length - 1; i++) {
    const c = marker.charAt(i).toLowerCase();
    if (!((c >= '0' && c <= '9') || (c >= 'a' && c <= 'z'))) return false;
  }
  return true;
};

// A node's or mark's attribute, read as the schema declares it: ProseMirror types every attribute
// `any`. Anything else reads as absent, which ProseMirror fills with the attribute's default.
export const textAttr = (attrs: Attrs, key: string): string | undefined => {
  const value: unknown = attrs[key];
  return typeof value === 'string' ? value : undefined;
};
export const listAttr = (attrs: Attrs): ArticleListKind | undefined =>
  ARTICLE_LIST_KINDS.find((kind) => kind === attrs.list);
export const numberAttr = (attrs: Attrs, key: string): number | undefined => {
  const value: unknown = attrs[key];
  return typeof value === 'number' ? value : undefined;
};

export const articleSchema = new Schema({
  nodes: {
    doc: { content: 'block+' },
    paragraph: {
      group: 'block',
      content: 'inline*',
      attrs: { id: { default: '' }, style: { default: 'body' }, align: { default: 'left' } },
      // Its own nodes win over the generic paragraph rule for pasted headings and quotes.
      parseDOM: [
        {
          tag: '[data-article-style]',
          getAttrs: (el) => {
            const style = el.getAttribute('data-article-style');
            return {
              style: ARTICLE_PARAGRAPH_STYLES.includes(style as ArticleParagraphStyle)
                ? style
                : 'body',
              align: readAlign(el),
            };
          },
        },
        // A quote's own paragraphs, and Word's quote styles, are quotes.
        {
          tag: 'blockquote > p, p.MsoQuote, p.MsoIntenseQuote',
          priority: 60,
          getAttrs: (el) => ({ style: 'quote', align: readAlign(el) }),
        },
        ...['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote'].map((tag) => ({
          tag,
          getAttrs: (el: HTMLElement) =>
            tag === 'blockquote' && hasBlockChild(el)
              ? false
              : { style: tagStyle(tag), align: readAlign(el) },
        })),
        { tag: 'p', getAttrs: (el) => ({ align: readAlign(el) }) },
        // A table cell of text is a paragraph of its own, so cells never run together.
        { tag: 'td, th', getAttrs: (el) => !hasBlockChild(el) && { align: readAlign(el) } },
      ],
      toDOM(node): DOMOutputSpec {
        const style = node.attrs.style as ArticleParagraphStyle;
        return [
          PARAGRAPH_TAG[style] ?? 'p',
          {
            class: `article-block article-${style}`,
            'data-article-style': style,
            'data-block-id': textAttr(node.attrs, 'id'),
            ...alignAttr(node.attrs.align as ArticleAlign),
          },
          0,
        ];
      },
    },
    list_item: {
      group: 'block',
      content: 'inline*',
      attrs: {
        id: { default: '' },
        list: { default: 'bullet' },
        level: { default: 0 },
        checked: { default: false },
        align: { default: 'left' },
      },
      parseDOM: [
        {
          tag: 'li[data-article-list]',
          getAttrs: (el) => {
            const e = el;
            const list = e.getAttribute('data-article-list');
            return {
              list: ARTICLE_LIST_KINDS.includes(list as ArticleListKind) ? list : 'bullet',
              level: Number(e.getAttribute('data-level')) || 0,
              checked: e.getAttribute('data-checked') === 'true',
              align: readAlign(e),
            };
          },
        },
        {
          tag: 'li',
          getAttrs: (el) => {
            // A pasted list item: its kind from its list, its level from how deep it is nested.
            const e = el;
            let level = 0;
            for (let p = e.parentElement?.parentElement; p; p = p.parentElement) {
              if (p.tagName === 'UL' || p.tagName === 'OL') level++;
            }
            const checkbox = e.querySelector(':scope > input[type=checkbox]');
            // Google Docs marks a checklist item as a checkbox rather than holding one.
            const ariaBox = e.getAttribute('role') === 'checkbox';
            return {
              list:
                checkbox || ariaBox
                  ? 'todo'
                  : e.parentElement?.tagName === 'OL'
                    ? 'numbered'
                    : 'bullet',
              level: Math.min(4, level),
              checked:
                (checkbox instanceof HTMLInputElement && checkbox.checked) ||
                (ariaBox && e.getAttribute('aria-checked') === 'true'),
            };
          },
        },
        // A list item's own paragraph (Google Docs, most web pages: `<li><p>…</p></li>`) is read as
        // the item's text, not as a paragraph that would leave the item empty.
        { tag: 'li > p', priority: 60, skip: true },
        // Word's list paragraphs, their typed-out markers dropped.
        { tag: WORD_MARKER, priority: 60, ignore: true },
        // Word's empty `<o:p>` closes each paragraph; read as a block it would leave an empty one.
        { tag: 'o\\:p', priority: 60, ignore: true },
        {
          tag: 'p[style*="mso-list" i]',
          priority: 60,
          getAttrs: (el) => {
            const marker = el.querySelector(WORD_MARKER)?.textContent?.replace(/\s/g, '') ?? '';
            return {
              list: isNumberedMarker(marker) ? 'numbered' : 'bullet',
              level: wordListLevel(el.getAttribute('style') ?? ''),
              align: readAlign(el),
            };
          },
        },
      ],
      toDOM(node): DOMOutputSpec {
        // Its marker ("1.", "b.", "•") is a decoration the list run gives it (article-plugins.ts).
        const { list, level, checked } = node.attrs as {
          list: ArticleListKind;
          level: number;
          checked: boolean;
        };
        return [
          'li',
          {
            class: `article-block article-list article-list-${list}${checked ? ' article-done' : ''}`,
            'data-block-id': textAttr(node.attrs, 'id'),
            'data-article-list': list,
            'data-level': String(level),
            'data-checked': String(checked),
            style: `--article-level: ${level}`,
            ...alignAttr(node.attrs.align as ArticleAlign),
          },
          0,
        ];
      },
    },
    code_block: {
      group: 'block',
      content: 'text*',
      marks: '',
      code: true,
      defining: true,
      attrs: { id: { default: '' } },
      parseDOM: [{ tag: 'pre', preserveWhitespace: 'full' }],
      toDOM(node): DOMOutputSpec {
        return [
          'pre',
          {
            class: 'article-block article-code',
            'data-block-id': textAttr(node.attrs, 'id'),
            spellcheck: 'false',
          },
          ['code', 0],
        ];
      },
    },
    divider: {
      group: 'block',
      atom: true,
      selectable: true,
      attrs: { id: { default: '' } },
      parseDOM: [{ tag: 'hr' }],
      toDOM(node): DOMOutputSpec {
        return [
          'div',
          { class: 'article-block article-divider', 'data-block-id': textAttr(node.attrs, 'id') },
          ['hr'],
        ];
      },
    },
    page_break: {
      group: 'block',
      atom: true,
      selectable: true,
      attrs: { id: { default: '' } },
      parseDOM: [{ tag: 'div[data-page-break]' }],
      toDOM(node): DOMOutputSpec {
        return [
          'div',
          {
            class: 'article-block article-page-break',
            'data-page-break': '',
            'data-block-id': textAttr(node.attrs, 'id'),
            contenteditable: 'false',
          },
          ['span', 'Page break'],
        ];
      },
    },
    zone: {
      group: 'block',
      atom: true,
      selectable: true,
      draggable: false,
      attrs: {
        id: { default: '' },
        zone: { default: 'drawing' },
        wrap: { default: 'inline' },
        align: { default: 'center' },
        width: { default: 400 },
        height: { default: 240 },
        // Where it was last laid out (ArticleZoneAt), kept as it is: the layout settle's to change.
        at: { default: null },
      },
      // Never parsed from a paste: a zone comes in only as its elements do.
      parseDOM: [],
      toDOM(node): DOMOutputSpec {
        const { zone, wrap, align, width, height } = node.attrs as Record<string, string | number>;
        return [
          'div',
          {
            class: `article-block article-zone article-zone-${wrap} article-zone-align-${align}`,
            'data-block-id': textAttr(node.attrs, 'id'),
            'data-zone': zone,
            contenteditable: 'false',
            style: `width: ${width}px; height: ${height}px`,
          },
        ];
      },
    },
    text: { group: 'inline' },
    hard_break: {
      inline: true,
      group: 'inline',
      selectable: false,
      parseDOM: [{ tag: 'br' }],
      toDOM: () => ['br'],
    },
  },
  marks: {
    // Order is precedence: a link wraps the others.
    link: {
      attrs: { href: {} },
      inclusive: false,
      parseDOM: [
        {
          tag: 'a[href]',
          getAttrs: (el) => {
            const href = el.getAttribute('href');
            return isSafeArticleHref(href) ? { href } : false;
          },
        },
      ],
      toDOM: (mark: Mark): DOMOutputSpec => [
        'a',
        {
          href: textAttr(mark.attrs, 'href'),
          class: 'article-link',
          rel: 'noopener noreferrer nofollow',
        },
        0,
      ],
    },
    bold: {
      parseDOM: [
        { tag: 'strong' },
        {
          tag: 'b',
          // Google Docs wraps a whole paste in <b style="font-weight:normal">.
          getAttrs: (el) => el.style.fontWeight !== 'normal' && null,
        },
        {
          style: 'font-weight',
          getAttrs: (v) => /^(bold(er)?|[6-9]\d{2,})$/.test(v) && null,
        },
      ],
      toDOM: (): DOMOutputSpec => ['strong', 0],
    },
    italic: {
      parseDOM: [{ tag: 'i' }, { tag: 'em' }, { style: 'font-style=italic' }],
      toDOM: (): DOMOutputSpec => ['em', 0],
    },
    underline: {
      parseDOM: [{ tag: 'u' }, { style: 'text-decoration=underline' }],
      toDOM: (): DOMOutputSpec => ['u', 0],
    },
    strike: {
      parseDOM: [
        { tag: 's' },
        { tag: 'del' },
        { tag: 'strike' },
        { style: 'text-decoration=line-through' },
      ],
      toDOM: (): DOMOutputSpec => ['s', 0],
    },
    code: {
      excludes: '_',
      parseDOM: [{ tag: 'code' }],
      toDOM: (): DOMOutputSpec => ['code', { class: 'article-inline-code' }, 0],
    },
    sup: {
      excludes: 'sub',
      parseDOM: [{ tag: 'sup' }],
      toDOM: (): DOMOutputSpec => ['sup', 0],
    },
    sub: {
      excludes: 'sup',
      parseDOM: [{ tag: 'sub' }],
      toDOM: (): DOMOutputSpec => ['sub', 0],
    },
    color: {
      attrs: { color: {} },
      // Only the article's own colours are kept from a paste: none are.
      parseDOM: [],
      toDOM: (mark: Mark): DOMOutputSpec => [
        'span',
        { class: 'article-color', style: `--article-text-color: ${mark.attrs.color}` },
        0,
      ],
    },
    // A margin note's text (docs/specs/007-editor/article-pages.md "Comments and actions"): tinted,
    // tied by id to its marker in the page's margin. Never taken from a paste.
    note: {
      attrs: { id: {}, kind: { default: 'comment' } },
      inclusive: false,
      parseDOM: [],
      toDOM: (mark: Mark): DOMOutputSpec => [
        'span',
        {
          class: `article-note article-note-${mark.attrs.kind === 'action' ? 'action' : 'comment'}`,
          'data-note-id': textAttr(mark.attrs, 'id'),
        },
        0,
      ],
    },
    highlight: {
      attrs: { color: {} },
      parseDOM: [],
      toDOM: (mark: Mark): DOMOutputSpec => [
        'mark',
        { class: 'article-highlight', style: `--article-highlight: ${mark.attrs.color}` },
        0,
      ],
    },
  },
});

/** A colour a mark may carry: a hex, never anything that could reach CSS otherwise. */
export const safeMarkColor = (c: unknown): string | null => (isArticleHex(c) ? c : null);
