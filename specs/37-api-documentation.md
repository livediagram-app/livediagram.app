# 37 — API documentation (OpenAPI)

> **Status: proposal.** Not built yet. This spec captures the decision to
> add a machine-readable OpenAPI description of the `/api/*` surface and
> the approach that fits this codebase. Code follows once the approach is
> agreed.

## Why

The api worker ([spec/11](11-api.md)) is documented two ways today:

- **Prose** in spec/11 plus the per-feature specs (teams → [spec/32](32-teams.md), images → [spec/19](19-images.md), telemetry → [spec/22](22-telemetry.md), change log → [spec/12](12-activity-and-audit.md), share password / expiry → [spec/24](24-share-password.md) / [spec/34](34-share-link-expiry.md)).
- **Compile-time payload shapes** in `@livediagram/api-schema` — every request / response DTO, imported by both the worker (which builds them) and the live editor (which consumes them), so the typechecker catches drift between the two sides.

What's missing is a **single, machine-readable description of the surface**: the paths, methods, auth requirements, and status codes. The TS types cover payload _shape_ but say nothing about URL shape, verbs, or auth; the prose isn't discoverable, testable, or consumable by tooling. A self-hoster or integrator can't point a client generator, a Postman import, or a docs viewer at anything.

The goal is an **OpenAPI 3.1 document** for `/api/*` that is generated from the existing source of truth (not hand-maintained in parallel, which would drift — the one thing this repo most wants to avoid) and is impossible to silently desync from the real routes.

## Goals

- One OpenAPI 3.1 document covering every `/api/*` endpoint (the surface enumerated in spec/11): path template, method, summary, auth scheme, request body schema, response schema(s), and the meaningful status codes (200/201/204/400/401/403/404/409).
- Served at **`GET /api/openapi.json`** — public, no auth, cacheable. It's the contract, not data, so a token holder isn't needed.
- **Component schemas reuse `@livediagram/api-schema`**: DTO shapes are generated from those TS types, never re-typed by hand. Adding a field to a DTO updates the doc automatically.
- **A drift test** (CI) that fails when a route is reachable in the worker's dispatch but absent from the OpenAPI doc, or vice versa. This mirrors the test-pinned template / theme catalogues ([spec/09](09-canvas-and-command-palette.md)): the doc cannot fall behind the code without turning CI red.
- Self-hostable: the doc is produced at build time and served by the worker. No external service, no secrets, works in pure-guest mode (Clerk unset).

## Non-goals (v1)

- **Runtime request validation.** The handlers today cast `request.json()` to a TS type with no runtime check. Adding Zod (or similar) validators would be a real upgrade and would let the OpenAPI doc fall straight out of the validators, but it's a large migration touching every handler. Out of scope here; noted as a future direction below.
- **Generated client SDKs** and an interactive "try it" console with live auth.
- **Documenting the realtime WebSocket protocol** (`GET /api/diagrams/:id/ws` and the Durable Object op messages). OpenAPI describes the REST surface; the WS upgrade is listed as an endpoint but its message protocol stays in spec/11 prose.

## Approach

The worker uses vanilla `fetch` handlers with segment-based dispatch (`apps/api/src/index.ts` → `routes/*.ts`), **not** Hono — see [docs/architecture.md](../docs/architecture.md). Two routes are therefore available:

1. **Migrate to `@hono/zod-openapi`** — rewrite the dispatch as Hono routes with Zod schemas, getting OpenAPI generation + runtime validation for free. Powerful, but it replaces the entire routing layer and the api-schema types with Zod schemas. Too large and too speculative for the payoff here. **Rejected for v1.**
2. **A declarative route manifest + schema generation, keeping the vanilla handlers.** **Recommended.**

### Recommended: route manifest + generated component schemas

- **Route manifest** — `apps/api/src/openapi/manifest.ts`: an array, one entry per endpoint. Each entry carries the method, the path template (`/api/...` with `{param}` placeholders), a summary, the auth mode (public / guest / clerk / either), optional request and response schema names, and the meaningful status codes. The manifest is plain data referencing DTO names from `@livediagram/api-schema`; it is the single declaration of the surface.
- **Component schemas** — generated from the api-schema TS types into JSON Schema (e.g. `ts-json-schema-generator` as a build step in `packages/api-schema` or the api worker), emitted into the OpenAPI `components.schemas`. Shapes are never re-typed; the manifest only references them by name.
- **Assembly** — a build step composes the manifest + generated schemas + the auth-scheme definitions (the guest `X-Owner-Id` header and the Clerk Bearer, per [spec/04](04-auth-and-guest-access.md)) into one OpenAPI 3.1 object, written to a TS constant the worker serves verbatim at `GET /api/openapi.json`. Build-time generation keeps the request path a constant lookup, no per-request work.
- **Drift test** (`apps/api/src/openapi/manifest.test.ts`) — the dispatch is segment-based, not declarative, so the manifest is the declaration and the test pins parity: it asserts the manifest's `(method, path)` set matches a route inventory derived from the handlers (and that every `requestSchema` / `responseSchema` name exists in `@livediagram/api-schema`). A new route added to `index.ts` / `routes/*.ts` without a manifest entry fails CI. This is the anti-drift guarantee; without it the doc is just another thing that rots.

### Auth + secrets

The doc declares the two auth schemes (guest `X-Owner-Id` header; Clerk `Authorization: Bearer`) and tags each endpoint with which it accepts, but carries **no secrets, keys, or URLs** ([spec/06](06-secrets-policy.md)). The `/api/openapi.json` endpoint is public and unauthenticated, like `GET /api/capabilities`.

### Optional viewer

A human-facing viewer (Scalar / Redoc / Stoplight Elements) is nice but pulls a dependency. v1 ships the JSON only; a viewer can be a thin static page later (in the telemetry-dashboard mould) or left to the reader's own tooling. Decide when the JSON exists.

## Hard constraints honored

- Served by the **api worker**, not Next.js — no SSR, no Node runtime added ([CLAUDE.md](../CLAUDE.md) static-only rule).
- **Self-hostable** with no external dependency; the doc generates at build time and ships in the worker bundle.
- **Reuse over duplication**: component schemas come from `@livediagram/api-schema`, the existing single source of truth, never re-typed.

## Future direction

If runtime request validation is wanted later, introduce Zod schemas for request bodies in the handlers and derive both the validation and the OpenAPI component schemas from them, retiring the hand-listed `requestSchema` references in the manifest. That subsumes this spec's payload half while keeping the manifest's path / method / auth / status declarations.

## Out of scope

- The marketing / live / telemetry frontends (static Next exports) are not OpenAPI surfaces.
- Versioning the API (`/api/v2`) — the surface is single-version today; revisit if a breaking change is ever needed.
