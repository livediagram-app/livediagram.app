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
import { documentRoom, type DocumentRoomClient } from '../document-client';
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

/** The graph compiled and its caption linked: the tab's elements, or null when the engine refuses it. */
export function graphTab(input: DiagramFromGraphInput, documentId = 'graph', tabId = 'graph') {
  const compiled = applyReplace(
    null,
    { graph: graphInputOf(input) },
    { tabId, name: input.name, log: engineLog({ documentId, tabId }) },
  );
  if ('errors' in compiled) {
    console.warn('[internal] graph refused', { code: compiled.errors[0]?.code });
    return null;
  }
  return {
    ...compiled.tab,
    elements: linkCaption(compiled.tab.elements, input.caption, input.link),
  };
}

/** The canvas's file, or null when the engine refuses the graph. */
export function graphDocumentFile(
  input: DiagramFromGraphInput,
  documentId = 'graph',
): string | null {
  const tab = graphTab(input, documentId);
  if (!tab) return null;
  return documentToEnvelopeText(
    { id: documentId, name: input.name, presentation: null },
    [tab],
    Date.now(),
  );
}

export type GraphDoorResult =
  | ImportResult
  | { status: 'ok'; id: string; tabId: string }
  | { status: 'invalid_graph' }
  | { status: 'not_found' };

/**
 * Send to Diagram's write. No `itemId`: a new canvas, `owner`'s personal item at the top of their library. With one: a
 * new tab at its end (a fresh id), or `tabId` redrawn, in the canvas's room as `owner`'s changeset (graph-tab.ts).
 * Either way the answer names the tab drawn.
 */
export async function documentFromGraph(
  env: Env,
  input: DiagramFromGraphInput,
  room: (id: string) => Pick<DocumentRoomClient, 'drawGraphTab' | 'outline'> = (id) =>
    documentRoom(env, id),
  importFile: typeof importDocumentFileFor = importDocumentFileFor,
): Promise<GraphDoorResult> {
  if (input.itemId) {
    const tabId = input.tabId ?? crypto.randomUUID();
    const tab = graphTab(input, input.itemId, tabId);
    if (!tab) return { status: 'invalid_graph' };
    const outcome = await room(input.itemId).drawGraphTab({
      tabId,
      name: input.name,
      elements: tab.elements,
      owner: input.owner,
    });
    return outcome.status === 'ok' ? { status: 'ok', id: input.itemId, tabId } : outcome;
  }
  const file = graphDocumentFile(input);
  if (file === null) return { status: 'invalid_graph' };
  const made = await importFile(env, {
    owner: input.owner,
    folderId: null,
    name: input.name,
    file,
  });
  if (made.status !== 'ok') return made;
  // The import gives the tab a fresh id: read it back, so sending again can update this tab.
  const tabId = (await room(made.id).outline()).tabs[0]?.id;
  return tabId ? { ...made, tabId } : made;
}
