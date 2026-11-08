# Settings and profiles: blueprint

Derived from [accounts.md "Settings"](../accounts.md#settings), ["Profiles"](../accounts.md#profiles) and ["Profile
pictures"](../accounts.md#profile-pictures). The spec decides; this file only adds engineering precision, read from the
code. Defaults are cited as `ACCn`. Paths are relative to the repository root.

Scope, by file:

| File                                             | Role                                                                                                                                                      |
| ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `liveworkspace/apps/accounts/src/settings.ts`    | `checkPatch`, `readSettings`, `writeSettings`, `resetSettings`, `deleteSettings`, `mergeGuestSettings`                                                    |
| `liveworkspace/apps/accounts/src/profiles.ts`    | `checkProfilePatch`, `readProfiles`, `readOwnProfile`, `writeProfile`, `readProfileLook`, `storeAccountPicture`, `withSessionColour`, `mergeGuestProfile` |
| `liveworkspace/apps/accounts/src/account-api.ts` | The settings and profile routes on each door                                                                                                              |
| `packages/settings`                              | The catalogue of settings and their defaults, the common keys, presence colours                                                                           |
| `packages/sites/src/picture.ts`                  | `profilePictureOf`: which picture URLs the apps draw                                                                                                      |

## Domain and naming

| Term    | Identifier                                      | Meaning                                                                |
| ------- | ----------------------------------------------- | ---------------------------------------------------------------------- |
| Owner   | an account id or a guest id                     | Settings and profiles belong to either                                 |
| Scope   | `all`, or a `SettingsApp` site id               | `all` every app shows; an app's only it                                |
| Key     | `^[A-Za-z0-9_.-]{1,64}$`                        | One setting; a value is replaced whole                                 |
| Profile | `profile (owner_id, name, color, show_picture)` | The display name and presence colour every app shows                   |
| Picture | `"user".image`                                  | An account's Google picture, shown to others unless `show_picture = 0` |

## Behaviour and state

### Settings

- A patch (`checkPatch`): a plain object (`400 settings_not_object`), every key a key (`400 invalid_setting_key`),
  its JSON at most 16,384 bytes (`400 settings_too_large`); a `null` value deletes that key; empty is no patch.
- `writeSettings(owner, app, { all, app })`: both patches checked; an app patch without an app is `400 app_required`.
  One statement per row in one batch: `INSERT … SELECT … json_patch` gated on the owner being a guest or an existing
  account (`404 unknown_owner` when nothing landed, so a closed account's live token can't write back), `ON CONFLICT
DO UPDATE` that removes each named key and sets it again in SQLite against the row as it stands, so two apps writing
  different keys both land. The `settings_size` CHECK holds the limit under concurrent writes (`413
settings_too_large`). Answers both rows as they now are.
- `readSettings(owner, app)`: one query on the primary key for `all` and the app's row: `{ all, app, updatedAt }`
  (`updatedAt` the later write, null when neither).
- `resetSettings(owner)` (Reset All Settings): reads the owner's `all` row, then in one batch deletes every row of the
  owner (`DELETE … WHERE owner_id = ?`, so no other owner's) and, when the row held any `RESET_KEEPS` key
  (`telemetryEnabled`), writes the `all` row back with just those. Answers `{ all, updatedAt }`.

| Route                                                                             | Door              | Effect                                                                                                          |
| --------------------------------------------------------------------------------- | ----------------- | --------------------------------------------------------------------------------------------------------------- |
| `GET /api/account/settings`                                                       | session or bearer | `{ all, updatedAt }`                                                                                            |
| `PATCH /api/account/settings { all }`                                             | session or bearer | `{ all, updatedAt }`                                                                                            |
| `GET /api/account/settings/:app`                                                  | session or bearer | both scopes; an unknown app `404`                                                                               |
| `PATCH /api/account/settings/:app { app }`                                        | session or bearer | only the app's scope                                                                                            |
| `DELETE /api/account/settings`                                                    | session or bearer | every scope reset, `RESET_KEEPS` kept: `{ all, updatedAt }`; a guest's bearer `401 signed_out`                  |
| `POST /api/account/internal/settings/read { owner, app }`                         | client            | `400 invalid_owner`, `400 invalid_app`, `403 client_has_no_app`, `403 wrong_app`; a guest owner is stamped seen |
| `POST /api/account/internal/settings/write { owner, app, patch: { all?, app? } }` | client            | as above; `400 invalid_patch`                                                                                   |

### Profiles

- A patch (`checkProfilePatch`): `name` a string or null, trimmed, at most 120, no control characters (`400
invalid_name`; empty clears); `color` a string or null, trimmed, at most 64, nothing that leaves a CSS value or
  loads something (quotes, `;`, braces, `\`, `<>`, backtick, `url`, `image`, `src(`, `element(`, `cross-fade`,
  `paint(`) and no control characters (`400 invalid_color`); `showPicture` a boolean (`400 invalid_show_picture`);
  `timeZone`, on the two own-profile doors only (`{ timeZone: true }`; the internal write ignores it), a zone
  `parseTimeZone` accepts, kept under its answer, or null for Automatic (`400 invalid_time_zone`); none of these is
  `400 nothing_to_change`.
- `writeProfile`: one upsert gated like settings (`404 unknown_owner`), setting only the named fields, then the row
  read back in the same batch. The upsert is left out when only `timeZone` is named, so a zone pick makes no profile
  row. A zone is written on the account's `"user"` row in the same batch: a pick `SET timeZone = ?, timeZoneChosen =
  1`; Automatic `SET timeZoneChosen = NULL, timeZone = COALESCE(<noted zone>, timeZone)`.
- The own-profile doors' `?timeZone=` (`profileRoute`), checked by `parseTimeZone` (an unknown one is ignored, as
  `X-Time-Zone` is): a `GET` writes it in the read's batch, guarded like the session sighting and skipped while a
  picked zone stands; an Automatic `PATCH` keeps it at once.
- `readProfiles(ids)`: one query over a JSON array of ids joined by primary key to `profile` and `"user"`: `{ id,
name: COALESCE(profile name, account name), color, picture }`; ids that are neither are left out.
- `readOwnProfile`: what others see, plus the person's own picture whatever the switch says, the switch, and
  `timeZone` (`"user".timeZone`, null with none) and `timeZoneAuto` (`timeZoneChosen IS NULL`). `readProfiles`
  never answers either.
- `readProfileLook` (ID token) and `readProfileColour` (`/get-session`): one primary-key read each; no row is
  Automatic colour and the picture shown.
- `storeAccountPicture`: on every Google account row write, the ID token's `picture` claim (decoded, not verified:
  it came straight from Google's token endpoint) onto `"user".image`, written only when it changed.

| Route                                                                              | Door                      | Effect                                                            |
| ---------------------------------------------------------------------------------- | ------------------------- | ----------------------------------------------------------------- |
| `GET /api/account/profile`                                                         | session or account bearer | `{ profile: OwnProfile }`                                         |
| `GET /api/account/profile?timeZone=`                                               | session or account bearer | `{ profile }`; notes the zone unless one was picked               |
| `PATCH /api/account/profile { name?, color?, showPicture?, timeZone? }`            | session or account bearer | `{ profile }`; `400 invalid_time_zone`                            |
| `POST /api/account/internal/profiles/read { ids }`                                 | client                    | `{ profiles }`; `400 ids_required`, `400 too_many_ids` (over 100) |
| `POST /api/account/internal/profiles/write { owner, name?, color?, showPicture? }` | client                    | `{ profile }`; a guest stamped seen                               |

### A guest signing in, and closing an account

- `mergeGuestSettings`: per scope, the account's keys win, the guest's fill the gaps as many as fit under the limit
  (counted entry by entry, linear), patched against the account's row as it stands; then the guest's rows go. One
  batch.
- `mergeGuestProfile`: the account keeps its own name and colour and takes the guest's where it has none (a name
  only when the account has no name at all); the guest's profile and `guest_seen` rows go. One batch.
- Closing an account deletes its settings and profile before the user row ([accounts.md](accounts.md)); neither has
  a foreign key, since guests' rows have no account.

## Data and persistence

| Table      | Key                 | Indexes         | Written by                                 | Read by                                                                                 |
| ---------- | ------------------- | --------------- | ------------------------------------------ | --------------------------------------------------------------------------------------- |
| `settings` | `(owner_id, scope)` | (WITHOUT ROWID) | settings writes; guest merge; sweep; close | settings reads; notify switches; lifecycle `notifyTips`; admins' `notifyInviteResponse` |
| `profile`  | `owner_id`          | (WITHOUT ROWID) | profile writes; guest merge; sweep; close  | people names; ID token; `/get-session`; team lists                                      |
| `user`     | `id`                |                 | picture hook; zone sightings and picks     | names, pictures; the own profile's zone                                                 |

`settings.prefs` default `'{}'`, CHECK `json_valid` and an object (`settings_object`) and at most 16,384 bytes
(`settings_size`). `profile.name` CHECK 1 to 120, `color` 1 to 64, `show_picture` NULL, 0 or 1 (0012).

## Errors and edge cases

| Case                                 | Answer                                    |
| ------------------------------------ | ----------------------------------------- |
| A row past 16 KB                     | `413 settings_too_large`; nothing changes |
| A closed account's token writing     | `404 unknown_owner`                       |
| A colour that would break out of CSS | `400 invalid_color`                       |
| A zone the runtime doesn't know      | `400 invalid_time_zone`                   |
| Another app's scope                  | `403 wrong_app`                           |

## Testing

| Test                                                        | Pins                                           |
| ----------------------------------------------------------- | ---------------------------------------------- |
| `liveworkspace/apps/accounts/src/settings.test.ts` (17)     | settings; a reset; a closed account; a guest signing in |
| `liveworkspace/apps/accounts/src/profiles.test.ts` (20)     | profiles; profile pictures; a time zone picked by hand; a guest signing in |
| `liveworkspace/apps/accounts/src/auth-options.test.ts` (11) | Google sign-in pictures                        |
| `packages/settings/src/*.test.ts`                           | the catalogue, common keys, presence colours   |

## Constants and configuration

`SETTINGS_MAX_BYTES` 16,384, `KEY` (`settings.ts`); `MAX_PROFILE_IDS` 100, `PROFILE_NAME_MAX` 120,
`PROFILE_COLOR_MAX` 64, `NOT_A_COLOUR`, `CONTROL` (`profiles.ts`).

## Defaults ledger

- `ACC14`: where a guest's settings and the account's share a key, the account's value is kept.
- `ACC28`: Reset All Settings keeps `telemetryEnabled` (`RESET_KEEPS`): a usage-events opt-out is a consent, not a
  preference.
