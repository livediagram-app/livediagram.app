# Profile picture: blueprint

Derived from [Profile picture](../profile-picture.md). Defaults applied where the spec is silent
are ledgered in [DEFAULTS.md](DEFAULTS.md) and cited as `Dn`.

| File                                                                   | Role                                                                                                                    |
| ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `packages/api-schema/src/profile-picture.ts`                           | `PROFILE_PICTURE_HOST`, `MAX_PICTURE_URL_LEN`, `isProfilePictureUrl` (shared by api and live)                           |
| `packages/api-schema/src/index.ts`, `room-messages.ts`                 | `ParticipantPresence.picture`, `TeamMember.pictureUrl`, participant `pictureUrl`                                        |
| `apps/api/migrations/0058_profile_pictures.sql`                        | `participants.picture_url`, `ws_tickets.account`                                                                        |
| `apps/api/src/db/participants.ts`                                      | Reads `picture_url`; `setParticipantPicture`                                                                            |
| `apps/api/src/routes/participants.ts`                                  | `PUT /participants/<id>/picture`; GET gates `pictureUrl` on a signed-in caller                                          |
| `apps/api/src/db/teams.ts`                                             | Joined members carry `pictureUrl`                                                                                       |
| `apps/api/src/db/ws-tickets.ts`, `routes/document-room-routes.ts`      | Ticket `account` bit; `X-Verified-Account` stamped on every upgrade                                                     |
| `apps/api/src/document-room.ts`, `document-room-rules.ts`              | Session `account`; hello keeps `picture` for accounts only; roster stripped per recipient                               |
| `apps/live/lib/account-avatar.ts`                                      | `resolveProfilePicture` (manual > Google > copy), `clerkImageSource`, `sizedPictureUrl`                                 |
| `apps/live/lib/user-preferences.ts`                                    | `showProfilePicture`, `SHOW_PROFILE_PICTURE_DEFAULT`, `showProfilePictureEnabled`                                       |
| `apps/live/components/dialogs/settings/settings-catalogue.ts`          | Account > You toggle "Show my profile picture"                                                                          |
| `apps/live/hooks/identity/usePublishedPicture.ts`                      | The URL others may see (switch applied) and its PUT on change                                                           |
| `apps/live/lib/participant-pictures.ts`                                | Cached `GET /participants/<id>` picture lookup for comment authors                                                      |
| `apps/live/components/primitives/PictureDisc.tsx`                      | GlyphDisc + picture overlay; every avatar surface                                                                       |
| `apps/live/components/providers/ClerkBridge.tsx`, `deferred-auth.tsx`  | `pictureUrl` on the auth user                                                                                           |
| `apps/live/lib/api/room.ts`, `app/document/[id]/useRoomConnection.ts`  | hello `picture`; `updateSelf` re-hello; signed-in joins mint a ticket                                                   |
| `apps/live/lib/presence-rows.ts`, `components/canvas/RemoteCursor.tsx` | Cursor rows carry `picture`; the pill leads with a 14px disc                                                            |
| Surfaces                                                               | `AuthControls`, `SettingsAccountRows`, `ParticipantAvatar`, `CommentThreadPopover`, `CommentBubbles`, `team-pane-parts` |
| `apps/live/e2e/clerk-stub/*`                                           | Signed-in e2e against the Clerk-enabled export                                                                          |

## Domain and naming

| Term                | Identifier                                         | Meaning                                                            |
| ------------------- | -------------------------------------------------- | ------------------------------------------------------------------ |
| Profile picture URL | `pictureUrl` (`string \| null`)                    | The resolved, sized Clerk URL, or null                             |
| Published picture   | `publishedPictureUrl`                              | What others may see: `pictureUrl` when the switch is on, else null |
| Presence picture    | `ParticipantPresence.picture`                      | The published picture on the room roster                           |
| Stored picture      | `participants.picture_url`, `pictureUrl`           | The published picture on the participant record                    |
| Account session     | `SessionAttachment.account`, `WsAdmission.account` | A room socket admitted by a verified Clerk account                 |
| Clerk image source  | `clerkImageSource(url)`                            | `'upload' \| 'oauth' \| 'default' \| 'other' \| 'unknown'`         |
| The switch          | `showProfilePicture`                               | Preference; default `SHOW_PROFILE_PICTURE_DEFAULT`                 |
| Picture disc        | `PictureDisc`                                      | Any avatar disc that may carry a picture                           |

