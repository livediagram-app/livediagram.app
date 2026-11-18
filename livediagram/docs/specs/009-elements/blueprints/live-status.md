# Live service status: blueprint

Derived from [Live service status](../live-status.md). The spec decides; this file only adds engineering precision.
Parts 2 to 4 (the room's rounds, the badge, the dialog) add their rows here as they land.

Scope, by file:

| File                                                  | Role                                                                                                                                   |
| ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `../packages/model-core/src/public-https-url.ts`      | `parsePublicHttpsUrl`, `INTERNAL_HOST_SUFFIXES`: the address shape check, shared with liveworkspace's webhooks                         |
| `packages/document/src/element-types.ts`              | `ShapeElement.statusUrl`                                                                                                               |
| `packages/document/src/status-source.ts`              | `STATUS_URL_MAX`, `isStatusUrl`, `statusUrlsOf`                                                                                        |
| `packages/document/src/validate-shape.ts`             | The `statusUrl` field check                                                                                                            |
| `packages/document/src/element-fields.ts`             | `statusUrl` in the shape's field list, so edit operations may set it                                                                   |
| `packages/document/src/participant-content.ts`        | `PARTICIPANT_NEVER_FIELDS`: kept as stored on a Participant's update, dropped from its add                                             |
| `packages/api-schema/src/service-status.ts`           | `ServiceState`, `ServiceStatus`, `ServiceStatusReason`, the constants, `classifyStatusAnswer`, `readStatusBody`, `currentServiceState` |
| `../liveworkspace/apps/index/src/webhooks/address.ts` | `parseWebhookUrl` over `parsePublicHttpsUrl`, adding its Slack and Teams host rules                                                    |
| `apps/api/src/openapi/schemas.generated.ts`           | Regenerated: `statusUrl` on the shape schema                                                                                           |

## Domain and naming

| Term    | Identifier               | Meaning                                                                 |
| ------- | ------------------------ | ----------------------------------------------------------------------- |
| Binding | `ShapeElement.statusUrl` | The public https URL a shape is bound to                                |
| Source  | a distinct `statusUrl`   | What a round checks once, however many shapes share it                  |
| State   | `ServiceState`           | `'up' \| 'degraded' \| 'down' \| 'unknown'`                             |
| Status  | `ServiceStatus`          | `{ state, checkedAt, reason?, httpStatus? }`, one source's latest check |
| Round   | (part 2)                 | One alarm's checks of every source, at most `STATUS_SOURCES_MAX`        |

## Behaviour and state

- `parsePublicHttpsUrl(raw, max = 2048)`: not a string, empty after trimming, or longer than `max` is `invalid`;
  `new URL(trimmed)` throwing is `invalid`; protocol not `https:`, a user name or password, or a port other than
  empty or `443` is `invalid`. The host is lowercased with one trailing dot dropped. An IPv4 literal (four dotted
  decimal parts, after the URL parser's own normalising, so `0x7f000001` is caught), an IPv6 literal (contains `:`),
  `localhost`, a host with no `.`, or a host ending in an `INTERNAL_HOST_SUFFIXES` entry (`.local`, `.localhost`,
  `.internal`, `.lan`, `.home.arpa`, `.intranet`) is `private`. Otherwise `{ ok: true, url, host }`.
- `isStatusUrl(v)`: `parsePublicHttpsUrl(v, STATUS_URL_MAX).ok`, and `v` is already trimmed (stored values never
  carry outer whitespace).
- `statusUrlsOf(tabs, max)`: the distinct `statusUrl`s of every shape across the tabs, in tab then element order,
  at most `max`; the scan stops at `max`. Linear in elements.
- The participant rule: `PARTICIPANT_NEVER_FIELDS = ['statusUrl']`. `mergeOwn` copies each from the stored
  element (absent stays absent); `applyAdd` deletes each from the stamped element. `mergeOthers` never copies it
  because it is in no permitted list.
- `classifyStatusAnswer(result, now)` over api-kit's `PublicFetchResult`:
  - `ok`: `readStatusBody(bytes)`; `too_large` is `up` (the body cap is checked only after a 2xx).
  - `http_status` is `down` with `httpStatus` when given; `timeout`, `unreachable`, `unresolved` are `down` with
    that reason.
  - `too_many_redirects` (any redirect, since rounds pass `maxRedirects: 0`) is `unknown`, reason `redirect`;
    `private_address`, `invalid_url`, `not_https` are `unknown`, reason `refused`.
- `readStatusBody(bytes)`: decoded as UTF-8 (non-fatal); trimmed; not starting `{` is `up`; `JSON.parse` throwing
  is `up`. A record whose `status` is a record with a string `indicator` maps the indicator (`none` up; `minor`,
  `maintenance` degraded; `major`, `critical` down; another word up). Otherwise the first of `status`, `state`,
  `health` that is a string is looked up in the word sets; a word in none, or no such field, is `up`. Any state but
  `up` from the body carries reason `reported`.
- `currentServiceState(status, now)`: `unknown` when there is no status or `now - checkedAt > STATUS_STALE_MS`;
  otherwise the stored state.

## Constants and configuration

| Name                 | Value   | Where               |
| -------------------- | ------- | ------------------- |
| `STATUS_URL_MAX`     | 2,048   | `status-source.ts`  |
| `STATUS_POLL_MS`     | 60,000  | `service-status.ts` |
| `STATUS_STALE_MS`    | 180,000 | `service-status.ts` |
| `STATUS_SOURCES_MAX` | 25      | `service-status.ts` |
| `STATUS_TIMEOUT_MS`  | 5,000   | `service-status.ts` |
| `STATUS_BODY_MAX`    | 65,536  | `service-status.ts` |

## Testing

- `public-https-url.test.ts`: each accept and refusal above; the webhooks guard's own tests keep passing over it.
- `status-source.test.ts`: `isStatusUrl`, `statusUrlsOf` (dedupe, order, cap, non-shapes ignored); validation
  names `statusUrl`.
- `participant-content.test.ts`: a Participant's own mind node keeps its stored `statusUrl` and can't add one; the
  leak test covers every other element.
- `service-status.test.ts`: every row of the spec's answer table; a CPU-time budget on a 64 KiB body.
