# AI Assistance

## Overview

An optional AI assistant panel in the diagram editor. Disabled by default; users opt in
via Settings. Requires a model key (`GOOGLE_AI_STUDIO_API_KEY`, `OPENAI_API_KEY`, or a generic `AI_API_KEY` + `AI_BASE_URL`) in the api worker environment —
if absent the feature is **hidden entirely** (no UI surface, no API routes respond). A
deployment without a model key (local development, previews) gets zero AI surface with
no extra code paths to reason about.

## Capability detection

`GET /api/capabilities` returns `{ "aiEnabled": boolean }`. No auth required. The live
app fetches this once at editor mount; if `aiEnabled: false` the AI toggle in Settings and
the AI panel are never rendered.

## Modes

Two modes. The old **Generate** (labelled **Build**) and **Review** modes were removed: a
capable model in an external AI tool generates far better via the MCP server ([MCP server](../015-api/mcp-server.md)), so
the built-in assistant focuses on the two things it does well against the active tab —
answering questions and tidying.

| Mode      | What it does                                         | Response                                           |
| --------- | ---------------------------------------------------- | -------------------------------------------------- |
| **Ask**   | Answers questions about the diagram (read-only Q&A)  | `text/event-stream` SSE (text deltas)              |
| **Clean** | Fixes label typos, normalises sizes/positions/styles | `text/event-stream` SSE; client parses JSON on end |

Both modes stream: the worker pipes OpenAI's SSE through unchanged so the panel can render progress (text deltas for Ask, a "thinking" indicator for the JSON Clean mode). The client buffers the Clean stream until completion, parses it, then applies the elements via `commit()` so undo still treats the change as one block.

## Context

