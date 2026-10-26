# Workbenches: blueprint

Derived from [workbench.md](../workbench.md). The spec decides; this file only adds engineering precision, read from the code. Defaults applied where the spec is silent are ledgered in [DEFAULTS.md](DEFAULTS.md). Paths are relative to the repository root.

## Domain and naming

| Term            | Identifier                                    | Meaning                                       |
| --------------- | --------------------------------------------- | --------------------------------------------- |
| Workbench store | `WorkbenchStore` Durable Object (`WORKBENCH`) | One per person, on the accounts Worker        |
| Pairing         | `wb_pairings` row                             | An API token paired with a workbench          |
| Ticket          | `wb_tickets` row                              | A one-time handoff into a session             |
| Session         | `wb_sessions` row                             | An open workbench session                     |
| Dialect         | `workbench/apps.ts`                           | Each app's word for an item and its addresses |

## Interfaces and contracts

On liveworkspace.app under `/api/account/workbench`; on an app's address under `/api/workbench`, which the
router forwards there.

Every route the specs name, with the section that defines it (each checked to have its path's literal in the code):

| Route                                                        | Specified in                                                                   |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------ |
| `POST /api/account/internal/workbench/session`               | [workbench.md "Addresses"](../../011-workbench/workbench.md#addresses)         |
| `POST /api/account/internal/workbench/rooms`                 | [workbench.md "Addresses"](../../011-workbench/workbench.md#addresses)         |
| `POST /api/account/internal/allowance`                       | [workbench.md "Addresses"](../../011-workbench/workbench.md#addresses)         |
| `DELETE /api/account/tokens/:id`                             | [workbench.md "Ending access"](../../011-workbench/workbench.md#ending-access) |
| `POST /api/index/internal/workbench-close`                   | [workbench.md "Ending access"](../../011-workbench/workbench.md#ending-access) |
| `POST /api/internal/items/:id/workbench-close { pairingId }` | [workbench.md "Ending access"](../../011-workbench/workbench.md#ending-access) |

## Security and trust

Pairing requests are limited (`WORKBENCH_LIMITER`, 30 a minute) and each store keeps a quota (`wb_quota`).
Revoking the token ends its pairings.

## Performance and limits

One Durable Object per person, so no shared hot row; the figures are in
[workbench.md "Performance"](../workbench.md#performance).

## Files

| File                                                          | Role                                                                                                                                                                                            |
| ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `liveworkspace/apps/accounts/src/workbench/apps.ts`           | Each app's workbench dialect (liveworkspace/docs/specs/011-workbench/workbench.md "Addresses"): the app a request is for, its word for an item as the item scope (`project`, `document`, `desi… |
| `liveworkspace/apps/accounts/src/workbench/durable-object.ts` | The workbench store's Durable Object (store.ts), one per person, bound as WORKBENCH (wrangler.toml: a `new_sqlite_classes` migration)                                                           |
| `liveworkspace/apps/accounts/src/workbench/index-access.ts`   | The owner's own access to an item or a folder, for a ticket's mint and redemption (liveworkspace/docs/specs/011-workbench/workbench.md "The handoff"): never a share code, whatever the reques… |
| `liveworkspace/apps/accounts/src/workbench/internal.ts`       | The apps' servers' doors into the workbench service (liveworkspace/docs/specs/011-workbench/workbench.md "The handoff"), under /api/account/internal with their client credentials, each for t… |
| `liveworkspace/apps/accounts/src/workbench/revoke.ts`         | Ending a workbench's access from accounts' side (liveworkspace/docs/specs/011-workbench/workbench.md "Ending access"): a token revoked ends its pairings and requests, an account closed drops… |
| `liveworkspace/apps/accounts/src/workbench/routes.ts`         | /api/account/workbench/* (liveworkspace/docs/specs/011-workbench/workbench.md "Addresses"): every app's workbench pairing, tickets and sessions                                                 |
| `liveworkspace/apps/accounts/src/workbench/store.ts`          | One person's workbench (liveworkspace/docs/specs/011-workbench/workbench.md "The store"): their pairing requests, pairings, tickets, sessions, the rooms a workspace session joined, and their… |

## Data and persistence

Each person has one `WorkbenchStore` Durable Object on the accounts Worker (`WORKBENCH` binding), whose SQLite holds:

| Table                 | Columns                                                                                                                                            | Declared in |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| `wb_pairing_requests` | `code`, `app`, `token_id`, `origin`, `name`, `scope`, `status`, `created_at`, `expires_at`, `answered_at`                                          | `store.ts`  |
| `wb_pairings`         | `id`, `app`, `token_id`, `origin`, `name`, `scope`, `created_at`                                                                                   | `store.ts`  |
| `wb_tickets`          | `ticket_hash`, `app`, `token_id`, `pairing_id`, `scope`, `item_id`, `folder_id`, `tab_id`, `origin`, `role`, `created_at`, `expires_at`, `used_at` | `store.ts`  |
| `wb_sessions`         | `id`, `secret_hash`, `app`, `token_id`, `pairing_id`, `scope`, `item_id`, `folder_id`, `tab_id`, `origin`, `role`, `created_at`, `expires_at`      | `store.ts`  |
| `wb_session_rooms`    | `session_id`, `item_id`                                                                                                                            | `store.ts`  |
| `wb_quota`            | `kind`, `at`, `until`                                                                                                                              | `store.ts`  |
| `wb_meta`             | `key`, `value`                                                                                                                                     | `store.ts`  |

## Constants and configuration: named constants

| Constant                         | Value                                     | File        |
| -------------------------------- | ----------------------------------------- | ----------- |
| `WORKBENCH_TICKET_TTL_MS`        | `60_000`                                  | `routes.ts` |
| `WORKBENCH_SESSION_TTL_MS`       | `8 * 60 * 60 * 1000`                      | `routes.ts` |
| `WORKBENCH_TICKETS_PER_MINUTE`   | `30`                                      | `routes.ts` |
| `WORKBENCH_NAME_MAX_LENGTH`      | `40`                                      | `routes.ts` |
| `WORKBENCH_ORIGIN_MAX_LENGTH`    | `255`                                     | `routes.ts` |
| `WORKBENCH_POLL_INTERVAL_S`      | `5`                                       | `routes.ts` |
| `WORKBENCH_SESSION_PREFIX`       | `'lvw_'`                                  | `store.ts`  |
| `WORKBENCH_TICKET_BYTES`         | `16`                                      | `store.ts`  |
| `WORKBENCH_PAIRING_CODE_BYTES`   | `16`                                      | `store.ts`  |
| `WORKBENCH_SESSION_SECRET_BYTES` | `32`                                      | `store.ts`  |
| `WORKBENCH_PAIRING_TTL_MS`       | `10 * 60 * 1000`                          | `store.ts`  |
| `WORKBENCH_SESSION_GRACE_MS`     | `24 * 60 * 60 * 1000`                     | `store.ts`  |
| `WORKBENCH_QUOTA_MAX`            | `1_000`                                   | `store.ts`  |
| `WORKBENCH_SESSION_ROOMS_MAX`    | `500`                                     | `store.ts`  |
| `WORKBENCH_TICKET_PATTERN`       | `/^[A-Za-z0-9_-]{22}\.[0-9a-f]{64}$/`     | `store.ts`  |
| `WORKBENCH_SESSION_PATTERN`      | `/^lvw_[A-Za-z0-9_-]{43}\.[0-9a-f]{64}$/` | `store.ts`  |
| `WORKBENCH_CODE_PATTERN`         | `/^[A-Za-z0-9_-]{22}$/`                   | `store.ts`  |

## Testing

1 test files:

- `liveworkspace/apps/accounts/src/workbench/workbench.test.ts`
