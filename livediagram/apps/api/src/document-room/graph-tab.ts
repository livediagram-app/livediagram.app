// Send to Diagram into an existing canvas (liveworkspace/docs/specs/004-index/send-to-diagram.md "The diagram"; the
// graph door, routes/internal-graph.ts): a new tab at the end, or a tab an earlier send drew, redrawn whole. Written in
// the canvas's room as an agent's changeset is (changesets/submit.ts, a `replace` of the compiled elements), as the
// person who sent: open editors see it arrive, and the canvas's history and undo hold it. The index checked the
// person's edit on the whole canvas before it called.
import type { Element } from '@livediagram/document';
import { getDocument } from '../db';
import { getParticipant } from '../liveworkspace/profiles';
import { submitChangeset } from '../changesets/submit';
import type { DocumentEnv } from '../types';

/** What the door hands the room: the tab (a fresh id for a new one), its name, the drawing and who sent it. */
export type GraphTabWrite = {
  tabId: string;
  name: string;
  elements: Element[];
  owner: string;
};

export type GraphTabOutcome =
  { status: 'ok' } | { status: 'not_found' } | { status: 'invalid_graph' };

// The author's name and colour when they have no participant row, as the changeset route's.
const FALLBACK = { name: 'Someone', color: '#0ea5e9' };

export async function writeGraphTab(
  env: DocumentEnv,
  documentId: string,
  write: GraphTabWrite,
  waitUntil?: (p: Promise<unknown>) => void,
): Promise<GraphTabOutcome> {
  const document = await getDocument(env, documentId);
  if (!document) return { status: 'not_found' };
  const participant = await getParticipant(env, write.owner);
  const result = await submitChangeset({
    env,
    document,
    tabId: write.tabId,
    request: {
      body: { kind: 'replace', replace: { elements: write.elements }, name: write.name },
      strict: false,
      summary: 'Send to Diagram',
    },
    dryRun: false,
    author: {
      id: write.owner,
      name: participant?.name ?? FALLBACK.name,
      color: participant?.color ?? FALLBACK.color,
    },
    tokenId: null,
    frontDoor: 'Api',
    ...(waitUntil ? { waitUntil } : {}),
  });
  if (result.status === 200) return { status: 'ok' };
  console.warn('[room] graph tab refused', { status: result.status });
  return result.status === 404 ? { status: 'not_found' } : { status: 'invalid_graph' };
}
