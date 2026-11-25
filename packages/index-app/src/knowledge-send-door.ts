// Send to Knowledge Base at liveknowledge's side (liveworkspace/docs/specs/004-index/send-to-knowledge.md "The
// section"; blueprint "liveknowledge"): the index calls, with the app's key and the person's grant (X-Index-Grant),
//
//   POST /api/internal/items/:id/knowledge-send   KnowledgeSendDoorCall  → 200 KnowledgeSendDoorAnswer
//
// The door checks the grant itself before anything is read or written: for this item, of the person the call names,
// an Editor's on the whole item, not one in the Trash (automation-step-door.ts grantWrites). Anything less is a 403,
// which the index answers as no access. A throw is a failure, never a 500. The body carries a picture, so it is read
// to a cap first.

import {
  ITEM_GRANT_HEADER,
  KNOWLEDGE_SEND_MARKDOWN_MAX,
  KNOWLEDGE_SEND_PICTURE_BASE64_MAX,
  readKnowledgeSendDoorCall,
  type GrantClaims,
  type KnowledgeSendDoorAnswer,
  type KnowledgeSendDoorCall,
} from '@liveworkspace/index-client';
import { grantWrites, type AutomationDoorGrants } from './automation-step-door';
import { badRequest, json } from './internal-doors';

/** The most of a call's body the door reads: the picture, the Markdown, and room for the rest. */
export const KNOWLEDGE_SEND_DOOR_BYTES_MAX =
  KNOWLEDGE_SEND_PICTURE_BASE64_MAX + KNOWLEDGE_SEND_MARKDOWN_MAX * 4 + 16 * 1024;

export type KnowledgeSendHandler = (
  itemId: string,
  call: KnowledgeSendDoorCall,
  claims: GrantClaims,
  grant: string,
) => Promise<KnowledgeSendDoorAnswer>;

async function cappedJson(request: Request): Promise<unknown> {
  const declared = Number(request.headers.get('Content-Length') ?? '0');
  if (declared > KNOWLEDGE_SEND_DOOR_BYTES_MAX) return null;
  try {
    const text = await request.text();
    return text.length > KNOWLEDGE_SEND_DOOR_BYTES_MAX ? null : (JSON.parse(text) as unknown);
  } catch {
    return null;
  }
}

export async function knowledgeSendDoor(
  request: Request,
  itemId: string,
  grants: AutomationDoorGrants,
  run: KnowledgeSendHandler,
): Promise<Response> {
  const call = readKnowledgeSendDoorCall(await cappedJson(request));
  if (!call) return badRequest('invalid knowledge send');
  const grant = request.headers.get(ITEM_GRANT_HEADER);
  const claims = await grants(grant, itemId);
  if (!grant || !grantWrites(claims, call.person, itemId))
    return json({ error: 'grant_refused' }, 403);
  try {
    return json(await run(itemId, call, claims, grant));
  } catch (err) {
    console.warn('[internal] knowledge send failed', { error: String(err) });
    return json({ ok: false, code: 'failed', reason: '' } satisfies KnowledgeSendDoorAnswer);
  }
}
