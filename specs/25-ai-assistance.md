# 25 — AI Assistance

## Overview

An optional AI assistant panel in the diagram editor. Disabled by default; users opt in
via Settings. Requires a model key (`GOOGLE_AI_STUDIO_API_KEY`, `OPENAI_API_KEY`, or a generic `AI_API_KEY` + `AI_BASE_URL`) in the api worker environment —
if absent the feature is **hidden entirely** (no UI surface, no API routes respond). This
keeps the OSS/self-host promise intact: contributors who don't want to provision an
OpenAI key get zero AI surface with no extra code paths to reason about.

## Capability detection

`GET /api/capabilities` returns `{ "aiEnabled": boolean }`. No auth required. The live
app fetches this once at editor mount; if `aiEnabled: false` the AI toggle in Settings and
the AI panel are never rendered.

## Modes

Two modes. The old **Generate** (labelled **Build**) and **Review** modes were removed: a
capable model in an external AI tool generates far better via the MCP server (spec/62), so
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

Each AI request optionally includes a `history` array of prior `{ role, content }` turns from the same panel session. The worker caps it at the most recent **6 turns** server-side (`MAX_HISTORY_TURNS`) so an extra-long session can't blow the context window. The panel maintains the history client-side and clears it when the user closes the panel or starts a new mode.

## Security

- Auth required: Clerk JWT or `X-Owner-Id`. The hosted deployment additionally requires
  Clerk (see `AI_REQUIRE_CLERK` below); self-hosters can accept anonymous owners by
  leaving the flag unset.
- Per-IP rate limiter (`AI_RATE_LIMITER` binding, 20 req/60 s). Optional — absent on
  self-host deployments falls through to "allow", matching the pattern used by
  `WRITE_RATE_LIMITER` and `EVENTS_RATE_LIMITER`.
- Optional `Origin` allow-list (`AI_ALLOWED_ORIGINS`). When set, every `/api/ai` request
  must carry an `Origin` header whose value matches one of the entries; otherwise the
  worker returns `403 { error: 'origin_not_allowed' }` before reaching OpenAI. Unset =
  no origin check (preserves the historical behaviour). The hosted deployment locks this
  down in `apps/api/wrangler.toml`'s `[vars]` — **not** the Cloudflare dashboard, because
  a dashboard-only var is wiped by the next `wrangler deploy` ([spec/140](140-staging-environment.md)
  predicted exactly this) and is invisible to code review either way. It was in fact unset
  in production for an unknown period, so the endpoint served any origin while this spec
  described it as locked down; a probe (`POST /api/ai` with no `Origin` answering
  `400 invalid mode` instead of `403 origin_not_allowed`) is how to tell.
  The value is **`https://www.livediagram.app,https://livediagram.app`**, and the `www`
  entry is the load-bearing one: the apex 301-redirects to `www`, so `www` is the origin a
  real browser sends. The apex-only value this spec used to recommend would have returned
  403 for every genuine request from the editor. Self-hosters set their own hostname —
  whichever one the browser actually lands on after redirects — plus dev origins like
  `http://localhost:3002`.
- Optional Clerk-only gate (`AI_REQUIRE_CLERK`). When set to `"true"`, `/api/ai` rejects
  any request without a verified Clerk Bearer JWT with `401 { error: 'sign_in_required' }`;
  the legacy `X-Owner-Id` guest path still works for every OTHER endpoint, just not for
  AI. Unset = guests can still use AI (the default before this flag landed), preserving
  the OSS self-host story where Clerk is optional. Combined with the origin allow-list,
  this is the spend-DoS defence on a public deployment: a third-party site can no longer
  drain the operator's OpenAI budget by minting fresh `X-Owner-Id` UUIDs.
- Prompt capped at 1 000 characters server-side; element payload capped at 200 elements.
  Both prevent runaway token costs and context-window stuffing.
- System prompt explicitly instructs the model to refuse any request unrelated to diagram
  creation/editing and to return a structured error rather than comply.
- For the mutating mode (Clean) `response_format: { type: "json_object" }` is set on the
  OpenAI request so the model can only return parseable JSON, preventing injection of
  arbitrary text through the diagram data layer.
- Max-token caps: the mutating mode (Clean) 8 000, the text mode (Ask) 400.

