import {
  isPhotoAcceptedType,
  PHOTO_MAX_BYTES,
  PHOTO_MAX_NOTES,
  type DetectedNote,
  type PhotoNotesRequest,
  type PhotoNotesResponse,
} from '@livediagram/api-schema';
import { CORS_HEADERS, json } from '../responses';
import { aiGate } from './ai-gate';
import { buildPhotoNotesPrompt, photoNotesSchema } from './ai-photo-prompt';
import type { RouteContext } from './context';

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';

// Enough for ~120 notes of structured JSON, with room for long labels.
const MAX_TOKENS = 8000;
const MAX_TAB_NAME = 200;

// Read the sticky notes out of a photograph of a wall (spec/139 Phase 8).
//
// The bytes are forwarded to the model and DISCARDED: nothing is stored, and
// nothing about the image reaches a log line. What is logged is the model's
// status and how many notes came back — enough to diagnose a failure, nothing
// that could reconstruct someone's wall.
export async function handleAiPhotoNotes(ctx: RouteContext): Promise<Response> {
  const { request, env } = ctx;

  const refused = await aiGate(ctx);
  if (refused) return refused;

  let body: PhotoNotesRequest;
  try {
    body = (await request.json()) as PhotoNotesRequest;
  } catch {
    return json({ error: 'photo_invalid' }, { status: 400 });
  }

  const image = typeof body?.image === 'string' ? body.image : '';
  const parsed = parseDataUrl(image);
  if (!parsed) return json({ error: 'photo_invalid' }, { status: 400 });
  if (parsed.bytes > PHOTO_MAX_BYTES) return json({ error: 'photo_too_large' }, { status: 413 });

  const tabName = typeof body.tabName === 'string' ? body.tabName.slice(0, MAX_TAB_NAME) : '';

  const model = env.OPENAI_VISION_MODEL ?? env.OPENAI_MODEL ?? 'gpt-4o';

  let res: Response;
  try {
    res = await fetch(OPENAI_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        max_tokens: MAX_TOKENS,
        messages: [
          { role: 'system', content: buildPhotoNotesPrompt(tabName) },
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Read the sticky notes in this photo.' },
              // `detail: high` because the whole job is reading marker
              // handwriting: at low detail the model sees colours and shapes
              // and invents the words.
              { type: 'image_url', image_url: { url: image, detail: 'high' } },
            ],
          },
        ],
        // Structured outputs: the editor needs a whole list before it can
        // reconcile anything, so a loose JSON blob would only add a parser and
        // a class of failure.
        response_format: {
          type: 'json_schema',
          json_schema: { name: 'wall_notes', strict: true, schema: photoNotesSchema() },
        },
      }),
    });
  } catch {
    console.error('[ai/photo-notes] upstream call failed');
    return json({ error: 'ai_error' }, { status: 502 });
  }

  if (!res.ok) {
    console.error(`[ai/photo-notes] model responded ${res.status}`);
    return json({ error: 'ai_error' }, { status: 502 });
  }

  let payload: unknown;
  try {
    const completion = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = completion.choices?.[0]?.message?.content;
    payload = content ? JSON.parse(content) : null;
  } catch {
    console.error('[ai/photo-notes] model returned unparseable content');
    return json({ error: 'ai_error' }, { status: 502 });
  }

  const answer = clampAnswer(payload);
  console.log(
    `[ai/photo-notes] ok model=${model} wall=${answer.wall} notes=${answer.notes.length}`,
  );
  return json(answer, { headers: CORS_HEADERS });
}

// `data:<mime>;base64,<payload>` — and nothing else. The mime must be one the
// wire contract accepts (jpeg / png / webp), which keeps GIF's animation and
// SVG's script out by construction rather than by review.
function parseDataUrl(value: string): { type: string; bytes: number } | null {
  const match = /^data:([a-z/+-]+);base64,([A-Za-z0-9+/=]+)$/.exec(value);
  if (!match) return null;
  const type = match[1]!;
  if (!isPhotoAcceptedType(type)) return null;
  const b64 = match[2]!;
  // Decoded length from the base64 length: no need to materialise the bytes to
  // find out they are too many.
  const padding = b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0;
  return { type, bytes: Math.floor((b64.length * 3) / 4) - padding };
}

// Trust the schema, verify the numbers. Structured outputs guarantees the
// SHAPE; it guarantees nothing about a box that sits outside the image or a
// note with no text, and a downstream that has to re-check every field is a
// downstream that will forget to.
function clampAnswer(payload: unknown): PhotoNotesResponse {
  const obj = (payload ?? {}) as { notes?: unknown; wall?: unknown; hint?: unknown };
  const raw = Array.isArray(obj.notes) ? obj.notes : [];
  const notes: DetectedNote[] = [];
  for (const item of raw) {
    if (notes.length >= PHOTO_MAX_NOTES) break;
    const n = item as Partial<DetectedNote>;
    if (typeof n.text !== 'string' || n.text.trim() === '') continue;
    if (!inUnit(n.cx) || !inUnit(n.cy) || !inUnit(n.w) || !inUnit(n.h)) continue;
    if (n.w! <= 0 || n.h! <= 0) continue;
    notes.push({
      id: typeof n.id === 'number' ? n.id : notes.length,
      text: n.text.trim(),
      kind: (n.kind ?? 'unknown') as DetectedNote['kind'],
      colour: typeof n.colour === 'string' ? n.colour : '',
      size: n.size === 'wide' || n.size === 'small' ? n.size : 'square',
      cx: n.cx!,
      cy: n.cy!,
      w: n.w!,
      h: n.h!,
      row: typeof n.row === 'number' ? Math.max(0, Math.round(n.row)) : 0,
      order: typeof n.order === 'number' ? Math.max(0, Math.round(n.order)) : notes.length,
      confidence: typeof n.confidence === 'number' ? Math.min(1, Math.max(0, n.confidence)) : 1,
    });
  }
  return {
    notes,
    // Absent `wall` reads as true when notes came back: the interesting case
    // is the model SAYING it is not a wall, not it forgetting to say so.
    wall: obj.wall === false ? false : true,
    ...(typeof obj.hint === 'string' && obj.hint.trim() !== ''
      ? { hint: obj.hint.trim().slice(0, 200) }
      : {}),
  };
}

function inUnit(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1;
}
