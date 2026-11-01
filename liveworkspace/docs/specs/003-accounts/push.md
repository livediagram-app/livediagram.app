# Phone notifications

On a phone, someone used to hear about a mention, an assignment or a reply only by email. Phone notifications bring
them back while the conversation is still happening. They are Web Push: each site can be installed to the home screen,
and once someone turns phone notifications on, every app can reach that device.

The work is split the same way as the notification emails ([accounts.md "Notification emails"](accounts.md#notification-emails)),
with one difference: **the apps decide when to notify, and the platform delivers.** An app knows its items, their
comments and who can read them, so it picks who hears of what and words the title. The accounts Worker keeps the
devices, each person's switches and the VAPID key, and sends.

## What a notification is about

| Kind          | When                                                            | Switch (`all` scope) | Mirrors the email      |
| ------------- | --------------------------------------------------------------- | -------------------- | ---------------------- |
| `mention`     | a teammate @mentions you in a comment on a team item            | `pushMentions`       | `notifyMentions`       |
| `action`      | a teammate assigns you an action                                | `pushActionAssigned` | `notifyActionAssigned` |
| `threadReply` | someone replies in a comment thread you started or replied to   | `pushThreadReplies`  | none (new)             |
| `comment`     | someone comments on a diagram, plan, document or design you own | `pushComments`       | `notifyComments`       |

The kinds and their switches are plain data in `@liveworkspace/settings/push` (`PUSH_KINDS`, `PUSH_SETTING_KEYS`),
and the switches are `ALL_SETTING_KEYS`, so they hold in every app. Each is on unless turned off: registering a
device is the opt-in. Tips, milestones and invitation answers stay email only.

One event sends a person one notification, the strongest kind first: a mention, then a reply in their thread, then a
comment on what they own. Someone mentioned in a reply on their own item hears of the mention only.

## What it carries

A notification carries a short title and a link, never anything the person can't already read:

- **Title.** Who did it and the item's name: `Ada mentioned you in Roadmap`, `Ada replied in Roadmap`,
  `Ada commented on Roadmap`, `Ada assigned you an action in Roadmap` (`Someone` when there is no name, `Untitled`
  for an item without one), at most 120 characters (`PUSH_TITLE_MAX`). Never the comment's words, an action's name
  or description, or anything else in the item.
- **Body.** The app's name (`liveplanner`), so a lock screen says where it came from.
- **Link.** The exact place: the item, opened at the comment's thread, the card or the action (each app's
  phone-notifications spec gives its links). Only a link on the sending app's own addresses in this deployment is
  sent (`appOrigins`); any other is refused.
- **Tag.** Notifications about the same thread share a tag (`<item>:<thread>`), so a burst of replies is one
  notification on the device, the latest.

## Who hears of it

The app checks each of these before it asks accounts to send (`createPusher` in `@liveworkspace/index-app`,
`src/push.ts`, shared by every app):

- **Accounts only.** Never a guest, never the person who did it. Comments and assignments made with an API token
  (an AI tool, a script) send no phone notification: a scripted burst never buzzes anyone's phone.
- **Only someone who can read the item.** Its owner, the joined people of its team, or someone the index grants it
  with no team in hand (a share link they opened before; a link with a password counts). An invited person who has
  not joined, someone removed from the team, or someone whose link was turned off hears nothing. This follows the
  share roles: an Editor, a Participant and a Viewer can all read, so all can be told; nobody without one is.
- **A mention only from inside the team.** As for the email: the item is a team's, the author one of its joined
  people, and each person mentioned one of its people (`teamTargets`); anyone else a comment names is skipped.
- **Not someone already looking at it.** A person with a session in the item's realtime room (it has said hello) is
  left out: the room's env carries `ROOM_PEOPLE`, the person tags of its sessions (`sha256(<item>:<person>)`, as
  each app's `personTagFor` makes them), and the check compares tags, so the room still holds no person's id.
- **At most 50 people an event** (`PUSH_RECIPIENTS_MAX`), which bounds the index asks.

The app runs all of this after it has answered: in the item room's `waitUntil` for a comment or a save, and in the
room's RPC for an assignment. A failure is logged and never reaches the request.

## Devices

A device is one browser's push subscription, kept per account in `push_device`
(`migrations/0017_push_devices.sql`, `src/push/devices.ts`): its push service endpoint, its two keys, a label and when
it last reached it. **One registration serves every app**: a row names no app, so a phone registered in livediagram
also hears of liveplanner's mentions, and tapping one opens liveplanner's address. Registering the same phone again
in another installed app adds a second row, which the device list shows with the app it was turned on in, so either
can be removed.

- **Registering** is `POST /api/account/push/devices` `{ endpoint, keys: { p256dh, auth }, label }`, answered
  `201 { device }`. One row per endpoint: registering again (new keys, or another account signing in on the same
  browser) updates the row in place and moves it to this account. The endpoint must be https on a known push service
  (FCM, Mozilla, Apple, Windows), with no port or credentials, so the Worker never posts to an address a page chose;
  the keys must be a P-256 point and a 16-byte secret. The label is cleaned like any typed name, at most 80
  characters (`A device` when empty).
- **At most 10 devices an account** (`MAX_PUSH_DEVICES`): registering another drops the oldest.
- **Listing** is `GET /api/account/push/devices`, answering `{ publicKey, devices: [{ id, label, createdAt,
lastSentAt }] }`, newest first. `publicKey` is the deployment's VAPID public key, what the browser subscribes with;
  null when phone notifications are off here (then `POST` answers `503 push_not_configured`).
- **Removing** is `DELETE /api/account/push/devices/<id>`, the person's own devices only (`404` otherwise).
- **Both doors.** These answer the session on liveworkspace.app (a write from its own origin) and the app's bearer
  on an app's address and in the editors (through `/api/workspace/account/*`), like the profile.
- **Gone devices.** A push service that answers `404` or `410` has dropped the subscription, and the device is
  removed. One whose stored keys no longer encrypt is removed too.
- **Closing an account** removes its devices with it (`ON DELETE CASCADE`).

## Sending

`POST /api/account/internal/push` `{ notifications: [{ userId, kind, title, url, tag? }] }`, from an app's server by
its client credentials (`sendPush` in `@liveworkspace/auth-client`, beside `notificationRecipients`), up to 50 a
request (`MAX_PUSH_NOTIFICATIONS`; `sendPush` splits more). The body is checked whole, one bad entry refusing it
(`400` with the reason), and a client that is no app is refused (`403`). It answers `202 { accepted }` at once and
sends after the answer (`waitUntil`, `src/push/deliver.ts`), so neither the app's write nor its call waits on a push
service:

- **The switches.** One read of everyone's `push…` switches in the `all` scope (a read that fails counts as on, as
  a missing one does), and one read of their devices.
