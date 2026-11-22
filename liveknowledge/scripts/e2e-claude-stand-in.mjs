// The e2e stack's stand-in for the two providers' APIs (docs/specs/003-system-architecture/e2e-smoke.md "The model
// stand-in"): a tiny server on the loopback that answers `POST /v1/messages` the way Anthropic's Messages API
// streams and `POST /v1/responses` the way OpenAI's Responses API does, so Ask, the conflict check and Describe to
// Set Up run end to end with no model, no network and no real key. `POST /workers-ai/run` answers Describe to Set
// Up's built-in AI as the Workers AI binding would (`{ response }`, the object JSON mode parsed), and a streamed ask
// (`stream: true`: Ask and the conflict check on built-in AI) as an event stream of `{ response }` pieces, then
// `[DONE]`. The api reaches it
// only because the stack sets `E2E_CLAUDE_STAND_IN` (apps/api/src/knowledge/model-door.ts `modelDoorFor`,
// setup-built-in-ai.ts `builtInAi`).
//
// What it answers is worked out from the request alone, so a spec knows what to expect:
//   - a key containing "refused" is not accepted (401, in the provider's own error shape);
//   - a question whose request carries passages is answered in two sentences, the first citing passage 1 and the
//     second the last passage sent, when there are two or more;
//   - a question with no passages is not answered, and comes back as one gap: the question itself;
//   - a description (Describe to Set Up) gets `SETUP_STRUCTURE` as JSON, or text that is no JSON when the
//     description holds "not json";
//   - a request with none of these (the conflict check) gets a reply that names no conflict.
// The answer arrives in several pieces, a few milliseconds apart, so a page can be seen streaming it.
import http from 'node:http';

const PIECE_GAP_MS = 40;

const questionOf = (content) => /<question>\n([\s\S]*?)\n<\/question>/.exec(content)?.[1]?.trim();
const passageNumbersOf = (content) =>
  [...content.matchAll(/<passage number="(\d{1,3})"/g)].map((m) => Number(m[1]));

/** The structure every description is answered with (packages/knowledge/src/setup-suggestion.ts reads it). */
export const SETUP_STRUCTURE = {
  name: 'Engineering Handbook',
  pages: [
    {
      id: 1,
      title: 'Getting Started',
      summary: 'What a new engineer needs in their first week.',
      headings: ['Accounts', 'Your First Change'],
      parent: null,
    },
    {
      id: 2,
      title: 'Local Setup',
      summary: 'How to run the stack on your own machine.',
      headings: ['Requirements'],
      parent: 1,
    },
    {
      id: 3,
      title: 'How We Ship',
      summary: 'From a branch to production.',
      headings: ['Reviews', 'Releases'],
      parent: null,
    },
    {
      id: 4,
      title: 'On-Call',
      summary: 'Who is paged, and what to do first.',
      headings: [],
      parent: 3,
    },
    {
      id: 5,
      title: 'Decisions',
      summary: 'The choices we made and why.',
      headings: ['How to Propose One'],
      parent: null,
    },
  ],
};

const descriptionOf = (content) =>
  /<description>\n([\s\S]*?)\n<\/description>/.exec(content)?.[1]?.trim();

/** The reply's text for a request body of either provider, in the form its reader expects
 *  (packages/knowledge/src/ask-answer.ts, setup-suggestion.ts). */
export function standInReply(body) {
  const turns = Array.isArray(body?.messages) ? body.messages : body?.input;
  const last = Array.isArray(turns) ? turns[turns.length - 1] : undefined;
  const content = typeof last?.content === 'string' ? last.content : '';
  const description = descriptionOf(content);
  if (description !== undefined)
    return description.includes('not json')
      ? 'Here is a structure you could use.'
      : JSON.stringify(SETUP_STRUCTURE);
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

const json = (res, status, body) => {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
};
const pause = () => new Promise((resolve) => setTimeout(resolve, PIECE_GAP_MS));
const STREAM_HEADERS = { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store' };

// Anthropic's Messages API: the key in `x-api-key`, `message_start` to `message_stop`.
async function answerClaude(req, res, body) {
  if (String(req.headers['x-api-key'] ?? '').includes('refused'))
    return json(res, 401, {
      type: 'error',
      error: { type: 'authentication_error', message: 'no' },
    });
  const model = typeof body?.model === 'string' ? body.model : 'stand-in';
  res.writeHead(200, STREAM_HEADERS);
  res.write(event('message_start', { message: { model } }));
  for (const piece of piecesOf(standInReply(body))) {
    res.write(
      event('content_block_delta', { index: 0, delta: { type: 'text_delta', text: piece } }),
    );
    await pause();
  }
  res.write(event('message_delta', { delta: { stop_reason: 'end_turn' } }));
  res.end(event('message_stop', {}));
}

// OpenAI's Responses API: the key as a bearer token, `response.created` to `response.completed`.
async function answerOpenAi(req, res, body) {
  if (String(req.headers.authorization ?? '').includes('refused'))
    return json(res, 401, {
      error: { message: 'no', type: 'invalid_request_error', param: null, code: 'invalid_api_key' },
    });
  const model = typeof body?.model === 'string' ? body.model : 'stand-in';
  const response = { model, error: null, incomplete_details: null };
  res.writeHead(200, STREAM_HEADERS);
  res.write(event('response.created', { response: { ...response, status: 'in_progress' } }));
  for (const piece of piecesOf(standInReply(body))) {
    res.write(
      event('response.output_text.delta', { output_index: 0, content_index: 0, delta: piece }),
    );
    await pause();
  }
  res.end(event('response.completed', { response: { ...response, status: 'completed' } }));
}

// Workers AI's binding, as the api's `builtInAi` asks it: `{ model, input }`. Streamed when the input asks, as the
// binding streams; else answered whole: JSON mode hands back the reply as an object, text that is no JSON as text.
async function answerWorkersAi(_req, res, body) {
  const text = standInReply(body?.input);
  if (body?.input?.stream === true) {
    res.writeHead(200, STREAM_HEADERS);
    for (const piece of piecesOf(text)) {
      res.write(`data: ${JSON.stringify({ response: piece })}\n\n`);
      await pause();
    }
    return res.end('data: [DONE]\n\n');
  }
  let response = text;
  try {
    response = JSON.parse(text);
  } catch {
    // Not JSON: the text as it is.
  }
  json(res, 200, { response });
}

const ROUTES = {
  '/v1/messages': answerClaude,
  '/v1/responses': answerOpenAi,
  '/workers-ai/run': answerWorkersAi,
};

async function answer(req, res) {
  const route = ROUTES[new URL(req.url, 'http://stand-in').pathname];
  if (req.method !== 'POST' || !route)
    return json(res, 404, { type: 'error', error: { type: 'not_found_error', message: 'none' } });
  await route(req, res, await readJson(req));
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
