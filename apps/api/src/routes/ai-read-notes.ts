import {
  CROP_MAX_BYTES,
  isPhotoAcceptedType,
  READ_MAX_CROPS_PER_REQUEST,
  type NoteText,
  type ReadNotesRequest,
  type ReadNotesResponse,
} from '@livediagram/api-schema';
import { aiError, CORS_HEADERS, json } from '../responses';
import { chatCompletions, providerOf } from '../ai-client';
import { aiGate } from './ai-gate';
import { buildReadNotesPrompt, READ_NOTES_SCHEMA } from './ai-read-prompt';
import type { RouteContext } from './context';

// Enough for 16 short phrases with room to spare; a sticky holds a few words.
const MAX_TOKENS = 2000;
// A note is a phrase, not an essay. Anything longer is a model running away.
const MAX_TEXT_CHARS = 200;

// Read the handwriting on sticky-note crops (docs/specs/021-event-storming/event-storming.md Phase 8).
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
      // A strict schema where the provider is known to honour one; JSON mode
      // for a generic endpoint. Every field is validated below either way — a
      // promise from a provider is not a check.
      response_format: provider.strictSchema
        ? { type: 'json_schema', json_schema: READ_NOTES_SCHEMA }
        : { type: 'json_object' },
    });
  } catch (err) {
    console.error(
      '[ai/read-notes] provider call failed:',
      err instanceof Error ? err.message : String(err),
    );
    return aiError();
  }

  if (!res.ok) {
    // Say WHAT the provider complained about, not just that it did. A bare
    // status turns "your key is out of quota", "that payload is too big" and
    // "we are busy" into the same unactionable line in the log.
    const detail = await res.text().catch(() => '');
    console.error(
      `[ai/read-notes] provider responded ${res.status} crops=${crops.length} ${detail.slice(0, 300)}`,
    );
    // A key that has run out for the day is not "try again in a moment": it is
    // "try again tomorrow, or raise the limit". Passing it through as one more
    // ai_error sends the author back to retry something that cannot work yet.
    if (res.status === 429) return json({ error: 'ai_quota' }, { status: 429 });
    return aiError();
  }

  let payload: unknown;
  try {
    const completion = (await res.json()) as {
      choices?: { finish_reason?: string; message?: { content?: string } }[];
    };
    const choice = completion.choices?.[0];
    const raw = choice?.message?.content;
    // A reasoning model spends part of the budget THINKING, so a batch can run
    // out mid-answer and arrive as half-written JSON. That is indistinguishable
    // from a malformed answer unless the provider's own reason is carried into
    // the log — and "unparseable" would send someone after the parser rather
    // than after MAX_TOKENS.
    if (choice?.finish_reason === 'length') {
      console.error(
        `[ai/read-notes] answer truncated: finish_reason=length model=${model} crops=${crops.length} max_tokens=${MAX_TOKENS} — raise MAX_TOKENS or send fewer crops`,
      );
      return aiError();
    }
    if (!raw) {
      payload = null;
    } else {
      payload = extractJson(raw);
      if (payload === null) {
        // A malformed answer has to be diagnosable: log what the model actually
        // said (truncated), then fail rather than hand back a silent empty list.
        console.error(`[ai/read-notes] unparseable content: ${raw.slice(0, 300)}`);
        return aiError();
      }
    }
  } catch (err) {
    console.error(
      '[ai/read-notes] provider returned unparseable content:',
      err instanceof Error ? err.message : String(err),
    );
    return aiError();
  }

  const answer = collate(
    payload,
    crops.map((c) => c.id),
  );
  const legible = answer.texts.filter((t) => t.legible).length;
  console.log(`[ai/read-notes] ok model=${model} crops=${crops.length} legible=${legible}`);
  return json(answer, { headers: CORS_HEADERS });
}

// The model is asked for JSON and given JSON mode, but a reasoning model still
// sometimes wraps its answer in a fence or a sentence. Take the JSON out of
// whatever shape it arrived in, rather than trusting the mode to have worked.
function extractJson(raw: string): unknown | null {
  const trimmed = raw.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    /* not bare JSON */
  }
  const fenced = trimmed.replace(/^```(?:json)?\s*|\s*```$/g, '').trim();
  if (fenced !== trimmed) {
    try {
      return JSON.parse(fenced);
    } catch {
      /* not a clean fence either */
    }
  }
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start !== -1 && end > start) {
    try {
      return JSON.parse(trimmed.slice(start, end + 1));
    } catch {
      /* fall through */
    }
  }
  return null;
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
