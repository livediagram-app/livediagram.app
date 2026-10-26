# API documentation (OpenAPI)

`GET /api/openapi.json` serves an OpenAPI 3.1 description of the `/api/*` surface, assembled from a declarative route
manifest plus component schemas generated from `@livedocuments/api-schema`, with a drift test pinning both to the real
handlers. A human-facing reference in the help centre links to it (`apps/help`, the **Developers** category,
[Help app](../018-help/help-app.md)).

## Why

The api worker ([API app](api.md)) is described in prose in [API app](api.md) and the per-feature specs, and its
payload shapes are compile-time types in `@livedocuments/api-schema`, imported by both the worker and the editor so the
typechecker catches drift between the two. Neither says, in a form tooling can read, what the paths, methods, auth
requirements and status codes are: an integrator needs something to point a client generator, a Postman import or a
docs viewer at.

So the OpenAPI document is generated from the existing source of truth, never hand-maintained in parallel, and cannot
fall behind the real routes without turning CI red, within the bounds the drift test states below.

## Goals

- One OpenAPI 3.1 document covering every `/api/*` endpoint: path template, method, summary, auth scheme, request
  body schema, response schema(s), and the meaningful status codes (200/201/204/400/401/403/404/409, and 429 where a
  limiter applies).
- Served at **`GET /api/openapi.json`**: public, no auth, cacheable. It is the contract, not data.
- **Component schemas reuse `@livedocuments/api-schema`**: DTO shapes are generated from those TS types, never
  re-typed by hand.
- **A drift test** in CI that fails when a `(method, path-template)` is reachable in the worker's dispatch but absent
  from the document, or the other way round, to the precision stated under "Drift test".
- No external service and no secrets: the document is produced at build time and served by the worker.

## Non-goals

- **Runtime request validation.** The handlers' bodies are validated by hand, not from schemas; Zod (or similar)
  validators the document falls out of would touch every handler.
- **Generated client SDKs** and an interactive "try it" console with live auth.
- **A viewer page** (Scalar, Redoc, Stoplight Elements): the JSON is served, and a reader brings their own tooling.
- **The realtime WebSocket protocol** (`GET /api/documents/:id/ws` and the Durable Object op messages). The WS upgrade
  is listed as an endpoint, but its message protocol is in [API app](api.md) prose.

## Approach

The worker uses vanilla `fetch` handlers with segment-based dispatch (`apps/api/src/index.ts` to `routes/*.ts`), not
Hono ([Architecture](../../development/architecture.md)). Rewriting the dispatch as `@hono/zod-openapi` routes would
replace the whole routing layer and the api-schema types, so the document comes from a declarative manifest beside the
vanilla handlers instead:

