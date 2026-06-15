# 25 — AI Assistance

## Overview

An optional AI assistant panel in the diagram editor. Disabled by default; users opt in
via Settings. Requires `OPENAI_API_KEY` to be configured in the api worker environment —
if absent the feature is **hidden entirely** (no UI surface, no API routes respond). This
keeps the OSS/self-host promise intact: contributors who don't want to provision an
OpenAI key get zero AI surface with no extra code paths to reason about.

## Capability detection

`GET /api/capabilities` returns `{ "aiEnabled": boolean }`. No auth required. The live
app fetches this once at editor mount; if `aiEnabled: false` the AI toggle in Settings and
the AI panel are never rendered.

## Modes

| Mode         | What it does                                                                                     | Response                                           |
| ------------ | ------------------------------------------------------------------------------------------------ | -------------------------------------------------- |
| **Generate** | Adds new elements and/or modifies existing ones per the prompt (labelled **Build** in the panel) | `text/event-stream` SSE; client parses JSON on end |
| **Clean**    | Fixes label typos, normalises sizes/positions/styles                                             | `text/event-stream` SSE; client parses JSON on end |
| **Review**   | Gives textual feedback on structure and content                                                  | `text/event-stream` SSE (text deltas)              |
| **Ask**      | Answers questions about the diagram (read-only Q&A)                                              | `text/event-stream` SSE (text deltas)              |

Every mode streams: the worker pipes OpenAI's SSE through unchanged so the panel can render progress (text deltas for review / ask, a "thinking" indicator for the JSON modes). The client buffers the JSON-mode stream until completion, parses it, then applies the elements via `commit()` so undo still treats the change as one block.

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
  down to `https://livediagram.app`; self-hosters set it to their own hostname (plus dev
  origins like `http://localhost:3002` if they want local dev to keep working).
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
- For mutating modes `response_format: { type: "json_object" }` is set on the OpenAI
  request so the model can only return parseable JSON, preventing injection of arbitrary
  text through the diagram data layer.
- Max-token caps: mutating modes (generate / clean) 8 000, text modes (review / ask) 400.

## API

### `GET /api/capabilities`

No auth required. Response:

```json
{ "aiEnabled": true }
```

`aiEnabled` is `true` iff `env.OPENAI_API_KEY` is set in the worker environment.

### `POST /api/ai`

Auth required (Clerk Bearer JWT **or** `X-Owner-Id`).

Request body:

```json
{
  "mode": "generate" | "clean" | "review" | "ask",
  "prompt": "string (max 1 000 chars)",
  "elements": [...],
  "tabName": "string",
  "focusIds": ["elementId", ...],
  "history": [{ "role": "user" | "assistant", "content": "..." }, ...]
}
```

`elements` is the full active-tab `Element[]` from `@livediagram/diagram`. `focusIds` is the optional list of selected element IDs; the system prompt steers the model toward editing those while preserving everything else. `history` is the optional prior-turn list (capped server-side at the last 6 turns); both fields default to `[]`.

Response for **every mode**: `Content-Type: text/event-stream`, OpenAI SSE format piped through with CORS headers added. The JSON-mode payload (generate / clean) is collected by the client into a single `{ elements: [...] }` block on stream completion:

- `generate`: a mix of **appended** elements (fresh IDs) and **modified** ones (existing IDs, replaced in place), the prompt decides which. This is the former separate "amend" mode folded in: generate now adds, edits, or does both in one response.
- `clean`: elements to **replace by ID** (same IDs as input; new IDs = append).
- `review` / `ask`: SSE text deltas rendered straight into the panel as they arrive.

**Client-side normalisation.** As elements are parsed out of the stream (`extractElementsFromBuffer`, `apps/live/lib/api/ai.ts`), each shape is normalised so the result renders consistently: a shape with no `textSize` (or `"scale"`) is pinned to `"md"`. Without this the canvas default for an unset size is `'scale'` (auto-fit), so a generated node with no explicit size balloons its label to fill the box while sized siblings stay small — the classic "inconsistent font sizes" output. The model's explicit `sm`/`md`/`lg` hierarchy is preserved; only missing / `scale` sizes are rewritten. The system prompt is also strict that every shape must carry an explicit `textSize` (never omit, never `scale`) and that siblings at the same tier share one size, but the normalisation is the safety net regardless of what the model returns.

## Deterministic auto-layout (Generate)

The model decides diagram **structure** (which nodes, which edges) well but geometry poorly: scattered box sizes, mis-anchored arrows, uneven spacing. So when **Generate** produces a whole new connected diagram, the client re-derives the geometry deterministically rather than trusting the model's coordinates. `autoLayoutElements` (`packages/diagram/src/auto-layout.ts`, pure + unit-tested) does three things:

1. **Uniform per-tier sizing.** Peers — same shape kind at the same text level — are snapped to one size (the tier's max dimension, clamped); circles / diamonds are squared. No more one node twice the size of its siblings.
2. **Layered (Sugiyama-lite) layout.** The pinned arrows form a graph; nodes are ranked by longest-path from the sources and placed in evenly-spaced, centred ranks. Direction (top-to-bottom vs left-to-right) is auto-detected from the model's rough positioning unless forced. Cycles are broken by ignoring back edges; disconnected sub-diagrams are laid out independently and arranged side by side.
3. **Re-anchored straight arrows.** Each arrow's faces are chosen from the final relative positions of its endpoints (target below → `s`→`n`, to the right → `e`→`w`, ...) and the style set to `straight`, so connectors point the right way and don't wander.

The pass runs inside `mergeAiElements` (`editor-page-helpers.ts`) and is gated by `isLayoutCandidate`: it only fires for a freshly generated diagram of **≥3 connected nodes**, placed in free space below existing content. Small additive edits ("add a step") and **Clean** keep the model's placement — re-flowing a diagram the user has already arranged would be destructive. This makes generated output visually consistent regardless of the model's geometry; a follow-up could offer the same pass as an explicit "tidy layout" command and route orthogonal arrows around skip-rank edges.

Error responses follow the standard worker envelope:
`{ "error": "ai_not_configured" | "ai_error" | "ai_parse_error" | "off_topic" | ... }`

## Environment variables

| Variable             | Where                 | Purpose                                                                                                                                                                                                                 |
| -------------------- | --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `OPENAI_API_KEY`     | Worker secret         | Required to enable AI. Absent = feature hidden.                                                                                                                                                                         |
| `OPENAI_MODEL`       | Worker var (optional) | OpenAI model name. Defaults to `gpt-4o`.                                                                                                                                                                                |
| `AI_ALLOWED_ORIGINS` | Worker var (optional) | Comma-separated `Origin` values that may call `/api/ai`. Unset = no check. Example: `https://livediagram.app,http://localhost:3002`. Entries are matched case-sensitive against the request's `Origin` header verbatim. |
| `AI_REQUIRE_CLERK`   | Worker var (optional) | Set to `"true"` to require a verified Clerk JWT on `/api/ai` (rejects the `X-Owner-Id` guest path with 401). Unset / any other value = guests allowed.                                                                  |

Set via `wrangler secret put OPENAI_API_KEY` for production; drop into `apps/api/.dev.vars`
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

- Mode selector (Build / Ask / Review / Clean tabs; "Build" is the `generate` mode)
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
- Image or freehand element generation
- Per-user cost attribution or quota
- Model switching in the UI
