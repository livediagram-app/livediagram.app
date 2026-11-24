// Send to Diagram's draft from the editor (docs/specs/013-workspace/send-to-diagram.md): POST
// .../pages/<tab>/describe-diagram, the words read as a graph on this knowledgebase's AI (its key, its team's, the
// person's own, else built-in AI). The drafter the shared picker calls: the graph, or an Error whose message the
// picker shows. The route's messages are its own fixed words, never a model's or a provider's text.
import { readDiagramSendGraph } from '@liveworkspace/index-client';
import type { DiagramDrafter } from '@liveworkspace/workbench/components/send-to-diagram/send-to-diagram-entry';
import { apiFetch } from '@/lib/api/core';
import { knowledgeHeaders, knowledgeUrl, type KnowledgeCaller } from '@/lib/api/knowledge';

/** One model call of at most 3,000 tokens, asked twice at most on built-in AI. */
export const DIAGRAM_DRAFT_TIMEOUT_MS = 90_000;

const FALLBACK = "Couldn't read the words as a diagram. Check your connection and try again.";

export function diagramDrafter(who: KnowledgeCaller, documentId: string): DiagramDrafter {
  return async ({ tabId, words, kind }) => {
    if (!tabId) throw new Error('Open a page first.');
    let res: Response;
    try {
      res = await apiFetch(
        knowledgeUrl(documentId, `pages/${encodeURIComponent(tabId)}/describe-diagram`),
        {
          method: 'POST',
          headers: await knowledgeHeaders(who, true),
          body: JSON.stringify({ words, kind }),
          signal: AbortSignal.timeout(DIAGRAM_DRAFT_TIMEOUT_MS),
        },
      );
    } catch {
      throw new Error(FALLBACK);
    }
    const read = (await res.json().catch(() => null)) as {
      graph?: unknown;
      message?: unknown;
    } | null;
    if (res.ok) {
      const graph = readDiagramSendGraph(read?.graph);
      if (graph) return graph;
      throw new Error(FALLBACK);
    }
    const message =
      typeof read?.message === 'string' && read.message.length < 300 ? read.message : FALLBACK;
    throw new Error(message);
  };
}