The full element list on the active tab is always sent, plus an explicit `focusIds` list pointing at the currently-selected elements (empty when the user has nothing selected). The system prompt tells the model to focus its edits on the focused IDs while treating the rest as read-only context, except where arrow connections require adjusting an out-of-focus element. This sends more tokens than a strict "selection only" cut would, but gives the model the structural context it needs to keep the diagram coherent (e.g. seeing an arrow's other endpoint when only one end is in focus).

Only the **active tab** is ever in scope, other tabs are never sent.

## Conversation history

Each AI request optionally includes a `history` array of prior `{ role, content }` turns from the same panel session. The worker caps it at the most recent **6 turns** server-side (`MAX_HISTORY_TURNS`) so an extra-long session can't blow the context window. The panel maintains the history client-side and clears it when the user closes the panel, switches to another tab, or presses **Clear context** (shown while prior exchanges are in context). Switching between the panel's modes keeps it.

## Security

- Auth required: an account access token or `X-Owner-Id`. The hosted deployment additionally requires
  sign-in (see `AI_REQUIRE_SIGN_IN` below); a deployment can accept anonymous owners by
  leaving the flag unset.
- Per-IP rate limiter (`AI_RATE_LIMITER` binding, 20 req/60 s). Optional — absent on
  a deployment it falls through to "allow", matching the pattern used by
  `WRITE_RATE_LIMITER` and `EVENTS_RATE_LIMITER`.
- Optional `Origin` allow-list (`AI_ALLOWED_ORIGINS`). When set, every `/api/ai` request
  must carry an `Origin` header whose value matches one of the entries; otherwise the
  worker returns `403 { error: 'origin_not_allowed' }` before reaching OpenAI. Unset =
  no origin check (preserves the historical behaviour). The hosted deployment locks this
  down in `apps/api/wrangler.toml`'s `[vars]` — **not** the Cloudflare dashboard, because
  a dashboard-only var is wiped by the next `wrangler deploy` ([Staging environment](../016-platform/staging-environment.md)
  predicted exactly this) and is invisible to code review either way. It was in fact unset
  in production for an unknown period, so the endpoint served any origin while this spec
  described it as locked down; a probe (`POST /api/ai` with no `Origin` answering
  `400 invalid mode` instead of `403 origin_not_allowed`) is how to tell.
  The value is **`https://www.liveplanner.app,https://liveplanner.app`**, and the `www`
  entry is the load-bearing one: the apex 301-redirects to `www`, so `www` is the origin a
  real browser sends. The apex-only value this spec used to recommend would have returned
  403 for every genuine request from the editor. Another deployment (staging) sets its own hostname —
  whichever one the browser actually lands on after redirects — plus dev origins like
  `http://localhost:3102`.
- Optional signed-in-only gate (`AI_REQUIRE_SIGN_IN`, formerly `AI_REQUIRE_CLERK`). When set to `"true"`, `/api/ai` rejects
  any request without a verified account access token with `401 { error: 'sign_in_required' }`;
  the legacy `X-Owner-Id` guest path still works for every OTHER endpoint, just not for
  AI. Unset = guests can still use AI (the default before this flag landed), preserving
  the rule that sign-in is optional. Combined with the origin allow-list,
  this is the spend-DoS defence on a public deployment: a third-party site can no longer
  drain the operator's OpenAI budget by minting fresh `X-Owner-Id` UUIDs.
- Prompt capped at 1 000 characters server-side; element payload capped at 200 elements
  (`AI_MAX_PROMPT_CHARS` / `AI_MAX_ELEMENTS` in `@liveplanner/api-schema`, shared with the panel). The
  prompt box holds no more than the cap. The panel sends the whole tab as context while it is within the
  element cap; past it, the selection alone (`aiContextElements`), and with no selection, or one itself
  over the cap, it says so ("Select up to 200 and try again") rather than sending a request the api refuses.
  Both prevent runaway token costs and context-window stuffing.
- System prompt explicitly instructs the model to refuse any request unrelated to diagram
  creation/editing and to return a structured error rather than comply.
- For the mutating mode (Clean) `response_format: { type: "json_object" }` is set on the
  OpenAI request so the model can only return parseable JSON, preventing injection of
  arbitrary text through the document data layer.
- Max-token caps: the mutating mode (Clean) 8 000, the text mode (Ask) 400.

## API

### `GET /api/capabilities`

No auth required. Response:

```json
{ "aiEnabled": true }
```

`aiEnabled` is `true` iff a model key resolves to a provider (see below). Both AI features
resolve from the same set of keys and fall back to each other's provider, so they are available
together or not at all: one flag answers for both.

### `POST /api/ai`

Auth required (an account access token as `Authorization: Bearer` **or** `X-Owner-Id`).

Request body:

```json
{
  "mode": "clean" | "ask",
  "prompt": "string (max 1 000 chars)",
  "elements": [...],
  "tabName": "string",
  "focusIds": ["elementId", ...],
  "history": [{ "role": "user" | "assistant", "content": "..." }, ...]
}
```

`elements` is the full active-tab `Element[]` from `@liveplanner/document`. `focusIds` is the optional list of selected element IDs; the system prompt steers the model toward editing those while preserving everything else. `history` is the optional prior-turn list (capped server-side at the last 6 turns); both fields default to `[]`.

Response for **both modes**: `Content-Type: text/event-stream`, OpenAI SSE format piped through with CORS headers added. The JSON-mode payload (Clean) is collected by the client into a single `{ elements: [...] }` block on stream completion:

- `clean`: elements to **replace by ID** (same IDs as input; new IDs = append).
- `ask`: SSE text deltas rendered straight into the panel as they arrive.

**Client-side normalisation.** As elements are parsed out of the stream (`extractElementsFromBuffer`, `apps/live/lib/api/ai.ts`), each shape is normalised so the result renders consistently: a shape with no `textSize` (or `"scale"`) is pinned to `"md"`. Without this the canvas default for an unset size is `'scale'` (auto-fit), so a generated node with no explicit size balloons its label to fill the box while sized siblings stay small — the classic "inconsistent font sizes" output. The model's explicit `sm`/`md`/`lg` hierarchy is preserved; only missing / `scale` sizes are rewritten. The system prompt is also strict that every shape must carry an explicit `textSize` (never omit, never `scale`) and that siblings at the same tier share one size, but the normalisation is the safety net regardless of what the model returns.

## Deterministic auto-layout

`Clean` never re-flows: it preserves the layout the user arranged and only tidies sizes,
labels, and styles in place. With **Generate** removed, the AI assistant no longer produces
fresh graphs, so it runs no auto-layout pass. The deterministic layout engine itself —
`autoLayoutElements` (`packages/document/src/auto-layout.ts`, pure + unit-tested) — still
exists and is now driven by the MCP server ([MCP server](../015-api/mcp-server.md)), where the calling model produces the
graph and the server lays it out on request. (`mergeAiElements` in `editor-page-helpers.ts`
retains a general clean/replace merge; the Clean path spreads the AI patch over each
existing element, preserving AI-invisible properties and positions.)

**Clean never changes what an element IS.** `type`, and `shape` for a shape, are pinned
from the existing element and cannot be overwritten by the patch — they are not on the list
of things Clean tidies. This is load-bearing, not tidiness: the client coerces any shape
outside its accept-set to `square` so a node the model _invented_ off-vocabulary still
renders rather than being dropped, and Clean asks the model to return every element with
its real `shape` forwarded. Unpinned, one Clean flattened every composite in the tab —
checklists, code blocks, charts, lanes, entities, progress rings, 30 of the 51 ShapeKinds —
and autosaved and broadcast the result. The coercion is right for an
invented element and has no business touching one the user already had.

Correspondingly, everything the worker's prompt asks the model to produce must survive
that accept-set. The two lists are one vocabulary in two workspaces, and the client is
deliberately the wider of the two (models emit unprompted kinds and synonyms), so only
prompt-minus-client is a defect. A test reads the prompt's own source and feeds each kind
through ingestion rather than restating the list, since the second hand-written copy is
what drifted: `checklist` was requested by name, with its `checklistItems` schema, and
squared on arrival.

Past that normalisation (kind coerced, a missing size defaulted), a streamed element is held
to the same structural guard every save is: `isValidElement` from `@liveplanner/document`,
limited to the four types the assistant may add (shape, text, sticky, arrow). A looser local
check used to live in the client and let through what the api then refused on save (an
arrow with a junk endpoint, a non-finite coordinate). Renamed additions carry every
reference kind with them (arrow ends, mind-map parents, portal partners) through the shared
`remapElementRefs`.

Error responses follow the standard worker envelope, `{ "error": "<token>" }`. The route emits
exactly six:

| Token                | Status | When                                                         |
| -------------------- | ------ | ------------------------------------------------------------ |
| `sign_in_required`   | 401    | The assistant is signed-in only.                             |
| `origin_not_allowed` | 403    | The request came from an origin the worker does not serve.   |
| `method_not_allowed` | 405    | Anything but a `POST`.                                       |
| `rate_limited`       | 429    | The caller's per-owner request budget is spent.              |
| `ai_error`           | 502    | The upstream model call failed.                              |
| `ai_not_configured`  | 503    | No model key on this deployment (the default without a key). |

A request with no identity at all (neither a signed-in session nor an `X-Owner-Id`)
gets the worker-wide `bad_request` 400 every owner-scoped route sends.

**`off_topic` is not one of them.** A prompt the model judges off-topic still returns **200**: the
streamed body carries `"offTopic": true`, and the editor turns that into a local `off_topic` error
for the AI panel to render (`apps/live/lib/api/ai.ts`). A client reading only the envelope will
never see it, and must look at the body.

## Whose model? The key says.

The worker does not know which company it is talking to, and it should not have
to be told twice. The PROVIDER is inferred from WHICH KEY IS SET, because a key
is provider-specific — a Google AI Studio key is useless to OpenAI — so the
variable that holds it should say whose it is, and the endpoint follows.

| key var                      | provider | base URL                                                  | default model                 |
| ---------------------------- | -------- | --------------------------------------------------------- | ----------------------------- |
| `GOOGLE_AI_STUDIO_API_KEY`   | google   | `https://generativelanguage.googleapis.com/v1beta/openai` | `gemini-3.6-flash`            |
| `OPENAI_API_KEY`             | openai   | `https://api.openai.com/v1`                               | `gpt-4o`                      |
| `AI_API_KEY` + `AI_BASE_URL` | generic  | whatever `AI_BASE_URL` says                               | none — `AI_MODEL` is REQUIRED |

The generic row is Mistral, OpenRouter, a local llama.cpp or Ollama — anything
that speaks the OpenAI chat-completions wire.

### Which key wins

The assistant (Ask / Clean, `/api/ai`) takes the first present key in its preference order:
openai → google → generic. A deployment sets one key and changes nothing.

- **The generic key is the last resort.** `AI_API_KEY` serves only
  when neither named key is set. Set beside a named key it serves nothing, so
  it is logged as an error on every resolution (`[ai] AI_API_KEY is set but
unused`) rather than left as a dead secret nobody notices.
- **A half-configured generic key resolves to no provider.** `AI_API_KEY`
  without `AI_BASE_URL` or `AI_MODEL` logs one loud line and the AI surface
  hides, exactly as with no key.

### Which model

`AI_MODEL`, else the provider's default model. The generic preset has no defaults, so it requires
`AI_MODEL`.

`aiEnabled` is "a provider resolved".

`OPENAI_API_KEY` is not a compatibility alias — it is the OpenAI preset's own
key, so a deployment already on OpenAI changes nothing. `OPENAI_MODEL` is gone;
it is `AI_MODEL` now.

**How the Gemini default was chosen (2026-09-16).** Not guessed: the key's own
`GET {base}/models` was listed, the `*-flash` ids extracted, and the candidates
actually called with `response_format: json_object`. `gemini-3.7-flash` and
`gemini-3.8-flash` answered 503 "high demand"; `gemini-flash-latest` is an alias
that would move under a deployment without anyone changing anything;
`gemini-3.6-flash` answered every time. One thing to know about these models:
they spend tokens on reasoning before the answer, so a `max_tokens` sized for
the visible output alone comes back `finish_reason: length` with nothing in it.

Requests use `response_format: { type: 'json_object' }` plus our own strict validation — the strict `json_schema` form is not universally supported, and we validate every field regardless.

## Environment variables

| Variable                                                     | Where                     | Purpose                                                                                                                                                                                                                 |
| ------------------------------------------------------------ | ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GOOGLE_AI_STUDIO_API_KEY` / `OPENAI_API_KEY` / `AI_API_KEY` | Worker secret             | The model keys; any one enables AI (see "Which key wins"). None = every AI surface hidden.                                                                                                                              |
| `AI_BASE_URL`                                                | Worker var (generic only) | The OpenAI-COMPATIBLE chat-completions base for `AI_API_KEY`: a laptop points it at llama.cpp or Ollama. The google and openai keys bring their own.                                                                    |
| `AI_MODEL`                                                   | Worker var (optional)     | Model id for the assistant. Defaults per provider (table above); required for the generic key.                                                                                                                          |
| `AI_ALLOWED_ORIGINS`                                         | Worker var (optional)     | Comma-separated `Origin` values that may call `/api/ai`. Unset = no check. Example: `https://liveplanner.app,http://localhost:3102`. Entries are matched case-sensitive against the request's `Origin` header verbatim. |
| `AI_REQUIRE_SIGN_IN`                                         | Worker var (optional)     | Set to `"true"` to require a verified account access token on `/api/ai` (rejects the `X-Owner-Id` guest path with 401). Unset / any other value = guests allowed.                                                       |

Set via `wrangler secret put <the key var>` for production; drop into `apps/api/.dev.vars`
for local dev (gitignored). The two `AI_*` flags are plain `[vars]` (no secret value), so
operators can set them via `wrangler.toml`, the Cloudflare dashboard, or `.dev.vars` for
local testing.

## Frontend

### User preference

`aiAssistanceEnabled?: boolean` added to `UserPreferences` ([User preferences](user-preferences.md) storage pattern).
Missing / `false` = panel hidden. Only shown in Settings when `capabilities.aiEnabled`.

### `useCapabilities` hook

Fetches `GET /api/capabilities` once at editor mount. Returns `{ aiEnabled: boolean }`.
On network failure defaults to `{ aiEnabled: false }` (fail-closed). The hook takes an
`enabled` flag so the call is deferred while a visitor is behind a share-link password
gate ([Share password](../013-workspace/share-password.md)): on a password-protected document, capabilities (and the server-side
preferences sync) don't fire until the correct password is entered, so wrong attempts
cost no extra requests.

### AI Panel

A floating, draggable panel rendered over the canvas via `MovablePanel` (drag to
reposition; reset returns it to its default spot). It's surfaced from the **Assistant**
accordion in the Editor side panel, and docks in its corner on a desktop and a phone alike. Visible
when `capabilities.aiEnabled && userPreferences.aiAssistanceEnabled`. Hidden in read-only /
view-role sessions (AI mutates the document; guests can't persist changes they don't own).

Contains:

- Mode selector (Ask / Clean tabs), with a **Connect agent** button on the right of that
  row that opens the "Connect an AI tool (MCP)" help article ([MCP server](../015-api/mcp-server.md)) in a new tab — the
  calling model in an external tool generates far better than `/api/ai`, so the panel
  points power users there.
- **Reset position** button in the panel header (snap back to the default corner,
  [Panel corner docking](panel-docking.md)), shown once the panel has been moved. The panel's two preferences ,
  **AI Assistant** (`aiAssistanceEnabled`) and **Suggested Prompts**
  (`aiSuggestedPrompts`), live in the **Settings** dialog's AI category
  ([User preferences](user-preferences.md)). They used to sit in a header settings gear; that popover went when
  every preference was centralised.
- Quick suggested-prompt chips under the mode tabs, shown only when `aiSuggestedPrompts`
  is on (they're handy but take vertical space, so Settings can hide them).
- Scrollable response / status area
- Prompt textarea + Send button (disabled while a request is in flight)
- Close button (hides for the session without touching the preference)

### Undo

AI-applied element changes land as a single undo block via `commit()`, which snapshots
history before applying the mapper. One Ctrl+Z undoes the entire AI operation.

## Telemetry

`track('AI', 'Used', mode)` fires on each successful request (after the response is
received / streaming completes). Fires before any error handling so off-topic refusals
don't inflate the count.

## Out of scope (this spec)

- Multi-tab context
- Per-user cost attribution or quota
- Model switching in the UI
