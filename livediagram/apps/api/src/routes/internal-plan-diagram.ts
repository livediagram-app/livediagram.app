// View As Diagram's door (liveworkspace/docs/specs/004-index/diagrams-and-plans.md "The doors"; docs/specs/015-api/api.md
// "Internal"): a liveplanner board's graph drawn as a canvas. The graph is compiled as the MCP's graph input is
// (edit-operations `applyReplace`, the lanes layout flowing right), then its ids are made the plan's own: a card's box
// `card:<lane>:<card>`, a lane `lane:<lane>`, a Blocked By arrow `dep:<blocker>:<card>`, the heading and caption fixed
// ones. So a redraw changes only what moved, and the editor tells the plan's arrows and lanes from ones a person drew
// (make-plan-cards.md "Changes to the plan"). Without `itemId` it is a new canvas of `owner`'s, written through the
// import door's path; with one, that tab redrawn in the canvas's room as `owner`'s changeset.
import {
  documentToEnvelopeText,
  type Element,
  type GraphInput,
} from '@livediagram/document';
import { applyReplace } from '@livediagram/edit-operations';
import type { PlanDiagramDrawResult } from '@liveworkspace/index-app';
import {
  planCardElementId,
  planDepElementId,
  planLaneElementId,
  readPlanElementId,
  type PlanDiagramDraw,
} from '@liveworkspace/index-client';
import { engineLog } from '../changesets/log';
import { documentRoom, type DocumentRoomClient } from '../document-client';
import type { Env } from '../types';
import { importDocumentFileFor } from './internal-file';

export const PLAN_TITLE_ID = 'plan:title';
export const PLAN_CAPTION_ID = 'plan:caption';

/** The board's graph as livediagram's graph input takes it: lanes as groups, the critical path strong and thick. */
export function planGraphInput(draw: PlanDiagramDraw): GraphInput {
  const { graph } = draw;
  const nodeId = new Map(graph.nodes.map((n) => [n.card, planCardElementId(n.lane, n.card)]));
  return {
    title: graph.title,
    subtitle: draw.caption,
    style: 'lanes',
    direction: 'right',
    nodes: graph.nodes.map((n) => ({
      id: nodeId.get(n.card)!,
      label: n.label,
      link: n.link,
      group: planLaneElementId(n.lane),
      ...(n.critical ? { tone: 'strong' as const } : n.done ? { tone: 'muted' as const } : {}),
    })),
    edges: graph.edges.map((e) => ({
      from: nodeId.get(e.from)!,
      to: nodeId.get(e.to)!,
      ...(e.critical ? { line: 'thick' as const } : {}),
    })),
    groups: graph.lanes.map((l) => ({ id: planLaneElementId(l.id), label: l.label })),
  };
}

/** The compiled drawing with the plan's ids: arrows between two cards' boxes, the heading and its caption. */
export function withPlanIds(elements: readonly Element[], draw: PlanDiagramDraw): Element[] {
  const cardOf = (id: string) => {
    const read = readPlanElementId(id);
    return read?.kind === 'card' ? read.card : null;
  };
  let titled = false;
  let captioned = false;
  return elements.map((el) => {
    if (el.type === 'arrow' && el.from.kind === 'pinned' && el.to.kind === 'pinned') {
      const from = cardOf(el.from.elementId);
      const to = cardOf(el.to.elementId);
      return from && to ? { ...el, id: planDepElementId(from, to) } : el;
    }
    if (el.type !== 'text') return el;
    const label = (el as { label?: unknown }).label;
    if (!titled && label === draw.graph.title) {
      titled = true;
      return { ...el, id: PLAN_TITLE_ID };
    }
    if (!captioned && label === draw.caption) {
      captioned = true;
      // The caption opens the plan's board.
      return { ...el, id: PLAN_CAPTION_ID, link: { kind: 'url', url: draw.link } };
    }
    return el;
  });
}

/** The drawn tab, or null when the engine refuses the graph. */
export function planDiagramTab(draw: PlanDiagramDraw, documentId = 'plan', tabId = 'plan') {
  // An empty board draws its heading alone.
  const compiled = applyReplace(
    null,
    { graph: planGraphInput(draw) },
    { tabId, name: draw.graph.title || draw.name, log: engineLog({ documentId, tabId }) },
  );
  if ('errors' in compiled) {
    console.warn('[internal] plan diagram refused', { code: compiled.errors[0]?.code });
    return null;
  }
  return { ...compiled.tab, elements: withPlanIds(compiled.tab.elements, draw) };
}

type Room = Pick<DocumentRoomClient, 'drawPlanTab' | 'outline'>;

export async function documentFromPlan(
  env: Env,
  draw: PlanDiagramDraw,
  room: (id: string) => Room = (id) => documentRoom(env, id),
  importFile: typeof importDocumentFileFor = importDocumentFileFor,
): Promise<PlanDiagramDrawResult> {
  if (draw.itemId && draw.tabId) {
    const tab = planDiagramTab(draw, draw.itemId, draw.tabId);
    if (!tab) return { status: 'invalid_graph' };
    const outcome = await room(draw.itemId).drawPlanTab({
      tabId: draw.tabId,
      elements: tab.elements,
      owner: draw.owner,
    });
    return outcome.status === 'ok' ? { status: 'ok', id: draw.itemId, tabId: draw.tabId } : outcome;
  }
  const tab = planDiagramTab(draw);
  if (!tab) return { status: 'invalid_graph' };
  const file = documentToEnvelopeText({ id: 'plan', name: draw.name, presentation: null }, [tab], Date.now());
  const made = await importFile(env, { owner: draw.owner, folderId: null, name: draw.name, file });
  if (made.status === 'too_large') return { status: 'too_large' };
  if (made.status !== 'ok') return { status: 'invalid_graph' };
  // The import gives the tab a fresh id: read it back, so the plan can redraw this tab.
  const tabId = (await room(made.id).outline()).tabs[0]?.id;
  return tabId ? { status: 'ok', id: made.id, tabId } : { status: 'not_found' };
}