## API

### `GET /api/capabilities`

No auth required. Response:

```json
{ "aiEnabled": true }
```

`aiEnabled` is `true` iff exactly one model key resolves to a provider (see below).

### `POST /api/ai`

Auth required (Clerk Bearer JWT **or** `X-Owner-Id`).

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

`elements` is the full active-tab `Element[]` from `@livediagram/diagram`. `focusIds` is the optional list of selected element IDs; the system prompt steers the model toward editing those while preserving everything else. `history` is the optional prior-turn list (capped server-side at the last 6 turns); both fields default to `[]`.

Response for **both modes**: `Content-Type: text/event-stream`, OpenAI SSE format piped through with CORS headers added. The JSON-mode payload (Clean) is collected by the client into a single `{ elements: [...] }` block on stream completion:

- `clean`: elements to **replace by ID** (same IDs as input; new IDs = append).
- `ask`: SSE text deltas rendered straight into the panel as they arrive.

**Client-side normalisation.** As elements are parsed out of the stream (`extractElementsFromBuffer`, `apps/live/lib/api/ai.ts`), each shape is normalised so the result renders consistently: a shape with no `textSize` (or `"scale"`) is pinned to `"md"`. Without this the canvas default for an unset size is `'scale'` (auto-fit), so a generated node with no explicit size balloons its label to fill the box while sized siblings stay small — the classic "inconsistent font sizes" output. The model's explicit `sm`/`md`/`lg` hierarchy is preserved; only missing / `scale` sizes are rewritten. The system prompt is also strict that every shape must carry an explicit `textSize` (never omit, never `scale`) and that siblings at the same tier share one size, but the normalisation is the safety net regardless of what the model returns.

## Deterministic auto-layout

`Clean` never re-flows: it preserves the layout the user arranged and only tidies sizes,
labels, and styles in place. With **Generate** removed, the AI assistant no longer produces
fresh graphs, so it runs no auto-layout pass. The deterministic layout engine itself —
`autoLayoutElements` (`packages/diagram/src/auto-layout.ts`, pure + unit-tested) — still
exists and is now driven by the MCP server (spec/62), where the calling model produces the
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
and autosaved, change-logged and broadcast the result. The coercion is right for an
invented element and has no business touching one the user already had.

Correspondingly, everything the worker's prompt asks the model to produce must survive
that accept-set. The two lists are one vocabulary in two workspaces, and the client is
deliberately the wider of the two (models emit unprompted kinds and synonyms), so only
prompt-minus-client is a defect. A test reads the prompt's own source and feeds each kind
through ingestion rather than restating the list, since the second hand-written copy is
what drifted: `checklist` was requested by name, with its `checklistItems` schema, and
squared on arrival.

Error responses follow the standard worker envelope, `{ "error": "<token>" }`. The route emits
exactly four:

| Token                | Status | When                                                       |
| -------------------- | ------ | ---------------------------------------------------------- |
| `sign_in_required`   | 401    | The assistant is signed-in only.                           |
| `origin_not_allowed` | 403    | The request came from an origin the worker does not serve. |
| `ai_error`           | 502    | The upstream model call failed.                            |
| `ai_not_configured`  | 503    | No model key on this deployment (the self-host default).   |

**`off_topic` is not one of them.** A prompt the model judges off-topic still returns **200**: the
streamed body carries `"offTopic": true`, and the editor turns that into a local `off_topic` error
for the AI panel to render (`apps/live/lib/api/ai.ts`). A client reading only the envelope will
never see it, and must look at the body.

## Whose model? The key says.

The worker does not know which company it is talking to, and it should not have
to be told twice. The PROVIDER is inferred from WHICH KEY IS SET, because a key
is provider-specific — a Google AI Studio key is useless to OpenAI — so the
variable that holds it should say whose it is, and the endpoint follows.

| key var                      | provider | base URL                                                  | default model                                                         |
| ---------------------------- | -------- | --------------------------------------------------------- | --------------------------------------------------------------------- |
| `GOOGLE_AI_STUDIO_API_KEY`   | google   | `https://generativelanguage.googleapis.com/v1beta/openai` | `gemini-3.6-flash` (assistant), `gemini-2.5-flash-lite` (crop reader) |
| `OPENAI_API_KEY`             | openai   | `https://api.openai.com/v1`                               | `gpt-4o`                                                              |
| `AI_API_KEY` + `AI_BASE_URL` | generic  | whatever `AI_BASE_URL` says                               | none — `AI_MODEL` is REQUIRED                                         |

