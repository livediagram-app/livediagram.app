// The e2e stack's stand-in for the Anthropic API (docs/specs/003-system-architecture/e2e-smoke.md "The Claude
// stand-in"): a tiny server on the loopback that answers `POST /v1/messages` the way the Messages API streams, so
// Ask and the conflict check run end to end with no model, no network and no real key. The api reaches it only
// because the stack sets `E2E_CLAUDE_STAND_IN` (apps/api/src/knowledge/claude-door.ts `claudeDoorFor`).
//
// What it answers is worked out from the request alone, so a spec knows what to expect:
//   - a key containing "refused" is not accepted (401 `authentication_error`);
//   - a question whose request carries passages is answered in two sentences, the first citing passage 1 and the
//     second the last passage sent, when there are two or more;
//   - a question with no passages is not answered, and comes back as one gap: the question itself;
//   - a request with no question (the conflict check) gets a reply that names no conflict.
// The answer arrives in several pieces, a few milliseconds apart, so a page can be seen streaming it.
import http from 'node:http';

const PIECE_GAP_MS = 40;

const questionOf = (content) => /<question>\n([\s\S]*?)\n<\/question>/.exec(content)?.[1]?.trim();
const passageNumbersOf = (content) =>
  [...content.matchAll(/<passage number="(\d{1,3})"/g)].map((m) => Number(m[1]));

/** The reply's text for a request body, in the form Ask reads (packages/knowledge/src/ask-answer.ts). */
export function standInReply(body) {
  const last = body?.messages?.[body.messages.length - 1];
  const content = typeof last?.content === 'string' ? last.content : '';
  const question = questionOf(content);
  if (question === undefined) return '';
  const numbers = passageNumbersOf(content);
  if (numbers.length === 0)
    return `<answer>\nThe pages do not cover this.\n</answer>\n<gap>${question.replace(/[<>]/g, '')}</gap>`;
  const first = numbers[0];
  const lastNumber = numbers[numbers.length - 1];
  const second = lastNumber === first ? '' : ` Another page agrees [${lastNumber}].`;
  return `<answer>\nThe pages answer this [${first}].${second}\n</answer>`;
}

// The reply in pieces of a few words, so the tags of the form are split across pieces as a real stream splits them.
const piecesOf = (text) => text.match(/[\s\S]{1,12}/g) ?? [];

const event = (type, data) => `event: ${type}\ndata: ${JSON.stringify({ type, ...data })}\n\n`;

async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    return null;
  }
}

async function answer(req, res) {
  if (req.method !== 'POST' || new URL(req.url, 'http://stand-in').pathname !== '/v1/messages') {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ type: 'error', error: { type: 'not_found_error', message: 'none' } }));
    return;
  }
  const body = await readJson(req);
  if (String(req.headers['x-api-key'] ?? '').includes('refused')) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({ type: 'error', error: { type: 'authentication_error', message: 'no' } }),
    );
    return;
  }
  const model = typeof body?.model === 'string' ? body.model : 'stand-in';
  res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store' });
  res.write(event('message_start', { message: { model } }));
  for (const piece of piecesOf(standInReply(body))) {
    res.write(event('content_block_delta', { index: 0, delta: { type: 'text_delta', text: piece } }));
    await new Promise((resolve) => setTimeout(resolve, PIECE_GAP_MS));
  }
  res.write(event('message_delta', { delta: { stop_reason: 'end_turn' } }));
  res.end(event('message_stop', {}));
}

/** Starts the stand-in on a free loopback port and answers its origin. It never keeps the process alive. */
export function startClaudeStandIn() {
  const server = http.createServer((req, res) => {
    answer(req, res).catch(() => res.destroy());
  });
  server.unref();
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      resolve({ origin: `http://127.0.0.1:${server.address().port}`, close: () => server.close() });
    });
  });
}
