// Knowledge sources from an app's side (liveworkspace/docs/specs/004-index/knowledge-sources.md "The door", "Keeping
// in step"): a source app answers an item's indexable text, and liveknowledge hears that a source changed. Each takes
// the index's key alone (internal.ts checks it first); a door without its handler is a 404.
//
//   GET  /api/internal/items/:id/knowledge-text            → { name, version, chunks }
//   POST /api/internal/items/:id/knowledge-source-changed  {app, itemId, gone?} → 202

import {
  isKnowledgeText,
  readKnowledgeSourceChange,
  type KnowledgeChunk,
  type KnowledgeSourceChange,
  type KnowledgeText,
} from '@liveworkspace/index-client';
import type { ExportQuery, ExportResult } from './internal-contract';
import { bodyOf, json, notFound } from './internal-doors';

export type KnowledgeTextResult = { status: 'ok'; text: KnowledgeText } | { status: 'not_found' };

export type KnowledgeSourceHandlers = {
  // A source app: the item's indexable text under the door's caps (knowledge-text.ts, knowledge-text-plan.ts).
  knowledgeText?: (itemId: string) => Promise<KnowledgeTextResult>;
  // liveknowledge: a source of this knowledgebase changed or went; the room owes it a read (or drops it).
  knowledgeSourceChanged?: (itemId: string, change: KnowledgeSourceChange) => Promise<unknown>;
};

const KNOWLEDGE_DOORS = new Set(['knowledge-text', 'knowledge-source-changed']);

// Whether `rest` (after `/api/internal/items/`) names one of these doors.
export const isKnowledgeSourceDoor = (rest: readonly string[]): boolean =>
  rest.length === 2 && KNOWLEDGE_DOORS.has(rest[1]!);

export async function answerKnowledgeSourceDoor(
  request: Request,
  id: string,
  door: string,
  handlers: KnowledgeSourceHandlers,
): Promise<Response> {
  if (door === 'knowledge-text' && request.method === 'GET' && handlers.knowledgeText) {
    const result = await handlers.knowledgeText(id);
    if (result.status !== 'ok') return notFound();
    // The app's own walker keeps the caps; an answer past them is a fault, never a bigger index downstream.
    if (!isKnowledgeText(result.text)) {
      console.warn('[internal] knowledge text past its caps', { id });
      return json({ error: 'invalid_text' }, 500);
    }
    return json(result.text);
  }
  if (
    door === 'knowledge-source-changed' &&
    request.method === 'POST' &&
    handlers.knowledgeSourceChanged
  ) {
    const change = readKnowledgeSourceChange(await bodyOf(request));
    if (!change) return json({ error: 'bad_request' }, 400);
    try {
      await handlers.knowledgeSourceChanged(id, change);
    } catch (err) {
      // The next change, or the daily look, catches the knowledgebase up.
      console.warn('[internal] knowledge source changed failed', { error: String(err) });
    }
    return json({ ok: true }, 202);
  }
  return notFound();
}

// A source app's `knowledgeText` handler over its export door's `file` format: the item's whole-item file read once,
// parsed, and walked by `chunksOf` (canvasKnowledgeChunks or planKnowledgeChunks). An item the app does not have, or
// a file that does not parse, is not found.
export function knowledgeTextFromExport(
  exportItem: (itemId: string, query: ExportQuery) => Promise<ExportResult>,
  chunksOf: (file: unknown) => { name: string; chunks: KnowledgeChunk[] },
): (itemId: string) => Promise<KnowledgeTextResult> {
  return async (itemId) => {
    const result = await exportItem(itemId, {
      format: 'file',
      tabId: null,
      code: null,
      appearance: null,
      ifVersion: null,
    });
    if (result.status === 'not_found' || result.status === 'unchanged') {
      return { status: 'not_found' };
    }
    if (result.status === 'empty') {
      return { status: 'ok', text: { name: '', version: result.version, chunks: [] } };
    }
    let file: unknown;
    try {
      const body =
        typeof result.body === 'string' ? result.body : new TextDecoder().decode(result.body);
      file = JSON.parse(body);
    } catch {
      return { status: 'not_found' };
    }
    const { name, chunks } = chunksOf(file);
    return { status: 'ok', text: { name, version: result.version, chunks } };
  };
}
