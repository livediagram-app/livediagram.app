// The writing's ProseMirror schema (docs/specs/007-editor/document-pages.md "Blocks"): one node type
// per block type, each top-level and flat (a list item is a block with a level, not a nested
// list), every one carrying its block id, so the writing converts to and from `DocBlock`s one to
// one (doc-convert.ts). The DOM each node draws carries the classes the writing's stylesheet
// (doc-styles.ts) styles; nothing here is user HTML.
import { Schema, type DOMOutputSpec, type Mark, type Node as PMNode } from 'prosemirror-model';
import {
  DOC_ALIGNS,
  DOC_LIST_KINDS,
  DOC_PARAGRAPH_STYLES,
  isDocHex,
  isSafeDocHref,
  type DocAlign,
  type DocListKind,
  type DocParagraphStyle,
} from '@livediagram/document';

const PARAGRAPH_TAG: Record<DocParagraphStyle, string> = {
  body: 'p',
  title: 'h1',
  subtitle: 'p',
  h1: 'h2',
  h2: 'h3',
  h3: 'h4',
  quote: 'blockquote',
};

const alignAttr = (align: DocAlign) => (align === 'left' ? {} : { 'data-align': align });

const readAlign = (el: HTMLElement): DocAlign => {
  const raw = el.getAttribute('data-align') ?? el.style.textAlign;
  return DOC_ALIGNS.includes(raw as DocAlign) ? (raw as DocAlign) : 'left';
};

// A pasted heading or quote, read as the style it is.
const tagStyle = (tag: string): DocParagraphStyle | null =>
  tag === 'h1'
    ? 'h1'
    : tag === 'h2'
      ? 'h2'
      : tag === 'h3' || tag === 'h4' || tag === 'h5' || tag === 'h6'
        ? 'h3'
        : tag === 'blockquote'
          ? 'quote'
          : null;

export const docSchema = new Schema({
  nodes: {
    doc: { content: 'block+' },
    paragraph: {
      group: 'block',
      content: 'inline*',
      attrs: { id: { default: '' }, style: { default: 'body' }, align: { default: 'left' } },
      // Its own nodes win over the generic paragraph rule for pasted headings and quotes.
      parseDOM: [
        {
          tag: '[data-doc-style]',
          getAttrs: (el) => {
            const style = (el as HTMLElement).getAttribute('data-doc-style');
            return {
              style: DOC_PARAGRAPH_STYLES.includes(style as DocParagraphStyle) ? style : 'body',
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
        const style = node.attrs.style as DocParagraphStyle;
        return [
          PARAGRAPH_TAG[style] ?? 'p',
          {
            class: `doc-block doc-${style}`,
            'data-doc-style': style,
            'data-block-id': node.attrs.id,
            ...alignAttr(node.attrs.align as DocAlign),
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
          tag: 'li[data-doc-list]',
          getAttrs: (el) => {
            const e = el as HTMLElement;
            const list = e.getAttribute('data-doc-list');
            return {
              list: DOC_LIST_KINDS.includes(list as DocListKind) ? list : 'bullet',
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
        // Its marker ("1.", "b.", "•") is a decoration the list run gives it (doc-plugins.ts).
        const { list, level, checked } = node.attrs as {
          list: DocListKind;
          level: number;
          checked: boolean;
        };
        return [
          'li',
          {
            class: `doc-block doc-list doc-list-${list}${checked ? ' doc-done' : ''}`,
            'data-block-id': node.attrs.id,
            'data-doc-list': list,
            'data-level': String(level),
            'data-checked': String(checked),
            style: `--doc-level: ${level}`,
            ...alignAttr(node.attrs.align as DocAlign),
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
          { class: 'doc-block doc-code', 'data-block-id': node.attrs.id, spellcheck: 'false' },
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
        return ['div', { class: 'doc-block doc-divider', 'data-block-id': node.attrs.id }, ['hr']];
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
            class: 'doc-block doc-page-break',
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
        // Where it was last laid out (DocZoneAt), kept as it is: the layout settle's to change.
        at: { default: null },
      },
      // Never parsed from a paste: a zone comes in only as its elements do.
      parseDOM: [],
      toDOM(node): DOMOutputSpec {
        const { zone, wrap, align, width, height } = node.attrs as Record<string, string | number>;
        return [
          'div',
          {
            class: `doc-block doc-zone doc-zone-${wrap} doc-zone-align-${align}`,
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
            return isSafeDocHref(href) ? { href } : false;
          },
        },
      ],
      toDOM: (mark: Mark): DOMOutputSpec => [
        'a',
        { href: mark.attrs.href, class: 'doc-link', rel: 'noopener noreferrer nofollow' },
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
      toDOM: (): DOMOutputSpec => ['code', { class: 'doc-inline-code' }, 0],
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
      // Only the document's own colours are kept from a paste: none are.
      parseDOM: [],
      toDOM: (mark: Mark): DOMOutputSpec => [
        'span',
        { class: 'doc-color', style: `--doc-text-color: ${mark.attrs.color}` },
        0,
      ],
    },
    highlight: {
      attrs: { color: {} },
      parseDOM: [],
      toDOM: (mark: Mark): DOMOutputSpec => [
        'mark',
        { class: 'doc-highlight', style: `--doc-highlight: ${mark.attrs.color}` },
        0,
      ],
    },
  },
});

/** Whether a node is one of the text blocks (a paragraph or a list item). */
export const isTextNode = (node: PMNode): boolean =>
  node.type === docSchema.nodes.paragraph || node.type === docSchema.nodes.list_item;

/** A colour a mark may carry: a hex, never anything that could reach CSS otherwise. */
export const safeMarkColor = (c: unknown): string | null => (isDocHex(c) ? c : null);
