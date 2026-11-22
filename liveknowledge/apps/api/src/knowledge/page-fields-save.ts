// A page's knowledge fields saved (docs/specs/030-knowledgebase/verification.md "The fields"; docs/specs/
// 013-workspace/automations.md "Steps of its own"): one write at the revision it read, repeated once when the page
// moved between the read and the write (an autosave landing), then told to every open editor as the `tab-meta`
// patch its own change would send. Page Health's routes and a rule's steps both save through here, so a rule's
// owner change reads exactly as a person's. The write is no edit of the page's writing, so it starts no Edited
// rule (`silently`); what it changed starts the knowledgebase's own triggers (Page Verified, Page Owner Changed).
import { silently } from '@liveworkspace/automations/room';
import type { KnowledgeFields } from '@liveknowledge/knowledge';
import {
  queueFieldsChanged,
  type KnowledgeWho,
} from '../document-room/automations/knowledge-events';
import { requestGrant } from '../index-service';
import { relayPages } from '../room-client';
import type { DocumentEnv } from '../types';
import { readPageKnowledge, writePageKnowledge, type StoredPageKnowledge } from './page-knowledge';

export type FieldsSaved<Refusal> =
  | { kind: 'saved'; after: StoredPageKnowledge; rev: number; now: number }
  | { kind: 'gone' }
  | { kind: 'busy' }
  | { kind: 'refused'; refusal: Refusal };

export async function savePageFields<Refusal>(
  env: DocumentEnv,
  documentId: string,
  tab: string,
  change: (page: StoredPageKnowledge) => Promise<KnowledgeFields | { refused: Refusal }>,
  opts: {
    verified?: boolean;
    also?: (rev: number) => D1PreparedStatement[];
    // Who made the change, asked only when a rule hears what it changed.
    who: () => Promise<KnowledgeWho>;
  },
): Promise<FieldsSaved<Refusal>> {
  const now = Date.now();
  for (let attempt = 0; attempt < 2; attempt++) {
    const page = await readPageKnowledge(env, documentId, tab);
    if (!page) return { kind: 'gone' };
    const next = await change(page);
    if ('refused' in next) return { kind: 'refused', refusal: next.refused };
    const rev = await silently(env, () =>
      writePageKnowledge(env, page, next, {
        ...(opts.verified ? { verified: true } : {}),
        ...(opts.also ? { also: opts.also } : {}),
        now,
      }),
    );
    if (rev === null) continue;
    const after = await readPageKnowledge(env, documentId, tab);
    if (!after) return { kind: 'gone' };
    console.info('[knowledge] fields', {
      documentId,
      tabId: tab,
      rev,
      verified: opts.verified === true,
    });
    const patch = Object.keys(after.fields).length > 0 ? { knowledge: after.fields } : {};
    await relayPages(
      env,
      documentId,
      [
        {
          kind: 'tab-meta',
          tabId: tab,
          patch,
          ...(patch.knowledge ? {} : { clear: ['knowledge'] }),
        },
      ],
      '[knowledge]',
    );
    await queueFieldsChanged(env, { tab, before: page.fields, after: after.fields, who: opts.who });
    return { kind: 'saved', after, rev, now };
  }
  return { kind: 'busy' };
}

/** Whether a person may own a page: they can open the knowledgebase. Its own owner can; anyone else is asked of
 *  the index, as that person with no team named. */
export async function personCanOpen(
  env: DocumentEnv,
  document: { id: string; ownerId: string },
  person: string,
): Promise<boolean> {
  if (person === document.ownerId) return true;
  const outcome = await requestGrant(
    env,
    { kind: 'delegate', personId: person, teams: [] },
    document.id,
    null,
  );
  return outcome.ok;
}
