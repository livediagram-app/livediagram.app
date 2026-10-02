// From whatever the person handed us to the pages of a draw.io diagram
// (docs/specs/020-import-export/blueprints/drawio-import.md step 2). The
// content is sniffed, never the file name: an mxfile, a bare mxGraphModel,
// an SVG carrying one in `content`, or a PNG carrying one in a text chunk.

import { BudgetExceeded, base64Bytes, decompressDiagram, type ByteBudget } from './inflate';
import { extractPngDiagram, isPng } from './png';
import { DrawioRefused } from './refusals';

export type DrawioInput = { kind: 'text'; text: string } | { kind: 'bytes'; bytes: Uint8Array };

/** What the file says about itself: the mxfile's `name` and `modified` (ISO) attributes. */
export type DrawioMeta = { name?: string; modified?: string };

export type DrawioSource = { pages: DrawioPageSource[]; meta: DrawioMeta };

export type DrawioPageSource = {
  id: string;
  name: string;
  /** The page's `mxGraphModel`; null for a page with no content. */
  model: Element | null;
};

function parseXml(text: string): Element {
  const trimmed = text.replace(/^\uFEFF/, '').trim();
  if (!trimmed.startsWith('<')) throw new DrawioRefused('not-xml');
  const doc = new DOMParser().parseFromString(trimmed, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length > 0) throw new DrawioRefused('not-xml');
  return doc.documentElement;
}

const childElements = (el: Element, localName: string) =>
  Array.from(el.children).filter((c) => c.localName === localName);

async function pageModel(
  diagram: Element,
  label: string,
  budget: ByteBudget,
): Promise<Element | null> {
  const inline = childElements(diagram, 'mxGraphModel')[0];
  if (inline) return inline;
  const body = diagram.textContent?.trim() ?? '';
  if (body === '') return null;
  try {
    const model = parseXml(await decompressDiagram(body, budget));
    if (model.localName !== 'mxGraphModel') throw new Error('not a model');
    return model;
  } catch (error) {
    if (error instanceof BudgetExceeded) throw new DrawioRefused('too-large');
    throw new DrawioRefused('page-unreadable', label);
  }
}

async function pagesOf(
  root: Element,
  budget: ByteBudget,
  depth: number,
): Promise<DrawioPageSource[]> {
  switch (root.localName) {
    case 'mxGraphModel':
      return [{ id: 'page-1', name: '', model: root }];
    case 'mxfile': {
      const diagrams = childElements(root, 'diagram');
      if (diagrams.length === 0) throw new DrawioRefused('no-pages');
      const pages: DrawioPageSource[] = [];
      for (const [i, diagram] of diagrams.entries()) {
        const name = diagram.getAttribute('name') ?? '';
        pages.push({
          id: diagram.getAttribute('id') || `page-${i + 1}`,
          name,
          model: await pageModel(diagram, name || `Page ${i + 1}`, budget),
        });
      }
      return pages;
    }
    case 'svg': {
      const content = root.getAttribute('content')?.trim() ?? '';
      if (content === '' || depth > 0) throw new DrawioRefused('svg-without-diagram');
      let inner = content;
      if (!inner.startsWith('<')) {
        try {
          inner = new TextDecoder('utf-8').decode(base64Bytes(inner));
        } catch {
          throw new DrawioRefused('svg-without-diagram');
        }
        if (!inner.trim().startsWith('<')) throw new DrawioRefused('svg-without-diagram');
      }
      return pagesOf(parseXml(inner), budget, depth + 1);
    }
    default:
      throw new DrawioRefused('not-drawio');
  }
}

function metaOf(root: Element): DrawioMeta {
  const file = root.localName === 'mxfile' ? root : null;
  const name = file?.getAttribute('name')?.trim();
  const modified = file?.getAttribute('modified')?.trim();
  return { ...(name ? { name } : {}), ...(modified ? { modified } : {}) };
}

