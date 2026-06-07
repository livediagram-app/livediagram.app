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

// Fetch server capabilities once at editor mount. Returns
// { aiEnabled: false } on any network error so callers can fail-closed.
export async function apiGetCapabilities(): Promise<CapabilitiesResponse> {
  try {
    const res = await fetch(`${API_BASE}/capabilities`);
    if (!res.ok) return { aiEnabled: false };
    return (await res.json()) as CapabilitiesResponse;
  } catch {
    return { aiEnabled: false };
  }
}

// Valid shape kinds — must stay in sync with packages/diagram ShapeKind.
// Used to validate AI-returned elements before applying them.
const VALID_SHAPE_KINDS = new Set([
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
  'browser',
  'monitor',
  'laptop',
  'phone',
  'tablet',
]);

function isValidElement(el: unknown): el is Element {
  if (typeof el !== 'object' || el === null) return false;
  const obj = el as Record<string, unknown>;
  if (typeof obj.id !== 'string' || !obj.id) return false;
  const t = obj.type;
  if (t === 'shape') {
    return (
      VALID_SHAPE_KINDS.has(obj.shape as string) &&
      typeof obj.x === 'number' &&
      typeof obj.y === 'number' &&
      typeof obj.width === 'number' &&
      (obj.width as number) > 0 &&
      typeof obj.height === 'number' &&
      (obj.height as number) > 0
    );
  }
  if (t === 'text' || t === 'sticky') {
    return (
      typeof obj.x === 'number' &&
      typeof obj.y === 'number' &&
      typeof obj.width === 'number' &&
      typeof obj.height === 'number'
    );
  }
  if (t === 'arrow') {
    return typeof obj.from === 'object' && typeof obj.to === 'object';
  }
  return false;
}

// Parse all complete element objects out of an accumulated JSON buffer.
// Finds the "elements":[ array, then extracts each top-level {...} object
// as soon as brace depth returns to zero. Called after each SSE chunk so
// new elements are surfaced incrementally while the stream is live.
function extractElementsFromBuffer(buffer: string): Element[] {
  const match = buffer.match(/"elements"\s*:\s*\[/);
  if (!match || match.index === undefined) return [];
  const elements: Element[] = [];
  let depth = 0;
  let start = -1;
  for (let i = match.index + match[0].length; i < buffer.length; i++) {
    const ch = buffer[i];
    if (ch === '{') {
      if (depth === 0) start = i;
      depth++;
    } else if (ch === '}') {
      depth--;
      if (depth === 0 && start >= 0) {
        try {
          const el = JSON.parse(buffer.slice(start, i + 1));
          if (isValidElement(el)) elements.push(el);
        } catch {
          /* skip malformed */
        }
        start = -1;
      }
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
  const isReview = payload.mode === 'review' || payload.mode === 'ask';

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
        if (isReview) {
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

  if (isReview) {
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
