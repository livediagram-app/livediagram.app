# One AI connection: blueprint

Derived from [mcp.md](../mcp.md). The spec decides; this file adds engineering precision, read from the code.

## Files

| File                                   | Role                                                                                                                                    |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/mcp/src/index.ts`                | The Worker entry: per request, the token's allowed apps and `?tools=all`, then mcp-kit's app; a refused token becomes the 401 challenge |
| `apps/mcp/src/apps.ts`                 | The five apps: kind, binding, item word and noun, id argument, the tools the core verbs map to, hand-made names                         |
| `apps/mcp/src/catalogue.ts`            | Renaming (`renameTool`), the rewrite of old names in texts (`nameRewriter`, `rewriteJson`), `namingProblems`                            |
| `apps/mcp/src/core.ts`                 | The ten core verbs: their schemas (`CORE_TOOLS`) and `runCore`                                                                          |
| `apps/mcp/src/app-client.ts`           | JSON-RPC to an app's MCP over its binding; the per-isolate tool lists; `TokenRefused`                                                   |
| `apps/mcp/src/server.ts`               | The per-request `McpServer`: low-level `tools/list` and `tools/call` handlers, the instructions                                         |
| `apps/mcp/src/grants.ts`               | Per-app consent: `keepGrant` on `/oauth/complete`, `allowedApps` per request                                                            |
| `apps/mcp/src/oauth.ts`, `listing.ts`  | The authorization server's configuration (consent on liveworkspace.app, no built-in clients); serverInfo                                |
| `apps/mcp/eval/`                       | The tool-pick eval: `requests.ts`, `score.ts`, `run.ts`, `snapshot.mjs`, the recorded `tools/`                                          |
| `apps/site/app/oauth/consent/page.tsx` | The consent page (`components/account/McpConsent.tsx`, `lib/mcp-connect.ts`)                                                            |
| `packages/mcp-kit/src/oauth.ts`        | `OauthServer.onGrant`: told of each grant with the consent page's body                                                                  |

## Bindings

| Binding         | Production                                                   | Staging                     |
| --------------- | ------------------------------------------------------------ | --------------------------- |
| `LIVEDIAGRAM`   | `livediagram-mcp`                                            | `livediagram-mcp-staging`   |
| `LIVEDOCUMENTS` | `livedocuments-mcp`                                          | `livedocuments-mcp-staging` |
| `LIVEPLANNER`   | `liveplanner-mcp`                                            | `liveplanner-mcp-staging`   |
| `LIVEDESIGN`    | `livedesign-mcp`                                             | `livedesign-mcp-staging`    |
| `LIVEKNOWLEDGE` | `liveknowledge-mcp`                                          | `liveknowledge-mcp-staging` |
| `OAUTH_KV`      | provisioned by the first deploy (no `id` in `wrangler.toml`) | the same, its own           |

`CONSENT_BASE_URL`: `https://www.liveworkspace.app`, staging `https://staging.liveworkspace.app`, local
`http://localhost:3000`. Hosts: `mcp.liveworkspace.app`, `mcp-staging.liveworkspace.app` (custom domains, no
`workers.dev`). Local: `wrangler dev` on 3013 (inspector 9139). Deploys in tier 2 (`TIER_OF` in
`.github/scripts/ci-plan.mjs`), after the MCP Workers it binds.

## Calling an app

`POST https://<app>.internal/mcp` on the binding, `Authorization: Bearer <the person's token>`,
`Accept: application/json, text/event-stream`, a bare JSON-RPC `tools/list` or `tools/call` (each app's MCP is
stateless, so no `initialize` first). A 401 throws `TokenRefused`, which marks the request refused; the entry then
answers `401 invalid_token` with `bearerChallenge(origin, true)`. Any other failure is a tool error in words, or, in
`find_items`, that app's entry in `failed`.

## Catalogue

| Constant                 | Value                                                                                                                     |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| `CATALOGUE_TTL_MS`       | 10 minutes, per isolate                                                                                                   |
| Allowed apps kept        | 1 minute per isolate, at most 500 tokens, then cleared                                                                    |
| `list_app_tools` `tools` | at most 10 names                                                                                                          |
| Grant record             | `apps:<sha256 hex of the token>` → app ids, `expirationTtl` = `CLIENT_TTL` (200 days); none kept when every app is ticked |

Renaming, in order: a hand-made name (`overrides`); in liveknowledge, `page(s)` → `knowledge_page(s)`; the app's
item word (`document`, `project`, `design`) → its noun (`diagram`, `doc`, `plan`, `design`, `knowledgebase`); a
name still without a subject word gets the insert noun after its verb. Subject words: diagram, doc, plan, design,
knowledge, knowledgebase, card, sheet, board, form, article, item (and plurals). A tool whose title ends
"(deprecated)" or whose description starts "Deprecated:" is left out. Descriptions open `For <noun phrase> (<app>).`

Default listing: `coreToolsWith(catalogues)`, the core verbs with each reachable app's tool names in
`list_app_tools`' description (`<kind>: reads …; changes ….`), so a cold isolate's first `tools/list` reads each
app's tool list once (in parallel, then cached); an app that can't be reached is left out of the names. A
`list_app_tools` call with an unknown name answers `available` (every name and `readOnly`). `withAppId`: for a tool
whose schema has the app's id argument, a ref (`ref` on the verb, or `ref`, the kind's name or `id` in the
arguments, when the schema has no such property) becomes that argument, and a ref given as the id loses its prefix.

`create_item` defaults: deck `blank-slide-deck`, article `blank-article`, infographic `blank-infographic`, plan
`kanban`; any other kind with no template gets one blank tab (`tabs: [{ elements: [] }]`); a knowledgebase takes
`template` itself, never `tabs`.

## The eval

- `snapshot.mjs` builds each app's server in a vitest run of its own (its `./image-result` stubbed) and writes
  `eval/tools/<app>.json` (name, title, description, input schema, compacted as the Worker sends them) and
  `<app>.instructions.txt`.
- `run.ts` (bundled by esbuild into `.wrangler/eval/run.mjs`): models `claude-opus-5-5` and `claude-haiku-5-5`,
  effort `medium`, `tool_choice` auto, one cache breakpoint at the end of the system prompt (tools and system
  cached), four calls at most per request, four requests at once after a first that writes the cache. The five
  servers' tools are named `<app>__<tool>`, as clients namespace them. Tool-list tokens: `count_tokens` with the
  setup's tools and system, less a bare count. Results: `eval/results/<time>.json` (not committed).
- Judging (`score.ts` `judge`): a call becomes the app tools it runs (the one MCP's through `runCore` and the
  catalogue); a read (`find`, `read`, `list`, `search`, `get`, `view_tab`, `view_live`) costs a step; the request is
  right when an expected app tool runs before any other change, with right arguments when its matchers hold.

## Testing

| Test                                | Pins                                                                                                                       |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `apps/mcp/src/catalogue.test.ts`    | No clash, no bare "document", every name has a subject, openings, no old name left, the rename table                       |
| `apps/mcp/src/router.test.ts`       | Listing both ways, routing as the person, rewritten answers, every core verb's mapping, an app down, 401s, per-app consent |
| `apps/mcp/src/eval.test.ts`         | Every request's expected tool exists; the eval's mapping and judging                                                       |
| `apps/site/lib/mcp-connect.test.ts` | The consent hand-over: mint, complete with the ticked apps, retire, refusals                                               |
