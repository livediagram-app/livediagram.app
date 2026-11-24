// View As Diagram's redraw (liveworkspace/docs/specs/004-index/diagrams-and-plans.md "Live"; the door,
// routes/internal-plan-diagram.ts): the tab a plan's board was drawn in, drawn again from the board as it is now.
// Written in the canvas's room as an agent's changeset is (changesets/submit.ts, a `replace` of the drawn elements), as
// the person who made the view: open editors see it move, and the canvas's history and undo hold it. The tab keeps its
// name, and a tab someone deleted is never made again (`mayCreateTab: false`): the plan then forgets the view. The
// index checked the maker's edit on the whole canvas before it called.
import type { Element } from '@livediagram/document';
import { getDocument } from '../db';
import { getParticipant } from '../liveworkspace/profiles';
import { submitChangeset } from '../changesets/submit';
import type { DocumentEnv } from '../types';

export type PlanTabWrite = { tabId: string; elements: Element[]; owner: string };

export type PlanTabOutcome =
  { status: 'ok' } | { status: 'not_found' } | { status: 'invalid_graph' };

// The author's name and colour when they have no participant row, as the changeset route's.
const FALLBACK = { name: 'Someone', color: '#0ea5e9' };

export async function writePlanTab(
  env: DocumentEnv,
  documentId: string,
  write: PlanTabWrite,
  waitUntil?: (p: Promise<unknown>) => void,
): Promise<PlanTabOutcome> {
  const document = await getDocument(env, documentId);
  if (!document) return { status: 'not_found' };
  const participant = await getParticipant(env, write.owner);
  const result = await submitChangeset({
    env,
    document,
    tabId: write.tabId,
    request: {
      body: { kind: 'replace', replace: { elements: write.elements } },
      strict: false,
      summary: 'View As Diagram',
    },
    dryRun: false,
    author: {
      id: write.owner,
      name: participant?.name ?? FALLBACK.name,
      color: participant?.color ?? FALLBACK.color,
    },
    tokenId: null,
    frontDoor: 'Api',
    mayCreateTab: false,
    ...(waitUntil ? { waitUntil } : {}),
  });
  if (result.status === 200) return { status: 'ok' };
  console.warn('[room] plan tab refused', { status: result.status });
  return result.status === 404 ? { status: 'not_found' } : { status: 'invalid_graph' };
}
