// What the api answered for one document in a pass (docs/specs/027-repositories/blueprints/repository-link.md "One
// sync pass" step 5): its overview, and at `files` its envelope fields; or trashed, unreadable, or a transient
// failure that keeps its files (RL14).

import type { VerbContext } from '@livediagram/agent-verbs';
import { ApiError } from '@livediagram/api-client';
import type { DocumentResponse, OverviewView } from '@livediagram/api-schema';
import { EXIT } from '../output/exit-codes';
import { failureOf } from '../output/failure-of';
import { SYNC_CONCURRENCY } from './constants';

// What a mirror file holds of a document besides its tabs' contents (RL37).
export type EnvelopeFields = {
  name: string;
  presentation: string | null;
  tabs: { id: string; orderIndex: number; folder?: string }[];
};

export type RemoteFact =
  | { kind: 'readable'; overview: OverviewView; envelope: EnvelopeFields | null }
  | { kind: 'trashed' }
  | { kind: 'unreadable' }
  // `failure` completes `! "<name>": <failure>; files kept`.
  | { kind: 'transient'; failure: string; exit: 6 | 7; reason: string };

// The overview's tabs as header facts, each with its id and revision.
export const remoteTabsOf = (overview: OverviewView) =>
  overview.tabs.flatMap((t) => (t.outOfScope ? [] : [t]));

// Each document's facts, SYNC_CONCURRENCY at a time: its overview, and its envelope fields for the ids in
// `envelopes`. A 401 or any other refusal of the whole account ends the pass before anything is written (RL14).
export async function readRemoteFacts(
  ctx: VerbContext,
  host: string,
  ids: readonly string[],
  envelopes: ReadonlySet<string>,
): Promise<Map<string, RemoteFact>> {
  const facts = new Map<string, RemoteFact>();
  const read = async (id: string): Promise<RemoteFact> => {
    const path = `/documents/${encodeURIComponent(id)}`;
    try {
      const [overview, envelope] = await Promise.all([
        ctx.api.json<OverviewView>(`${path}?view=overview&json=1`),
        envelopes.has(id)
          ? ctx.api.json<DocumentResponse>(path).then(({ document }) => ({
              name: document.name,
              presentation: document.presentation ?? null,
              tabs: document.tabs.map((t) => ({
                id: t.id,
                orderIndex: t.orderIndex,
                ...(t.folder ? { folder: t.folder } : {}),
              })),
            }))
          : null,
      ]);
      return { kind: 'readable', overview, envelope };
    } catch (err) {
      return answerOf(ctx, id, err, host);
    }
  };
  let next = 0;
  const worker = async () => {
    while (next < ids.length) {
      const id = ids[next++]!;
      facts.set(id, await read(id));
    }
  };
  await Promise.all(Array.from({ length: SYNC_CONCURRENCY }, worker));
  return facts;
}

// A failed read as a fact: trashed, unreadable, or transient; anything else is the whole pass's failure.
export function answerOf(ctx: VerbContext, id: string, err: unknown, host: string): RemoteFact {
  if (err instanceof ApiError && err.status === 410) return { kind: 'trashed' };
  if (err instanceof ApiError && err.status === 404) {
    ctx.log(`unreadable ${id}`);
    return { kind: 'unreadable' };
  }
  const failure = failureOf(err, host);
  if (failure.exit !== EXIT.rateLimited && failure.exit !== EXIT.failure) throw err;
  const reason = err instanceof ApiError ? String(err.status) : 'network';
  ctx.log(`transient ${id} ${reason}`);
  return { kind: 'transient', failure: failure.message, exit: failure.exit, reason };
}
