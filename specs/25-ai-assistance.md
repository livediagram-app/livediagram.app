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

| Mode         | What it does                                         | Response                                                     |
| ------------ | ---------------------------------------------------- | ------------------------------------------------------------ |
| **Generate** | Appends new elements described by the prompt         | JSON `{ elements }` — new elements to append                 |
| **Amend**    | Modifies existing elements per the prompt            | JSON `{ elements }` — full element list with changes applied |
| **Clean**    | Fixes label typos, normalises sizes/positions/styles | JSON `{ elements }` — full element list cleaned              |
| **Review**   | Gives textual feedback on structure and content      | `text/event-stream` SSE (streamed)                           |

## Context

The elements sent to the AI depend on the current editor selection:

- One or more elements selected → send only those elements.
- Nothing selected → send all elements on the current (active) tab.

Only the **active tab** is ever in scope — other tabs are never sent.

## Security

- Auth required: Clerk JWT or `X-Owner-Id` (no anonymous use of the AI endpoint).
- Per-IP rate limiter (`AI_RATE_LIMITER` binding, 20 req/60 s). Optional — absent on
  self-host deployments falls through to "allow", matching the pattern used by
  `WRITE_RATE_LIMITER` and `EVENTS_RATE_LIMITER`.
- Prompt capped at 1 000 characters server-side; element payload capped at 200 elements.
  Both prevent runaway token costs and context-window stuffing.
- System prompt explicitly instructs the model to refuse any request unrelated to diagram
  creation/editing and to return a structured error rather than comply.
- For mutating modes `response_format: { type: "json_object" }` is set on the OpenAI
  request so the model can only return parseable JSON, preventing injection of arbitrary
  text through the diagram data layer.
- Max-token caps: mutating modes 4 000, review mode 600.

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
  "mode": "generate" | "amend" | "clean" | "review",
  "prompt": "string (max 1 000 chars)",
  "elements": [...],
  "tabName": "string"
}
```

`elements` is an `Element[]` from `@livediagram/diagram` — either the selected subset or
the full active tab, computed client-side before the request.

Response for **mutating modes** (generate / amend / clean):

```json
{ "elements": [...] }
```

- `generate`: elements to **append** (fresh IDs).
- `amend` / `clean`: elements to **replace by ID** (same IDs as input; new IDs = append).

Response for **review**: `Content-Type: text/event-stream`, OpenAI SSE format piped
directly from the OpenAI API with CORS headers added.

Error responses follow the standard worker envelope:
`{ "error": "ai_not_configured" | "ai_error" | "ai_parse_error" | "off_topic" | ... }`

## Environment variables

| Variable         | Where                 | Purpose                                         |
| ---------------- | --------------------- | ----------------------------------------------- |
| `OPENAI_API_KEY` | Worker secret         | Required to enable AI. Absent = feature hidden. |
| `OPENAI_MODEL`   | Worker var (optional) | OpenAI model name. Defaults to `gpt-4o-mini`.   |

Set via `wrangler secret put OPENAI_API_KEY` for production; drop into `apps/api/.dev.vars`
for local dev (gitignored).

## Frontend

### User preference

`aiAssistanceEnabled?: boolean` added to `UserPreferences` (spec/20 storage pattern).
Missing / `false` = panel hidden. Only shown in Settings when `capabilities.aiEnabled`.

### `useCapabilities` hook

Fetches `GET /api/capabilities` once at editor mount. Returns `{ aiEnabled: boolean }`.
On network failure defaults to `{ aiEnabled: false }` (fail-closed).

### AI Panel

Fixed panel, bottom-left corner of the editor canvas. Visible when
`capabilities.aiEnabled && userPreferences.aiAssistanceEnabled`. Hidden in read-only /
view-role sessions (AI mutates the diagram; guests can't persist changes they don't own).

Contains:

- Mode selector (Generate / Amend / Clean / Review tabs)
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
- Conversation history / multi-turn sessions
- Image or freehand element generation
- Per-user cost attribution or quota
- Model switching in the UI
