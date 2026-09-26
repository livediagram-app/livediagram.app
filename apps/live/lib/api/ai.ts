// AI Assistance (spec/25): server-capability probe + the unified
// streaming request handler that parses elements out of the SSE feed.
import type {
  AiConversationTurn,
  AiMode,
  AiRequest,
  CapabilitiesResponse,
  NoteCrop,
  ReadNotesRequest,
  ReadNotesResponse,
} from '@livediagram/api-schema';
import { READ_MAX_CROPS_PER_REQUEST } from '@livediagram/api-schema';
import { isValidElement, type Element } from '@livediagram/diagram';
import { API_BASE, apiHeaders, apiFetch } from './core';

// Fetch server capabilities once at editor mount. Returns everything
// fail-closed (false) on any network error so callers degrade gracefully.
export async function apiGetCapabilities(): Promise<CapabilitiesResponse> {
  try {
    const res = await apiFetch(`${API_BASE}/capabilities`);
    if (!res.ok) return { aiEnabled: false, emailEnabled: false };
    return (await res.json()) as CapabilitiesResponse;
  } catch {
    return { aiEnabled: false, emailEnabled: false };
  }
}

// Shape kinds the AI may emit and we render as-is. A SUPERSET of what the
// server prompt lists (apps/api SCHEMA), because models routinely stray:
// they emit valid-but-unprompted kinds (triangle, star, speech-bubble, …)
// and synonyms ("rectangle", "box", "oval"). Anything NOT in this set is
// coerced to "square" by normalizeAiElement rather than dropped — a wrong
// shape still shows; a dropped one leaves arrows pointing at nothing. The
// data-carrying composites (charts / rail / rating / progress / icon) are
// deliberately excluded: without their extra fields they'd render empty, so
// they collapse to a plain square. Keep in sync with packages/diagram
// ShapeKind (the simple, self-contained subset).
//
// That exclusion is about elements the model INVENTS. It must never reach an
// element the user already had — see mergeAiElements, which pins `type` and
// `shape` on the clean path for exactly that reason.
const AI_SHAPE_KINDS = new Set([
  'square',
  'circle',
  'diamond',
  'cylinder',
  'parallelogram',
  'hexagon',
  'document',
  'stadium',
  'actor',
  'cloud',
  'triangle',
  'trapezoid',
  'star',
  'speech-bubble',
  'frame',
  'browser',
  'monitor',
  'laptop',
  'phone',
  'tablet',
  'foldable',
  'smartwatch',
  // The prompt asks the model for this one by name, with its checklistItems
  // schema, so coercing it to a square threw away the exact composite it had
  // been told to produce — and ChecklistView is gated on the kind, so the rows
  // rode along on the element and rendered nowhere. The "SUPERSET of what the
  // server prompt lists" claim above was false for precisely this entry; a test
  // now holds it.
  'checklist',
]);

// Fallback size for an AI shape that omitted / mis-typed width or height, so
// the box still renders (generated diagrams get re-laid-out anyway).
const AI_DEFAULT_SHAPE_W = 120;
const AI_DEFAULT_SHAPE_H = 64;

// Element types the assistant is allowed to add. Anything else in the stream
// (an image, a freehand stroke the prompt told it not to emit) is dropped.
const AI_ELEMENT_TYPES = new Set(['shape', 'text', 'sticky', 'arrow']);

// Parse, normalise, then hold the result to the SAME structural guard every
// save goes through (`isValidElement` from @livediagram/diagram). A looser
// local copy used to live here: it let through arrows with junk endpoints and
// non-finite coordinates, which rendered, then failed the api's tab validation
// on save. Normalising first keeps the forgiving part (a stray kind or a
// missing size still renders) without the drift.
function toAiElement(raw: unknown): Element | null {
  if (typeof raw !== 'object' || raw === null) return null;
  if (!AI_ELEMENT_TYPES.has((raw as { type?: unknown }).type as string)) return null;
  const el = normalizeAiElement(raw as Record<string, unknown>);
  return isValidElement(el) ? el : null;
}

// Normalise an AI-returned element so it renders consistently. The big one:
// a shape with no `textSize` (or "scale") falls through to the canvas default
// of 'scale' (auto-fit, BoxedElementView), which balloons the label to fill
// the box — so a generated diagram ends up with some nodes huge and others
// tiny. Manually-created shapes never hit this because createShape sets
// textSize:'md'; AI shapes routinely omit it (the prompt even told them to),
// so pin any missing / non-fixed size to 'md'. The model's explicit sm/md/lg
// hierarchy choices are preserved.
function normalizeAiElement(obj: Record<string, unknown>): unknown {
  if (obj.type !== 'shape' && obj.type !== 'text' && obj.type !== 'sticky') return obj;
  const patch: Record<string, unknown> = {};
  // Default a missing / non-positive size so the box has area to draw.
  if (typeof obj.width !== 'number' || obj.width <= 0) patch.width = AI_DEFAULT_SHAPE_W;
  if (typeof obj.height !== 'number' || obj.height <= 0) patch.height = AI_DEFAULT_SHAPE_H;
  if (obj.type === 'shape') {
    // Off-vocabulary / synonym kind ("rectangle", "box", a composite without
    // its data) → plain square, so the node renders instead of being dropped.
    if (typeof obj.shape !== 'string' || !AI_SHAPE_KINDS.has(obj.shape)) {
      patch.shape = 'square';
    }
    // Pin a non-fixed textSize to 'md' (else 'scale' balloons the label).
    const ts = obj.textSize;
    if (ts !== 'sm' && ts !== 'md' && ts !== 'lg') patch.textSize = 'md';
  }
  return Object.keys(patch).length ? { ...obj, ...patch } : obj;
}

