// The server-capability probe, and the sticky-note photo reader
// (docs/specs/021-event-storming/note-reader.md).
import type {
  CapabilitiesResponse,
  NoteCrop,
  ReadCredits,
  ReadNotesRequest,
  ReadNotesResponse,
} from '@livediagram/api-schema';
import { READ_MAX_CROPS_PER_REQUEST } from '@livediagram/api-schema';
import { readAiKeyFailure, type AiKeyFailure } from '@liveworkspace/ai/key-failure';
import { createCapabilitiesClient } from '@liveworkspace/api-client';
import { proOn } from '@liveworkspace/subscription-ui/flag';
import {
  noteReadCredits,
  noteReadCreditsUsed,
  readRun,
  readTarget,
} from '@/lib/reading/read-credits';
import { API_BASE, apiHeaders, apiFetch } from './core';

// Fetch server capabilities (the shared one-ask client, @liveworkspace/api-client): fail-closed (every
// feature off) on any network error so callers degrade gracefully, fetched once per page, and a failed
// answer is not kept, so the next caller asks again.
const capabilities = createCapabilitiesClient<CapabilitiesResponse>({
  request: () => apiFetch(`${API_BASE}/capabilities`),
  closed: { aiEnabled: false, emailEnabled: false },
});

export const apiGetCapabilities = capabilities.get;

// Tests only: a fresh page.
export const resetCapabilitiesForTests = capabilities.reset;

// Read the handwriting on sticky-note crops (docs/specs/021-event-storming/event-storming.md Phase 8).
//
// Non-streaming: the editor cannot reconcile half a list. Batched, because a wall section is tens of stickies and one enormous
// request is one enormous thing to lose — and two batches in flight keeps a
// run brisk without hammering the provider. The route's error tokens are
// thrown as Errors whose message IS the token, so one catch renders one
// message per cause.
// What a run of batches comes back with: the words, and — when part of the run
// did not answer — how many crops went unread and why. A CLIENT type: the
// worker's wire format knows nothing about batching, because the batching is
// ours.
type ReadNotesResult = ReadNotesResponse & { unread?: number; failure?: string };

export async function apiAiReadNotes(
  ownerId: string,
  crops: NoteCrop[],
  opts: { signal?: AbortSignal; onProgress?: (readCount: number) => void } = {},
): Promise<ReadNotesResult> {
  const batches: NoteCrop[][] = [];
  for (let i = 0; i < crops.length; i += READ_MAX_CROPS_PER_REQUEST) {
    batches.push(crops.slice(i, i + READ_MAX_CROPS_PER_REQUEST));
  }
  const texts: ReadNotesResponse['texts'] = [];
  let readCount = 0;
  let unread = 0;
  let failure: string | undefined;
  let keyFailed: ReadKeyFailed | undefined;
  // With Pro on, a read is paid for once (docs/specs/021-event-storming/note-reader.md "What a read costs"): a batch
  // goes alone until the read holds its pass, which lets the rest through. An api that answers with no credits
  // counts nothing, so the rest go as before; with a pass in hand, or Pro off, every batch goes as before.
  let uncounted = false;
  const width = () =>
    proOn() && readRun().pass === null && !uncounted ? 1 : READ_BATCH_CONCURRENCY;
  // Two at a time: a whole wall in parallel is a burst any rate limiter will
  // refuse, and one at a time is a wait nobody enjoys.
  for (let i = 0, step = width(); i < batches.length; i += step, step = width()) {
    const slice = batches.slice(i, i + step);
    // ONE LOST BATCH IS ONE LOST BATCH. A hundred-note wall is seventeen
    // requests, and over seventeen requests something eventually answers 429
    // or hands back a truncated line; throwing on the first of them threw away
    // every word the model had already read, which is why a whole wall came
    // back saying "Type the words…". The batches that answered are kept, the
    // crops in the batch that did not stay blank, and the reason travels with
    // the result so the author is told which part failed rather than that
    // everything did.
    const answers = await Promise.allSettled(slice.map((batch) => readBatch(ownerId, batch, opts)));
    answers.forEach((answer, at) => {
      if (answer.status === 'fulfilled') {
        if (!answer.value.credits) uncounted = true;
        texts.push(...answer.value.texts);
        readCount += answer.value.texts.length;
        return;
      }
      unread += slice[at]!.length;
      const reason: unknown = answer.reason;
      if (reason instanceof ReadKeyFailed) keyFailed ??= reason;
      failure ??= reason instanceof Error ? reason.message : 'ai_error';
    });
    // The person's own key failed: every batch would, so the run stops and says so (note-reader.md "On your own key").
    if (keyFailed) throw keyFailed;
    // Report batch-by-batch, so the author watching the bar sees the run
    // advance instead of a spinner that never moves.
    opts.onProgress?.(readCount);
    // The payer's AI credits are used (note-reader.md "When the credits are used"): no later batch can be paid for
    // either, so none is sent, and the rest of the photo is the device reader's.
    if (failure === 'ai_credits_used') {
      for (const batch of batches.slice(i + slice.length)) unread += batch.length;
      break;
    }
  }
  // Nothing at all came back: that is not a partial read, it is a failure, and
  // it is told the way every other failure here is told.
  if (texts.length === 0 && failure !== undefined) throw new Error(failure);
  return failure === undefined ? { texts } : { texts, unread, failure };
}