`AI_MODEL` overrides the default for any provider; `AI_VISION_MODEL` overrides
it for `/api/ai/read-notes` only. The READER has its own Google default,
`gemini-2.5-flash-lite`, because reading handwriting is literal work: measured
on a real wall it read 99% of the words against 95% for `gemini-3.6-flash`,
while costing about a quarter as much and finishing four times faster
(docs/vision/handwriting-readers.md). That default applies only when the
operator has named NO model — setting `AI_MODEL` means it for the reader too,
and `AI_VISION_MODEL` beats both. The generic
row is Mistral, OpenRouter, a local llama.cpp or Ollama — anything that speaks
the OpenAI chat-completions wire.

**Exactly one key may be set.** Two of them, or a generic key without a base URL
or a model, resolves to NO provider and logs one loud line naming the conflict:
picking one would be spending somebody's money on a coin flip, and picking one
silently is how that goes unnoticed. `aiEnabled` is "a provider resolved".

`OPENAI_API_KEY` is not a compatibility alias — it is the OpenAI preset's own
key, so a self-hoster already on OpenAI changes nothing. `OPENAI_MODEL` is gone;
it is `AI_MODEL` now.

**How the Gemini default was chosen (2026-09-16).** Not guessed: the key's own
`GET {base}/models` was listed, the `*-flash` ids extracted, and the candidates
actually called with `response_format: json_object`. `gemini-3.7-flash` and
`gemini-3.8-flash` answered 503 "high demand"; `gemini-flash-latest` is an alias
that would move under a deployment without anyone changing anything;
`gemini-3.6-flash` answered every time. One thing to know about these models:
they spend tokens on reasoning before the answer, so a `max_tokens` sized for
the visible output alone comes back `finish_reason: length` with nothing in it.

Requests use `response_format: { type: 'json_object' }` plus our own strict
validation — the strict `json_schema` form is not universally supported, and we
validate every field regardless. The crop reader is the exception below: it
asks the two known providers for a strict schema.

## POST /api/ai/read-notes — reading the text on sticky crops

The model half of the event-storming photo import (spec/139 Phase 8). The
stickies are FOUND in the browser by classical computer vision; this route is
asked only to read the handwriting on the crops that came out of that.

- Same admission sequence as `/api/ai` (shared `routes/ai-gate.ts`): key
  present → origin allow-list → Clerk-only flag → owner → method → rate limiter.
- **Body**: `{ crops: { id, image }[] }` — at most `READ_MAX_CROPS_PER_REQUEST`
  (6) crops per call, each a data URL of at most `CROP_MAX_BYTES` in one of
  `image/jpeg`, `image/png`, `image/webp`. The client batches a bigger run and
  sends two batches at a time. Six, not sixteen: a 16-image request was
  answered 503 "high demand" every time by a hosted flash model while a 5-image
  request succeeded every time, and smaller batches also read the handwriting
  markedly better.
- **Never the whole photo.** A crop is one sticky; whoever is standing in front
  of the wall stays in the browser.
- **A strict schema where the provider has one.** The google and openai presets
  send `response_format: { type: 'json_schema', strict: true }` with the answer
  shape, so the model is constrained to valid JSON of that shape as it writes.
  JSON mode alone was not enough: `gemini-2.5-flash-lite` failed two batches of
  seven in one run (12 of 42 notes) with broken quoting (`{'id':20`, `{"id':21`), a dropped field,
  or an answer that stopped after `{"texts":[`, and one bad answer fails all six
  notes of its batch (`ai_error`, logged as `unparseable content`). The generic
  preset keeps JSON mode, because what a self-hosted endpoint supports is
  unknown; the validation below applies to every provider regardless.
- **Answer**: `{ texts: { id, text, legible }[] }`. `legible: false` with empty
  text is a real answer — the paper was there, the words were not readable — and
  it still becomes a note, empty, for the author to fill in.
