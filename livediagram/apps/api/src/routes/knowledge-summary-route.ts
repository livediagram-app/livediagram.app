// Send to Knowledge Base's summary, `POST /api/documents/:id/knowledge-summary` (docs/specs/013-workspace/
// send-to-knowledge.md "The summary"; the platform's liveworkspace/docs/specs/004-index/send-to-knowledge.md): the
// selected items described for a knowledgebase page. The summariser is the platform's (@liveworkspace/ask/server
// serveSelectionSummary); this file says who is calling and that they can read the canvas, and hands in the AI the
// way Ask AI's route does: the key that applies, else built-in AI on Ask's daily count, and with Pro on the credit
// from whoever pays for this canvas, spent once the model has answered.
import { askCreditsOf, serveSelectionSummary, spendAsk } from '@liveworkspace/ask/server';
import { personAiKey } from '@liveworkspace/auth-client/ai-key';
import { accountCredentials } from '../auth/accounts';
import { getDocumentMeta } from '../db';
import { CORS_HEADERS, methodNotAllowed } from '../responses';
import { deniedOnTab, gateRead, missingDocument, type DocumentRouteContext } from './context';
import { resolveDocumentGrant } from './document-grant';

const TAB_ID_MAX = 200;

/** The tab the selection is on, from the body, without reading the body the summariser reads. */
async function tabOf(request: Request): Promise<string | undefined> {
  const body = (await request.json().catch(() => null)) as { tabId?: unknown } | null;
  const tabId = body?.tabId;
  return typeof tabId === 'string' && tabId && tabId.length <= TAB_ID_MAX ? tabId : undefined;
}

export async function handleKnowledgeSummary(ctx: DocumentRouteContext): Promise<Response | null> {
  const { segments, request, env } = ctx;
  if (segments.length !== 4 || segments[3] !== 'knowledge-summary') return null;
  if (request.method !== 'POST') return methodNotAllowed();
  const documentId = segments[2]!;
  const doc = await getDocumentMeta(env, documentId);
  if (!doc) return missingDocument(ctx, documentId);
  // Whoever can read the items may have them summarised: the tab-scoped link's own tab alone.
  const tabId = await tabOf(request.clone());
  if (!(await gateRead(ctx, documentId, doc.ownerId, doc.teamId, tabId)))
    return deniedOnTab(ctx, doc);
  return serveSelectionSummary({
    request,
    // A signed-in account; a guest or a link visitor would spend built-in AI for strangers.
    accountId: ctx.verifiedUserId,
    itemId: documentId,
    aiKey: (teamId) => personAiKey(accountCredentials(env), ctx, teamId),
    builtIn: env.AI ?? null,
    spend: (accountId, now) => spendAsk(env.DOCUMENT_ROOM, accountId, now),
    // Null with Pro off: no grant is read and the subscription service is never asked.
    credits: askCreditsOf({
      env,
      app: 'livediagram.app',
      rooms: env.DOCUMENT_ROOM,
      teams: ctx.teams,
      grant: (itemId) => resolveDocumentGrant(ctx, itemId),
    }),
    headers: CORS_HEADERS,
  });
}
