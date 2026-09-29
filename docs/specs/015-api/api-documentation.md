# API documentation (OpenAPI)

> **Status: implemented.** `GET /api/openapi.json` serves a valid OpenAPI
> 3.1 description of the `/api/*` surface, assembled from a declarative
> route manifest plus component schemas generated from
> `@livediagram/api-schema`, with a drift test pinning both to the real
> handlers. The recommended approach in this spec is what shipped; the
> "As built" note at the end records the concrete file layout. A
> human-facing reference in the help centre links to this document
> (`apps/help`, the **Developers** category — see [Help app](../018-help/help-app.md)).

## Why

The api worker ([API app](api.md)) is documented two ways today:

- **Prose** in [API app](api.md) plus the per-feature specs (teams → [Teams](../013-workspace/teams.md), images → [Image element + per-owner gallery](../009-elements/images.md), telemetry → [Telemetry + public transparency dashboard](../017-telemetry/telemetry.md), change log → [Activity and audit log](../012-collaboration/activity-and-audit.md), share password / expiry → [Share password](../013-workspace/share-password.md) / [Share-link expiry](../013-workspace/share-link-expiry.md)).
- **Compile-time payload shapes** in `@livediagram/api-schema` — every request / response DTO, imported by both the worker (which builds them) and the live editor (which consumes them), so the typechecker catches drift between the two sides.

What's missing is a **single, machine-readable description of the surface**: the paths, methods, auth requirements, and status codes. The TS types cover payload _shape_ but say nothing about URL shape, verbs, or auth; the prose isn't discoverable, testable, or consumable by tooling. A self-hoster or integrator can't point a client generator, a Postman import, or a docs viewer at anything.

The goal is an **OpenAPI 3.1 document** for `/api/*` that is generated from the existing source of truth (not hand-maintained in parallel, which would drift — the one thing this repo most wants to avoid) and cannot fall behind the real routes without turning CI red, within the bounds the drift test states below.

## Goals

- One OpenAPI 3.1 document covering every `/api/*` endpoint (the surface enumerated in [API app](api.md)): path template, method, summary, auth scheme, request body schema, response schema(s), and the meaningful status codes (200/201/204/400/401/403/404/409).
- Served at **`GET /api/openapi.json`** — public, no auth, cacheable. It's the contract, not data, so a token holder isn't needed.
- **Component schemas reuse `@livediagram/api-schema`**: DTO shapes are generated from those TS types, never re-typed by hand. Adding a field to a DTO updates the doc automatically.
- **A drift test** (CI) that fails when a `(method, path-template)` is reachable in the worker's dispatch but absent from the OpenAPI doc, or vice versa, to the precision stated under "Drift test" below. This mirrors the test-pinned template / theme catalogues ([Canvas and palette](../008-canvas/canvas-and-palette.md)): the doc cannot fall behind the code without turning CI red.
- Self-hostable: the doc is produced at build time and served by the worker. No external service, no secrets, works in pure-guest mode (Clerk unset).

## Non-goals (v1)

- **Runtime request validation.** The handlers today cast `request.json()` to a TS type with no runtime check. Adding Zod (or similar) validators would be a real upgrade and would let the OpenAPI doc fall straight out of the validators, but it's a large migration touching every handler. Out of scope here; noted as a future direction below.
- **Generated client SDKs** and an interactive "try it" console with live auth.
- **Documenting the realtime WebSocket protocol** (`GET /api/documents/:id/ws` and the Durable Object op messages). OpenAPI describes the REST surface; the WS upgrade is listed as an endpoint but its message protocol stays in [API app](api.md) prose.

## Approach

The worker uses vanilla `fetch` handlers with segment-based dispatch (`apps/api/src/index.ts` → `routes/*.ts`), **not** Hono — see [docs/development/architecture.md](../../development/architecture.md). Two routes are therefore available:

