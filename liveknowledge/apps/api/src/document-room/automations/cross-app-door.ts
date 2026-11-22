// A rule's step from another app on this knowledgebase (docs/specs/013-workspace/automations.md "Steps in other
// apps"; liveworkspace blueprint cross-app.md "The door"): Write a Page in a Knowledgebase, as the rule's author,
// through the knowledgebase's own create_page route (routes/knowledge-agent-routes.ts) with the author's grant, so the
// page is made, placed and told to everyone with the knowledgebase open exactly as an Editor's is. The request says
// it is a rule's (`automation` on its identity): the page is stamped Written by Automation with the rule and the item
// it came from, its Owner is the author, and it is never verified. The pickers' read is the page tree.
import type { DocumentGrant } from '../../index-service';
import type {
  AutomationStepAnswer,
  AutomationStepDoorCall,
  AutomationTargetDescription,
  KbPageStep,
} from '@liveworkspace/index-client';
import { SOMEONE, takeCrossAppStep } from '@liveworkspace/automations/room';
import { getParticipant } from '../../person/profiles';
import type { DocumentEnv } from '../../types';
import { readDocumentOutline } from '../document-content';
import type { DocumentRoom } from '../document-room';
import { route } from '../document-room-doors';
import type { RouteIdentity } from '../document-route';
import { readStoredPages } from '../page-tree-store';
import { documentTabUrl } from './kit-outline';

// The room's own requests: never on the network, the origin only names them.
const ROOM_ORIGIN = 'https://liveknowledge.internal';

/** The identity the knowledgebase's routes read for a rule's step: the author, on their grant, as a rule. */
export const automationIdentity = (
  author: string,
  grant: DocumentGrant,
  automation: NonNullable<RouteIdentity['automation']>,
): RouteIdentity => ({
  accountUserId: author,
  verifiedUserId: author,
  accountEmail: null,
  owner: author,
  token: null,
  workbench: null,
  teams: null,
  bearer: null,
  grant,
  automation,
});

const asJson = (body: unknown, method: string) => ({
  method,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

async function writePage(
  room: DocumentRoom,
  env: DocumentEnv,
  documentId: string,
  step: KbPageStep,
  identity: RouteIdentity,
): Promise<AutomationStepAnswer> {
  const base = `${ROOM_ORIGIN}/api/documents/${encodeURIComponent(documentId)}/pages`;
  const made = await route(
    room,
    documentId,
    new Request(
      base,
      asJson(
        { title: step.title, markdown: step.body, ...(step.parent ? { parent: step.parent } : {}) },
        'POST',
      ),
    ),
    identity,
  );
  const body = (await made.json().catch(() => null)) as {
    page?: { tab?: string; title?: string };
    error?: string;
    message?: string;
  } | null;
  const tab = body?.page?.tab;
  if (made.status !== 201 || !tab) {
    if (made.status === 403) return { ok: false, code: 'no_access', reason: '' };
    // A parent page named that is gone.
    if (made.status === 404)
      return { ok: false, code: 'target_gone', reason: 'The parent page is gone' };
    return { ok: false, code: 'failed', reason: body?.message || "Couldn't write the page" };
  }
  // Its Owner is the author: the one who answers for it until someone verifies it.
  const owned = await route(
    room,
    documentId,
    new Request(
      `${base}/${encodeURIComponent(tab)}/knowledge`,
      asJson({ owner: identity.owner }, 'PUT'),
    ),
    identity,
  );
  await owned.body?.cancel();
  return {
    ok: true,
    text: `Wrote “${body.page?.title ?? step.title}” in “${step.target.title || 'Untitled'}”`,
    link: documentTabUrl(env, documentId, tab),
  };
}

export async function itemAutomationStep(
  room: DocumentRoom,
  documentId: string,
  call: AutomationStepDoorCall,
  grant: DocumentGrant,
): Promise<AutomationStepAnswer> {
  room.bindDocument(documentId);
  if (!room.storedSchema()) return { ok: false, code: 'no_access', reason: '' };
  const env = room.requireEnv();
  const person = await getParticipant(env, call.author).catch(() => null);
  const author = {
    id: call.author,
    name: person?.name || SOMEONE.name,
    color: person?.color || SOMEONE.color,
  };
  const identity = automationIdentity(call.author, grant, {
    rule: call.rule.name,
    from: call.from.title,
  });
  return takeCrossAppStep(
    env,
    call,
    { kb_page: (step) => writePage(room, env, documentId, step, identity) },
    author,
  );
}

export async function itemAutomationTarget(
  room: DocumentRoom,
  documentId: string,
): Promise<Pick<AutomationTargetDescription, 'pages'>> {
  const env = room.requireEnv();
  const [outline, tree] = await Promise.all([
    readDocumentOutline(env, documentId),
    readStoredPages(env, documentId),
  ]);
  const parents = new Map(tree.filter((p) => !p.connection).map((p) => [p.id, p.parent ?? null]));
  return {
    pages: outline.tabs
      .filter((t) => parents.has(t.id))
      .map((t) => ({ id: t.id, name: t.name, parent: parents.get(t.id) ?? null })),
  };
}

// The room's doors' shapes, so each of its methods stays a line or two (document-room.ts stays under 800 lines).
export type StepCall = AutomationStepDoorCall;
export type StepAnswer = AutomationStepAnswer;
export type TargetHere = Omit<AutomationTargetDescription, 'app' | 'title'>;
