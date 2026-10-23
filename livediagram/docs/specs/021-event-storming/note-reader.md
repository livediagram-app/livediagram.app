# Note reader

## Overview

The model half of the event-storming photo import ([Event storming](event-storming.md) Phase 8).
The stickies are FOUND in the browser by classical computer vision; `POST /api/ai/read-notes`
is asked only to read the handwriting on the crops that came out of that. It is the only
model call the api worker makes: livediagram has no in-editor AI assistant (connected AI
tools work through the [MCP server](../015-api/mcp-server.md) and API tokens instead).

The server reader is optional. It needs a model key (`GOOGLE_AI_STUDIO_API_KEY`, or a generic
`AI_API_KEY` + `AI_BASE_URL` + `AI_VISION_MODEL`) in the api worker environment. With none,
`GET /api/capabilities` reports `aiEnabled: false`, the route answers 503, and the editor reads
the crops in the browser instead (`apps/editor/lib/reading/select.ts`), so the photo import still
works and nothing leaves the device. The server reader wins when it exists because it reads
markedly better.

## Capability detection

`GET /api/capabilities` (no auth) returns `aiEnabled: boolean`, `true` iff a model key
resolves to a provider (below). The editor fetches it once at mount and fails closed on a
network error. The fetch is deferred while a visitor is behind a share-link password gate
([Share password](../013-workspace/share-password.md)).

## Whose model? The key says.

The PROVIDER is inferred from WHICH KEY IS SET, because a key is provider-specific, so the
variable that holds it should say whose it is, and the endpoint follows.

| key var                                          | provider | base URL                                                  | default model           |
| ------------------------------------------------ | -------- | --------------------------------------------------------- | ----------------------- |
| `GOOGLE_AI_STUDIO_API_KEY`                       | google   | `https://generativelanguage.googleapis.com/v1beta/openai` | `gemini-2.5-flash-lite` |
| `AI_API_KEY` + `AI_BASE_URL` + `AI_VISION_MODEL` | generic  | whatever `AI_BASE_URL` says                               | none, `AI_VISION_MODEL` |

The generic row is Mistral, OpenRouter, a local llama.cpp or Ollama: anything that speaks
the OpenAI chat-completions wire.

- **Google outranks the generic key.** Set beside `GOOGLE_AI_STUDIO_API_KEY`, `AI_API_KEY`
  serves nothing, so it is logged as an error on every resolution (`[ai] AI_API_KEY is set
but unused`) rather than left as a dead secret nobody notices.
- **A half-configured generic key resolves to no provider.** `AI_API_KEY` without
  `AI_BASE_URL` or `AI_VISION_MODEL` logs one loud line and the reader hides, exactly as with
  no key.
- **Which model.** `AI_VISION_MODEL`, else the Google default `gemini-2.5-flash-lite`.
  Reading handwriting is literal work: measured on a real wall the small model read 99% of
  the words against 95% for a bigger flash model, at about a quarter of the cost and four
  times the speed (docs/research/vision/handwriting-readers.md). These models spend tokens on
  reasoning before the answer, so `max_tokens` must leave room for it.

## The route

- **Admission** (`routes/ai-gate.ts`), in this order: a provider resolves → origin allow-list
  → sign-in-only flag → owner → method → rate limiter. The origin check runs before auth so a
  third-party site cannot probe the endpoint for state, and the rate limiter runs last so a
  refused caller never spends anyone's budget.
- **Body**: `{ crops: { id, image }[] }`, at most `READ_MAX_CROPS_PER_REQUEST` (6) crops per
  call, each a data URL of at most `CROP_MAX_BYTES` in one of `image/jpeg`, `image/png`,
  `image/webp`. The client batches a bigger run and sends two batches at a time. Six, not
  sixteen: a 16-image request was answered 503 "high demand" every time by a hosted flash
  model while a 5-image request succeeded every time, and smaller batches also read the
  handwriting markedly better.
- **Never the whole photo.** A crop is one sticky; whoever is standing in front of the wall
  stays in the browser.