Banned: "photo" and "avatar URL" as identifiers.

## Behaviour and state

`resolveProfilePicture(user)`:

1. `user.hasImage && clerkImageSource(user.imageUrl) === 'upload'` → `sizedPictureUrl(user.imageUrl)`.
2. First `externalAccounts` entry with `provider === 'google'` and non-empty `imageUrl` whose
   `sizedPictureUrl` is non-null.
3. `user.hasImage` → `sizedPictureUrl(user.imageUrl)`.
4. null.

`clerkImageSource(url)`: host must be `img.clerk.com`; decode the first path segment as base64url
JSON (D1). `type === 'default'` → `'default'`; `type === 'proxy'` and `src` host
`images.clerk.dev`: path starts `/uploaded/` → `'upload'`, `/oauth_` → `'oauth'`; any other
`src` → `'other'`; anything that fails → `'unknown'`.

`sizedPictureUrl(url)`: `isProfilePictureUrl` must pass (https, host `img.clerk.com`, ≤ 512
chars before sizing); sets `width`/`height` 96 and `fit=crop`; the sized result must still pass,
else null.

Published picture: signed in && `showProfilePictureEnabled(prefs)` → `pictureUrl`, else null.
Recomputed on every auth emission and every `PREFERENCES_CHANGED_EVENT`.

Publisher (`usePublishedPicture`, mounted where the account's participant row exists: the
editor): PUT when the published value differs from the last value PUT this page (D2). A 404 (no
participant row yet) is not retried until the value changes (D3).

Room:

- Join: a signed-in client mints a ticket for every room (not only team documents). The ticket
  row records `account = 1` when `ctx.clerkUserId` is set. Consume returns it; the upgrade
  stamps `X-Verified-Account: 1|0` on every path; the DO pins it on the attachment.
- `helloPresence(claimed, session)`: `picture` kept when `session.account` and
  `isProfilePictureUrl(claimed.picture)`, else dropped (logged when a non-empty picture is
  dropped).
- First hello: as before. A repeat hello from a session that already has presence (D4) only
  replaces the presence and rebroadcasts.
- `broadcastPresence`: per recipient, the roster minus self; `picture` removed from every entry
  when the recipient's session is not an account.
- Client: `connectRoom` returns `updateSelf(participant)`, which stores the participant for
  reconnects and sends a hello when the socket is open. The editor calls it when the published
  picture changes.

`PictureDisc` state machine (as before): `initial` → `loading` → `picture`, `loading` → `initial`
on error, keyed on the URL.

## Interfaces and contracts

```ts
// packages/api-schema/src/profile-picture.ts
export const PROFILE_PICTURE_HOST = 'img.clerk.com';
export const MAX_PICTURE_URL_LEN = 512;
export function isProfilePictureUrl(url: unknown): url is string;

// PUT /api/participants/<id>/picture   body { pictureUrl: string | null }
//   401 when no verified Clerk session; 403 when clerkUserId !== id;
//   400 invalid_picture_url; 404 no participant row; 200 { pictureUrl }
// GET /api/participants/<id> → { participant: { id, name, color, createdAt, pictureUrl } }
//   pictureUrl is null unless the caller is signed in (verifiedUserId)

// apps/live/components/primitives/PictureDisc.tsx
export function PictureDisc(props: GlyphDiscProps & { pictureUrl?: string | null }): JSX.Element;
```

## Data and persistence

- `participants.picture_url TEXT NULL`: the published picture; null for guests, when the switch is
  off, and before the first PUT. Deleted with the account's participant row.
- `ws_tickets.account INTEGER NOT NULL DEFAULT 0`: 60-second rows, consumed once.
- Session attachment gains `account?: boolean` and a presence `picture` of at most 512 chars;
  worst case stays under the 2 KB attachment limit (≈ 900 bytes).
- `showProfilePicture?: boolean` in the synced preferences blob; missing = the default.
- Migration `0058` (0056 and 0057 are taken by open pull requests).

## Errors and edge cases

