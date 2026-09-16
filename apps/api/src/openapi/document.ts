// Assembles the OpenAPI 3.1 document served at GET /api/openapi.json (spec/37)
// from three runtime-safe inputs: the route manifest (the declared surface),
// the generated component schemas (derived from @livediagram/api-schema), and
// the static auth-scheme / info metadata below. Pure and deterministic — the
// worker memoises the result once per isolate (see routes/openapi.ts). No part
// of the heavy schema GENERATOR is imported here; this file only consumes its
// committed output.

import { COMPONENT_SCHEMAS } from './schemas.generated';
import { ROUTE_MANIFEST, type AuthMode, type RouteSpec } from './manifest';
import type { BodySchema, JsonSchema, OpenApiDocument } from './types';

// The error envelope every 4xx/5xx shares (`responses.ts`: `{ error, message? }`).
// Not a named DTO in api-schema (it's a worker response shape), so it's defined
// here and merged into the components alongside the generated schemas.
const ERROR_SCHEMA: JsonSchema = {
  type: 'object',
  properties: {
    error: { type: 'string', description: 'Stable snake_case error token.' },
    message: { type: 'string', description: 'Optional human-readable detail.' },
  },
  required: ['error'],
};

const SECURITY_SCHEMES: Record<string, JsonSchema> = {
  // A Clerk session JWT OR an API token (`lvd_…`), both presented as
  // `Authorization: Bearer <credential>` (spec/04, spec/61).
  Bearer: {
    type: 'http',
    scheme: 'bearer',
    description:
      'A Clerk session JWT or an API token (`lvd_…`). API tokens are the credential for external callers; create one in the Explorer (see the API tokens help article).',
  },
  // The guest path: an unsigned per-browser owner id (spec/04). First-party
  // app use; an `X-Owner-Sig` HMAC is also required once enforcement is on.
  GuestId: {
    type: 'apiKey',
    in: 'header',
    name: 'X-Owner-Id',
    description:
      'Per-browser guest owner id. First-party app path; external callers use a Bearer token.',
  },
};

function securityFor(auth: AuthMode): Record<string, string[]>[] {
  switch (auth) {
    case 'public':
      // Explicit empty requirement = "no auth needed" (and satisfies tooling
      // that wants every operation's security stated).
      return [];
    case 'clerk':
      return [{ Bearer: [] }];
    case 'guest-or-clerk':
      return [{ Bearer: [] }, { GuestId: [] }];
  }
}

function bodyToSchema(body: BodySchema): JsonSchema {
  return typeof body === 'string' ? { $ref: `#/components/schemas/${body}` } : body;
}

// `/diagrams/{id}` → ['id']. Drives the generated path-parameter list so the
// manifest doesn't repeat them.
function pathParams(path: string): string[] {
  return [...path.matchAll(/\{(\w+)\}/g)].flatMap((m) => (m[1] ? [m[1]] : []));
}

function operationId(route: RouteSpec): string {
  const slug = route.path.replace(/[{}]/g, '').split('/').filter(Boolean).join('-');
  return `${route.method.toLowerCase()}-${slug}`;
}

// 429 is applied in index.ts BEFORE dispatch, so no manifest entry declares it
// and none ever would. The help centre's errors-and-rate-limits article already
// tells integrators to expect it and back off; the machine-readable document
// they point a client generator at said nothing, on any of the 77 operations.
//
// Derived here rather than added to each entry because the rule is global.
// Writing it out 60-odd times by hand is the kind of copy that goes stale one
// route at a time.
//
// Mirrors index.ts exactly, which means NOT every operation:
//   - writes share a per-owner (or per-token) budget, except POST /events
//     (spec/22: telemetry must not be throttled into silence);
//   - GETs are throttled only under a token, so only the token-usable ones;
//   - GET /share/{code} is throttled per IP, to blunt share-code guessing.
// A read that no token can reach cannot 429, and saying otherwise would send
// an integrator writing retry logic for a status it will never see.
//
// One more exemption lives in index.ts: the room-ticket mint (a 429 there
// costs a member their whole realtime session). It needs no entry here because
// the mint has no manifest entry at all, the realtime handshake being
// documented in spec/11 rather than in the OpenAPI surface.
const RATE_LIMIT_EXEMPT_WRITES = new Set(['post /events']);

function isRateLimited(route: RouteSpec): boolean {
  const id = `${route.method.toLowerCase()} ${route.path}`;
  if (route.method === 'GET') return route.tokenUsable === true || route.path === '/share/{code}';
  return !RATE_LIMIT_EXEMPT_WRITES.has(id);
}

