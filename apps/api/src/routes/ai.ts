import {
  badRequest,
  CORS_HEADERS,
  json,
  methodNotAllowed,
  missingAuth,
  rateLimited,
} from '../responses';
import { clientIp } from '../client-ip';
import { buildSystemPrompt, diagramTypeHint, extractExistingStyle } from '../ai-prompt';
import type { RouteContext } from './context';
import type { AiRequest } from '@livediagram/api-schema';

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';

const MAX_PROMPT_CHARS = 1000;
const MAX_ELEMENTS = 200;
const MAX_TOKENS_MUTATE = 8000;
const MAX_TOKENS_REVIEW = 400;
const MAX_HISTORY_TURNS = 6;

// ---------------------------------------------------------------------------
// Sanitise elements — strip anything that shouldn't leave the browser.
// ---------------------------------------------------------------------------
function sanitiseElements(elements: unknown[]): unknown[] {
  return elements.map((el) => {
    if (typeof el !== 'object' || el === null) return el;
    const {
      id,
      type,
      shape,
      x,
      y,
      width,
      height,
      label,
      strokeWidth,
      strokeStyle,
      borderRadius,
      textSize,
      textBold,
      textItalic,
      opacity,
      locked,
      from,
      to,
      arrowStyle,
      arrowEnds,
      groupId,
      aspectLocked,
    } = el as Record<string, unknown>;
    return {
      id,
      type,
      shape,
      x,
      y,
      width,
      height,
      label,
      strokeWidth,
      strokeStyle,
      borderRadius,
      textSize,
      textBold,
      textItalic,
      opacity,
      locked,
      from,
      to,
      arrowStyle,
      arrowEnds,
      groupId,
      aspectLocked,
    };
  });
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------
export async function handleAi(ctx: RouteContext): Promise<Response> {
  const { request, env } = ctx;

  if (!env.OPENAI_API_KEY) return json({ error: 'ai_not_configured' }, { status: 503 });

  // Origin allow-list (spec/25). Optional: when AI_ALLOWED_ORIGINS is
  // unset the worker accepts any Origin, matching the historical OSS
  // self-host story. When set, the request's Origin header must match
  // one of the comma-separated entries exactly. The check runs BEFORE
  // auth + rate-limit so a third-party site can't even probe the
  // endpoint for state. We compare case-sensitive against the raw
  // header value: every modern browser sends a canonical lower-case
  // scheme + host, and we want a strict deny default.
  if (env.AI_ALLOWED_ORIGINS && env.AI_ALLOWED_ORIGINS.length > 0) {
    const allowed = env.AI_ALLOWED_ORIGINS.split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    const origin = request.headers.get('Origin');
    if (!origin || !allowed.includes(origin)) {
      return json({ error: 'origin_not_allowed' }, { status: 403 });
    }
  }

  // Clerk-only gate (spec/25). When AI_REQUIRE_CLERK="true", reject
  // the legacy X-Owner-Id guest path so the AI feature can't be
  // driven by an attacker minting fresh per-request UUIDs to drain
  // the operator's OpenAI budget. The flag is opt-in so an OSS self-
  // host that doesn't run Clerk at all (the pure-guest path) keeps
  // the feature usable; hosted livediagram.app sets it to "true".
  if (env.AI_REQUIRE_CLERK === 'true' && ctx.clerkUserId == null) {
    return json({ error: 'sign_in_required' }, { status: 401 });
  }

  const owner = ctx.resolveOwner();
  if (!owner) return missingAuth();

  if (request.method !== 'POST') return methodNotAllowed();

  if (env.AI_RATE_LIMITER) {
    const ip = clientIp(request, 'unknown');
    const { success } = await env.AI_RATE_LIMITER.limit({ key: ip });
    if (!success) return rateLimited();
  }

  let body: AiRequest;
  try {
    body = (await request.json()) as AiRequest;
  } catch {
    return badRequest('invalid JSON');
  }

  const { mode, prompt, elements, tabName, focusIds = [], history = [] } = body;

  if (!mode || !['clean', 'ask'].includes(mode)) return badRequest('invalid mode');
  if (typeof prompt !== 'string') return badRequest('prompt must be a string');
  if (prompt.length > MAX_PROMPT_CHARS) return badRequest('prompt too long');
  if (!Array.isArray(elements)) return badRequest('elements must be an array');
  if (elements.length > MAX_ELEMENTS) return badRequest('too many elements');
  // Bound the remaining body fields that reach the system prompt —
  // prompt/elements/history are capped above/below, but an unbounded
  // focusIds or tabName near the 8 MB body cap would still build a
  // multi-megabyte upstream prompt (pure operator-cost amplification).
  if (!Array.isArray(focusIds) || focusIds.length > MAX_ELEMENTS) {
    return badRequest('too many focusIds');
  }
  if (focusIds.some((id) => typeof id !== 'string' || id.length > 100)) {
    return badRequest('invalid focusIds');
  }
  if (typeof tabName === 'string' && tabName.length > 200) return badRequest('tabName too long');

  const model = env.OPENAI_MODEL ?? 'gpt-4o';
  const isTextMode = mode === 'ask';
  const safe = sanitiseElements(elements);
  const systemPrompt = buildSystemPrompt(
    mode,
    typeof tabName === 'string' ? tabName : '',
    focusIds,
    prompt,
  );

  const typeHint = !isTextMode ? diagramTypeHint(prompt) : '';
  const existingStyle = !isTextMode ? extractExistingStyle(safe) : '';

  const userContent = isTextMode
    ? `Diagram elements:\n${JSON.stringify(safe)}\n\n${prompt.trim() || 'Answer any questions about this diagram.'}`
    : [
        `Existing diagram elements:\n${JSON.stringify(safe)}`,
        existingStyle && `Style to match: ${existingStyle}`,
        typeHint && `Layout guidance: ${typeHint}`,
        `Request: ${prompt.trim() || 'Clean up this diagram.'}`,
      ]
        .filter(Boolean)
        .join('\n\n');

  const safeHistory = history
    .slice(-MAX_HISTORY_TURNS)
    .filter((t) => t.role === 'user' || t.role === 'assistant')
    .map((t) => ({ role: t.role, content: String(t.content).slice(0, 2000) }));

  const messages = [
    { role: 'system', content: systemPrompt },
    ...safeHistory,
    { role: 'user', content: userContent },
  ];

  const oaiRes = await fetch(OPENAI_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages,
      stream: true,
      max_tokens: isTextMode ? MAX_TOKENS_REVIEW : MAX_TOKENS_MUTATE,
      ...(isTextMode ? {} : { response_format: { type: 'json_object' } }),
    }),
  });

  if (!oaiRes.ok || !oaiRes.body) {
    const errText = await oaiRes.text().catch(() => '');
    console.error('OpenAI error:', oaiRes.status, errText);
    return json({ error: 'ai_error' }, { status: 502 });
  }

  return new Response(oaiRes.body, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      ...CORS_HEADERS,
    },
  });
}
