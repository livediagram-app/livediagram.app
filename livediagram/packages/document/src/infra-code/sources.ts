// The parts of a tab's sources record the infrastructure import writes (docs/specs/027-repositories/diagram-sources.md
// "The tab's sources", blueprint "The sources record"): each file's fingerprint and, while they fit, its text; and
// what each node, group, heading and edge of the drawing became.

import type { DiagramSourceFile, DiagramSourceNode } from '../diagram-sources';
import type { GraphInput } from '../graph-input';
import type { Element } from '../index';
import { detectInfraFormat } from './detect';
import { PASTE_NAME } from './graph';
import { INFRA_SOURCES_MAX_STORED_CHARS } from './limits';
import type { InfraFile } from './types';

/** FNV-1a, 32 bits, over the UTF-16 code units: eight hex digits that tell an unchanged file cheaply. */
export function fingerprint(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

/** The record's files: each one's name, format and fingerprint, its text while the texts together fit (I6). */
export function sourceFiles(files: readonly InfraFile[]): DiagramSourceFile[] {
  let stored = 0;
  return files.map((file) => {
    const format = detectInfraFormat(file.name, file.text);
    const out: DiagramSourceFile = {
      name: file.name ?? PASTE_NAME[format],
      format,
      hash: fingerprint(file.text),
    };
    if (stored + file.text.length <= INFRA_SOURCES_MAX_STORED_CHARS) {
      stored += file.text.length;
      out.text = file.text;
    }
    return out;
  });
}

/** The header texts' keys: they are not nodes, so they take keys no slug can be. */
export const TITLE_KEY = '#title';
export const CAPTION_KEY = '#caption';

/** A node's record: its element and the values of the fields a re-read may update (I7). */
export function nodeRecord(el: Element): DiagramSourceNode {
  const e = el as { label?: unknown; note?: unknown; iconId?: unknown };
  return {
    el: el.id,
    ...(typeof e.label === 'string' ? { label: e.label } : {}),
    ...(typeof e.note === 'string' ? { note: e.note } : {}),
    ...(typeof e.iconId === 'string' ? { iconId: e.iconId } : {}),
  };
}

/** Each laid-out element's source key: node and group ids as themselves, the title and caption by their text. */
export function keyedElements(
  elements: readonly Element[],
  graph: GraphInput,
): Map<string, Element> {
  const ids = new Set([...graph.nodes.map((n) => n.id), ...(graph.groups ?? []).map((g) => g.id)]);
  const out = new Map<string, Element>();
  for (const el of elements) {
    if (ids.has(el.id)) out.set(el.id, el);
    else if (el.type === 'text' && graph.title && el.label === graph.title && !out.has(TITLE_KEY))
      out.set(TITLE_KEY, el);
    else if (
      el.type === 'text' &&
      graph.subtitle &&
      el.label === graph.subtitle &&
      !out.has(CAPTION_KEY)
    )
      out.set(CAPTION_KEY, el);
  }
  return out;
}

/** The edge key of an arrow pinned at both ends, as the elements it joins are named by `keyOf`. */
export function edgeKeyOf(el: Element, keyOf: (elementId: string) => string | undefined) {
  if (el.type !== 'arrow' || el.from.kind !== 'pinned' || el.to.kind !== 'pinned') return undefined;
  const from = keyOf(el.from.elementId);
  const to = keyOf(el.to.elementId);
  return from !== undefined && to !== undefined ? `${from}>${to}` : undefined;
}

/** What a fresh drawing's elements are, by source key: the record a first import saves. */
export function drawnRecord(
  elements: readonly Element[],
  graph: GraphInput,
): { nodes: Record<string, DiagramSourceNode>; edges: Record<string, string> } {
  const nodes: Record<string, DiagramSourceNode> = {};
  const keyed = keyedElements(elements, graph);
  const keyOfId = new Map<string, string>();
  for (const [key, el] of keyed) {
    nodes[key] = nodeRecord(el);
    keyOfId.set(el.id, key);
  }
  const edges: Record<string, string> = {};
  for (const el of elements) {
    const key = edgeKeyOf(el, (id) => keyOfId.get(id));
    if (key !== undefined && !Object.hasOwn(edges, key)) edges[key] = el.id;
  }
  return { nodes, edges };
}