function responsesFor(route: RouteSpec): Record<string, unknown> {
  const responses: Record<string, unknown> = {};
  const success = route.statuses.find((s) => s >= 200 && s < 300);
  if (isRateLimited(route) && !route.statuses.includes(429)) {
    responses['429'] = {
      description: 'Rate limited. Back off and retry.',
      content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
    };
  }
  for (const status of route.statuses) {
    const key = String(status);
    if (status === success) {
      if (status === 204 || !route.responseSchema) {
        responses[key] = { description: 'Success.' };
      } else {
        responses[key] = {
          description: 'Success.',
          content: { 'application/json': { schema: bodyToSchema(route.responseSchema) } },
        };
      }
    } else if (status === 101) {
      responses[key] = { description: 'Switching Protocols (WebSocket upgrade).' };
    } else {
      responses[key] = {
        description: 'Error.',
        content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
      };
    }
  }
  return responses;
}

function operationFor(route: RouteSpec): Record<string, unknown> {
  const params = [
    ...pathParams(route.path).map((name) => ({
      name,
      in: 'path',
      required: true,
      schema: { type: 'string' },
    })),
    ...(route.query ?? []).map((q) => ({
      name: q.name,
      in: 'query',
      required: q.required,
      description: q.description,
      schema: { type: 'string' },
    })),
  ];

  const op: Record<string, unknown> = {
    tags: [route.tag],
    summary: route.summary,
    operationId: operationId(route),
    responses: responsesFor(route),
  };
  if (route.tokenUsable) op['x-token-usable'] = true;
  const security = securityFor(route.auth);
  if (security) op.security = security;
  if (params.length) op.parameters = params;
  if (route.requestSchema) {
    const isBinary =
      typeof route.requestSchema !== 'string' && route.requestSchema.format === 'binary';
    op.requestBody = {
      required: true,
      content: {
        [isBinary ? 'application/octet-stream' : 'application/json']: {
          schema: bodyToSchema(route.requestSchema),
        },
      },
    };
  }
  return op;
}

const TAGS = [
  { name: 'Diagrams', description: 'Create, read, update, and delete diagrams and their tabs.' },
  { name: 'Sharing', description: 'Share links, passwords, and the diagrams shared with you.' },
  { name: 'Folders', description: 'Organise diagrams into a personal or team folder tree.' },
  { name: 'Images', description: 'Upload, list, and reference image assets.' },
  { name: 'Themes', description: 'Saved custom themes.' },
  { name: 'Activity', description: 'Per-diagram change log.' },
  { name: 'API tokens', description: 'Mint and revoke the credentials external callers use.' },
  { name: 'Teams', description: 'Teams, members, invites, and shared libraries.' },
  { name: 'Participants', description: 'Display name and colour for a collaborator.' },
  { name: 'Account', description: 'Account-level data, preferences, and migration.' },
  { name: 'AI', description: 'Optional AI diagram assistant.' },
  { name: 'Telemetry', description: 'Anonymous first-party usage events and the public summary.' },
  { name: 'Meta', description: 'Capabilities, link unfurl, and this document.' },
];

/** Build the full OpenAPI 3.1 document. Deterministic; safe to memoise. */
export function buildOpenApiDocument(): OpenApiDocument {
  const paths: Record<string, Record<string, unknown>> = {};
  for (const route of ROUTE_MANIFEST) {
    const path = route.path;
    paths[path] ??= {};
    paths[path][route.method.toLowerCase()] = operationFor(route);
  }

  return {
    openapi: '3.1.0',
    info: {
      title: 'livediagram API',
      version: '1.0.0',
      description:
        'The REST API behind livediagram. The same surface the web editor uses, callable ' +
        'programmatically. External callers authenticate with an API token ' +
        '(`Authorization: Bearer lvd_…`); see the "API tokens" help article to create one. ' +
        'Endpoints an external token can use are marked `x-token-usable`. The realtime ' +
        'WebSocket protocol is documented in spec/11, not here.',
      license: { name: 'MIT' },
    },
    servers: [{ url: '/api', description: 'Same-origin API (e.g. https://livediagram.app/api).' }],
    tags: TAGS,
    paths,
    components: {
      schemas: { ...COMPONENT_SCHEMAS, Error: ERROR_SCHEMA },
      securitySchemes: SECURITY_SCHEMES,
    },
  };
}