- **A strict schema where the provider has one.** The google preset sends
  `response_format: { type: 'json_schema', strict: true }` with the answer shape. JSON mode
  alone was not enough: `gemini-2.5-flash-lite` failed two batches of seven in one run with
  broken quoting, a dropped field, or a truncated answer, and one bad answer fails every note
  of its batch. The generic preset keeps JSON mode, because what a self-hosted endpoint
  supports is unknown; strict validation applies to every provider regardless.
- **Answer**: `{ texts: { id, text, legible }[] }`. `legible: false` with empty text is a real
  answer (the paper was there, the words were not readable) and it still becomes a note,
  empty, for the author to fill in.

## Security

- Auth required: access token or `X-Owner-Id`.
- Per-IP rate limiter (`AI_RATE_LIMITER` binding, 20 req/60 s). Optional: absent on
  self-host deployments falls through to "allow".
- Optional `Origin` allow-list (`AI_ALLOWED_ORIGINS`). When set, the request's `Origin`
  must match one of the comma-separated entries exactly, or the worker answers
  `403 origin_not_allowed` before reaching the model. The hosted deployment sets it in
  `apps/api/wrangler.toml`'s `[vars]` (not the dashboard, which the next deploy wipes) to
  `https://www.livediagram.app,https://livediagram.app`. The `www` entry is the load-bearing
  one, because the apex 301-redirects to it.
- Optional sign-in-only gate (`AI_REQUIRE_SIGN_IN`). When `"true"`, the route rejects any
  request without a verified access token with `401 sign_in_required`, so a third-party
  site cannot drain the operator's model budget by minting fresh `X-Owner-Id` UUIDs.

Error responses follow the standard worker envelope, `{ "error": "<token>" }`:

| Token                | Status | When                                                          |
| -------------------- | ------ | ------------------------------------------------------------- |
| `crops_invalid`      | 400    | The body is not a list of valid crops.                        |
| `sign_in_required`   | 401    | The deployment requires sign-in for the reader.               |
| `origin_not_allowed` | 403    | The request came from an origin the worker does not serve.    |
| `method_not_allowed` | 405    | Anything but a `POST`.                                        |
| `crops_too_large`    | 413    | Too many crops, or a crop over `CROP_MAX_BYTES`.              |
| `rate_limited`       | 429    | The caller's per-IP request budget is spent.                  |
| `ai_quota`           | 429    | The model key has spent its quota (raise it; retrying won't). |
| `ai_error`           | 502    | The upstream model call failed or answered unusably.          |
| `ai_not_configured`  | 503    | No model key on this deployment (the self-host default).      |

A request with no identity at all gets the worker-wide `bad_request` 400 every owner-scoped
route sends.

## Environment

| Variable                                  | Where                 | Purpose                                                                                          |
| ----------------------------------------- | --------------------- | ------------------------------------------------------------------------------------------------ |
| `GOOGLE_AI_STUDIO_API_KEY` / `AI_API_KEY` | Worker secret         | The model keys; either enables the reader. None = the photo reader is hidden.                    |
| `AI_BASE_URL`                             | Worker var (generic)  | The OpenAI-compatible chat-completions base for `AI_API_KEY`.                                    |
| `AI_VISION_MODEL`                         | Worker var (optional) | The reader's model. Defaults to `gemini-2.5-flash-lite` on Google; required for the generic key. |
| `AI_ALLOWED_ORIGINS`                      | Worker var (optional) | Comma-separated `Origin` values that may call the reader. Unset = no check.                      |
| `AI_REQUIRE_SIGN_IN`                      | Worker var (optional) | `"true"` requires a verified access token (rejects the guest path with 401).                     |

Set the keys via `wrangler secret put <the key var>` for production; drop them into
`apps/api/.dev.vars` for local dev (gitignored).

## Telemetry

`AI / Used / PhotoNotes`, once per committed import (the editor fires it, because the route
cannot know whether the author kept the result).