1. **Migrate to `@hono/zod-openapi`** — rewrite the dispatch as Hono routes with Zod schemas, getting OpenAPI generation + runtime validation for free. Powerful, but it replaces the entire routing layer and the api-schema types with Zod schemas. Too large and too speculative for the payoff here. **Rejected for v1.**
2. **A declarative route manifest + schema generation, keeping the vanilla handlers.** **Recommended.**

### Recommended: route manifest + generated component schemas

- **Route manifest** — `apps/api/src/openapi/manifest.ts`: an array, one entry per endpoint. Each entry carries the method, the path template (`/api/...` with `{param}` placeholders), a summary, the auth mode (public / guest / clerk / either), optional request and response schema names, and the meaningful status codes. The manifest is plain data referencing DTO names from `@livediagram/api-schema`; it is the single declaration of the surface.
- **Component schemas** — generated from the api-schema TS types into JSON Schema (e.g. `ts-json-schema-generator` as a build step in `packages/api-schema` or the api worker), emitted into the OpenAPI `components.schemas`. Shapes are never re-typed; the manifest only references them by name.
- **Assembly** — a build step composes the manifest + generated schemas + the auth-scheme definitions (the guest `X-Owner-Id` header and the Clerk Bearer, per [Auth + guest access](../014-identity/auth-and-guest-access.md)) into one OpenAPI 3.1 object, written to a TS constant the worker serves verbatim at `GET /api/openapi.json`. Build-time generation keeps the request path a constant lookup, no per-request work.
- **Drift test** — the dispatch is segment-based and imperative, not declarative, so there is no route table to diff; the manifest is the declaration and the test pins it to the running dispatch (see "Drift test" below). Every `requestSchema` / `responseSchema` name must also exist in `@livediagram/api-schema`. This is the anti-drift guarantee; without it the doc is just another thing that rots.

### Drift test

The route inventory is taken from the worker itself, by probing it:

- **Vocabulary.** For each resource segment in `index.ts`'s dispatch switch, the literals its route modules compare a path position against (`segments[k] === '<literal>'`), read from the source, plus a placeholder standing in for any path parameter.
- **Probe.** Every `(method, path)` built from that vocabulary, for GET, POST, PUT, DELETE and PATCH, one level deeper than the deepest known path, is sent through the real `fetch` handler as a signed-in caller, with feature gates open and every storage binding (D1, R2, Durable Objects) and outbound `fetch` replaced by a trap that records the touch and throws.
- **Outcomes.** A clean 404 / 405 without a touch is _not routed_. Any other answer without a touch is _routed_: that exact method and path are served. A touch means the path is served, but not which methods, because most handlers load and authorise the resource before branching on the verb.

What the test then proves:

1. Every manifest entry is served: its `(method, path)` is never _not routed_.
2. Every path the probe finds served matches a manifest path template.
3. Every _routed_ `(method, path)` matches a manifest entry with that method.
4. Every literal the route code discriminates on appears at that position in a manifest template of its segment, so a literal route shadowed by a parameter sibling (`/teams/stats` beside `/teams/{id}`) cannot hide behind the parameter's template.
5. Every verb a segment's route modules compare `request.method` against is documented for that segment.

And what it does not: for a handler that touches storage before branching on the verb, method parity holds per resource segment (rule 5), not per path; a new verb on such a path passes when the segment already documents that verb elsewhere. The vocabulary also depends on route code reading path segments only as `segments[<digit>]` or `segments.length` and never comparing an alias of one against a literal; the test enforces both, since a literal reached any other way would be invisible to the probe.

Two consequences for route code: every handler matches its **full** path, so an unknown suffix (`/api/capabilities/x`) is a 404 rather than an undocumentable alias; and a handler routes before it loads, so an unknown path under a resource 404s without a storage read.

### Auth + secrets

The doc declares the two auth schemes (guest `X-Owner-Id` header; Clerk `Authorization: Bearer`) and tags each endpoint with which it accepts, but carries **no secrets, keys, or URLs** ([Secrets policy](../002-project-scope/secrets-policy.md)). The `/api/openapi.json` endpoint is public and unauthenticated, like `GET /api/capabilities`.

