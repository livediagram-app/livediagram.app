// GET /api/openapi.json (docs/specs/015-api/api-documentation.md): @liveworkspace/api-kit's route, memoised once per
// isolate, bound to this api's OpenAPI builder and answers.

import { createOpenApiRoute } from '@liveworkspace/api-kit/openapi-route';
import { buildOpenApiDocument } from '../openapi/document';
import { json, methodNotAllowed, notFound } from '../responses';

export const handleOpenapi = createOpenApiRoute({
  build: buildOpenApiDocument,
  json,
  methodNotAllowed,
  notFound,
});
