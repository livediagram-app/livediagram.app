import {
  CROP_MAX_BYTES,
  isPhotoAcceptedType,
  READ_MAX_CROPS_PER_REQUEST,
  type NoteText,
  type ReadNotesRequest,
  type ReadNotesResponse,
} from '@livediagram/api-schema';
import { CORS_HEADERS, json } from '../responses';
import { chatCompletions, providerOf } from '../ai-client';
import { aiGate } from './ai-gate';
import { buildReadNotesPrompt } from './ai-read-prompt';
import type { RouteContext } from './context';

// Enough for 16 short phrases with room to spare; a sticky holds a few words.
const MAX_TOKENS = 2000;
// A note is a phrase, not an essay. Anything longer is a model running away.
const MAX_TEXT_CHARS = 200;

// Read the handwriting on sticky-note crops (spec/139 Phase 8).
//
// The crops arrive already cut out by the browser, which is also where the
// stickies were FOUND. This route does one thing: hand the pictures to the
// model and hand the words back, validated. The bytes are forwarded and
// discarded — nothing is stored, and nothing about an image reaches a log line.
export async function handleAiReadNotes(ctx: RouteContext): Promise<Response> {
  const { request, env } = ctx;

  const refused = await aiGate(ctx);
  if (refused) return refused;

  let body: ReadNotesRequest;
  try {
    body = (await request.json()) as ReadNotesRequest;
  } catch {
    return json({ error: 'crops_invalid' }, { status: 400 });
  }

  const crops = Array.isArray(body?.crops) ? body.crops : null;
  if (!crops || crops.length === 0) return json({ error: 'crops_invalid' }, { status: 400 });
  if (crops.length > READ_MAX_CROPS_PER_REQUEST) {
    return json({ error: 'crops_invalid' }, { status: 400 });
  }

  let totalBytes = 0;
  for (const crop of crops) {
    if (!Number.isInteger(crop?.id)) return json({ error: 'crops_invalid' }, { status: 400 });
    const parsed = parseDataUrl(typeof crop.image === 'string' ? crop.image : '');
    if (!parsed) return json({ error: 'crops_invalid' }, { status: 400 });
    totalBytes += parsed.bytes;
    if (parsed.bytes > CROP_MAX_BYTES || totalBytes > CROP_MAX_BYTES * READ_MAX_CROPS_PER_REQUEST) {
      return json({ error: 'crops_too_large' }, { status: 413 });
    }
  }

  // The gate has already refused a deployment with no usable provider.
  const provider = providerOf(env)!;
  const model = provider.visionModel;
  // One user message: each crop introduced by the id it must be answered
  // under, so the model never has to infer which picture it is talking about.
  const content: unknown[] = [{ type: 'text', text: `Read these ${crops.length} sticky notes.` }];
  for (const crop of crops) {
    content.push({ type: 'text', text: `Crop ${crop.id}:` });
    content.push({ type: 'image_url', image_url: { url: crop.image, detail: 'high' } });
  }

  let res: Response;
  try {
    res = await chatCompletions(provider, {
      model,
      max_tokens: MAX_TOKENS,
      messages: [
        { role: 'system', content: buildReadNotesPrompt() },
        { role: 'user', content },
      ],
      // JSON mode rather than a strict schema: not every OpenAI-compatible
      // provider supports the strict form, and we validate every field below
      // in any case — a promise from a provider is not a check.
      response_format: { type: 'json_object' },
    });
  } catch {
    console.error('[ai/read-notes] provider call failed');
    return json({ error: 'ai_error' }, { status: 502 });
  }

  if (!res.ok) {
    console.error(`[ai/read-notes] provider responded ${res.status}`);
    return json({ error: 'ai_error' }, { status: 502 });
  }

  let payload: unknown;
  try {
    const completion = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const raw = completion.choices?.[0]?.message?.content;
    payload = raw ? JSON.parse(raw) : null;
  } catch {
    console.error('[ai/read-notes] provider returned unparseable content');
    return json({ error: 'ai_error' }, { status: 502 });
  }

  const answer = collate(
    payload,
    crops.map((c) => c.id),
  );
  const legible = answer.texts.filter((t) => t.legible).length;
  console.log(`[ai/read-notes] ok model=${model} crops=${crops.length} legible=${legible}`);
  return json(answer, { headers: CORS_HEADERS });
}

// `data:<mime>;base64,<payload>` — and nothing else. The mime must be one the
// wire contract accepts, which keeps GIF's animation and SVG's script out by
// construction rather than by review.
function parseDataUrl(value: string): { type: string; bytes: number } | null {
  const match = /^data:([a-z/+-]+);base64,([A-Za-z0-9+/=]+)$/.exec(value);
  if (!match) return null;
  const type = match[1]!;
  if (!isPhotoAcceptedType(type)) return null;
  const b64 = match[2]!;
  const padding = b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0;
  return { type, bytes: Math.floor((b64.length * 3) / 4) - padding };
}

// Every crop that went out gets an answer back, whatever the model said.
// An id it skipped, an id it invented, a text that is not a string: all of
// them resolve to "the paper was there, the words were not readable", because
// the note still has to land.
function collate(payload: unknown, ids: number[]): ReadNotesResponse {
  const raw = (payload as { texts?: unknown })?.texts;
  const byId = new Map<number, NoteText>();
  if (Array.isArray(raw)) {
    for (const item of raw) {
      const t = item as Partial<NoteText>;
      if (!Number.isInteger(t?.id) || !ids.includes(t.id as number)) continue;
      const text = typeof t.text === 'string' ? t.text.trim().slice(0, MAX_TEXT_CHARS) : '';
      byId.set(t.id as number, {
        id: t.id as number,
        text,
        // A model that says "legible" and hands back nothing has not read it.
        legible: t.legible === true && text !== '',
      });
    }
  }
  return {
    texts: ids.map((id) => byId.get(id) ?? { id, text: '', legible: false }),
  };
}
