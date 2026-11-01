// A contents block in the writing as drawn (docs/specs/007-editor/article-pages.md "Table of contents"):
// "Contents", then a line per heading with the page it falls on, drawn from the writing and its layout,
// never stored. The entries follow the writing on every change (tocPlugin); the page numbers follow the
// layout, measured a frame after it settles (measureTocPages). A press on an entry goes to its heading.
import { Plugin, PluginKey, type EditorState, type Transaction } from 'prosemirror-state';
import { Decoration, DecorationSet, type EditorView, type NodeView } from 'prosemirror-view';
import type { Node as PMNode } from 'prosemirror-model';
import {
  articleTocEntries,
  tocDepthOf,
  type ArticleTocDepth,
  type ArticleTocEntry,
} from '@livedocuments/document';
import { debugLog } from '@liveworkspace/workbench/lib/debug-log';
import { articleSchema } from './article-schema';

const S = articleSchema;

/** Each heading's page in its article (0 the first), by block id. */
export type TocPages = ReadonlyMap<string, number>;

type TocState = { pages: TocPages; decos: DecorationSet };

export const tocKey = new PluginKey<TocState>('article-toc');

// The doc's headings, as the contents lists them (every level; each block filters by its depth).
function headingsOf(doc: PMNode): ArticleTocEntry[] {
  const blocks: { id: string; type: string; style?: string; runs: { text: string }[] }[] = [];
  doc.forEach((node) => {
    if (node.type !== S.nodes.paragraph) return;
    const style = node.attrs.style as string;
    if (style !== 'h1' && style !== 'h2' && style !== 'h3') return;
    blocks.push({
      id: node.attrs.id as string,
      type: 'paragraph',
      style,
      runs: [{ text: node.textContent }],
    });
  });
  return articleTocEntries(blocks, 3);
}

/** What one contents block shows: its entries, each with its page number (1 the first), or none. */
export type TocLine = ArticleTocEntry & { page: number | null };

function decorationsOf(doc: PMNode, pages: TocPages): DecorationSet {
  let any = false;
  doc.forEach((node) => {
    if (node.type === S.nodes.toc) any = true;
  });
  if (!any) return DecorationSet.empty;
  const headings = headingsOf(doc);
  const decos: Decoration[] = [];
  doc.forEach((node, pos) => {
    if (node.type !== S.nodes.toc) return;
    const depth = tocDepthOf(node.attrs);
    const lines: TocLine[] = headings
      .filter((h) => h.level <= depth)
      .map((h) => {
        const page = pages.get(h.id);
        return { ...h, page: page === undefined ? null : page + 1 };
      });
    decos.push(Decoration.node(pos, pos + node.nodeSize, {}, { tocLines: lines }));
  });
  return DecorationSet.create(doc, decos);
}

const samePages = (a: TocPages, b: TocPages) =>
  a.size === b.size && [...a].every(([id, p]) => b.get(id) === p);

/** The contents blocks' entries and pages: rebuilt on a change to the writing or to the pages measured,
 *  kept as they are otherwise (a caret moving changes nothing). */
export const tocPlugin = new Plugin<TocState>({
  key: tocKey,
  state: {
    init: (_c, state) => ({ pages: new Map(), decos: decorationsOf(state.doc, new Map()) }),
    apply(tr: Transaction, value: TocState, _old: EditorState, state: EditorState): TocState {
      const pages = tr.getMeta(tocKey) as TocPages | undefined;
      if (pages && !samePages(pages, value.pages))
        return { pages, decos: decorationsOf(state.doc, pages) };
      if (!tr.docChanged) return value;
      return { pages: value.pages, decos: decorationsOf(state.doc, value.pages) };
    },
  },
  props: {
    decorations: (state) => tocKey.getState(state)?.decos ?? DecorationSet.empty,
  },
});

/** Whether the writing holds a contents block (only then are headings' pages measured). */
export function hasToc(state: EditorState): boolean {
  return (tocKey.getState(state)?.decos ?? DecorationSet.empty) !== DecorationSet.empty;
}

/**
 * Each heading's page as laid out now (its first line's column), dispatched when it changed (meta only).
 * `pageOf` maps a screen x to the page's index among the article's pages.
 */
export function measureTocPages(view: EditorView, pageOf: (screenX: number) => number): void {
  if (!hasToc(view.state)) return;
  const next = headingPages(view, pageOf);
  const was = tocKey.getState(view.state)?.pages ?? new Map();
  if (samePages(was, next)) return;
  debugLog('[article-toc] pages', { headings: next.size });
  view.dispatch(view.state.tr.setMeta(tocKey, next).setMeta('addToHistory', false));
}

/** Every heading's page (0 the first), by its first line's place on screen. */
export function headingPages(view: EditorView, pageOf: (screenX: number) => number): TocPages {
  const out = new Map<string, number>();
  view.dom
    .querySelectorAll<HTMLElement>(
      ':scope > h2[data-block-id], :scope > h3[data-block-id], :scope > h4[data-block-id]',
    )
    .forEach((el) => {
      const r = el.getClientRects()[0];
      if (r && el.dataset.blockId) out.set(el.dataset.blockId, pageOf(r.left + 1));
    });
  return out;
}

