// The server-capability probe, and the sticky-note photo reader
// (docs/specs/021-event-storming/note-reader.md).
import type {
  CapabilitiesResponse,
  NoteCrop,
  ReadNotesRequest,
  ReadNotesResponse,
} from '@livediagram/api-schema';
import { READ_MAX_CROPS_PER_REQUEST } from '@livediagram/api-schema';
import { API_BASE, apiHeaders, apiFetch } from './core';

// Fetch server capabilities. Returns everything fail-closed (false) on any
// network error so callers degrade gracefully.
//
// Fetched once per page: the answer is deployment config, the same for every
// caller, and the editor, the Drive mirror and each Settings open all ask.
// A failed answer is not kept, so the next caller asks again.
let capabilities: Promise<CapabilitiesResponse> | null = null;

export function apiGetCapabilities(): Promise<CapabilitiesResponse> {
  capabilities ??= fetchCapabilities().then(({ caps, ok }) => {
    if (!ok) capabilities = null;
    return caps;
  });
  return capabilities;
}

// Tests only: a fresh page.
export function resetCapabilitiesForTests(): void {
  capabilities = null;
}

async function fetchCapabilities(): Promise<{ caps: CapabilitiesResponse; ok: boolean }> {
  const closed = { aiEnabled: false, emailEnabled: false };
  try {
    const res = await apiFetch(`${API_BASE}/capabilities`);
    if (!res.ok) return { caps: closed, ok: false };
    return { caps: (await res.json()) as CapabilitiesResponse, ok: true };
  } catch {
    return { caps: closed, ok: false };
  }
}

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
  // Two at a time: a whole wall in parallel is a burst any rate limiter will
  // refuse, and one at a time is a wait nobody enjoys.
  for (let i = 0; i < batches.length; i += READ_BATCH_CONCURRENCY) {
    const slice = batches.slice(i, i + READ_BATCH_CONCURRENCY);
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
        texts.push(...answer.value.texts);
        readCount += answer.value.texts.length;
        return;
      }
      unread += slice[at]!.length;
      const reason: unknown = answer.reason;
      failure ??= reason instanceof Error ? reason.message : 'ai_error';
    });
    // Report batch-by-batch, so the author watching the bar sees the run
    // advance instead of a spinner that never moves.
    opts.onProgress?.(readCount);
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
  const res = await apiFetch(`${API_BASE}/ai/read-notes`, {
    method: 'POST',
    headers: await apiHeaders(ownerId, { body: true }),
    body: JSON.stringify({ crops } satisfies ReadNotesRequest),
    ...(opts.signal ? { signal: opts.signal } : {}),
  });
  if (!res.ok) throw new Error(await errorToken(res));
  return (await res.json()) as ReadNotesResponse;
}

// The worker's `{ error: '<token>' }` envelope, or a status-shaped fallback
// when the body is not one (a proxy's own 502 page, say).
async function errorToken(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { error?: unknown };
    if (typeof body.error === 'string' && body.error !== '') return body.error;
  } catch {
    /* not an envelope */
  }
  if (res.status === 413) return 'crops_too_large';
  if (res.status === 429) return 'ai_quota';
  return 'ai_error';
}
