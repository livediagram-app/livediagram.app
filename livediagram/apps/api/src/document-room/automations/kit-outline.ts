// The document as a rule's run reads it (blueprint automations.md "The kit": outline, tabUrl): its name, link, owner,
// tabs and people. The people are the owner and, for a team's document, the team's joined accounts: who Send Email
// may name and Who Did It may check. No address is read here; Send Email resolves one when it sends (kit-mail.ts).
import { documentPath } from '@livediagram/api-schema';
import type { ItemOutline } from '@liveworkspace/automations/item';
import { appBaseUrl } from '../../email/client';
import { getParticipants } from '../../liveworkspace/profiles';
import { teamPeople } from '../../liveworkspace/team-people';
import type { DocumentEnv } from '../../types';
import { readDocumentOutline } from '../document-content';

/** A link that opens the document in the editor. */
export const documentUrl = (env: DocumentEnv, documentId: string): string =>
  `${appBaseUrl(env)}${documentPath(documentId)}`;

/** A link that opens one of its tabs: the editor's own tab pin (apps/editor lib/collab-deep-link.ts). */
export const documentTabUrl = (env: DocumentEnv, documentId: string, tabId: string): string =>
  `${documentUrl(env, documentId)}#t=${encodeURIComponent(tabId)}`;

// The most people an outline names: a team past it keeps its first (the picker and Who Did It read no more).
export const OUTLINE_PEOPLE_MAX = 200;

async function peopleOf(
  env: DocumentEnv,
  ownerId: string,
  teamId: string | null,
): Promise<ItemOutline['people']> {
  const team = teamId ? ((await teamPeople(env, teamId)) ?? []) : [];
  const joined = team.filter((p) => p.status === 'joined' && p.userId);
  const named = new Map<string, string>();
  for (const p of joined.slice(0, OUTLINE_PEOPLE_MAX)) named.set(p.userId!, p.name ?? 'Someone');
  if (ownerId && !named.has(ownerId)) {
    const owner = (await getParticipants(env, [ownerId])).get(ownerId);
    named.set(ownerId, owner?.name ?? 'The owner');
  }
  return [...named].map(([id, name]) => ({ id, name }));
}

/** The outline, or one for a document not started (no name, no tabs, nobody). */
export async function documentItemOutline(
  env: DocumentEnv,
  documentId: string,
): Promise<ItemOutline> {
  const outline = await readDocumentOutline(env, documentId);
  const ownerId = outline.meta?.ownerId ?? '';
  return {
    name: outline.meta?.name || 'Untitled',
    url: documentUrl(env, documentId),
    ownerId,
    tabs: outline.tabs.map((t) => ({ id: t.id, name: t.name })),
    people: await peopleOf(env, ownerId, outline.meta?.teamId ?? null),
    ...(outline.savedAt > 0 ? { editedAt: outline.savedAt } : {}),
  };
}
