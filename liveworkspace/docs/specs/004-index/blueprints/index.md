# The index: blueprint

Derived from [index-service.md](../index-service.md), [one-explorer.md](../one-explorer.md) and [one-explorer-contracts.md](../one-explorer-contracts.md). The spec decides; this file only adds engineering precision, read from the code. Defaults applied where the spec is silent are ledgered in [DEFAULTS.md](DEFAULTS.md). Paths are relative to the repository root.

## Domain and naming

| Term           | Identifier                           | Meaning                                                                     |
| -------------- | ------------------------------------ | --------------------------------------------------------------------------- |
| Item           | `items` row                          | One document, project or design in an app                                   |
| Folder         | `folders` row                        | A person's or team's folder, across every app                               |
| Share link     | `share_links`, `share_passwords`     | A link to an item, at a role, with an optional password and expiry          |
| Grant          | a signed token (`GRANT_SIGNING_KEY`) | The index's word that a person may open an item, checked offline by the app |
| Timeline event | `timeline_events`                    | What happened, shown on the Timeline and the Inbox                          |
| Purge          | `person_purges`, `purge_tombstones`  | Emptying a closed account's rows                                            |
| Merge          | `person_app_merges`                  | A guest's items moved to their account on sign-up                           |

## Behaviour and state

Every 15 minutes (`*/15 * * * *`): closed accounts' purges carry on, and the apps hear what was purged and
which guests became accounts. Once a day (`23 4 * * *`): empty, unchanged items go to the Trash, items 30 days in it
are purged, apps that missed a purge are retried, and owners of share links lapsing within the week are warned
(`share-expiry.ts`). With `INDEX_ENABLED` off the crons do nothing. A write that changes a Drive-mirrored person's
items signals Drive after the response (`DRIVE` binding).

## Interfaces and contracts

A browser calls `/api/index/…` with an accounts or guest token; an app's server with `INDEX_KEY_<APP>`,
naming the app in `X-Index-App` and the person in `X-Index-Person`; Drive with `INDEX_KEY_DRIVE`; accounts' merges
with `MERGE_KEY`. `@liveworkspace/index-client` wraps the routes; `@liveworkspace/index-app` is each app's side.

