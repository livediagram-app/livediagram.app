// GET /api/openapi.json: the machine-readable OpenAPI 3.1 description of a product's REST surface (each product's
// docs/specs/015-api/api-documentation.md). Public, unauthenticated, and cacheable: it's the contract, not data, so
// no credential is needed (mirrors /api/capabilities). Built once per isolate from the product's route manifest and
// generated component schemas; the assembly is pure, so memoising is safe. Each api binds it once at module scope.

import type { OpenApiDocument } from './openapi-types';

export type OpenApiRouteDeps = {
  /** The product's OpenAPI description, assembled from its manifest. */
  build: () => OpenApiDocument;
  json: (body: unknown, init?: ResponseInit) => Response;
  methodNotAllowed: () => Response;
  notFound: () => Response;
};

/** The `/api/openapi.json` route, bound to a product's builder and answers. */
export function createOpenApiRoute(
  deps: OpenApiRouteDeps,
): (ctx: { request: Request; segments: readonly string[] }) => Response {
  const { build, json, methodNotAllowed, notFound } = deps;
  let cached: OpenApiDocument | null = null;
  return (ctx) => {
    if (ctx.segments.length !== 2) return notFound();
    if (ctx.request.method !== 'GET') return methodNotAllowed();
    cached ??= build();
    return json(cached, { headers: { 'Cache-Control': 'public, max-age=3600' } });
  };
}
