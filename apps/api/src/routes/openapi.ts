import { buildOpenApiDocument } from '../openapi/document';
import type { OpenApiDocument } from '../openapi/types';
import { json, methodNotAllowed } from '../responses';
import type { RouteContext } from './context';

// GET /api/openapi.json — the machine-readable OpenAPI 3.1 description of the
// REST surface (docs/specs/015-api/api-documentation.md). Public, unauthenticated, and cacheable: it's the
// contract, not data, so no credential is needed (mirrors /api/capabilities).
// Built once per isolate from the route manifest + the generated component
// schemas; the assembly is pure, so memoising is safe.
let cached: OpenApiDocument | null = null;

export function handleOpenapi(ctx: RouteContext): Response {
  if (ctx.request.method !== 'GET') return methodNotAllowed();
  cached ??= buildOpenApiDocument();
  return json(cached, { headers: { 'Cache-Control': 'public, max-age=3600' } });
}