// How many read requests are in flight at once.
const READ_BATCH_CONCURRENCY = 2;

async function readBatch(
  ownerId: string,
  crops: NoteCrop[],
  opts: { signal?: AbortSignal },
): Promise<ReadNotesResponse> {
  // With Pro on the read names its diagram (whose owner pays), itself, how many notes the photo has (what the read
  // costs), and the pass it was given. With Pro off the request is the crops alone, as it always was.
  const metered = proOn();
  const { documentId, shareCode } = readTarget();
  const run = metered ? readRun() : null;
  const body: ReadNotesRequest = run
    ? {
        crops,
        ...(documentId ? { documentId } : {}),
        read: run.id,
        ...(run.notes > 0 ? { notes: run.notes } : {}),
        ...(run.pass ? { pass: run.pass } : {}),
      }
    : { crops };
  const res = await apiFetch(`${API_BASE}/ai/read-notes`, {
    method: 'POST',
    headers: await apiHeaders(ownerId, {
      body: true,
      ...(metered && shareCode ? { share: shareCode } : {}),
    }),
    body: JSON.stringify(body),
    ...(opts.signal ? { signal: opts.signal } : {}),
  });
  if (!res.ok) throw await errorOf(res);
  const answer = (await res.json()) as ReadNotesResponse;
  noteReadCredits(answer.credits);
  return answer;
}

/** The person's own key failed (`ai_key_failed`): whose key and how, for the review's source line. Never the key. */
export class ReadKeyFailed extends Error {
  readonly aiKey: AiKeyFailure;
  constructor(aiKey: AiKeyFailure) {
    super('ai_key_failed');
    this.name = 'ReadKeyFailed';
    this.aiKey = aiKey;
  }
}

async function errorOf(res: Response): Promise<Error> {
  const body: unknown = await res
    .clone()
    .json()
    .catch(() => null);
  const aiKey = readAiKeyFailure(body);
  return aiKey ? new ReadKeyFailed(aiKey) : new Error(await errorToken(res));
}

// The worker's `{ error: '<token>' }` envelope, or a status-shaped fallback
// when the body is not one (a proxy's own 502 page, say).
async function errorToken(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as Record<string, unknown>;
    const { error, owner, used, max, credits } = body;
    // A read that spent and then failed still hands back its pass, so its next batch is not charged again.
    if (
      typeof credits === 'object' &&
      credits !== null &&
      typeof Reflect.get(credits, 'owner') === 'string'
    ) {
      noteReadCredits(credits as ReadCredits);
    }
    // The payer's month of AI credits is used (note-reader.md "When the credits are used"): the review says so.
    // The numbers come only to the payer and the paying team; anyone else is told whose month it is and no more.
    if (error === 'ai_credits_used' && typeof owner === 'string') {
      const numbers = typeof used === 'number' && typeof max === 'number';
      noteReadCreditsUsed({ owner, used: numbers ? used : 0, max: numbers ? max : 0 });
    }
    if (typeof error === 'string' && error !== '') return error;
  } catch {
    /* not an envelope */
  }
  if (res.status === 413) return 'crops_too_large';
  if (res.status === 429) return 'ai_quota';
  return 'ai_error';
}
