// AI Assistance (docs/specs/007-editor/ai-assistance.md): server-capability probe + the unified
// streaming request handler that parses elements out of the SSE feed.
import type {
  AiConversationTurn,
  AiMode,
  AiRequest,
  CapabilitiesResponse,
} from '@livedesign/api-schema';
import { isTextSize, isValidElement, type Element } from '@livedesign/document';
import { API_BASE, apiHeaders, apiFetch } from './core';

// Fetch server capabilities. Returns everything fail-closed (false) on any
// network error so callers degrade gracefully.
//
// Fetched once per page: the answer is deployment config, the same for every
// caller, and the editor and each Settings open both ask.
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

// Shape kinds the AI may emit and we render as-is. A SUPERSET of what the
// server prompt lists (apps/api SCHEMA), because models routinely stray:
// they emit valid-but-unprompted kinds (triangle, star, speech-bubble, …)
// and synonyms ("rectangle", "box", "oval"). Anything NOT in this set is
// coerced to "square" by normalizeAiElement rather than dropped — a wrong
// shape still shows; a dropped one leaves arrows pointing at nothing. The
// data-carrying composites (charts / rail / rating / progress / icon) are
// deliberately excluded: without their extra fields they'd render empty, so
// they collapse to a plain square. Keep in sync with packages/document
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
// save goes through (`isValidElement` from @livedesign/document). A looser
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
    // Pin a non-fixed textSize to 'md' (else 'scale' balloons the label). A slider px is fixed too: an
    // element's own size echoed back by Clean is kept, not flattened to 'md'.
    const ts = obj.textSize;
    const fixed =
      ts === 'sm' || ts === 'md' || ts === 'lg' || (typeof ts === 'number' && isTextSize(ts));
    if (!fixed) patch.textSize = 'md';
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

// Re-export types so callers don't need extra imports.
export type { AiMode, AiConversationTurn };