- **Route manifest**: `apps/api/src/openapi/manifest.ts`, one entry per endpoint: the method, the path template
  (`/api/...` with `{param}` placeholders), a summary, the auth mode (`public`, `guest-or-clerk`, or `clerk`, the
  manifest's name for Bearer-only), optional request and response schema names, and the meaningful status codes. It
  is plain data referencing DTO names from `@livedocuments/api-schema`, the single declaration of the surface.
- **Component schemas**: generated from the api-schema TS types into JSON Schema (`ts-json-schema-generator`) and
  emitted into `components.schemas`.
- **Assembly**: the manifest, the generated schemas and the one auth scheme (a Bearer: an account access token, a
  guest token or an API token, [Auth + guest access](../014-identity/auth-and-guest-access.md)) compose into one
  OpenAPI 3.1 object, which the worker serves verbatim. There is no per-request work beyond a memoised build.
- **Drift test**: the dispatch is imperative, so there is no route table to diff; the manifest is the declaration and
  the test pins it to the running dispatch. Every `requestSchema` / `responseSchema` name must also exist in
  `@livedocuments/api-schema`.

### Drift test

The route inventory is taken from the worker itself, by probing it:

- **Vocabulary.** For each resource segment in `index.ts`'s dispatch switch, the literals its route modules compare a path position against (`segments[k] === '<literal>'`), read from the source, plus a placeholder standing in for any path parameter.
- **Probe.** Every `(method, path)` built from that vocabulary, for GET, POST, PUT, DELETE and PATCH, one level deeper than the deepest known path, is sent through the real `fetch` handler as a signed-in caller, with feature gates open and every storage binding (the documents' Durable Objects and their store) and outbound `fetch` replaced by a trap that records the touch and throws.
- **Outcomes.** A clean 404 / 405 without a touch is _not routed_. Any other answer without a touch is _routed_: that exact method and path are served. A touch means the path is served, but not which methods, because most handlers load and authorise the resource before branching on the verb.

What the test then proves:

1. Every manifest entry is served: its `(method, path)` is never _not routed_.
2. Every path the probe finds served matches a manifest path template.
3. Every _routed_ `(method, path)` matches a manifest entry with that method.
4. Every literal the route code discriminates on appears at that position in a manifest template of its segment, so a literal route shadowed by a parameter sibling (`/teams/stats` beside `/teams/{id}`) cannot hide behind the parameter's template.
5. Every verb a segment's route modules compare `request.method` against is documented for that segment.

And what it does not: for a handler that touches storage before branching on the verb, method parity holds per resource segment (rule 5), not per path; a new verb on such a path passes when the segment already documents that verb elsewhere. The vocabulary also depends on route code reading path segments only as `segments[<digit>]` or `segments.length` and never comparing an alias of one against a literal; the test enforces both, since a literal reached any other way would be invisible to the probe.

Two consequences for route code: every handler matches its **full** path, so an unknown suffix (`/api/capabilities/x`) is a 404 rather than an undocumentable alias; and a handler routes before it loads, so an unknown path under a resource 404s without a storage read.

## Auth and secrets

The document declares one auth scheme (`Authorization: Bearer`, carrying an account access token, a guest token or an API token) and marks each endpoint public or not, but carries **no secrets, keys, or URLs** ([Secrets policy](../002-project-scope/secrets-policy.md)). The `/api/openapi.json` endpoint is public and unauthenticated, like `GET /api/capabilities`.

## Files

All under `apps/api/src/openapi/` unless noted:

- **`manifest.ts`**: `ROUTE_MANIFEST`, one `RouteSpec` per endpoint (method,
  path template, resource segment, tag, summary, `auth` mode, an
  `x-token-usable` hint for external-token callers, optional query params, and
  request/response bodies). A body is either a component name (a `$ref` into the
  generated schemas) or an inline JSON Schema for the small response envelopes
  (`{ documents: DocumentSummary[] }` etc.) that aren't named DTOs.
- **`schemas.generated.ts`**: committed, generated by
  `apps/api/scripts/gen-openapi-schemas.mjs` (`pnpm --filter @livedocuments/api gen:openapi`)
  from the api-schema TS types via `ts-json-schema-generator` (`expose: 'export'`
  so only exported DTOs become named components; `Record<…>`/`Partial<…>`
  utilities inline). The generator is a dev dependency only and is **not** in the
  worker bundle: nothing on the runtime path imports it.
- **`document.ts`**: `buildOpenApiDocument()` assembles the manifest + generated
  schemas + the one security scheme (`Bearer` = account access token, guest token
  **or** API token) + a shared `Error` envelope into the 3.1
  object. Path parameters are derived from the `{param}` placeholders, so the
  manifest doesn't repeat them. Pure and deterministic.
- **`routes/openapi.ts`**: `handleOpenapi`, dispatched from `index.ts` on the
  `openapi.json` segment. GET only, public, `Cache-Control: public, max-age=3600`,
  memoised once per isolate.
- **`route-parity.test.ts`** + **`dispatch-probe.ts`**: the `(method,
path-template)` parity described under "Drift test", run in the api worker's
  Node test env against `index.ts`'s default export.
- **`manifest.test.ts`**: the remaining guards: (1) the manifest's segment set
  equals the `case '…':` labels in `index.ts`'s dispatch, in both directions,
  and every verb a segment's handlers compare against is documented for it;
  (2) every schema the manifest / assembled document references exists; (3) the
  committed `schemas.generated.ts` deep-equals a fresh generation, so a DTO
  change that wasn't regenerated fails CI; (4) the 429 each operation declares
  mirrors `index.ts`'s limiters. The (method, path) pairs are also asserted
  unique.
- **Media types**: a success body is `application/json` unless the entry sets
  `responseMediaType`; the tab render (`GET /documents/{id}/tabs/{tabId}/render.svg`) declares
  `image/svg+xml`.

The served document validates as OpenAPI 3.1 (checked with `@redocly/cli`). The
realtime WebSocket op protocol is in [API app](api.md) prose;
the `GET …/ws` upgrade is listed but its message protocol is not.

## Out of scope

- The marketing, editor and help frontends (static Next exports) are not OpenAPI surfaces.
- Versioning the API (`/api/v2`): the surface is single-version.
