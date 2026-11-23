// The graph door (liveworkspace/docs/specs/004-index/send-to-diagram.md; docs/specs/015-api/api.md "Internal"): Send to
// Diagram's new canvas for `owner`, drawn from a graph another app's AI drafted. The graph is compiled as the MCP's graph
// input is (edit-operations `applyReplace`: shapes, pinned arrows, frames for groups, the auto layout), its caption
// linked back to the words' place, then written as a `.livediagram` file through the import door's path, so every
// check, cap and undo the import has applies.
import { documentToEnvelopeText, type Element, type GraphInput } from '@livediagram/document';
import { applyReplace } from '@livediagram/edit-operations';
import type { DiagramFromGraphInput } from '@liveworkspace/index-client';
import type { ImportResult } from '@liveworkspace/index-app';
import { engineLog } from '../changesets/log';
import { importDocumentFileFor } from './internal-file';
import type { Env } from '../types';

/** The graph as livediagram's graph input takes it. */
export function graphInputOf(input: DiagramFromGraphInput): GraphInput {
  const { graph } = input;
  return {
    ...(graph.title ? { title: graph.title } : {}),
    subtitle: input.caption,
    ...(graph.style ? { style: graph.style } : {}),
    ...(graph.direction ? { direction: graph.direction } : {}),
    nodes: graph.nodes.map((n) => ({
      id: n.id,
      label: n.label,
      ...(n.shape ? { shape: n.shape } : {}),
      ...(n.note ? { note: n.note } : {}),
      ...(n.role ? { role: n.role } : {}),
      ...(n.group ? { group: n.group } : {}),
    })),
    edges: graph.edges.map((e) => ({
      from: e.from,
      to: e.to,
      ...(e.label ? { label: e.label } : {}),
      ...(e.line ? { line: e.line } : {}),
    })),
    ...(graph.groups ? { groups: graph.groups.map((g) => ({ id: g.id, label: g.label })) } : {}),
  };
}

/** The caption's text element links back to the words' place: the one text whose label is the caption. */
export function linkCaption(elements: readonly Element[], caption: string, url: string): Element[] {
  let linked = false;
  return elements.map((el) => {
    if (linked || el.type !== 'text' || (el as { label?: unknown }).label !== caption) return el;
    linked = true;
    return { ...el, link: { kind: 'url', url } };
  });
}

/** The canvas's file, or null when the engine refuses the graph. */
export function graphDocumentFile(
  input: DiagramFromGraphInput,
  documentId = 'graph',
): string | null {
  const tabId = 'graph';
  const compiled = applyReplace(
    null,
    { graph: graphInputOf(input) },
    { tabId, name: input.name, log: engineLog({ documentId, tabId }) },
  );
  if ('errors' in compiled) {
    console.warn('[internal] graph refused', { code: compiled.errors[0]?.code });
    return null;
  }
  const tab = {
    ...compiled.tab,
    elements: linkCaption(compiled.tab.elements, input.caption, input.link),
  };
  return documentToEnvelopeText(
    { id: documentId, name: input.name, presentation: null },
    [tab],
    Date.now(),
  );
}

export type GraphDoorResult = ImportResult | { status: 'invalid_graph' };

/** The new canvas, as `owner`'s personal item at the top of their library. */
export async function documentFromGraph(
  env: Env,
  input: DiagramFromGraphInput,
): Promise<GraphDoorResult> {
  const file = graphDocumentFile(input);
  if (file === null) return { status: 'invalid_graph' };
  return importDocumentFileFor(env, { owner: input.owner, folderId: null, name: input.name, file });
}