const DEPTHS: { depth: ArticleTocDepth; label: string; name: string }[] = [
  { depth: 1, label: 'H1', name: 'List Heading 1 only' },
  { depth: 2, label: 'H1 to H2', name: 'List Heading 1 to Heading 2' },
  { depth: 3, label: 'H1 to H3', name: 'List Heading 1 to Heading 3' },
];

/** The contents block's host: what this person may do, and where an entry goes. */
export type TocHost = {
  editable: () => boolean;
  reshape: () => boolean;
  onJump: (headingId: string) => void;
};

const linesOf = (decorations: readonly Decoration[]): readonly TocLine[] =>
  decorations.map((d) => (d.spec as { tocLines?: TocLine[] }).tocLines).find((l) => !!l) ?? [];

export class TocView implements NodeView {
  dom: HTMLElement;
  private node: PMNode;
  private signature = '';
  private view: EditorView;
  private getPos: () => number | undefined;
  private host: TocHost;

  constructor(
    node: PMNode,
    view: EditorView,
    getPos: () => number | undefined,
    decorations: readonly Decoration[],
    host: TocHost,
  ) {
    this.node = node;
    this.view = view;
    this.getPos = getPos;
    this.host = host;
    this.dom = document.createElement('nav');
    this.dom.className = 'article-block article-toc';
    this.dom.setAttribute('aria-label', 'Contents');
    this.dom.setAttribute('contenteditable', 'false');
    this.dom.addEventListener('click', this.onClick);
    this.render(linesOf(decorations));
  }

  update(node: PMNode, decorations: readonly Decoration[]): boolean {
    if (node.type !== this.node.type) return false;
    this.node = node;
    this.render(linesOf(decorations));
    return true;
  }

  private render(lines: readonly TocLine[]): void {
    const depth = tocDepthOf(this.node.attrs);
    const editable = this.host.editable();
    const reshape = editable && this.host.reshape();
    const signature = JSON.stringify([lines, depth, editable, reshape, this.node.attrs.id]);
    if (signature === this.signature) return;
    this.signature = signature;
    const id = this.node.attrs.id as string;
    if (id) this.dom.dataset.blockId = id;
    this.dom.dataset.depth = String(depth);
    const doc = this.dom.ownerDocument;
    const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, text?: string) => {
      const e = doc.createElement(tag);
      e.className = cls;
      if (text !== undefined) e.textContent = text;
      return e;
    };
    const parts: HTMLElement[] = [el('div', 'article-toc-title', 'Contents')];
    if (reshape) {
      const chips = el('div', 'article-toc-depth article-chrome');
      chips.setAttribute('role', 'group');
      chips.setAttribute('aria-label', 'Heading levels');
      for (const d of DEPTHS) {
        const b = el('button', 'article-toc-chip', d.label);
        b.type = 'button';
        b.dataset.tocDepth = String(d.depth);
        b.setAttribute('aria-pressed', String(d.depth === depth));
        b.setAttribute('aria-label', d.name);
        b.title = d.name;
        chips.appendChild(b);
      }
      parts.push(chips);
    }
    if (lines.length === 0) {
      if (editable)
        parts.push(el('p', 'article-toc-empty article-chrome', 'Headings you add are listed here'));
    } else {
      const list = el('div', 'article-toc-list');
      list.setAttribute('role', 'list');
      for (const line of lines) {
        const b = el('button', 'article-toc-entry');
        b.type = 'button';
        b.setAttribute('role', 'listitem');
        b.dataset.tocTarget = line.id;
        b.style.setProperty('--toc-level', String(line.level - 1));
        b.setAttribute(
          'aria-label',
          line.page === null ? line.text : `${line.text}, page ${line.page}`,
        );
        b.append(
          el('span', 'article-toc-text', line.text),
          el('span', 'article-toc-leader'),
          el('span', 'article-toc-page', line.page === null ? '' : String(line.page)),
        );
        list.appendChild(b);
      }
      parts.push(list);
    }
    this.dom.replaceChildren(...parts);
  }

  private onClick = (e: MouseEvent): void => {
    const target = e.target as Element | null;
    const chip = target?.closest?.<HTMLElement>('[data-toc-depth]');
    if (chip) {
      e.preventDefault();
      const pos = this.getPos();
      if (pos === undefined || !this.host.reshape()) return;
      const depth = Number(chip.dataset.tocDepth);
      this.view.dispatch(this.view.state.tr.setNodeAttribute(pos, 'depth', depth));
      return;
    }
    const entry = target?.closest?.<HTMLElement>('[data-toc-target]');
    if (entry?.dataset.tocTarget) {
      e.preventDefault();
      this.host.onJump(entry.dataset.tocTarget);
    }
  };

  // Its buttons are its own: a press on one never selects the block or moves the caret.
  stopEvent(e: Event): boolean {
    return !!(e.target as Element | null)?.closest?.('button');
  }

  ignoreMutation(): boolean {
    return true;
  }

  destroy(): void {
    this.dom.removeEventListener('click', this.onClick);
  }
}