- **Errors**: the four this spec already defines, plus `crops_invalid` (400),
  `crops_too_large` (413) and `ai_quota` (429). A key that has spent its quota
  is told apart from a passing spike on purpose: one means try later, the other
  means raise the limit, and reporting both as `ai_error` sends the author back
  to retry something that cannot work yet.

**Telemetry:** `AI / Used / PhotoNotes`, once per committed import (the editor
fires it, because the route cannot know whether the author kept the result).

## Environment variables

| Variable                                                     | Where                     | Purpose                                                                                                                                                                                                                 |
| ------------------------------------------------------------ | ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GOOGLE_AI_STUDIO_API_KEY` / `OPENAI_API_KEY` / `AI_API_KEY` | Worker secret             | The model key; exactly one enables AI, and which one names the provider (see "Whose model? The key says."). None = every AI surface hidden.                                                                             |
| `AI_BASE_URL`                                                | Worker var (generic only) | The OpenAI-COMPATIBLE chat-completions base for `AI_API_KEY`: a laptop points it at llama.cpp or Ollama. The google and openai keys bring their own.                                                                    |
| `AI_MODEL`                                                   | Worker var (optional)     | Model id for the assistant. Defaults per provider (table above); required for the generic key.                                                                                                                          |
| `AI_VISION_MODEL`                                            | Worker var (optional)     | Model id for reading note crops (`/api/ai/read-notes`, spec/139 Phase 8). Defaults to `AI_MODEL`, so a deployment only sets it to split the two apart.                                                                  |
| `AI_ALLOWED_ORIGINS`                                         | Worker var (optional)     | Comma-separated `Origin` values that may call `/api/ai`. Unset = no check. Example: `https://livediagram.app,http://localhost:3002`. Entries are matched case-sensitive against the request's `Origin` header verbatim. |
| `AI_REQUIRE_CLERK`                                           | Worker var (optional)     | Set to `"true"` to require a verified Clerk JWT on `/api/ai` (rejects the `X-Owner-Id` guest path with 401). Unset / any other value = guests allowed.                                                                  |

Set via `wrangler secret put <the key var>` for production; drop into `apps/api/.dev.vars`
for local dev (gitignored). The two `AI_*` flags are plain `[vars]` (no secret value), so
operators can set them via `wrangler.toml`, the Cloudflare dashboard, or `.dev.vars` for
local testing.

## Frontend

### User preference

`aiAssistanceEnabled?: boolean` added to `UserPreferences` (spec/20 storage pattern).
Missing / `false` = panel hidden. Only shown in Settings when `capabilities.aiEnabled`.

### `useCapabilities` hook

Fetches `GET /api/capabilities` once at editor mount. Returns `{ aiEnabled: boolean }`.
On network failure defaults to `{ aiEnabled: false }` (fail-closed). The hook takes an
`enabled` flag so the call is deferred while a visitor is behind a share-link password
gate (spec/24): on a password-protected diagram, capabilities (and the server-side
preferences sync) don't fire until the correct password is entered, so wrong attempts
cost no extra requests.

### AI Panel

A floating, draggable panel rendered over the canvas via `MovablePanel` (drag to
reposition; reset returns it to its default spot). It's surfaced from the **Assistant**
accordion in the Editor side panel, and on mobile through the bottom dock popover. Visible
when `capabilities.aiEnabled && userPreferences.aiAssistanceEnabled`. Hidden in read-only /
view-role sessions (AI mutates the diagram; guests can't persist changes they don't own).

Contains:

- Mode selector (Ask / Clean tabs), with a **Connect agent** button on the right of that
  row that opens the "Connect an AI tool (MCP)" help article (spec/62) in a new tab — the
  calling model in an external tool generates far better than `/api/ai`, so the panel
  points power users there.
- **Reset position** button in the panel header (snap back to the default corner,
  spec/63), shown once the panel has been moved. The panel's two preferences ,
  **AI Assistant** (`aiAssistanceEnabled`) and **Suggested Prompts**
  (`aiSuggestedPrompts`), live in the **Settings** dialog's AI category
  (spec/20). They used to sit in a header settings gear; that popover went when
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
- Image or freehand element generation (READING the text on an image is in
  scope — see the read-notes route above; generating one is not)
- Per-user cost attribution or quota
- Model switching in the UI
