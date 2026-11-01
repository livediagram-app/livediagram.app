# Phone notifications: blueprint

Derived from [push.md](../push.md). The spec decides; this file only adds engineering precision, read from the code.
Defaults are cited as `ACCn`. Paths are relative to the repository root.

Scope, by file:

| File                                                           | Role                                                                   |
| -------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `packages/settings/src/push.ts`                                | The contract: kinds, switches, limits, wire shapes, paths              |
| `packages/settings/src/account.ts`                             | `PUSH_ROWS`: the four switches as the Settings panel words them        |
| `packages/auth-client/src/push.ts`                             | `sendPush`: an app's server asking accounts to send                    |
| `packages/index-app/src/push.ts`                               | `createPusher`: who hears of a comment or an assignment, for every app |
| `liveworkspace/apps/accounts/src/push/web-push.ts`             | RFC 8291 encryption and RFC 8292 VAPID on Web Crypto                   |
| `liveworkspace/apps/accounts/src/push/devices.ts`              | `push_device`: register, list, remove, look up, settle                 |
| `liveworkspace/apps/accounts/src/push/deliver.ts`              | Checking an app's notifications; sending them after the answer         |
| `liveworkspace/apps/accounts/src/push/routes.ts`               | The device routes (both doors) and `POST /internal/push`               |
| `liveworkspace/apps/accounts/migrations/0017_push_devices.sql` | The table                                                              |
| `liveworkspace/apps/accounts/scripts/generate-vapid-keys.ts`   | Makes a VAPID pair and prints the two secrets                          |
| `packages/settings-ui/src/push/`                               | The Phone section: Turn On, the switches, the device list              |
| `packages/ui/src/push-worker.ts`                               | The push-only service worker's source, and registering it after load   |

## Domain and naming

| Term         | Identifier                                                | Meaning                                                                                |
| ------------ | --------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Kind         | `PushKind`: `comment`, `mention`, `action`, `threadReply` | What a notification is about                                                           |
| Switch       | `PUSH_SETTING_KEYS[kind]`                                 | `pushComments`, `pushMentions`, `pushActionAssigned`, `pushThreadReplies`, `all` scope |
| Device       | `push_device` row, id `pd_<32 hex>`                       | One browser's subscription, for every app                                              |
| Notification | `PushNotification { userId, kind, title, url, tag? }`     | What an app hands accounts                                                             |
| Message      | `PushMessage { title, body, url, tag? }`                  | What the service worker decrypts                                                       |
| Person tag   | `sha256("<item>:<person>")`, hex                          | How the room's sessions are matched, never an id                                       |

## Behaviour and state

- **Register** (`registerDevice`): one batch, an upsert on `endpoint` (`RETURNING` the row, its id kept on conflict),
  then a trim keeping the account's newest `MAX_PUSH_DEVICES` by `created_at DESC, id`.
- **Deliver** (`deliverPush`): VAPID pair or nothing (`skipped`); quiet-hours hook; settings and devices read at once;
  one post per (notification, device) whose switch is not stored `false`; capped; pooled; settled in one batch.
- **Pusher** (`createPusher`): `pushComment` picks mention, then `threadReply`, then `comment` per person; checks
  readers (owner, joined team member, else `indexGrants`); drops present people; sends one `sendPush`.
- **Service worker**: `push` shows `PushMessage` with the site's icon and `data.url`; `notificationclick` focuses a
  client already at that URL, else `clients.openWindow(url)`. No `fetch` listener.

## Interfaces and contracts

| Route                                  | Door               | Answers                                                                           |
| -------------------------------------- | ------------------ | --------------------------------------------------------------------------------- |
| `GET /api/account/push/devices`        | session, bearer    | `{ publicKey: string \| null, devices: PushDevice[] }`                            |
| `POST /api/account/push/devices`       | session, bearer    | `201 { device }`; `400 invalid_endpoint\|invalid_keys`; `503 push_not_configured` |
| `DELETE /api/account/push/devices/:id` | session, bearer    | `{ id }`; `404 not_found`                                                         |
| `POST /api/account/internal/push`      | client credentials | `202 { accepted }`; `400 <reason>`; `403 client_has_no_app`                       |

`400` reasons for `/internal/push`: `notifications_required`, `too_many_notifications`, `invalid_user`,
`invalid_kind`, `invalid_title`, `invalid_url`, `invalid_tag` (tag `^[A-Za-z0-9:_-]{1,64}$`).

## Data and persistence

`push_device (id PK, user_id → "user" ON DELETE CASCADE, endpoint UNIQUE 12..1024, p256dh 86..88, auth 22..24,
label 1..80, created_at, last_sent_at)`, index `(user_id, created_at)`. Every read and write names `user_id` or
`endpoint`, or a list of ids through `json_each`.

## Errors and edge cases

- A shared browser: the second account's registration moves the row (`ON CONFLICT (endpoint) DO UPDATE SET user_id`).
- A push service's `404`/`410` removes the device; any other non-2xx or a thrown fetch counts `failed` and keeps it.
- Stored keys that no longer import as a P-256 point remove the device.
- `deliverPush` and every pusher method never throw: each logs `[push] …` and returns.

## Security and trust

- Endpoints only on `PUSH_SERVICE_HOSTS` (and subdomains), https, no port or credentials: no request to a page's
  chosen address.
- Links only on the calling client's app origins (`appOrigins(client.app, ENVIRONMENT)`).
- Titles cleaned (`cleanText`: bidi controls out, clipped between whole characters).
- The payload is end-to-end encrypted for the device; the push service sees the record, VAPID token and TTL.
- No comment text, action name or description ever reaches a title (`pushTitle`).

## Performance and limits

| Constant                  | Value  | Where                    |
| ------------------------- | ------ | ------------------------ |
| `MAX_PUSH_NOTIFICATIONS`  | 50     | a request to accounts    |
| `MAX_PUSH_DEVICES`        | 10     | an account (ACC20)       |
| `MAX_PUSH_SENDS_PER_CALL` | 200    | posts a request (ACC21)  |
| `PUSH_SEND_CONCURRENCY`   | 8      | posts in flight          |
| `PUSH_SEND_TIMEOUT_MS`    | 10,000 | each post                |
| `PUSH_TTL_SECONDS`        | 14,400 | a message's TTL (ACC22)  |
| `VAPID_TOKEN_SECONDS`     | 43,200 | a VAPID token            |
| `PUSH_RECIPIENTS_MAX`     | 50     | people one event reaches |

The worst request (200 encryptions and posts against an instant fake service) runs in about 0.3 seconds in the tests
(`push.test.ts`), and the app's request never waits on it.

## Observability

Logs, never an id or address: `[push] not_configured { count }`, `settings_failed`, `over_cap { posts, cap }`,
`refused { status, host }`, `post_failed { host }`, `deliver_failed`, `comment_failed`, `action_failed`.

## Testing

`web-push.test.ts` (the RFC 8291 Appendix A example byte for byte, a browser-side decrypt, VAPID verified with the
public key), `push.test.ts` (devices, both doors, the internal route, delivery, the cap), `index-app/src/push.test.ts`
(kinds, readers, presence, the cap), `auth-client/src/push.test.ts`, and the Settings panel's Phone tests.

## Constants and configuration

Secrets `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` (base64url point and scalar); the VAPID subject is `BASE_URL`.

## Defaults ledger

ACC20, ACC21, ACC22, ACC23.
