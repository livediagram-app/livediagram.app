// AI Assistance (spec/25): server-capability probe + the unified
// streaming request handler that parses elements out of the SSE feed.
import type {
  AiConversationTurn,
  AiMode,
  AiRequest,
  CapabilitiesResponse,
} from '@livediagram/api-schema';
import type { Element } from '@livediagram/diagram';
import { API_BASE, apiHeaders } from './core';

// Fetch server capabilities once at editor mount. Returns everything
// fail-closed (false) on any network error so callers degrade gracefully.
export async function apiGetCapabilities(): Promise<CapabilitiesResponse> {
  try {
    const res = await fetch(`${API_BASE}/capabilities`);
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
  'smartwatch',
]);

// Fallback size for an AI shape that omitted / mis-typed width or height, so
// the box still renders (generated diagrams get re-laid-out anyway).
const AI_DEFAULT_SHAPE_W = 120;
const AI_DEFAULT_SHAPE_H = 64;

function isValidElement(el: unknown): el is Element {
  if (typeof el !== 'object' || el === null) return false;
  const obj = el as Record<string, unknown>;
  if (typeof obj.id !== 'string' || !obj.id) return false;
  const t = obj.type;
  if (t === 'shape') {
    // Accept any shape with a position; the kind is coerced and the size
    // defaulted in normalizeAiElement, so an off-vocabulary kind or a
    // missing width/height no longer drops the whole node (which used to
    // leave its connecting arrows floating).
    return typeof obj.x === 'number' && typeof obj.y === 'number';
  }
  if (t === 'text' || t === 'sticky') {
    return typeof obj.x === 'number' && typeof obj.y === 'number';
  }
  if (t === 'arrow') {
    return typeof obj.from === 'object' && typeof obj.to === 'object';
  }
  return false;
}

// Normalise an AI-returned element so it renders consistently. The big one:
// a shape with no `textSize` (or "scale") falls through to the canvas default
// of 'scale' (auto-fit, BoxedElementView), which balloons the label to fill
// the box — so a generated diagram ends up with some nodes huge and others
// tiny. Manually-created shapes never hit this because createShape sets
// textSize:'md'; AI shapes routinely omit it (the prompt even told them to),
// so pin any missing / non-fixed size to 'md'. The model's explicit sm/md/lg
// hierarchy choices are preserved.
function normalizeAiElement(el: Element): Element {
  if (el.type === 'shape') {
    const obj = el as Record<string, unknown>;
    const patch: Record<string, unknown> = {};
    // Off-vocabulary / synonym kind ("rectangle", "box", a composite without
    // its data) → plain square, so the node renders instead of being dropped.
    if (typeof obj.shape !== 'string' || !AI_SHAPE_KINDS.has(obj.shape)) {
      patch.shape = 'square';
    }
    // Default a missing / non-positive size so the box has area to draw.
    if (typeof obj.width !== 'number' || obj.width <= 0) patch.width = AI_DEFAULT_SHAPE_W;
    if (typeof obj.height !== 'number' || obj.height <= 0) patch.height = AI_DEFAULT_SHAPE_H;
    // Pin a non-fixed textSize to 'md' (else 'scale' balloons the label).
    const ts = obj.textSize;
    if (ts !== 'sm' && ts !== 'md' && ts !== 'lg') patch.textSize = 'md';
    return Object.keys(patch).length ? ({ ...el, ...patch } as Element) : el;
  }
  return el;
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
          const el = JSON.parse(buffer.slice(start, i + 1));
          if (isValidElement(el)) elements.push(normalizeAiElement(el));
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
  const res = await fetch(`${API_BASE}/ai`, {
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
