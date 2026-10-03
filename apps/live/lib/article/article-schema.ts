// The writing's ProseMirror schema (docs/specs/007-editor/article-pages.md "Blocks"): one node type
// per block type, each top-level and flat (a list item is a block with a level, not a nested
// list), every one carrying its block id, so the writing converts to and from `ArticleBlock`s one to
// one (article-convert.ts). The DOM each node draws carries the classes the writing's stylesheet
// (article-styles.ts) styles; nothing here is user HTML.
import { Schema, type DOMOutputSpec, type Mark, type Node as PMNode } from 'prosemirror-model';
import {
  ARTICLE_ALIGNS,
  ARTICLE_LIST_KINDS,
  ARTICLE_PARAGRAPH_STYLES,
  isArticleHex,
  isSafeArticleHref,
  type ArticleAlign,
  type ArticleListKind,
  type ArticleParagraphStyle,
} from '@livediagram/document';

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
            const style = (el as HTMLElement).getAttribute('data-article-style');
            return {
              style: ARTICLE_PARAGRAPH_STYLES.includes(style as ArticleParagraphStyle)
                ? style
                : 'body',
              align: readAlign(el as HTMLElement),
            };
          },
        },
        ...['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote'].map((tag) => ({
          tag,
          getAttrs: (el: HTMLElement) => ({ style: tagStyle(tag), align: readAlign(el) }),
        })),
        { tag: 'p', getAttrs: (el) => ({ align: readAlign(el as HTMLElement) }) },
      ],
      toDOM(node): DOMOutputSpec {
        const style = node.attrs.style as ArticleParagraphStyle;
        return [
          PARAGRAPH_TAG[style] ?? 'p',
          {
            class: `article-block article-${style}`,
            'data-article-style': style,
            'data-block-id': node.attrs.id,
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
            const e = el as HTMLElement;
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
            const e = el as HTMLElement;
            let level = 0;
            for (let p = e.parentElement?.parentElement; p; p = p.parentElement) {
              if (p.tagName === 'UL' || p.tagName === 'OL') level++;
            }
            const checkbox = e.querySelector(':scope > input[type=checkbox]');
            return {
              list: checkbox ? 'todo' : e.parentElement?.tagName === 'OL' ? 'numbered' : 'bullet',
              level: Math.min(4, level),
              checked: checkbox instanceof HTMLInputElement && checkbox.checked,
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
            'data-block-id': node.attrs.id,
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
            'data-block-id': node.attrs.id,
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
          { class: 'article-block article-divider', 'data-block-id': node.attrs.id },
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
            'data-block-id': node.attrs.id,
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
            'data-block-id': node.attrs.id,
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
            const href = (el as HTMLElement).getAttribute('href');
            return isSafeArticleHref(href) ? { href } : false;
          },
        },
      ],
      toDOM: (mark: Mark): DOMOutputSpec => [
        'a',
        { href: mark.attrs.href, class: 'article-link', rel: 'noopener noreferrer nofollow' },
        0,
      ],
    },
    bold: {
      parseDOM: [
        { tag: 'strong' },
        {
          tag: 'b',
          // Google Docs wraps a whole paste in <b style="font-weight:normal">.
          getAttrs: (el) => (el as HTMLElement).style.fontWeight !== 'normal' && null,
        },
        {
          style: 'font-weight',
          getAttrs: (v) => /^(bold(er)?|[6-9]\d{2,})$/.test(v as string) && null,
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
          'data-note-id': mark.attrs.id,
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

/** Whether a node is one of the text blocks (a paragraph or a list item). */
export const isTextNode = (node: PMNode): boolean =>
  node.type === articleSchema.nodes.paragraph || node.type === articleSchema.nodes.list_item;

/** A colour a mark may carry: a hex, never anything that could reach CSS otherwise. */
export const safeMarkColor = (c: unknown): string | null => (isArticleHex(c) ? c : null);