- **Quiet hours.** Each notification passes `heldForQuietHours(userId, now)` first. It holds nothing yet; the queued
  quiet-hours card fills it in from the person's hours and zone (`user.timeZone`).
- **Each device** gets one message: the payload `{ title, body, url, tag }` encrypted for it as RFC 8291 says
  (`aes128gcm`, a fresh key pair and salt every message, one 4096-byte record), signed with VAPID (RFC 8292, an ES256
  token for the push service's origin, good for 12 hours, subject the Worker's `BASE_URL`), `TTL` 4 hours and
  `Urgency: normal`. Written on Web Crypto alone (`src/push/web-push.ts`), with no library.
- **Bounds.** At most 200 posts a request (`MAX_PUSH_SENDS_PER_CALL`, the rest dropped and logged), 8 at a time,
  each given 10 seconds. One VAPID token per push service a request reaches.
- **After.** One batch removes the gone devices and stamps `last_sent_at` on the rest.

## The app side

Each site serves what it takes to install it and to receive a push (every app's
docs/specs/016-platform/installable-app.md, and [site.md](../010-site/site.md#installing)):

- **A web app manifest** at `/manifest.webmanifest`, `display: standalone`, its icons (192 and 512 pixels, and a
  maskable one), and a `start_url` at the editor or the Explorer, never the marketing page.
- **A push-only service worker** at `/push-worker.js`, registered after the page has loaded. It has **no fetch
  handler**, so it never answers a request and keeps no offline copy (each app's load-recovery.md). It shows each
  push as a notification (title, the app's name, the site's icon, the tag) and, on a tap, focuses a window already
  at that link or opens the link, on whichever app's address it is.

## Settings

**Notifications** in the Settings panel's Account section ([site.md "Settings"](../010-site/site.md#settings)) has a
**Phone** section beside Email, wherever the panel opens (liveworkspace.app, the Explorer on an app's address, every
editor; `@liveworkspace/settings-ui`, `push/`):

- **Turn On Phone Notifications** asks the browser's permission, subscribes with the deployment's public key and
  registers the device, labelled with its kind, browser and the app it was turned on in (`iPhone, Safari
(liveplanner)`). Where the browser can't, it says why instead: on an iPhone or iPad the app must first be added to
  the Home Screen (Share, Add to Home Screen) and opened from there; a browser that has blocked notifications must be
  allowed in its settings; a browser with no Web Push can't; a deployment with no VAPID key has phone notifications
  off. A guest sees no Phone section.
- **The four switches**, one per kind, worded as the email ones.
- **Devices**, newest first, each with when it last got a notification (or when it was added), this browser's marked
  This Device, and Remove (asked once). Removing this browser's device also unsubscribes it here.

## Before deploy

- **VAPID keys.** Make one pair per environment (`node scripts/generate-vapid-keys.ts` in `liveworkspace/apps/accounts`)
  and set `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY` as secrets on the accounts Worker, production and staging. A
  deployment keeps its pair for good: a new public key leaves every registered device unable to receive. Without
  them, phone notifications are off and say so.
- **The migration.** `0017_push_devices.sql` makes `push_device`; CI applies it before the code.
