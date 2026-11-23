# Note reader

## Overview

The model half of the event-storming photo import ([Event storming](event-storming.md#import-a-photo-of-the-wall).
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

## On your own key

The platform's rule ([ai-keys.md "In the apps"](../../../../liveworkspace/docs/specs/003-accounts/ai-keys.md#in-the-apps)):
a signed-in person with their own key (Settings › AI) has the notes read by it, on the key's provider and model (Claude or OpenAI, both of which read pictures), in place of the deployment's model or the
device.

- **Only their own key.** A read names no canvas, so a team's key does not apply here; the person's personal key
  does.
- **The route asks accounts first.** For a signed-in person in person (their own bearer), before the gate, which
  needs the answer: a key reads the crops whether or not the deployment has a model, and spends neither the
  deployment's daily budget (`AI_DAILY_CAP`) nor anything else built-in AI counts. The gate's origin allow-list,
  sign-in check and per-network rate limiter still run on a key. No key: the deployment's model, as below.
- **The editor asks when a photo is read.** Where the deployment has no model (`aiEnabled` false), a signed-in
  person's import asks once whether they have a key (`GET /api/workspace/account/ai-key`, never on load); on a key
  the server reads, and a re-read in the same review goes the same way.
- **A key that fails** (`ai_key_failed`: refused, out of credit, a model it can't use) is said in the review with
  **Fix Key**, and the notes are not sent to the deployment's model or read on the device instead.
- **The review shows the source line** (`AiSource`) under its reading progress: **Built-in AI** (the deployment's
  model or this device, both included with livediagram) or **Your Key** with the provider and model, and **Use Your
  Own Key** or **Change**, which opens Settings on its AI category over the review.

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
  of its batch. The generic preset keeps JSON mode, because what a custom endpoint
  supports is unknown; strict validation applies to every provider regardless.
- **Answer**: `{ texts: { id, text, legible }[] }`. `legible: false` with empty text is a real
  answer (the paper was there, the words were not readable) and it still becomes a note,
  empty, for the author to fill in.

## Security

- Auth required: an account access token or a guest token.
- With Pro on, a read also spends AI credits of the month, one for every 24 of its notes, from the owner of the
  diagram it is read into, after the gate and before the model is called ([AI credits (Pro)](#ai-credits-pro)). With
  Pro off nothing of that runs.
- Per-IP rate limiter (`AI_RATE_LIMITER` binding, 20 req/60 s). Optional: absent on
  deployments falls through to "allow".
- A daily cap on the whole deployment's reader requests, last in the gate, so a caller the
  rest of it refused never spends one. The per-IP limiter alone still lets one address spend
  28,800 requests a day, and guests are admitted, so nothing else bounds the provider bill.
  The cap defaults to **1,000 requests a UTC day** (`AI_DAILY_CAP`, a Worker var, overrides
  it with a positive whole number). A request is about six stickies, so that is roughly a
  hundred large walls a day, and at `gemini-2.5-flash-lite`'s prices well under a dollar a
  day at the cap. Past it the gate answers `429 ai_quota`, the same answer as a provider
  out of quota, so the editor reads the rest on the device and says "AI is resting for
  today" ([Event storming](event-storming.md)). The count lives in one instance of the
  worker's existing `PERSON_STORE` Durable Object, named `~ai-daily-budget` (no person id
  starts with `~`), under one storage key holding the day and its count; a new UTC day
  starts again from zero. No new binding, secret or migration. If that instance cannot be
  reached the gate admits the request and logs it: a cap that fails closed would switch the
  reader off on an infrastructure hiccup, and the per-IP limiter still runs.
- Optional `Origin` allow-list (`AI_ALLOWED_ORIGINS`). When set, the request's `Origin`
  must match one of the comma-separated entries exactly, or the worker answers
  `403 origin_not_allowed` before reaching the model. The hosted deployment sets it in
  `apps/api/wrangler.toml`'s `[vars]` (not the dashboard, which the next deploy wipes) to
  `https://www.livediagram.app,https://livediagram.app`. The `www` entry is the load-bearing
  one, because the apex 301-redirects to it.
- Optional sign-in-only gate (`AI_REQUIRE_SIGN_IN`). When `"true"`, the route rejects any
  request without a verified account access token with `401 sign_in_required`, so a third-party
  site cannot drain the operator's model budget with fresh guest identities.

Error responses follow the standard worker envelope, `{ "error": "<token>" }`:

| Token                | Status | When                                                            |
| -------------------- | ------ | --------------------------------------------------------------- |
| `crops_invalid`      | 400    | The body is not a list of valid crops.                          |
| `read_required`      | 400    | With Pro on, a read that would spend a credit names no read.    |
| `notes_required`     | 400    | With Pro on, a charged read does not say how many notes it has. |
| `notes_exceeded`     | 400    | With Pro on, a crop is a note the read did not pay for.         |
| `sign_in_required`   | 401    | The deployment requires sign-in for the reader.                 |
| `origin_not_allowed` | 403    | The request came from an origin the worker does not serve.      |
| `method_not_allowed` | 405    | Anything but a `POST`.                                          |
| `crops_too_large`    | 413    | Too many crops, or a crop over `CROP_MAX_BYTES`.                |
| `rate_limited`       | 429    | The caller's per-IP request budget is spent.                    |
| `ai_quota`           | 429    | The model key has spent its quota, or the day's cap is spent.   |
| `ai_credits_used`    | 429    | With Pro on, the payer's month of AI credits is used.           |
| `ai_error`           | 502    | The upstream model call failed or answered unusably.            |
| `ai_not_configured`  | 503    | No model key on this deployment (the default).                  |

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
| `AI_DAILY_CAP`                            | Worker var (optional) | The deployment's reader requests a UTC day. Unset or not a positive whole number = 1000.         |

Set the keys via `wrangler secret put <the key var>` for production; drop them into
`apps/api/.dev.vars` for local dev (gitignored).

## Telemetry

`AI / Used / PhotoNotes`, once per committed import (the editor fires it, because the route
cannot know whether the author kept the result).

## AI credits (Pro)

Status: being built, local only, with the rest of Pro
([Subscription](../../../../liveworkspace/docs/specs/019-subscription/subscription.md)).

With Pro on (the api worker's `PRO_ENABLED`), reading a photo spends AI credits of the month's AI Credits (Free 50,
Pro 1,000, Pro for Teams 500 a member, pooled): **one for every 24 notes or part of 24, one at least**
(`photoReadCredits` in `@liveworkspace/subscription`, the platform's table in
[Subscription](../../../../liveworkspace/docs/specs/019-subscription/subscription.md) "What an AI operation costs").
A note is read six to a request, so 24 notes is four requests: a 10-note photo is 1 credit, 30 notes 2, the 400
notes one photo may yield 17. The person sees the cost before the read starts, and may read on the device for
nothing instead ([What the editor shows](#what-the-editor-shows)). With Pro off nothing here exists: the route spends
nothing, asks the subscription service nothing and answers exactly as described above, and the editor draws and
sends nothing new.

### What a read costs

A read is one photo: every batch of its notes, and any note read again in the review, together. The server holds
that, not the browser:

- **A charged read says how many notes it has.** Every request of a charged read carries `notes`, the notes found
  in the photo (a whole number, 1 to `PHOTO_MAX_NOTES`, 400). A charged request without it, or with anything else, is
  refused `400 notes_required` and spends nothing. With Pro off, or a read charged to nobody, `notes` is not read.
- The first request of a read spends **`photoReadCredits(notes)` before the model is called**. Its answer carries a
  **read pass**: a signature over who paid, the read's id, the paid note count and when it lapses, 10 minutes later.
- Every later request of the same read (the other batches, a box read again) presents the pass and spends nothing.
  A pass that has lapsed, or is for another payer, another read or another note count, is ignored: that request is a
  new read, spends `photoReadCredits(notes)` and is given a new pass.
- **A request is bounded by what was paid.** The detector numbers a photo's notes from 0, and the review numbers the
  boxes drawn by hand from -1 down. Every crop of a charged request must be one of the read's notes, `0 ≤ id <
notes`, or a drawn box within what the credits paid for, `-24 × credits ≤ id < 0`. A crop outside is refused
  `400 notes_exceeded` before anything is spent: a pass for 10 notes is never a pass for note 50.
- **A charged read names itself.** A request that would spend a credit and carries no read id (or one that is not
  an id) is refused `400 read_required`: without an id there is no pass, and every request would spend.
- **A request that spent and then failed still hands back its pass** (`credits` beside the error), so the read's
  other batches are not charged again for a model that stumbled.
- **The pass is never signed with the app's subscription key itself.** A browser holds the pass, so its signing key
  is one derived for this purpose alone, `HMAC(SUBSCRIPTION_KEY, "livediagram:read-pass:v1")`.
- The editor sends the first batch alone, and the next ones one at a time until it holds the pass, then two at a
  time.

**What a lying browser can and cannot get.** The pass is a stateless signature, so the server does not count the
crops a pass has carried: a browser can present the same pass again. It can never read without spending (no pass
without a spend), never read a note outside the count it paid for, and never declare fewer than 1 or more than 400
notes. What it can do is declare few notes, pay for them, and send the same note ids again with other pictures
until the pass lapses: at most what the per-IP limiter lets through in 10 minutes (200 requests), each at most six
crops, for the credits it paid. That is exactly today's bound for one credit, so the price by count is never weaker
than one credit a read; an honest editor always declares the photo's real count, and an honest read costs what it
says.

### Who pays

The owner of the diagram the notes are read into, never the person reading.

- **A reader without an account is charged to nobody**, whatever they read into: their own diagram, none, or
  someone else's through a share link. They keep the behaviour from before Pro (the per-IP limiter and the day's cap
  bound them), are never told an owner, and can never spend anyone's credit. An Editor link handed to the world is
  not a way into its owner's month.
- For a reader who is signed in, the request names its diagram (`documentId`). The api asks the index for the
  caller's grant on it, exactly as a document route does. With an Editor's grant, the credit is the diagram's
  owner's, by the one rule every app follows ([Subscription](../../../../liveworkspace/docs/specs/019-subscription/subscription.md)
  "Who pays for an item"): the team's for a team's diagram, else the person who owns it. A team's diagram spends the
  team's, also when the reader has Pro of their own.
- **A guest's diagram** (its owner has no account) is never sent to the subscription service: a read into it spends
  nobody's credit, the gate alone bounds it, and nobody is offered an upgrade there.
- With no diagram named, no Editor's grant on it, or a grant that names no owner, the credit is the signed-in
  reader's own.
- Nothing the request says about a tier, a limit or an owner is read.

### A collaborator's reads

A signed-in Editor who is not the diagram's owner, nor a member of its owning team, spends the owner's credits. So
the diagram takes at most **20 such reads a UTC day** (`OWNER_READS_BY_OTHERS_PER_DAY`), counted over everyone who
is not its owner: a long workshop's worth of photos, as liveplanner's 20 AI drafts a day per plan is. A typical
photo is 1 or 2 credits; the most one read can cost is 17 (400 notes).

- The count is the diagram's own: one storage key in its room (`ai-owner-reads`, the day and its count), taken
  before the credit is spent. No new binding or migration.
- Past it the request answers `429 ai_quota`, the day's cap's own answer, so the editor reads the photo on the
  device and says AI is resting for today. Nothing of the owner's is spent.
- A read already paid for finishes on its pass: only a new read is counted.
- A read the owner's credits refuse (their month is used, or the service refuses the api) gives its slot back:
  only a read that spent a credit uses up one of the day's 20.
- The owner's own reads, and the owning team's, are never counted against it.
- If the diagram's room cannot be asked the read is refused the same way: this guards someone else's credits, and
  the photo is still read on the device.

The per-IP limiter and the deployment's daily cap stay in force on every tier, before the credit: a request they
refuse spends nothing.

### When the credits are used

- The first request of a read answers `429 { error: 'ai_credits_used', limit: 'aiCreditsPerMonth', owner, used?,
max? }` and the model is not called. `used` and `max` are the payer's own numbers: sent to the payer and the
  paying team's members alone. (Only someone signed in is ever charged, so `owner` never reaches a signed-out
  visitor.)
- The editor reads the photo on the device instead, as it does when the day's cap is spent, so the import still
  finishes.
- If the subscription service cannot be reached the read goes ahead (the client's rule): the reader never stops
  because the service is down.

### What the editor shows

**Before the read: the choice.** With Pro on, once the stickies are found and before anything is sent, a read the
editor expects to be charged asks how to read. Charged means: the reader is signed in, the server reader is available
(`aiEnabled`), and the diagram is not a guest's (its owner, as the document load named it, is an account or a team;
`itemPayer` in `@liveworkspace/subscription`). Above the review's Cancel and Add, a panel:

- **Read 30 Notes with AI · Uses 2 AI credits** (the primary; the cost is `usesAiCredits`). Under it, what is left
  for the diagram's owner or the owning team where this person may know it ("38 of 50 left this month", from the
  owner's usage as the subscription kit reads it, or the count the last read of this diagram answered; a
  collaborator is told no number). The number is the photo's found notes, the cost `photoReadCredits` of it: the
  same number the server spends.
- **Read on This Device** (secondary): the on-device reader, which spends nothing and sends nothing, with the quiet
  "On this device: free, nothing is sent, fewer words read right."
- **Too few left.** When fewer credits are left than the read uses, the AI choice is disabled and says why: "Uses 2
  AI credits, and 1 is left this month." When none are left the panel shows the kit's used notice ("This month's AI
  credits are used. They start again on 1 December."), with the offer for whoever may take it (**Upgrade to Pro**,
  **Upgrade Team**, **Ask an Admin**, nothing for anyone else), and Read on This Device stays.
- Nothing is read until a choice is made; a box moved or drawn meanwhile is read again on the device.

An uncharged read (Pro off, a reader who is not signed in, a guest's diagram, no server reader) shows no choice and
starts at once, exactly as before. If the server's word differs from the editor's guess (it charges nobody), the read
simply goes ahead and no line is drawn.

**During and after.** On the review, with the other status lines, only with Pro on and only once the api has said the
read is counted:

- **Uses 2 AI credits.** A quiet line while the photo is read, "Used 2 AI credits" once it has been: the real count
  for this read. For the diagram's owner or the owning team it also says what is left ("38 of 50 left this month"),
  in the numbers the api answered. A collaborator and a guest read the cost alone.
- **Used.** In place of "AI is resting for today": **This Month's 50 AI Credits Are Used**, "They come back on 1
  December. This photo is being read on this device instead.", then for the owner or a team admin "Pro has 1,000 a
  month." with **Upgrade to Pro** (Upgrade Team for a team), and for a team's member **Ask an Admin**. Everyone
  else reads "This month's AI credits are used. This photo is being read on this device instead." with no number,
  no offer and nothing about the owner's tier.
- **A box read again** after an AI read goes to the AI while the read's pass holds, and spends nothing. Once the pass
  has lapsed (10 minutes), or for a read made on the device, it is read on the device: a re-read never spends
  without asking.

The date is the first of next month (UTC), as the reader's locale writes it.

### The wire

- `ReadNotesRequest` gains `documentId?`, `read?` (the read's id: 8 to 64 of `A-Z a-z 0-9 _ -`), `notes?` (the
  photo's found notes, 1 to 400) and `pass?`. The editor sends them only with Pro on.
- `ReadNotesResponse` gains `credits?: { owner, pass, used?, max? }` when the read was counted: the payer's scope
  (`p:<accountId>` or `t:<teamId>`), the read pass, and what is used and the limit for the payer themself or a
  member of the paying team. A charged request that failed after its spend carries the same `credits` beside its
  `error`.

| Token             | Status | When                                                                   |
| ----------------- | ------ | ---------------------------------------------------------------------- |
| `ai_credits_used` | 429    | Pro is on and the payer has used the month's AI credits (first batch). |

### Cost

With Pro off: nothing more. With Pro on, a read's first request makes one index grant read (when it names a
diagram and carries no grant) and one spend at the subscription service; every later request of the read verifies
the pass (one HMAC) and makes no request.

The choice before a charged read loads with the review (the review's own chunk, never the first load) and reads
the owner's usage through the subscription kit already mounted for the credits line: no request of its own to the
api, and nothing with Pro off.