### Optional viewer

A human-facing viewer (Scalar / Redoc / Stoplight Elements) is nice but pulls a dependency. v1 ships the JSON only; a viewer can be a thin static page later (in the telemetry-dashboard mould) or left to the reader's own tooling. Decide when the JSON exists.

## Hard constraints honored

- Served by the **api worker**, not Next.js — no SSR, no Node runtime added ([AGENTS.md](../../../AGENTS.md) static-only rule).
- **Self-hostable** with no external dependency; the doc generates at build time and ships in the worker bundle.
- **Reuse over duplication**: component schemas come from `@livediagram/api-schema`, the existing single source of truth, never re-typed.

## Future direction

If runtime request validation is wanted later, introduce Zod schemas for request bodies in the handlers and derive both the validation and the OpenAPI component schemas from them, retiring the hand-listed `requestSchema` references in the manifest. That subsumes this spec's payload half while keeping the manifest's path / method / auth / status declarations.

## As built

The recommended route-manifest approach shipped. Concrete layout, all under
`apps/api/src/openapi/` unless noted:

- **`manifest.ts`** — `ROUTE_MANIFEST`, one `RouteSpec` per endpoint (method,
  path template, resource segment, tag, summary, `auth` mode, an
  `x-token-usable` hint for external-token callers, optional query params, and
  request/response bodies). A body is either a component name (a `$ref` into the
  generated schemas) or an inline JSON Schema for the small response envelopes
  (`{ documents: DocumentSummary[] }` etc.) that aren't named DTOs.
- **`schemas.generated.ts`** — committed, generated by
  `scripts/gen-openapi-schemas.mjs` (`pnpm --filter @livediagram/api gen:openapi`)
  from the api-schema TS types via `ts-json-schema-generator` (`expose: 'export'`
  so only exported DTOs become named components; `Record<…>`/`Partial<…>`
  utilities inline). The generator is a dev dependency only and is **not** in the
  worker bundle — nothing on the runtime path imports it.
- **`document.ts`** — `buildOpenApiDocument()` assembles the manifest + generated
  schemas + the two security schemes (`Bearer` = Clerk JWT **or** API token;
  `GuestId` = the `X-Owner-Id` header) + a shared `Error` envelope into the 3.1
  object. Path parameters are derived from the `{param}` placeholders, so the
  manifest doesn't repeat them. Pure and deterministic.
- **`routes/openapi.ts`** — `handleOpenapi`, dispatched from `index.ts` on the
  `openapi.json` segment. GET only, public, `Cache-Control: public, max-age=3600`,
  memoised once per isolate.
- **`route-parity.test.ts`** + **`dispatch-probe.ts`** — the `(method,
path-template)` parity described under "Drift test", run in the api worker's
  Node test env against `index.ts`'s default export.
- **`manifest.test.ts`** — the remaining guards: (1) the manifest's segment set
  equals the `case '…':` labels in `index.ts`'s dispatch, in both directions,
  and every verb a segment's handlers compare against is documented for it;
  (2) every schema the manifest / assembled document references exists; (3) the
  committed `schemas.generated.ts` deep-equals a fresh generation, so a DTO
  change that wasn't regenerated fails CI; (4) the 429 each operation declares
  mirrors `index.ts`'s limiters. The (method, path) pairs are also asserted
  unique.
- **Media types** — a success body is `application/json` unless the entry sets
  `responseMediaType`; the two SVG snapshot reads (`GET /documents/{id}/thumbnail`,
  `GET /share/{code}/image.svg`) declare `image/svg+xml`.

The served document validates as OpenAPI 3.1 (checked with `@redocly/cli`). The
realtime WebSocket op protocol stays in [API app](api.md) prose, as planned;
the `GET …/ws` upgrade is listed but its message protocol is not.

## Out of scope

- The marketing / live / telemetry frontends (static Next exports) are not OpenAPI surfaces.
- Versioning the API (`/api/v2`) — the surface is single-version today; revisit if a breaking change is ever needed.