// The root an SVG carries in `content`: what its meta is read from.
function metaRoot(root: Element): Element {
  if (root.localName !== 'svg') return root;
  const content = root.getAttribute('content')?.trim() ?? '';
  try {
    const inner = content.startsWith('<')
      ? content
      : new TextDecoder('utf-8').decode(base64Bytes(content));
    return parseXml(inner);
  } catch {
    return root;
  }
}

export async function readDrawioSource(
  input: DrawioInput,
  budget: ByteBudget,
): Promise<DrawioSource> {
  let text: string;
  if (input.kind === 'bytes') {
    if (isPng(input.bytes)) {
      let embedded: string | null;
      try {
        embedded = await extractPngDiagram(input.bytes, budget);
      } catch (error) {
        if (error instanceof BudgetExceeded) throw new DrawioRefused('too-large');
        embedded = null;
      }
      if (embedded === null) throw new DrawioRefused('png-without-diagram');
      text = embedded;
    } else {
      text = new TextDecoder('utf-8').decode(input.bytes);
    }
  } else {
    text = input.text;
  }
  const root = parseXml(text);
  const pages = await pagesOf(root, budget, 0);
  return { pages, meta: metaOf(metaRoot(root)) };
}

/** How much of a file the sniff reads: room for a BOM, an XML declaration and the root element. */
export const DRAWIO_SNIFF_CHARS = 4096;

/**
 * What a file is, by its content alone (never its name: a Drive save has no extension): a draw.io
 * diagram, a draw.io library, or neither. Cheap: the PNG signature, or the first few KB as text.
 */
export function sniffDrawio(input: DrawioInput): 'diagram' | 'library' | null {
  if (input.kind === 'bytes' && isPng(input.bytes)) return 'diagram';
  const head = (
    input.kind === 'bytes'
      ? new TextDecoder('utf-8').decode(input.bytes.subarray(0, DRAWIO_SNIFF_CHARS))
      : input.text.slice(0, DRAWIO_SNIFF_CHARS)
  )
    .replace(/^\uFEFF/, '')
    .trimStart();
  // draw.io's JSON export opens with its version (a long `data` may push `pages` past the head).
  if (head.startsWith('{')) {
    const exported =
      /^\{\s*"version"\s*:\s*"\d+(?:\.\d+)*"/.test(head) || /^\{[^{}]*"pages"\s*:/.test(head);
    return exported ? 'diagram' : null;
  }
  const root = rootTagOf(head);
  if (!root) return null;
  if (root.tag === 'mxlibrary') return 'library';
  if (root.tag === 'mxfile' || root.tag === 'mxGraphModel') return 'diagram';
  if (root.tag === 'svg' && /\scontent\s*=/.test(root.attrs)) return 'diagram';
  return null;
}

const isSpace = (ch: string | undefined) =>
  ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r' || ch === '\f';
const isNameChar = (ch: string) => /[\w:.-]/.test(ch);

// What may come before the root element, each skipped to its close: a declaration or processing
// instruction, a comment, a doctype (after the comment, which it would otherwise match).
const SKIPPED_BEFORE_ROOT: readonly (readonly [open: string, close: string])[] = [
  ['<?', '?>'],
  ['<!--', '-->'],
  ['<!', '>'],
];

/**
 * The root element of an XML head: its tag name and the rest of its opening tag. Skips whitespace,
 * XML declarations and processing instructions, comments and a doctype with `indexOf`, so it reads
 * any head in linear time; null when the head ends first or holds no element.
 */
export function rootTagOf(head: string): { tag: string; attrs: string } | null {
  let i = 0;
  for (;;) {
    while (isSpace(head[i])) i++;
    const skip = SKIPPED_BEFORE_ROOT.find(([open]) => head.startsWith(open, i));
    if (!skip) break;
    const end = head.indexOf(skip[1], i + skip[0].length);
    if (end < 0) return null;
    i = end + skip[1].length;
  }
  if (head[i] !== '<' || !/[A-Za-z]/.test(head[i + 1] ?? '')) return null;
  let j = i + 1;
  while (j < head.length && isNameChar(head[j]!)) j++;
  const close = head.indexOf('>', j);
  return { tag: head.slice(i + 1, j), attrs: head.slice(j, close < 0 ? head.length : close) };
}
