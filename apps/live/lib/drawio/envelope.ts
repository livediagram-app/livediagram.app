// From whatever the person handed us to the pages of a draw.io diagram
// (docs/specs/020-import-export/blueprints/drawio-import.md step 2). The
// content is sniffed, never the file name: an mxfile, a bare mxGraphModel,
// an SVG carrying one in `content`, or a PNG carrying one in a text chunk.

import { BudgetExceeded, base64Bytes, decompressDiagram, type ByteBudget } from './inflate';
import { extractPngDiagram, isPng } from './png';
import { DrawioRefused } from './refusals';

export type DrawioInput = { kind: 'text'; text: string } | { kind: 'bytes'; bytes: Uint8Array };

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

export async function readDrawioPages(
  input: DrawioInput,
  budget: ByteBudget,
): Promise<DrawioPageSource[]> {
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
  return pagesOf(parseXml(text), budget, 0);
}