Every route the specs name, with the section that defines it (each checked to have its path's literal in the code):

| Route                                                         | Specified in                                                                                                                       |
| ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `POST /api/internal/people/:guest/merge`                      | [index-service.md "Who calls it"](../../004-index/index-service.md#who-calls-it)                                                   |
| `POST /api/index/app/migration/handoff`                       | [index-service.md "Who calls it"](../../004-index/index-service.md#who-calls-it)                                                   |
| `GET /items/:id`                                              | [index-service.md "Who calls it"](../../004-index/index-service.md#who-calls-it)                                                   |
| `GET /share/:code`                                            | [index-service.md "Who calls it"](../../004-index/index-service.md#who-calls-it)                                                   |
| `POST /api/index/internal/merge`                              | [index-service.md "Who calls it"](../../004-index/index-service.md#who-calls-it)                                                   |
| `POST /api/index/internal/purge-person`                       | [index-service.md "Who calls it"](../../004-index/index-service.md#who-calls-it)                                                   |
| `POST /api/index/internal/workbench-close`                    | [index-service.md "Who calls it"](../../004-index/index-service.md#who-calls-it)                                                   |
| `DELETE /app/people/:id/drive`                                | [index-service.md "Who calls it"](../../004-index/index-service.md#who-calls-it)                                                   |
| `POST /app/changes`                                           | [index-service.md "Who calls it"](../../004-index/index-service.md#who-calls-it)                                                   |
| `POST /folders`                                               | [index-service.md "Decisions the contract left open"](../../004-index/index-service.md#decisions-the-contract-left-open)           |
| `GET /folders`                                                | [index-service.md "Decisions the contract left open"](../../004-index/index-service.md#decisions-the-contract-left-open)           |
| `DELETE /items/:id?reason=empty`                              | [index-service.md "Decisions the contract left open"](../../004-index/index-service.md#decisions-the-contract-left-open)           |
| `DELETE /trash`                                               | [one-explorer-contracts.md "Reaching the index"](../../004-index/one-explorer-contracts.md#reaching-the-index)                     |
| `POST /items`                                                 | [one-explorer-contracts.md "Reaching the index"](../../004-index/one-explorer-contracts.md#reaching-the-index)                     |
| `POST /internal/merge`                                        | [one-explorer-contracts.md "Guests"](../../004-index/one-explorer-contracts.md#guests)                                             |
| `POST /api/internal/people/:guest/merge {into}`               | [one-explorer-contracts.md "Guests"](../../004-index/one-explorer-contracts.md#guests)                                             |
| `POST /api/internal/people/:guest/merge {into, legacy: true}` | [one-explorer-contracts.md "Guests"](../../004-index/one-explorer-contracts.md#guests)                                             |
| `GET /items`                                                  | [one-explorer-contracts.md "Items"](../../004-index/one-explorer-contracts.md#items)                                               |
| `PATCH /items/:id`                                            | [one-explorer-contracts.md "Items"](../../004-index/one-explorer-contracts.md#items)                                               |
| `DELETE /items/:id`                                           | [one-explorer-contracts.md "Items"](../../004-index/one-explorer-contracts.md#items)                                               |
| `POST /items/:id/restore`                                     | [one-explorer-contracts.md "Items"](../../004-index/one-explorer-contracts.md#items)                                               |
| `POST /items/:id/copy`                                        | [one-explorer-contracts.md "Items"](../../004-index/one-explorer-contracts.md#items)                                               |
| `POST /items/:id/open`                                        | [one-explorer-contracts.md "Items"](../../004-index/one-explorer-contracts.md#items)                                               |
| `POST /items/:id/grant`                                       | [one-explorer-contracts.md "Items"](../../004-index/one-explorer-contracts.md#items)                                               |
| `GET /trash`                                                  | [one-explorer-contracts.md "Items"](../../004-index/one-explorer-contracts.md#items)                                               |
| `GET /shared`                                                 | [one-explorer-contracts.md "Items"](../../004-index/one-explorer-contracts.md#items)                                               |
| `POST /internal/purge-person`                                 | [one-explorer-contracts.md "Closing an account"](../../004-index/one-explorer-contracts.md#closing-an-account)                     |
| `POST /api/internal/people/:id/purge {items}`                 | [one-explorer-contracts.md "Closing an account"](../../004-index/one-explorer-contracts.md#closing-an-account)                     |
| `GET /folders/previews?ids=a,b,…&app=`                        | [one-explorer-contracts.md "Folders, favourites, defaults"](../../004-index/one-explorer-contracts.md#folders-favourites-defaults) |
| `GET /favourites`                                             | [one-explorer-contracts.md "Folders, favourites, defaults"](../../004-index/one-explorer-contracts.md#folders-favourites-defaults) |
| `GET /placement-defaults`                                     | [one-explorer-contracts.md "Folders, favourites, defaults"](../../004-index/one-explorer-contracts.md#folders-favourites-defaults) |
| `POST /share/:code/extend`                                    | [one-explorer-contracts.md "Sharing and access"](../../004-index/one-explorer-contracts.md#sharing-and-access)                     |
| `PUT /items/:id/share-password`                               | [one-explorer-contracts.md "Sharing and access"](../../004-index/one-explorer-contracts.md#sharing-and-access)                     |
| `POST /items/:id/share {public: true}`                        | [one-explorer-contracts.md "Sharing and access"](../../004-index/one-explorer-contracts.md#sharing-and-access)                     |
| `PUT /items/:id/share-password {password}`                    | [one-explorer-contracts.md "Sharing and access"](../../004-index/one-explorer-contracts.md#sharing-and-access)                     |
| `DELETE /shared/:itemId`                                      | [one-explorer-contracts.md "Sharing and access"](../../004-index/one-explorer-contracts.md#sharing-and-access)                     |
| `GET /jwks`                                                   | [one-explorer-contracts.md "Grants"](../../004-index/one-explorer-contracts.md#grants)                                             |
| `GET /api/<items>/:id/tabs`                                   | [one-explorer-contracts.md "An item's tabs"](../../004-index/one-explorer-contracts.md#an-items-tabs)                              |
| `PUT /app/items/:id/summary`                                  | [one-explorer-contracts.md "What an item pushes"](../../004-index/one-explorer-contracts.md#what-an-item-pushes)                   |
| `PUT /app/items/:id/collab/:tabId`                            | [one-explorer-contracts.md "What an item pushes"](../../004-index/one-explorer-contracts.md#what-an-item-pushes)                   |
| `PUT /app/items/:id/forms/:tabId`                             | [one-explorer-contracts.md "What an item pushes"](../../004-index/one-explorer-contracts.md#what-an-item-pushes)                   |
| `PUT /app/items/:id/forms/:tabId/seen`                        | [one-explorer-contracts.md "What an item pushes"](../../004-index/one-explorer-contracts.md#what-an-item-pushes)                   |
| `GET /app/forms/:code`                                        | [one-explorer-contracts.md "What an item pushes"](../../004-index/one-explorer-contracts.md#what-an-item-pushes)                   |
| `PUT /app/items/:id/events`                                   | [one-explorer-contracts.md "What an item pushes"](../../004-index/one-explorer-contracts.md#what-an-item-pushes)                   |
| `PUT /app/people/events`                                      | [one-explorer-contracts.md "What an item pushes"](../../004-index/one-explorer-contracts.md#what-an-item-pushes)                   |
| `POST /app/migration/handoff`                                 | [one-explorer-contracts.md "The migration's handoff"](../../004-index/one-explorer-contracts.md#the-migrations-handoff)            |
| `PUT /app/people/:id/drive`                                   | [one-explorer-contracts.md "The Google Drive mirror"](../../004-index/one-explorer-contracts.md#the-google-drive-mirror)           |
| `GET /app/people/:id/count?limit=`                            | [one-explorer-contracts.md "Notices"](../../004-index/one-explorer-contracts.md#notices)                                           |
| `POST /internal/timeline {events}`                            | [one-explorer-contracts.md "Timeline"](../../004-index/one-explorer-contracts.md#timeline)                                         |
| `GET /timeline?app=&limit=&cursor=`                           | [one-explorer-contracts.md "Timeline"](../../004-index/one-explorer-contracts.md#timeline)                                         |
| `GET /timeline?item=<id>&limit=&cursor=`                      | [one-explorer-contracts.md "Timeline"](../../004-index/one-explorer-contracts.md#timeline)                                         |
| `POST /timeline/seen`                                         | [one-explorer-contracts.md "Timeline"](../../004-index/one-explorer-contracts.md#timeline)                                         |
| `POST /timeline/dismiss {ids}`                                | [one-explorer-contracts.md "Timeline"](../../004-index/one-explorer-contracts.md#timeline)                                         |
| `GET /inbox?app=`                                             | [one-explorer-contracts.md "Inbox"](../../004-index/one-explorer-contracts.md#inbox)                                               |
| `POST /api/<items>/:id/tabs/:tabId/comments`                  | [one-explorer-contracts.md "Inbox"](../../004-index/one-explorer-contracts.md#inbox)                                               |
| `GET /api/<items>/:id/comments?status=all`                    | [one-explorer-contracts.md "Inbox"](../../004-index/one-explorer-contracts.md#inbox)                                               |
| `POST /api/projects/:id/items/:cardId/comments`               | [one-explorer-contracts.md "Inbox"](../../004-index/one-explorer-contracts.md#inbox)                                               |

## Security and trust

Access is decided here once and handed to the app as a grant signed with `GRANT_SIGNING_KEY`, for the
audiences in `INDEX_AUDIENCES`. Share passwords are stored hashed (`password-hash.ts`), and a malformed stored hash is
refused, never matched. Secrets are set once per Worker and environment with `wrangler secret put` and survive every deploy; the
`Env fields` line under the Worker's configuration below lists every name the Worker reads, vars and secrets
together (a name not in a `[vars]` table is a secret). App keys are compared in constant time, and each key speaks
only for its own app.

## Performance and limits

Every list is paged (`limit`, `cursor`) and bounded by the constants below; the measured numbers are in
[index-service.md "Performance"](../index-service.md#performance).

## Observability

Every log line the service writes, by its fingerprint (the first literal of the call; `…` marks an interpolation):

| Level   | Fingerprint                                         | Where                  |
| ------- | --------------------------------------------------- | ---------------------- |
| `warn`  | `[account-app] activity_failed`                     | `activity.ts`          |
| `error` | `[grant] index unreachable`                         | `service.ts`           |
| `warn`  | `[grant] refused`                                   | `service.ts`           |
| `warn`  | `[index-app] images_report_failed`                  | `person-events.ts`     |
| `log`   | `[index] GRANT_SIGNING_KEY is unset: signing grant` | `grants.ts`            |
| `warn`  | `[index] copy failed`                               | `items.ts`             |
| `error` | `[index] create failed`                             | `request.ts`           |
| `log`   | `[index] created`                                   | `items.ts`             |
| `error` | `[index] cron step failed: …`                       | `index.ts`             |
| `log`   | `[index] emptied trash`                             | `items.ts`             |
| `warn`  | `[index] malformed stored share password refused`   | `password-hash.ts`     |
| `log`   | `[index] merged a guest`                            | `merge.ts`             |
| `log`   | `[index] migration handoff`                         | `migration-handoff.ts` |
| `warn`  | `[index] migration handoff not taken`               | `migration-handoff.ts` |
| `warn`  | `[index] notice not delivered`                      | `notices.ts`           |
| `warn`  | `[index] person merge not taken`                    | `person-merges.ts`     |
| `log`   | `[index] person merges`                             | `index.ts`             |
| `warn`  | `[index] person merges failed`                      | `merge.ts`             |
| `warn`  | `[index] person merges given up`                    | `person-merges.ts`     |
| `warn`  | `[index] person notice not taken`                   | `person-notices.ts`    |
| `warn`  | `[index] person notices`                            | `account-purge.ts`     |
| `warn`  | `[index] person notices given up`                   | `person-notices.ts`    |
| `warn`  | `[index] purge: apps unreachable, kept for the nex` | `purge.ts`             |
| `error` | `[index] purge: tombstone drain failed`             | `purge.ts`             |
| `log`   | `[index] purged`                                    | `items.ts`             |
| `log`   | `[index] purged a closed account`                   | `account-purge.ts`     |
| `log`   | `[index] purges`                                    | `index.ts`             |
| `warn`  | `[index] revoke not delivered`                      | `sharing.ts`           |
| `log`   | `[index] sweep: … empty items to the Tras`          | `index.ts`             |
| `error` | `[index] unreachable`                               | `lists.ts`             |
| `warn`  | `[index] visitor copy not recorded`                 | `visitors.ts`          |
| `warn`  | `[index] visitor open not recorded`                 | `visitors.ts`          |
| `log`   | `[index] … items wi`                                | `index.ts`             |
| `error` | `[internal] copy-to failed`                         | `internal.ts`          |
| `error` | `[internal] import failed`                          | `internal.ts`          |
| `warn`  | `[internal] import refused`                         | `internal.ts`          |
| `warn`  | `[internal] import undo failed`                     | `import-item.ts`       |
| `error` | `[internal] import write failed`                    | `import-item.ts`       |
| `info`  | `[internal] imported`                               | `internal.ts`          |
| `info`  | `[internal] migrated`                               | `internal.ts`          |
| `error` | `[internal] migration failed`                       | `internal.ts`          |
| `warn`  | `[internal] migration refused`                      | `internal.ts`          |
| `warn`  | `[internal] notice failed`                          | `internal.ts`          |
| `warn`  | `[internal] person merge failed`                    | `internal.ts`          |
| `warn`  | `[notify-email] skipped … ${String(emails`          | `notifier.ts`          |
| `warn`  | `[notify-email] the sender allowance could not be`  | `notify-claims.ts`     |
| `warn`  | `[room-purge] did not reach the room`               | `purge.ts`             |
| `info`  | `[room-purge] purged`                               | `purge.ts`             |
| `warn`  | `[tab-shares] leave failed`                         | `tab-shares.ts`        |
| `warn`  | `[tab-shares] send failed`                          | `tab-shares.ts`        |
| `warn`  | `[teams] accounts unreachable; the claim stands`    | `teams.ts`             |
| `error` | `[teams] create_failed`                             | `teams.ts`             |
| `warn`  | `[teams] create_refused`                            | `teams.ts`             |
| `info`  | `[teams] created`                                   | `teams.ts`             |
| `warn`  | `index: drive-signal failed`                        | `drive.ts`             |
| `error` | `index: drive-signal failed`                        | `drive.ts`             |

## Files

| File                                                | Role                                                                                                                                                                                            |
| --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `liveworkspace/apps/index/src/access.ts`            | The access rule (liveworkspace/docs/specs/004-index/one-explorer-contracts.md "Sharing and access"): the owner, and every joined member of the item's team, edit everything; anyone else n…     |
| `liveworkspace/apps/index/src/account-purge.ts`     | Closing an account (liveworkspace/docs/specs/004-index/one-explorer-contracts.md "Closing an account"): accounts calls POST /internal/purge-person with its own key once the account is go…     |
| `liveworkspace/apps/index/src/app-calls.ts`         | The index calling an app's internal routes (liveworkspace/docs/specs/004-index/one-explorer-contracts.md): copy an item's content, drop a purged item's content, tell an item a link was r…     |
| `liveworkspace/apps/index/src/app-routes.ts`        | What an item pushes (liveworkspace/docs/specs/004-index/one-explorer-contracts.md "What an item pushes"), from its app's server with the app's key: the summary derived from its content, …     |
| `liveworkspace/apps/index/src/auth.ts`              | Who is asking (liveworkspace/docs/specs/004-index/one-explorer-contracts.md "Reaching the index"): - a person, by an accounts access token or a guest token, checked offline against accou…     |
| `liveworkspace/apps/index/src/codec.ts`             | Small encodings: list cursors, share codes, search patterns, page sizes, base64url.                                                                                                             |
| `liveworkspace/apps/index/src/collab-push.ts`       | What an item pushes for the Inbox (liveworkspace/docs/specs/004-index/one-explorer-contracts.md "Inbox"), from its app's server with the app's key: each tab's comment threads and actions…     |
| `liveworkspace/apps/index/src/compound.ts`          | D1 refuses a compound SELECT of more than five terms ("too many terms in compound SELECT"), where SQLite's own default, and so the tests' node:sqlite, allows 500. Measure…                     |
| `liveworkspace/apps/index/src/config.ts`            | The Worker's settings                                                                                                                                                                           |
| `liveworkspace/apps/index/src/context.ts`           |                                                                                                                                                                                                 |
| `liveworkspace/apps/index/src/default-placement.ts` | Filing on create: where a new item lands when it is made without a place                                                                                                                        |
| `liveworkspace/apps/index/src/drive.ts`             | The Google Drive mirror's side of the index (liveworkspace/docs/specs/005-drive/drive.md "Contracts > The index"): the per-person `drive_mirrored` flag (`/app/people/:id/drive`), and the…     |
| `liveworkspace/apps/index/src/env.ts`               |                                                                                                                                                                                                 |
| `liveworkspace/apps/index/src/folder-previews.ts`   | What a folder card shows of what is inside (`GET /folders/previews?ids=…`): for each of up to 60 of the person's folders, its newest few items and how many it holds, for …                     |
| `liveworkspace/apps/index/src/folders.ts`           | Folders (liveworkspace/docs/specs/004-index/one-explorer-contracts.md "Folders, favourites, defaults"): one tree per person and one per team, holding items from any app                        |
| `liveworkspace/apps/index/src/fresh-teams.ts`       | A team made or joined since the caller's access token was minted (liveworkspace/docs/specs/004-index/one-explorer-contracts.md "Teams"): the token's `teams` claim is up to an hour old, s…     |
| `liveworkspace/apps/index/src/grants.ts`            | Grants (liveworkspace/docs/specs/004-index/one-explorer-contracts.md "Grants"): ES256 JWTs saying who may open an item at what level, valid for ten minutes, signed with the index's own k…     |
| `liveworkspace/apps/index/src/http.ts`              | Responses and request bodies                                                                                                                                                                    |
| `liveworkspace/apps/index/src/inbox.ts`             | The Inbox (liveworkspace/docs/specs/004-index/one-explorer-contracts.md "Inbox"): across every app, open actions and cards assigned to or by me, unresolved threads (an element's or a car…     |
| `liveworkspace/apps/index/src/index.ts`             | liveworkspace's index (liveworkspace/docs/specs/004-index/index-service.md): one Worker on liveworkspace.app/api/index holding where every Canvas, Plan, Document and Design is and who ca…     |
| `liveworkspace/apps/index/src/items.ts`             | Items (liveworkspace/docs/specs/004-index/one-explorer-contracts.md "Items"): listing, making, reading, renaming and moving, the Trash, copies, opens and grants.                               |
| `liveworkspace/apps/index/src/lists.ts`             | The Explorer's lists (`GET /items`, `GET /trash`): one query per page, keyset-paged, each driven by an index that starts with the person (their scopes, their opens, favou…                     |
| `liveworkspace/apps/index/src/merge.ts`             | A guest becoming an account (liveworkspace/docs/specs/004-index/one-explorer-contracts.md "Becoming an account"): accounts calls this with its own key, and everything the guest had moves…     |
| `liveworkspace/apps/index/src/migration-handoff.ts` | The migration's handoff (liveworkspace/docs/specs/004-index/one-explorer-contracts.md "The migration's handoff", docs/migration.md step 6): livediagram's api splits a browser's Local onl…     |
| `liveworkspace/apps/index/src/notices.ts`           | What the index tells an item's app for its notification emails, and the one count it answers for them (liveworkspace/docs/specs/004-index/one-explorer-contracts.md "Notices"): someone ma…     |
| `liveworkspace/apps/index/src/password-hash.ts`     | Share-password storage, as liveplanner keeps it (liveplanner/apps/api/src/auth/share-password-hash.ts): `pbkdf2-sha256$<iterations>$<salt>$<hash>`                                              |
| `liveworkspace/apps/index/src/person-merges.ts`     | Telling the apps a guest became an account (liveworkspace/docs/specs/004-index/one-explorer-contracts.md "Becoming an account"): the merge moves the index's own rows, but each app may ke…     |
| `liveworkspace/apps/index/src/person-notices.ts`    | Telling the apps about a closed account (liveworkspace/docs/specs/004-index/one-explorer-contracts.md "Closing an account"): the index anonymises its own rows, but the person's name is a…     |
| `liveworkspace/apps/index/src/personal.ts`          | A person's own things about items (liveworkspace/docs/specs/004-index/one-explorer-contracts.md "Folders, favourites, defaults"): favourites, what they hid from Recent, and the folder Ne…     |
| `liveworkspace/apps/index/src/purge.ts`             | Purging (liveworkspace/docs/specs/004-index/one-explorer-contracts.md "Purging"): a permanent delete, emptying the Trash, or the daily sweep of items 30 days in it                             |
| `liveworkspace/apps/index/src/rows.ts`              | Item rows and their wire shape                                                                                                                                                                  |
| `liveworkspace/apps/index/src/share-expiry.ts`      | Share Link Expiring (liveworkspace/docs/specs/004-index/one-explorer-contracts.md "Timeline"): a warning on an item owner's Timeline before its share links stop working                        |
| `liveworkspace/apps/index/src/share-guesses.ts`     | Share-password guesses (liveworkspace/docs/specs/004-index/one-explorer-contracts.md "Sharing and access"): each try at an item's password that this isolate hasn't already found right is…     |
| `liveworkspace/apps/index/src/sharing.ts`           | Sharing (liveworkspace/docs/specs/004-index/one-explorer-contracts.md "Sharing and access"): share links, the share password, what a link opens, and Shared with me                             |
| `liveworkspace/apps/index/src/timeline.ts`          | The Timeline (liveworkspace/docs/specs/004-index/one-explorer-contracts.md "Timeline"): what happened to the items a person reaches as owner or team member, newest first, in every app or…     |
| `liveworkspace/apps/index/src/visitors.ts`          | Opened by a Visitor and Copied by a Visitor (liveworkspace/docs/specs/004-index/one-explorer-contracts.md "Timeline"): who came in to an item through one of its share links, on its owner…     |
| `liveworkspace/apps/index/src/workbench-close.ts`   | Accounts' workbench service ending a pairing's access (liveworkspace/docs/specs/011-workbench/workbench.md "Ending access"): it asks here, with its merge key, to tell an app to close the roo… |
| `packages/index-client/src/browser/fake-window.ts`  | A window for node tests: the two storages, a location whose assign and replace are recorded, and globals to set.                                                                                |
| `packages/index-client/src/browser/guest-token.ts`  | A guest's identity is liveworkspace's, the same guest in every app (liveworkspace/docs/specs/004-index/one-explorer-contracts.md "Guests")                                                      |
| `packages/index-client/src/browser/index.ts`        | The browser side of an app on the index: what every editor needs to be a guest, hold an item's grant, and read the person's teams from their token                                              |
| `packages/index-client/src/browser/item-grants.ts`  | The index's grant on an item (liveworkspace/docs/specs/004-index/one-explorer-contracts.md "Grants"), as an editor holds it: a ten-minute token naming the item, the level and the tab, wh…     |
| `packages/index-client/src/browser/token-teams.ts`  | The teams an access token names (its `teams` claim, liveworkspace/docs/specs/003-accounts/accounts.md "Teams"), read without checking the signature: for the Explorer's team list               |
| `packages/index-client/src/client.ts`               | The index as the Explorer and the editors call it (liveworkspace/docs/specs/004-index/one-explorer-contracts.md): one typed method per call                                                     |
| `packages/index-client/src/constants.ts`            | The index's fixed names and numbers (liveworkspace/docs/specs/004-index/one-explorer-contracts.md)                                                                                              |
| `packages/index-client/src/grant.ts`                | Checks a grant inside an app (its api Worker or an item's Durable Object): an ES256 JWT the index signed, saying who may open which item at what level                                          |
| `packages/index-client/src/index.ts`                | The One Explorer index's shared contract (liveworkspace/docs/specs/004-index/one-explorer-contracts.md): the names and limits, the wire types, a typed client for browsers and apps' serve…     |
| `packages/index-client/src/notices.ts`              | What the index tells an item's app, and asks of it, for the app's notification emails (liveworkspace/docs/specs/004-index/one-explorer-contracts.md "Notices")                                  |
| `packages/index-client/src/testing.ts`              | Test helpers                                                                                                                                                                                    |
| `packages/index-client/src/types.ts`                | The index's wire shapes (liveworkspace/docs/specs/004-index/one-explorer-contracts.md)                                                                                                          |
| `packages/index-app/src/activity.ts`                | The owner's newest save, reported to the liveworkspace accounts Worker for its onboarding series (whether they have made anything yet, and when they were last active, in …                     |
| `packages/index-app/src/anonymise.ts`               | A closed account's name off the work they leave in other people's items (liveworkspace/docs/one-explorer- contracts.md "Closing an account"): the index anonymises its own…                     |
| `packages/index-app/src/cards.ts`                   | An item's cards in the Inbox (liveworkspace/docs/specs/004-index/one-explorer-contracts.md "What an item pushes"): the open cards assigned to someone, and every card's comment thread, pu…     |
| `packages/index-app/src/forms.ts`                   | A public form's code, as an app's Worker finds the item behind it (liveworkspace/docs/specs/004-index/one-explorer-contracts.md "What an item pushes")                                          |
| `packages/index-app/src/image-grants.ts`            | Which images an item may serve, answered in the item's own SQLite (its Durable Object): placement grants (liveworkspace/docs/specs/006-media/media.md "References"; an app's images spec, …     |
| `packages/index-app/src/import-item.ts`             | The import door's work every app shares (liveworkspace/docs/specs/005-drive/drive.md "Contracts > The apps"): read the file, make the index's item as its owner's personal item in the fol…     |
| `packages/index-app/src/index.ts`                   | The server side every app on liveworkspace's index shares (liveworkspace/docs/specs/004-index/one-explorer-contracts.md): its grants and clients, the index's doors into its items, purgin…     |
| `packages/index-app/src/internal.ts`                | /api/internal/items/**: the index's doors into an app's items (liveworkspace/docs/specs/004-index/one-explorer-contracts.md).                                                                   |
| `packages/index-app/src/item-db.ts`                 | An item's own SQLite behind the D1 surface, for an app whose items each live in a Durable Object (a plan, a document, a design)                                                                 |
| `packages/index-app/src/item-head.ts`               | An item's owner and team, as its Durable Object keeps them (liveworkspace/docs/specs/004-index/one-explorer-contracts.md "Grants")                                                              |
| `packages/index-app/src/lists.ts`                   | What the routes an API client (the MCP server, the CLI, any script with an `lwt_` token) still calls on an app's api share, answering from the index: its refusals as the …                     |
| `packages/index-app/src/migration-door.ts`          | The migration door's body (docs/migration.md "The apps' migration door"; @liveworkspace/migration contract.ts MigrationRoomPayload): checked field by field before anythin…                     |
| `packages/index-app/src/migration-room.ts`          | The migration door's write into one item's Durable Object (docs/migration.md "The apps' migration door"; the contract is @liveworkspace/migration contract.ts): an old liv…                     |
| `packages/index-app/src/notifier.ts`                | The notification emails every app sends about its items, written once (docs/specs/014-identity/ profile-and-email-notifications.md in each app): the two milestones (the t…                     |
| `packages/index-app/src/notify-claims.ts`           | The once-only rules of an item's notification emails (@liveworkspace/auth-client notify.ts holds the numbers), for every app: - Once per key: someone joined (one email p…                      |
| `packages/index-app/src/outbox.ts`                  | What an item's Durable Object owes the index (liveworkspace/docs/specs/004-index/one-explorer-contracts.md "What an item pushes"): its summary (`PUT /app/items/:id/summary`), each change…     |
| `packages/index-app/src/person-events.ts`           | Timeline events about a person rather than an item (docs/one-explorer-contracts.md "Timeline"): images uploaded, one entry per person, app and day whose count grows with …                     |
| `packages/index-app/src/purge.ts`                   | Dropping items' content for good (liveworkspace/docs/specs/004-index/one-explorer-contracts.md "Purging"): the index has already removed the rows (a permanent delete, the Trash's sweep, …     |
| `packages/index-app/src/request.ts`                 | The index's grant on the item a request is about (liveworkspace/docs/specs/004-index/one-explorer-contracts.md "Grants"), as an app's worker settles it before the request goes to the ite…     |
| `packages/index-app/src/room-ticket.ts`             | The ticket a socket joins an item's room with (`…/ws?t=`), and renews its session with: the index's grant itself (liveworkspace/docs/specs/004-index/one-explorer-contracts.md "Grants")        |
| `packages/index-app/src/service.ts`                 | An app's api reaching liveworkspace's index (liveworkspace/docs/specs/004-index/one-explorer.md, one-explorer-contracts.md): where every item is and who may open it                            |
| `packages/index-app/src/tab-link.ts`                | "Add to <Item>": `POST /api/<items>/:target/tabs/:tabId/link {from}` shares a tab of another of the caller's items (`from`) into `target` (tab-shares.ts)                                       |
| `packages/index-app/src/tab-shares.ts`              | A tab shared between items: one tab in several of a person's items at once, an edit in any reaching the others (each app's "Add to <Item>", its `tab-<item>-many-to-many.m…                     |
| `packages/index-app/src/tabs.ts`                    | An item's tabs alone (liveworkspace/docs/specs/004-index/one-explorer-contracts.md "An item's tabs"): `GET /api/<items>/:id/tabs` answers `{ tabs: [{ id, name, kind }] }`, in the item's …     |
| `packages/index-app/src/teams.ts`                   | Team access for an app on the index (liveworkspace/docs/specs/003-accounts/accounts.md "Teams"): an app keeps no copy of teams.                                                                 |
| `packages/index-app/src/testing.ts`                 | Tests only (`@liveworkspace/index-app/testing`): node:sqlite stand-ins for what the kit's Durable Objects run on.                                                                               |
| `packages/index-app/src/timing-safe.ts`             | Constant-time string comparison for keys and share secrets: both sides are hashed (so length is hidden and the compared buffers are always 32 bytes) and the digests diffe…                     |
| `packages/index-app/src/worker-http.ts`             | Small pieces every liveworkspace service Worker answers with (index, media, Community, telemetry), kept once.                                                                                   |

## Constants and configuration: the Worker

`liveworkspace/apps/index/wrangler.toml`, account `851be7d244b76a6557bcbe6c4ded80f5`, main `src/index.ts`, compatibility date `2026-05-29`.

**Production**

| Setting                                  | Value                                                                                      |
| ---------------------------------------- | ------------------------------------------------------------------------------------------ |
| Worker name                              | `liveworkspace-index`                                                                      |
| Route                                    | `liveworkspace.app/api/index*`                                                             |
| D1 `INDEX_DB`                            | `liveworkspace-index`, migrations `migrations`                                             |
| Service `DRIVE`                          | `liveworkspace-drive`                                                                      |
| Rate limit `MIGRATION_LIMITER`           | 60 per 60 s                                                                                |
| Rate limit `SHARE_GUESS_VISITOR_LIMITER` | 10 per 60 s                                                                                |
| Rate limit `SHARE_GUESS_ITEM_LIMITER`    | 30 per 60 s                                                                                |
| Crons                                    | `23 4 * * *`, `*/15 * * * *`                                                               |
| Var `ENVIRONMENT`                        | `production`                                                                               |
| Var `ACCOUNTS_URL`                       | `https://liveworkspace.app`                                                                |
| Var `INDEX_AUDIENCES`                    | `https://livediagram-router.liveworkspace-easing509.workers.dev/api,https://liveplanner.…` |
| Var `APP_ORIGIN_LIVEDIAGRAM`             | `https://livediagram-router.liveworkspace-easing509.workers.dev`                           |
| Var `APP_ORIGIN_LIVEPLANNER`             | `https://liveplanner.app`                                                                  |
| Var `APP_ORIGIN_LIVEDOCUMENTS`           | `https://livedocuments.app`                                                                |
| Var `APP_ORIGIN_LIVEDESIGN`              | `https://livedesign.app`                                                                   |

**`env.staging`**

| Setting                                  | Value                                                                                      |
| ---------------------------------------- | ------------------------------------------------------------------------------------------ |
| Worker name                              | `liveworkspace-index-staging`                                                              |
| Route                                    | `staging.liveworkspace.app/api/index*`                                                     |
| D1 `INDEX_DB`                            | `liveworkspace-index-staging`, migrations `migrations`                                     |
| Service `DRIVE`                          | `liveworkspace-drive-staging`                                                              |
| Rate limit `MIGRATION_LIMITER`           | 60 per 60 s                                                                                |
| Rate limit `SHARE_GUESS_VISITOR_LIMITER` | 10 per 60 s                                                                                |
| Rate limit `SHARE_GUESS_ITEM_LIMITER`    | 30 per 60 s                                                                                |
| Crons                                    | `23 4 * * *`, `*/15 * * * *`                                                               |
| Var `ENVIRONMENT`                        | `staging`                                                                                  |
| Var `ACCOUNTS_URL`                       | `https://staging.liveworkspace.app`                                                        |
| Var `INDEX_AUDIENCES`                    | `https://livediagram-router-staging.liveworkspace-easing509.workers.dev/api,https://stag…` |
| Var `APP_ORIGIN_LIVEDIAGRAM`             | `https://livediagram-router-staging.liveworkspace-easing509.workers.dev`                   |
| Var `APP_ORIGIN_LIVEPLANNER`             | `https://staging.liveplanner.app`                                                          |
| Var `APP_ORIGIN_LIVEDOCUMENTS`           | `https://staging.livedocuments.app`                                                        |
| Var `APP_ORIGIN_LIVEDESIGN`              | `https://staging.livedesign.app`                                                           |

Env fields (`env.ts`): `ACCOUNTS_URL`, `APP_ORIGIN_LIVEDESIGN`, `APP_ORIGIN_LIVEDIAGRAM`, `APP_ORIGIN_LIVEDOCUMENTS`, `APP_ORIGIN_LIVEPLANNER`, `DRIVE_KEY_INDEX`, `ENVIRONMENT`, `GRANT_SIGNING_KEY`, `INDEX_AUDIENCES`, `INDEX_ENABLED`, `INDEX_KEY_DRIVE`, `INDEX_KEY_LIVEDESIGN`, `INDEX_KEY_LIVEDIAGRAM`, `INDEX_KEY_LIVEDOCUMENTS`, `INDEX_KEY_LIVEPLANNER`, `MERGE_KEY`.

## Data and persistence

Migrations, in order:

- `0001_index.sql`
- `0002_person_app_notices.sql`
- `0003_person_app_merges.sql`
- `0004_form_codes.sql`
- `0005_drive_people.sql`
- `0006_person_app_merges_legacy.sql`

| Table                   | Columns                                                                                                                                                                                                                             | Created in                    |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| `collab_actions`        | `app`, `item_id`, `tab_id`, `tab_name`, `element_id`, `action_id`, `element_label`, `name`, `description`, `status`, `assignee_id`, `assignee_name`, `assigner_id`, `assigner_name`, `team_id`, `card`, `created_at`, `updated_at`  | `0001_index.sql`              |
| `collab_form_reads`     | `person_id`, `item_id`, `tab_id`, `seen`                                                                                                                                                                                            | `0001_index.sql`              |
| `collab_forms`          | `app`, `item_id`, `tab_id`, `heading`, `board_tab_id`, `responses`, `latest_at`, `code (0004)`                                                                                                                                      | `0001_index.sql`              |
| `collab_thread_people`  | `app`, `item_id`, `tab_id`, `element_id`, `person_id`                                                                                                                                                                               | `0001_index.sql`              |
| `collab_threads`        | `app`, `item_id`, `tab_id`, `tab_name`, `element_id`, `element_label`, `resolved`, `comment_count`, `participant_ids`, `mentioned_ids`, `latest_text`, `latest_author_name`, `latest_author_color`, `card`, `first_at`, `latest_at` | `0001_index.sql`              |
| `drive_people`          | `person_id`, `since`                                                                                                                                                                                                                | `0005_drive_people.sql`       |
| `favourites`            | `person_id`, `item_id`, `created_at`                                                                                                                                                                                                | `0001_index.sql`              |
| `folders`               | `id`, `name`, `parent_id`, `owner_id`, `team_id`, `scope`, `created_at`, `updated_at`                                                                                                                                               | `0001_index.sql`              |
| `items`                 | `id`, `app`, `kind`, `owner_id`, `team_id`, `scope`, `folder_id`, `title`, `source`, `intent`, `summary`, `created_at`, `updated_at`, `trashed_at`, `trash_reason`, `empty_swept_for`                                               | `0001_index.sql`              |
| `opens`                 | `person_id`, `item_id`, `last_opened_at`, `hidden`                                                                                                                                                                                  | `0001_index.sql`              |
| `person_app_merges`     | `guest_id`, `user_id`, `app`, `created_at`, `attempts`, `last_attempt_at`, `legacy (0006)`                                                                                                                                          | `0003_person_app_merges.sql`  |
| `person_app_notices`    | `person_id`, `app`, `item_id`, `created_at`, `attempts`, `last_attempt_at`                                                                                                                                                          | `0002_person_app_notices.sql` |
| `person_purges`         | `person_id`, `team_ids`, `requested_at`, `finished_at`, `runs`                                                                                                                                                                      | `0001_index.sql`              |
| `placement_defaults`    | `person_id`, `default_key`, `folder_id`, `updated_at`                                                                                                                                                                               | `0001_index.sql`              |
| `purge_tombstones`      | `item_id`, `app`, `created_at`, `attempts`, `last_attempt_at`, `last_error`                                                                                                                                                         | `0001_index.sql`              |
| `share_links`           | `code`, `item_id`, `level`, `tab_id`, `expiry`, `expires_at`, `created_at`, `public`                                                                                                                                                | `0001_index.sql`              |
| `share_passwords`       | `item_id`, `hash`, `updated_at`                                                                                                                                                                                                     | `0001_index.sql`              |
| `shared_with`           | `person_id`, `item_id`, `share_code`, `last_seen`                                                                                                                                                                                   | `0001_index.sql`              |
| `timeline_dismissals`   | `person_id`, `event_id`, `created_at`                                                                                                                                                                                               | `0001_index.sql`              |
| `timeline_event_scopes` | `scope`, `event_id`, `app`, `occurred_at`                                                                                                                                                                                           | `0001_index.sql`              |
| `timeline_events`       | `id`, `app`, `item_id`, `actor_id`, `actor_name`, `type`, `title`, `detail`, `occurred_at`                                                                                                                                          | `0001_index.sql`              |
| `timeline_scope_state`  | `person_id`, `last_seen_at`                                                                                                                                                                                                         | `0001_index.sql`              |
| `use_days`              | `person_id`, `item_id`, `day`                                                                                                                                                                                                       | `0001_index.sql`              |

## Constants and configuration: named constants

| Constant                        | Value                                                                    | File                 |
| ------------------------------- | ------------------------------------------------------------------------ | -------------------- |
| `ANONYMISED_PERSON`             | `'deleted'`                                                              | `account-purge.ts`   |
| `CHUNK`                         | `500`                                                                    | `account-purge.ts`   |
| `LINGER_MS`                     | `2 * 60 * 60 * 1000`                                                     | `account-purge.ts`   |
| `FREQUENT_CRON`                 | `'*/15 * * * *'`                                                         | `account-purge.ts`   |
| `TOMBSTONES_PER_FREQUENT_RUN`   | `300`                                                                    | `account-purge.ts`   |
| `TOMBSTONE_RETRY_AFTER_MS`      | `60 * 60 * 1000`                                                         | `account-purge.ts`   |
| `CALL_BUDGET`                   | `{ ms: 5_000, calls: 300 }`                                              | `account-purge.ts`   |
| `CRON_BUDGET`                   | `{ ms: 30_000, calls: 300 }`                                             | `account-purge.ts`   |
| `DRIVE_DELEGATE`                | `'drive'`                                                                | `auth.ts`            |
| `SHARE_CODE_LENGTH`             | `14`                                                                     | `codec.ts`           |
| `D1_COMPOUND_MAX`               | `5`                                                                      | `compound.ts`        |
| `API_PATH`                      | `INDEX_API_PATH`                                                         | `config.ts`          |
| `MAX_BODY_BYTES`                | `512 * 1024`                                                             | `config.ts`          |
| `ID_MAX`                        | `128`                                                                    | `config.ts`          |
| `INTENT_MAX`                    | `100`                                                                    | `config.ts`          |
| `DEFAULT_KEY_MAX`               | `100`                                                                    | `config.ts`          |
| `JWKS_MAX_AGE_S`                | `300`                                                                    | `config.ts`          |
| `SWEEP_ITEMS_MAX`               | `500`                                                                    | `config.ts`          |
| `TOMBSTONES_PER_RUN`            | `200`                                                                    | `config.ts`          |
| `EMPTY_SWEEP_MAX`               | `1000`                                                                   | `config.ts`          |
| `PURGE_NOW_MAX`                 | `25`                                                                     | `config.ts`          |
| `APP_CALL_CONCURRENCY`          | `6`                                                                      | `config.ts`          |
| `APP_CALL_TIMEOUT_MS`           | `10_000`                                                                 | `config.ts`          |
| `HANDOFF_MAX_BYTES`             | `32 * 1024 * 1024`                                                       | `config.ts`          |
| `HANDOFF_APP_TIMEOUT_MS`        | `30_000`                                                                 | `config.ts`          |
| `INBOX_LIMIT_DEFAULT`           | `100`                                                                    | `config.ts`          |
| `OPEN_MEMORY_MAX`               | `5_000`                                                                  | `config.ts`          |
| `PASSWORD_MEMORY_MAX`           | `1_000`                                                                  | `config.ts`          |
| `SHARE_GUESS_RETRY_AFTER_S`     | `60`                                                                     | `config.ts`          |
| `SHARE_PASSWORD_ITERATIONS`     | `100_000`                                                                | `password-hash.ts`   |
| `PERSON_ITEMS_PER_CALL`         | `100`                                                                    | `person-notices.ts`  |
| `NOTICE_RETRY_AFTER_MS`         | `60 * 60 * 1000`                                                         | `person-notices.ts`  |
| `NOTICE_GIVE_UP_MS`             | `7 * 24 * 60 * 60 * 1000`                                                | `person-notices.ts`  |
| `LOOSE_EVENTS_SWEEP_MAX`        | `1000`                                                                   | `purge.ts`           |
| `ITEM_COLUMNS`                  | `'i.id, i.app, i.kind, i.owner_id, i.team_id, i.scope, i.fold…`          | `rows.ts`            |
| `LIVE_LINK`                     | `(alias: string) =>`                                                     | `rows.ts`            |
| `EXPIRY_SWEEP_MAX`              | `2_000`                                                                  | `share-expiry.ts`    |
| `FUTURE_SLACK_MS`               | `5 * 60 * 1000`                                                          | `timeline.ts`        |
| `WORKBENCH_CLOSE_MAX_ITEMS`     | `500`                                                                    | `workbench-close.ts` |
| `WORKBENCH_CLOSE_CONCURRENCY`   | `10`                                                                     | `workbench-close.ts` |
| `GUEST_TOKEN_REFRESH_BEFORE_MS` | `30 * 24 * 3600 * 1000`                                                  | `guest-token.ts`     |
| `GUEST_HANDOFF_BACKOFF_MS`      | `5 * 60_000`                                                             | `guest-token.ts`     |
| `GRANT_RENEW_BEFORE_MS`         | `60_000`                                                                 | `item-grants.ts`     |
| `GRANT_REFUSAL_MEMORY_MS`       | `30_000`                                                                 | `item-grants.ts`     |
| `GRANT_RETRY_MS`                | `15_000`                                                                 | `item-grants.ts`     |
| `GRANTS_HELD_MAX`               | `32`                                                                     | `item-grants.ts`     |
| `APPS`                          | `['livediagram', 'liveplanner', 'livedocuments', 'livedesign'] as const` | `constants.ts`       |
| `KINDS`                         | `['canvas', 'plan', 'document', 'design'] as const`                      | `constants.ts`       |
| `APP_KINDS`                     | `(object or list, see file)`                                             | `constants.ts`       |
| `LEVELS`                        | `['view', 'participate', 'edit'] as const`                               | `constants.ts`       |
| `FOLDER_PREVIEW_IDS_MAX`        | `60`                                                                     | `constants.ts`       |
| `FOLDER_PREVIEW_ITEMS`          | `4`                                                                      | `constants.ts`       |
| `FOLDER_PREVIEW_COUNT_CAP`      | `1000`                                                                   | `constants.ts`       |
| `INDEX_API_PATH`                | `'/api/index'`                                                           | `constants.ts`       |
| `INDEX_API_URL`                 | `https://liveworkspace.app${INDEX_API_PATH}`                             | `constants.ts`       |
| `INDEX_APP_HEADER`              | `'X-Index-App'`                                                          | `constants.ts`       |
| `INDEX_PERSON_HEADER`           | `'X-Index-Person'`                                                       | `constants.ts`       |
| `INDEX_TEAMS_HEADER`            | `'X-Index-Teams'`                                                        | `constants.ts`       |
| `DELEGATED_TEAMS_MAX`           | `50`                                                                     | `constants.ts`       |
| `ITEM_GRANT_HEADER`             | `'X-Index-Grant'`                                                        | `constants.ts`       |
| `SHARE_CODE_HEADER`             | `'X-Share-Code'`                                                         | `constants.ts`       |
| `SHARE_PASSWORD_HEADER`         | `'X-Share-Password'`                                                     | `constants.ts`       |
| `GRANT_LIFETIME_S`              | `600`                                                                    | `constants.ts`       |
| `GRANT_RENEW_BEFORE_S`          | `60`                                                                     | `constants.ts`       |
| `GRANT_ALG`                     | `'ES256'`                                                                | `constants.ts`       |
| `GRANT_ISSUER`                  | `INDEX_API_URL`                                                          | `constants.ts`       |
| `GRANT_JWKS_URL`                | `${INDEX_API_URL}/jwks`                                                  | `constants.ts`       |
| `LIST_LIMIT_DEFAULT`            | `50`                                                                     | `constants.ts`       |
| `LIST_LIMIT_MAX`                | `200`                                                                    | `constants.ts`       |
| `SUMMARY_MAX_BYTES`             | `2048`                                                                   | `constants.ts`       |
| `COLLAB_MAX_THREADS`            | `500`                                                                    | `constants.ts`       |
| `COLLAB_MAX_ACTIONS`            | `500`                                                                    | `constants.ts`       |
| `COLLAB_CARDS_TAB`              | `'~cards'`                                                               | `constants.ts`       |
| `TITLE_MAX`                     | `500`                                                                    | `constants.ts`       |
| `FOLDER_NAME_MAX`               | `500`                                                                    | `constants.ts`       |
| `SHARE_PASSWORD_MAX`            | `256`                                                                    | `constants.ts`       |
| `SHARE_PASSWORD_MIN`            | `6`                                                                      | `constants.ts`       |
| `SHARE_LINKS_PER_ITEM`          | `100`                                                                    | `constants.ts`       |
| `SEARCH_MAX`                    | `200`                                                                    | `constants.ts`       |
| `SEARCH_WORDS_MAX`              | `16`                                                                     | `constants.ts`       |
| `FILTER_VALUES_MAX`             | `8`                                                                      | `constants.ts`       |
| `INTENT_WORD`                   | `/^[a-z0-9-]{1,32}$/`                                                    | `constants.ts`       |
| `ITEM_OWNERS`                   | `['me', 'others'] as const`                                              | `constants.ts`       |
| `TRASH_RETENTION_MS`            | `30 * 24 * 60 * 60 * 1000`                                               | `constants.ts`       |
| `EMPTY_ITEM_STALE_MS`           | `30 * 24 * 60 * 60 * 1000`                                               | `constants.ts`       |
| `OPEN_DEBOUNCE_MS`              | `60 * 1000`                                                              | `constants.ts`       |
| `USE_WINDOW_DAYS`               | `90`                                                                     | `constants.ts`       |
| `MOST_USED_MAX`                 | `8`                                                                      | `constants.ts`       |
| `ITEM_TIMELINE_EVENT_TYPES`     | `(object or list, see file)`                                             | `constants.ts`       |
| `PERSON_TIMELINE_EVENT_TYPES`   | `['image_uploaded', 'taken_offline'] as const`                           | `constants.ts`       |
| `ACCOUNT_TIMELINE_EVENT_TYPES`  | `(object or list, see file)`                                             | `constants.ts`       |
| `TIMELINE_EVENT_TYPES`          | `(object or list, see file)`                                             | `constants.ts`       |
| `APP_TIMELINE_EVENT_TYPES`      | `['edited'] as const`                                                    | `constants.ts`       |
| `APP_PERSON_EVENT_TYPES`        | `['image_uploaded'] as const`                                            | `constants.ts`       |
| `TIMELINE_PLATFORM`             | `'liveworkspace' as const`                                               | `constants.ts`       |
| `ACCOUNT_EVENT_SCOPES_MAX`      | `250`                                                                    | `constants.ts`       |
| `SHARE_EXPIRY_WARNING_MS`       | `7 * 24 * 60 * 60 * 1000`                                                | `constants.ts`       |
| `ACCOUNT_EVENT_AHEAD_MS`        | `8 * 24 * 60 * 60 * 1000`                                                | `constants.ts`       |
| `COLLAB_EVENTS_MAX`             | `100`                                                                    | `constants.ts`       |
| `TIMELINE_PAGE`                 | `30`                                                                     | `constants.ts`       |
| `TIMELINE_LIMIT_MAX`            | `100`                                                                    | `constants.ts`       |
| `APP_EVENTS_MAX`                | `100`                                                                    | `constants.ts`       |
| `TIMELINE_DISMISS_MAX`          | `100`                                                                    | `constants.ts`       |
| `TIMELINE_NEW_CAP`              | `99`                                                                     | `constants.ts`       |
| `SHARE_LINK_EXPIRIES`           | `['never', 'week', 'month', 'sixMonths'] as const`                       | `constants.ts`       |
| `SHARE_LINK_EXPIRY_MS`          | `(object or list, see file)`                                             | `constants.ts`       |
| `DEFAULT_LINK_LEVEL`            | `'edit'`                                                                 | `constants.ts`       |
| `ITEM_SOURCES`                  | `['person', 'ai', 'import', 'template'] as const`                        | `constants.ts`       |
| `ITEM_VIEWS`                    | `(object or list, see file)`                                             | `constants.ts`       |
| `INDEX_ERRORS`                  | `(object or list, see file)`                                             | `constants.ts`       |
| `OWNED_COUNT_MAX`               | `1000`                                                                   | `notices.ts`         |
| `ANONYMISED_PERSON`             | `'deleted'`                                                              | `anonymise.ts`       |
| `ANONYMISED_NAME`               | `'Deleted account'`                                                      | `anonymise.ts`       |
| `FORM_PLACE_TTL_MS`             | `60_000`                                                                 | `forms.ts`           |
| `FORM_PLACE_CACHE_MAX`          | `1_000`                                                                  | `forms.ts`           |
| `IMAGE_GRANT_SCHEMA`            | `(object or list, see file)`                                             | `image-grants.ts`    |
| `JOINED_TELEMETRY_TYPE`         | `(object or list, see file)`                                             | `internal.ts`        |
| `EXPORT_FORMATS`                | `['svg', 'file'] as const`                                               | `internal.ts`        |
| `IMPORT_MAX_BYTES`              | `32 * 1024 * 1024`                                                       | `internal.ts`        |
| `IMPORT_NAME_MAX`               | `1000`                                                                   | `internal.ts`        |
| `PERSON_ITEMS_MAX`              | `100`                                                                    | `internal.ts`        |
| `MIGRATION_MAX_BYTES`           | `IMPORT_MAX_BYTES`                                                       | `internal.ts`        |
| `LIST_PAGES`                    | `5`                                                                      | `lists.ts`           |
| `NOTIFY_QUOTA_KIND`             | `'notify-email'`                                                         | `notify-claims.ts`   |
| `FLUSH_IDLE_MS`                 | `2_000`                                                                  | `outbox.ts`          |
| `FLUSH_MIN_GAP_MS`              | `60_000`                                                                 | `outbox.ts`          |
| `FLUSH_RETRY_MS`                | `60_000`                                                                 | `outbox.ts`          |
| `DRAIN_TABS`                    | `50`                                                                     | `outbox.ts`          |
| `PUSH_CONCURRENCY`              | `6`                                                                      | `outbox.ts`          |
| `ROOM_PURGE_TIMEOUT_MS`         | `3_000`                                                                  | `purge.ts`           |
| `ROOM_PURGE_CONCURRENCY`        | `10`                                                                     | `purge.ts`           |
| `BULK_PURGE_MAX`                | `100`                                                                    | `purge.ts`           |
| `ROOM_GRANT_MAX_LENGTH`         | `8192`                                                                   | `room-ticket.ts`     |
| `GRANT_CACHE_MAX`               | `1000`                                                                   | `service.ts`         |
| `MAX_TAB_HOLDERS`               | `20`                                                                     | `tab-shares.ts`      |
| `DRAIN_SHARES`                  | `50`                                                                     | `tab-shares.ts`      |
| `ITEM_TABS_SEGMENT`             | `'tabs'`                                                                 | `tabs.ts`            |
| `MISS_RECHECK_MS`               | `2_000`                                                                  | `teams.ts`           |
| `FRESH_TEAMS_MS`                | `30_000`                                                                 | `teams.ts`           |
| `TEAM_NAME_MAX`                 | `80`                                                                     | `teams.ts`           |
| `TEAM_ORGANISATION_MAX`         | `80`                                                                     | `teams.ts`           |

## Testing

52 test files:

- `liveworkspace/apps/index/src/account-purge.test.ts`
- `liveworkspace/apps/index/src/app.test.ts`
- `liveworkspace/apps/index/src/codec.test.ts`
- `liveworkspace/apps/index/src/compound.test.ts`
- `liveworkspace/apps/index/src/default-placement.test.ts`
- `liveworkspace/apps/index/src/delegate.test.ts`
- `liveworkspace/apps/index/src/drive.test.ts`
- `liveworkspace/apps/index/src/folder-previews.test.ts`
- `liveworkspace/apps/index/src/fresh-teams.test.ts`
- `liveworkspace/apps/index/src/home-reads.test.ts`
- `liveworkspace/apps/index/src/http.test.ts`
- `liveworkspace/apps/index/src/inbox.test.ts`
- `liveworkspace/apps/index/src/items.test.ts`
- `liveworkspace/apps/index/src/lists.test.ts`
- `liveworkspace/apps/index/src/migration.test.ts`
- `liveworkspace/apps/index/src/most-used.test.ts`
- `liveworkspace/apps/index/src/notices.test.ts`
- `liveworkspace/apps/index/src/personal.test.ts`
- `liveworkspace/apps/index/src/share-expiry.test.ts`
- `liveworkspace/apps/index/src/sharing.test.ts`
- `liveworkspace/apps/index/src/timeline.test.ts`
- `liveworkspace/apps/index/src/visitors.test.ts`
- `liveworkspace/apps/index/src/workbench.test.ts`
- `packages/index-client/src/browser/guest-token.test.ts`
- `packages/index-client/src/browser/item-grants.test.ts`
- `packages/index-client/src/browser/token-teams.test.ts`
- `packages/index-client/src/client.test.ts`
- `packages/index-client/src/constants.test.ts`
- `packages/index-client/src/grant.test.ts`
- `packages/index-app/src/anonymise.test.ts`
- `packages/index-app/src/cards.test.ts`
- `packages/index-app/src/drive-doors.test.ts`
- `packages/index-app/src/export.test.ts`
- `packages/index-app/src/forms.test.ts`
- `packages/index-app/src/image-grants.test.ts`
- `packages/index-app/src/import-item.test.ts`
- `packages/index-app/src/internal.test.ts`
- `packages/index-app/src/item-db.test.ts`
- `packages/index-app/src/item-head.test.ts`
- `packages/index-app/src/lists.test.ts`
- `packages/index-app/src/migration-door.test.ts`
- `packages/index-app/src/notifier.test.ts`
- `packages/index-app/src/notify-claims.test.ts`
- `packages/index-app/src/outbox.test.ts`
- `packages/index-app/src/person-events.test.ts`
- `packages/index-app/src/purge.test.ts`
- `packages/index-app/src/request.test.ts`
- `packages/index-app/src/room-ticket.test.ts`
- `packages/index-app/src/tab-shares.test.ts`
- `packages/index-app/src/tabs.test.ts`
- `packages/index-app/src/teams.test.ts`
- `packages/index-app/src/timing-safe.test.ts`