// Parse all complete element objects out of an accumulated JSON buffer.
// Finds the "elements":[ array, then extracts each top-level {...} object
// as soon as brace depth returns to zero. Called after each SSE chunk so
// new elements are surfaced incrementally while the stream is live.
export function extractElementsFromBuffer(buffer: string): Element[] {
  const match = buffer.match(/"elements"\s*:\s*\[/);
  if (!match || match.index === undefined) return [];
  const elements: Element[] = [];
  let depth = 0;
  let start = -1;
  // Track string state so braces INSIDE a value (a label like "if (x) {")
  // don't throw off the depth count and corrupt every object after it.
  let inStr = false;
  let esc = false;
  for (let i = match.index + match[0].length; i < buffer.length; i++) {
    const ch = buffer[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === '\\') esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') {
      inStr = true;
    } else if (ch === '{') {
      if (depth === 0) start = i;
      depth++;
    } else if (ch === '}') {
      depth--;
      if (depth === 0 && start >= 0) {
        try {
          const el = toAiElement(JSON.parse(buffer.slice(start, i + 1)));
          if (el) elements.push(el);
        } catch {
          /* skip malformed */
        }
        start = -1;
      }
    } else if (ch === ']' && depth === 0) {
      break; // end of the elements array — stop before the summary field
    }
  }
  return elements;
}

// Unified streaming handler for all AI modes. All modes now stream from
// the server (OpenAI SSE piped through the worker).
//
// For review: onTextChunk fires with each incremental text fragment.
// For mutating modes: onProgress fires as elements are parsed out of
// the streaming JSON (useful for showing a live count). onDone fires
// once with the final validated element array.
//
// Throws on network error, non-2xx, or off-topic refusal.
export async function apiAiStream(
  ownerId: string,
  payload: AiRequest,
  callbacks: {
    onTextChunk?: (text: string) => void;
    onProgress?: (count: number) => void;
    onDone: (result: {
      elements: Element[];
      offTopic: boolean;
      reviewText: string;
      summary: string;
    }) => void;
  },
): Promise<void> {
  const res = await apiFetch(`${API_BASE}/ai`, {
    method: 'POST',
    headers: await apiHeaders(ownerId, { body: true }),
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`ai request failed: ${res.status}`);
  const reader = res.body?.getReader();
  if (!reader) {
    callbacks.onDone({ elements: [], offTopic: false, reviewText: '', summary: '' });
    return;
  }

  const decoder = new TextDecoder();
  let buf = '';
  let jsonBuf = ''; // accumulated JSON tokens for mutating modes
  let reviewText = '';
  let lastCount = 0;
  const isText = payload.mode === 'ask';

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split('\n');
    buf = lines.pop() ?? '';
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const data = line.slice(6).trim();
      if (data === '[DONE]') continue;
      try {
        const chunk = JSON.parse(data) as {
          choices?: Array<{ delta?: { content?: string } }>;
        };
        const text = chunk.choices?.[0]?.delta?.content;
        if (!text) continue;
        if (isText) {
          reviewText += text;
          callbacks.onTextChunk?.(text);
        } else {
          jsonBuf += text;
          const elements = extractElementsFromBuffer(jsonBuf);
          if (elements.length > lastCount) {
            lastCount = elements.length;
            callbacks.onProgress?.(lastCount);
          }
        }
      } catch {
        /* skip malformed SSE chunk */
      }
    }
  }

  if (isText) {
    callbacks.onDone({ elements: [], offTopic: false, reviewText, summary: '' });
    return;
  }

  const offTopic = /"offTopic"\s*:\s*true/.test(jsonBuf);
  if (offTopic) throw new Error('off_topic');
  // Final parse — use the fully accumulated buffer for the authoritative list.
  const elements = extractElementsFromBuffer(jsonBuf);
  // Extract the optional summary field the model includes alongside elements.
  let summary = '';
  try {
    const summaryMatch = jsonBuf.match(/"summary"\s*:\s*"((?:[^"\\]|\\.)*)"/);
    if (summaryMatch) summary = summaryMatch[1]!.replace(/\\n/g, ' ').replace(/\\"/g, '"');
  } catch {
    /* no summary */
  }
  callbacks.onDone({ elements, offTopic: false, reviewText: '', summary });
}

// Read the handwriting on sticky-note crops (spec/139 Phase 8).
//
// Non-streaming, unlike the assistant above: the editor cannot reconcile half
// a list. Batched, because a wall section is tens of stickies and one enormous
// request is one enormous thing to lose — and two batches in flight keeps a
// run brisk without hammering the provider. The route's error tokens are
// thrown as Errors whose message IS the token, the same shape the assistant's
// `off_topic` refusal takes, so one catch renders one message per cause.
// What a run of batches comes back with: the words, and — when part of the run
// did not answer — how many crops went unread and why. A CLIENT type: the
// worker's wire format knows nothing about batching, because the batching is
// ours.
export type ReadNotesResult = ReadNotesResponse & { unread?: number; failure?: string };

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
      const reason = answer.reason;
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

// Re-export types so callers don't need extra imports.
export type { AiMode, AiConversationTurn };