| Case                                                      | Handling                                                                                |
| --------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Clerk URL format changes                                  | `clerkImageSource` → `'unknown'`: not an upload; Google wins                            |
| Non-Clerk host or `http:` picture                         | Not a picture anywhere                                                                  |
| Guest or API-token PUT                                    | 401 / 403, logged `not_account`                                                         |
| Hello picture from a non-account session                  | Dropped, logged                                                                         |
| Anonymous recipient                                       | Roster without pictures                                                                 |
| Switch flipped with a room open                           | `updateSelf` → hello → roster rebroadcast                                               |
| Ticket mint fails for a signed-in personal-document owner | Falls back to the `o` leg: account 0, no picture in that room (logged by the connector) |
| Comment without `authorId`                                | Initial                                                                                 |
| Participant lookup fails / 404                            | Initial; cached as null for the page                                                    |
| Picture 404 / blocked                                     | `error` → initial, one log line                                                         |

## Security and trust

Spec §6: server accepts only `isProfilePictureUrl` values from a verified Clerk session and hands
them only to account recipients / signed-in callers. `X-Verified-Account` is set unconditionally
by the worker so a client header cannot claim it. Pictures cannot be verified as the account's
own; recorded as a known limit.

## Performance and limits

Presence: +≤512 bytes per entry. One ticket mint per signed-in room join (one D1 insert and one
delete). Participant lookups: one GET per distinct comment author per page, deduped in flight
and cached. Images: one 96px request per distinct URL per page.

## Presentation and UX

- `PictureDisc`: outer `relative inline-flex shrink-0` box at `size`; the `GlyphDisc` with all
  caller props; an `img` `absolute inset-0 rounded-full object-cover`, `opacity-0` until loaded,
  initial text `invisible` once loaded. Ring shadows stay on the disc and show around the picture.
- Sizes unchanged per surface (20, 44, 16/22/28 presence, 24 popover, 20 bubbles, 32 members); the
  cursor pill gains a leading 14px disc only when a picture exists (D5).
- Toggle copy: label "Show my profile picture"; description "Signed-in collaborators see your
  picture on presence, cursors, comments and teams. People who open your share links without
  signing in always see your initials. You always see it yourself."

## Accessibility

`alt=""` on every picture; names and `aria-label`s unchanged. Toggle is the standard Settings
switch with its label.

## Web Experience

CLS 0: fixed boxes, the cursor pill is a transient absolutely positioned overlay. LCP unaffected
(≤ 44px images after auth settles).

## Observability

- Client: `[profile-picture] load failed { host }`; `[profile-picture] publish failed { status }`.
- Api: `[profile-picture] rejected <reason>` for PUT and hello refusals.
- Telemetry: `UI` / `Toggled` / `ShowProfilePictureOn|Off`.

## Testing

| Rule                                                       | Test                                                     |
| ---------------------------------------------------------- | -------------------------------------------------------- |
| URL contract                                               | `api-schema` `profile-picture.test.ts`                   |
| Precedence, source decoding                                | `apps/live/lib/account-avatar.test.ts`                   |
| Switch default + publish                                   | `user-preferences` tests, `usePublishedPicture.test.tsx` |
| PUT / GET gating                                           | `apps/api/src/routes/participants.test.ts`               |
| Members carry pictures                                     | `apps/api/src/db/teams` tests                            |
| Account bit through the ticket and upgrade                 | `ws-tickets` + `document-room-routes.test.ts`            |
| Hello keeps / drops, roster strips per recipient, re-hello | `document-room-rules.test.ts`, `document-room.test.ts`   |
| Discs                                                      | `PictureDisc.test.tsx`, `ParticipantAvatar`, cursor rows |
| End to end: switch, peer picture, anonymous                | `e2e/clerk-stub/profile-picture.spec.ts`                 |

## Constants and configuration

| Constant                       | Value           | Provenance                                |
| ------------------------------ | --------------- | ----------------------------------------- |
| `PROFILE_PICTURE_PX`           | 96              | 44px at 2x, 20px at 4x                    |
| `PROFILE_PICTURE_HOST`         | `img.clerk.com` | Clerk image optimization + CSP guides     |
| `MAX_PICTURE_URL_LEN`          | 512             | Observed Clerk proxy URLs are ≤ 350 chars |
| `SHOW_PROFILE_PICTURE_DEFAULT` | `true`          | Operator decision                         |

## Assets and external resources

None committed; pictures are Clerk's. The e2e picture is generated SVG served by a route.

## Defaults ledger

D1 to D7 in [DEFAULTS.md](DEFAULTS.md).
