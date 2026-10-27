# Moving livediagram's people and documents onto liveworkspace

The historical livediagram.app runs on the previous Cloudflare account, signs people in with Clerk, and keeps
everything in one D1 database (`livediagram`, 97 migrations), the `livediagram-images` R2 bucket and its
`DocumentRoom` objects. The new livediagram runs on the liveworkspace account (`851be7d244b76a6557bcbe6c4ded80f5`)
and started fresh: sign-in is liveworkspace's accounts Worker, each document's content is its own SQLite
`DocumentRoom`, where a document is and who may reach it is the index's, images are the media service's, and Plan,
Pages and the design pages have left for liveplanner, livedocuments and livedesign.

So this is a move out of Clerk and the old account, not into Clerk. It copies people and documents across, splits
each mixed document by product, tells everyone, then switches livediagram.app over. livediagram is the only source:
liveplanner, livedocuments and livedesign have no data from before accounts moved.

Related: [migrating-from-clerk.md](../liveworkspace/docs/specs/012-migrate/migrating-from-clerk.md),
[livediagram/plans/0002-liveworkspace-accounts.md](../livediagram/plans/0002-liveworkspace-accounts.md),
[stand-in-addresses.md](../livediagram/docs/specs/016-platform/stand-in-addresses.md).

## Rules that hold throughout

- **The old account is the source, and stays untouched.** Every step reads it and writes only to the new account.
  Nothing on the old account is changed or deleted until step 10, so it is always the rollback.
- **Split from the raw rows, never through the new read path.** The new livediagram drops Pages and Plan on read
  (`dropRetiredPages`, `dropRetiredPlan` in `packages/document`) and saves the result the next time a tab is
  saved. A migration that read old tabs through livediagram's parser would lose every page and board. The
  splitter reads the stored JSON and the Plan tables itself.
- **Nothing made on either side before the switch is lost.** The old site keeps taking work until the freeze
  (step 7), and the new account's apps (livediagram on its stand-in, liveplanner, livedocuments, livedesign) may
  take work too. The migration only adds to the new account: it never deletes, never overwrites a row it didn't
  write, and the final catch-up run picks up what the old site took since the last run. An imported row that would
  land on an id the new side already uses is reported and skipped, never written over.
- **Ids stay.** Accounts keep their Clerk ids (`user_…`), and every document keeps its id in the product that keeps
  most of it, so owners, links, embeds and bookmarks still resolve. Documents made by the split get new ids.
- **Every step can re-run.** Each writes by id, and only over rows an earlier run of the migration wrote (each
  such row is marked as imported, with the old row's `updated_at`), so step 0's rehearsal, the full copy and the
  final catch-up are the same scripts.
- **Old livediagram is frozen** for code from step 0 (no more features in the old livediagram.app repository), so
  the schema the scripts read doesn't move under them.

## 0. Inventory, backups and a rehearsal environment

Before anything is copied, know what's there and make sure it can be put back.

- Count, from a D1 export of the old database: accounts, guests (`owner_aliases`), documents, tabs per kind
  (Diagram, Draw, Workshop, Pages, Plan board/sheet/dashboard/form, logo, wireframe, photo), documents with more
  than one product in them, items, sheets, forms with public links, images and their bytes, teams, share links,
  Community posts, Drive connections, people who unsubscribed (`email_lifecycle`).
- Export the old D1 (`wrangler d1 export`) and note the Time Travel bookmark. List the R2 bucket. These are the
  restore point.
- Run every step below against **staging** on the new account from that export first, and walk a sample of real
  documents in each product's editor before any production run.

The counts decide the open questions at the end (how big the email send is, how many documents split, how long
the copy takes).

## 1. Accounts

1. Export users from Clerk (Users → Export) and import them into `liveworkspace-accounts` with
   `apps/accounts/scripts/import-clerk-users.ts` (Clerk id, primary email, name). Google-only people need no
   password: signing in with Google or a code to the same address lands on the same account.
2. **Someone who already signed up on the new side.** The script skips an email that already has an account
   (`INSERT OR IGNORE`), so today their old documents would be left under a Clerk id with no account. Instead the
   import writes an **owner map** (Clerk id → account id): the Clerk id where the account was imported, the
   existing account's id where the email was already taken. Every later step writes owners, members and grants
   through that map, so the person's old and new work land on one account and nothing they made on the new side
   moves. The script reports each such match.
3. Carry over the per-person data that has a new home:
   - `user_preferences` into the shared settings (the accounts Worker's `settings` table, `packages/settings`),
     **before** step 8 sends anything: opting out of email is a settings key there (`notifyTips`,
     `notifyComments`, `notifyMentions` and the rest in the `all` scope, `notifyDocumentJoin` in livediagram's),
     not a table of its own. `email_lifecycle` holds only which onboarding emails were sent; its stamps are copied
     too (into the accounts Worker's `email_lifecycle`, with `signup_app` livediagram), so nobody gets the welcome
     series again;
   - Plan's, Forms', Pages' and the logo pages' settings go to the app that has the feature, not livediagram:
     `planTourSeen`, `planTourTracks` and `formTourSeen` to liveplanner's scope; `pagesTourSeen` to livedocuments'
     and livedesign's, with each one's own page kinds of `pagesTourKinds` (article, slide and infographic to
     livedocuments, logo and wireframe to livedesign); `logoGuides`, `logoGuidesHidden` and `logoGuideStrength` to
     livedesign's. The old `recentExcludedIds` list is not a setting on the new side: it becomes the index's hidden
     `opens` rows (step 2.3);
   - `shape_libraries` into each person's livediagram `PersonStore`, through livediagram's person migration door
     (Tooling); `placement_defaults` into the index's `placement_defaults`. `custom_themes` and tags are not carried:
     livediagram has neither feature.
4. **Recreate teams** in the accounts Worker (`liveworkspace/docs/specs/003-accounts/accounts.md`, Teams) from `teams` and
   `team_members`: each team with its name, organisation, members and roles through the owner map, **keeping the
   old team id** (both sides use a plain UUID as the key, `team.id` here and `teams.id` there, so documents keep
   their team with no team map). Roles map one to one (`admin`, `member` on both). An old member row with a
   `user_id` becomes `joined`; one with only an `email` (the old site's pending invitation) becomes `invited`, its
   email sent only after the switch. A pending invitation keeps its reminder clock: `clockStartedAt` is the old
   `clock_started_at` (its `created_at` where that is empty), with the old `reminder1/2/3_sent_at` and
   `reminder_attempts`, so the accounts Worker's daily sweep carries on the old series where it stopped, sends no
   reminder the old site had sent, and expires the invitation 28 days after its clock started, as the old site would
   have. A catch-up run leaves the stamps as the first run wrote them (the sweep's own stamps don't move `updatedAt`,
   so a rewrite could undo one). An old creator row may have no `email` (the old table allowed null, the new
   `team_member.email` doesn't), so it takes the account's email. This replaces 0002's "teams are managed
   separately". Recreating writes no `team_*` Timeline events and sends no
   invitation emails at import time.
5. **Carry over API tokens**, so scripts, the CLI and connected AI tools keep working (this replaces 0002's "old
   tokens are revoked at the switch"). Checked against both codebases:
   - The old tokens are `lvd_<base64url(32 random bytes)>`, stored as the lowercase SHA-256 hex of the whole
     token (the old site's `apps/api/src/auth/api-token.ts`). The accounts Worker stores `lwt_` tokens in exactly that form
     (`hashApiToken`, `src/tokens.ts`), so an old row's hash can be copied as it is and the secret is never
     needed.
   - Copy every live row of `api_tokens` (not revoked, not expired) into `api_token`: owner through the owner map,
     name, `readOnly`, `createdAt`, `lastUsedAt`, `expiresAt` and `expiryWarnedAt` unchanged. Old tokens last six
     months from creation, like new ones, so each lapses on the day it would have, and the accounts Worker's
     expiry warning takes over (once per token: one already warned isn't warned again). The old cap was 10 per
     account and the new one is 20, so a copy only goes over it where someone also made tokens on the new side;
     the cap only stops new tokens being made, so nothing breaks.
   - Accept the `lvd_` prefix as well as `lwt_` wherever a token's shape is checked: `isApiTokenFormat` in
     `apps/accounts/src/tokens.ts` and `packages/api-kit/src/api-token.ts`, and livediagram's api, which picks
     the token path by prefix (`apps/api/src/index.ts`). Only imported rows can have that prefix, since nothing
     mints `lvd_` any more. A copied token works on every app's API, as every token now does.
   - **Connected AI tools.** The old MCP server's OAuth hands the client an `lvd_` token as its access token,
     with no refresh token (`apps/mcp/src/oauth.ts`), so a connection keeps working on the copied token until it
     expires. Copy the old MCP's dynamic client registrations as well (`client:<id>` in its `OAUTH_KV`, the same
     shape and key the new MCP reads, `packages/mcp-kit/src/oauth-clients.ts`), with their remaining time to
     live, so when a token lapses the tool signs in again on its own instead of failing on an unknown client.
     Some tools may still ask to be reconnected, which step 8's email says.
6. Left behind: workbench pairings and sessions, and profile pictures (0002). Drive connections can't move (their
   tokens are sealed with the old `DRIVE_TOKEN_KEY` and the Google client changes). The new livediagram has no
   Drive mirror of its own: Google Drive sync is liveworkspace's, for every app (liveworkspace/docs/specs/005-drive/drive.md), so a
   person connects there once; step 8's email says Drive sync is paused, not that it needs reconnecting.

## 2. Copy documents into livediagram

One script, per document, in batches:

1. Read the document's row, its tabs (`diagrams`, `diagram_tabs`, `tabs`) and their Plan rows from the old D1.
2. Hand the tabs to the splitter (step 3). What stays in livediagram is written into the document's new
   `DocumentRoom` through a **migration import door** (a new `importMigrated` RPC, reached by a route behind
   `MIGRATION_KEY`), with its `image_refs`, `tab_stats`, comments and actions (these live in the element JSON
   already). The existing `importCopy` is not enough, checked against `document-content.ts`: it carries tabs,
   their folders and image grants, but no changesets; it stamps every time as now (`saved_at`, `updated_at`,
   `created_at` 0) where the migration keeps the old ones; and it refuses a document that already has content
   (`document_not_empty`), so a catch-up run could never update one. The migration door writes the old times,
   takes changesets, marks what it wrote as imported with the old row's `updated_at`, and on a re-run replaces
   a tab only when it is still the imported revision (no one has edited it on the new side since).
3. Register the document with the index: owner, team, folder, favourites, Trash state, recent opens
   (`document_opens`) with what each person hid from Recent (the old `recentExcludedIds` preference: an open row
   marked `hidden`, or a row with no open, `last_opened_at` 0, for a document they hid but never opened), and who
   it's shared with (`shared_with`, `share_links`, keeping each link's token so old share URLs still work).
4. Shared tabs (one tab in several documents, `tab-document-many-to-many.md`) become `tab_shares` rows once every
   document holding the tab has been copied, so run that as a second pass.

**History is kept.** The old `timeline_events` (with `timeline_event_scopes`) become Timeline events in the index
(`apps/index/src/timeline.ts`) with their original times, actors through the owner map, and a mark that they were
imported so the import doesn't count as fresh activity or notify anyone. `agent_changesets` and their parts go into
the document's `DocumentRoom` beside the tabs they changed. Where a tab was split off (step 3), its history goes
with it to the product it went to, if that product keeps a Timeline for it; otherwise it stays on the livediagram
part. The kinds the index has under another name are mapped: `document_opened_by_visitor` and
`document_copied_by_visitor` to `opened_by_visitor` and `copied_by_visitor`, `document_synced` to `synced`,
`document_offline` to the person's own `taken_offline` (about no item, titled with the document's name),
`team_invite_accepted` to `team_joined`, and `team_member_left` to `team_member_removed` marked `left`. An old event
kind with no new equivalent is reported in the rehearsal and dropped rather than guessed.
Not copied: `collab_threads` and `collab_actions` (a projection, rebuilt from the JSON), `change_log`, `events`
(telemetry).

## 3. Split mixed documents by product

A livediagram document can hold tabs that now belong to four products. Each tab goes to one:

| Tab in the old document                                                                | Goes to       | As                   |
| -------------------------------------------------------------------------------------- | ------------- | -------------------- |
| Diagram, Draw, Workshop (Q&A boards and cards included)                                | livediagram   | the same document id |
| Pages: article, slide and infographic pages (`opensIn` pages, illustrate, infographic) | livedocuments | a new document       |
| Pages: logo and wireframe pages                                                        | livedesign    | a new design         |
| Board, Sheet, Dashboard, Form tabs, with their items, sheet cells and forms            | liveplanner   | a new project        |

- **One new document per product**, not per tab: a document with a diagram, two slide decks and a board becomes
  one livediagram document, one livedocuments document holding both decks, and one liveplanner project.
- **The same name**, owner, team, folder and sharing on every part, so each person finds them where they
  expect. A document with no diagram tabs keeps its id in the product that got most of it, so its links land
  there.
- **A pointer from the original.** The livediagram part (or its link, if it has no diagram tabs) carries where
  the rest went, so an old link to a mixed document can say "its pages are in livedocuments" and link there. A
  `moved_parts` mapping (old document id → new ids per product) is written alongside, and drives that notice,
  step 8's per-person list and the router's redirects.
- **References that now cross products**: a slide's tab window onto a diagram tab, a chart anchored to a sheet,
  a diagram's link to a board. Each keeps its last picture or value and becomes a link to the other product's
  document; none stays live.
- **Plan data lives in tables, not tabs** (`items`, `sheets`, `sheet_cells`, `sheet_refs`, `plan_board_statuses`,
  `form_links`, `form_reports`, `form_reads`), so the liveplanner copy reads those by tab id. A form's public link
  keeps working: the old form URL redirects to liveplanner's.
- **A Pages tab with both kinds of page** (an infographic beside a logo) splits by page: livedocuments knows only
  article, slide and infographic pages, and livedesign only logo, wireframe and photo pages; each reads the other's
  as an untyped A4 page. Each element goes with the page it sits on (its centre inside the page's rectangle); an
  element on no page stays with the documents part. The old site never had photo pages.
- **Each tab is upgraded before it moves.** liveplanner, livedocuments and livedesign don't run livediagram's
  older read migrations (whiteboard tabs, schemes, themes, legacy links and the element upgrades), so each tab is
  run through livediagram's stored-tab upgrades first, without its Pages and Plan drops. liveplanner drops `pages`
  and `articles` on read, which is fine: only Plan tabs go there.

Each product needs the same migration import door as step 2, and its own writes to the index.

## 4. Images

1. Copy the bytes from the old `livediagram-images` bucket into the media service's bucket **under the same ids**
   (an old image's R2 key is its `images.id`, a UUID, as the media service's is), with its `images` row: owner
   through the owner map (a guest's as the media service keys guests, `guest:` + SHA-256 of
   `livediagram.app\n<guest id>`), app `livediagram.app`, its size, type, dimensions, `sha256` and name, and its old
   `created_at`. Keeping the ids means no tab's image references change. The media service's upload door always
   makes a new id, so this goes in as SQL and R2 puts, not through it. Each copy is checked before it is put: by
   its SHA-256, except a JPEG, which the old site stored with its metadata stripped while keeping the hash of the
   file as picked (what the media service's `sha256` means too), so a JPEG is checked by its size.
2. Give a split part an `image_grants` row for each image it places that its owner didn't upload, and send each
   app's references (`POST /refs` with `complete: true`) straight after, so the media service's sweep of
   unreferenced images never sees an imported image as unplaced.
3. Previews and share cards are drawn fresh by the previews service; nothing is copied.

## 5. Community

Copy `community_posts`, their tags, likes, copies and open reports into the Community service
(`liveworkspace/docs/specs/007-community/community.md`), pointing each post at the livediagram document, or at the part that now
holds what was posted. The old site's `apps/community` signs in with Clerk; the new one reads the Community
service and signs in with liveworkspace accounts.

## 6. Guests

Guests' documents are copied. What the two sites do with guests, checked against both codebases:

- **Old.** A guest is a bare UUID in the browser's `localStorage` (`livediagram:v2:self-id`), minted by the api
  with an HMAC signature under `GUEST_ID_HMAC_SECRET` kept beside it (`livediagram:v2:self-sig`). Signing has been
  live in production since 2026-09-25 12:00 UTC (`GUEST_SIGNING_LIVE_AT`); a guest from before then has an
  unsigned id. The server keeps guest rows for good: there is no expiry.
- **New.** A guest is `guest_<uuid>`, made by the accounts Worker and kept in its `lw_guest` cookie on
  liveworkspace.app, the same guest in every app; the editor keeps a guest token for it
  (`livediagram:v2:guest-token`). Signing in merges the guest's index items into the account
  (`POST /internal/merge` on the index).
- **The same origin.** Both serve the editor on `https://www.livediagram.app` (the apex redirects there), so once
  the zone moves the new editor can read what the old one left in that browser.

So the old id can't simply be reused, and the plan is:

1. Copy guest-owned documents (steps 2–5) under `guest_<old uuid>`. Old guest ids are lowercase v4 UUIDs, so
   this is a valid new guest id, but the accounts Worker mints guest ids itself and signs its cookie, so no browser
   is ever handed one of these: it is held by nobody until it is claimed. The accounts Worker also keeps a
   `legacy_guest` row per migrated guest (the id, when the old site first saw it, when it was claimed).
2. The new editor, on first load, looks for `livediagram:v2:self-id`. When it finds one, it sends the old id and
   its signature, with its own guest or account token, to a one-time door on livediagram's api. The door checks
   the signature with the old `GUEST_ID_HMAC_SECRET` (copied as a secret; the owner copies its value from the old
   repository's GitHub secrets, since a Cloudflare secret can't be read back), or, for an unsigned id, accepts it only
   when the guest's `participants` row predates `GUEST_SIGNING_LIVE_AT`, the old site's own rule for legacy ids.
   The check runs in the accounts Worker (which holds the secret and the `legacy_guest` rows), reached from
   livediagram's api with its client credentials. It then merges `guest_<old uuid>` into the caller, guest or
   account, through the index's `POST /internal/merge`, and the editor removes the old keys. A retry merges
   nothing and is harmless. The merge today refuses a guest as the target, so it gains a `legacy: true` form that
   allows one, as do the apps' `people/:guest/merge` doors and the media service's owner merge (which already
   takes any two ids).
3. From then on the work is the browser's ordinary new guest's, or the account's if they were signed in (a
   signed-in person whose old guest work never moved is covered by the same door).

A guest who never comes back keeps their copied documents, unreachable but intact, as on the old site. Guests
can't be emailed; the old site's banner before the switch (step 7) tells them nothing is needed.

**Local only documents.** For a guest the old site's default is a Local only document, kept in that browser's
IndexedDB and never sent to the server, so no server step can copy it. Both editors use the same database
(`livediagram-offline`, version 2), so the new editor opens them as they are, but it drops Pages and Plan tabs on
read and saves without them (rules, above), which would lose them for good. Before the switch the new editor needs a
one-time pass over the local store, run before anything reads a document: for each local document holding Pages,
Plan or design tabs, keep the raw tabs aside, then offer to move them into livedocuments, liveplanner or livedesign
(through the same splitter as step 3, as the browser's guest or account), and drop them from the local copy only
once that has succeeded. (Queued edits to cloud documents are held in memory only, never in IndexedDB, so there
are none to carry.) The rehearsal should include a browser with a real old local store.

## 7. The switch

1. **Rehearse** steps 1–6 end to end on staging, then run them on production while the old site is still live.
   Re-run to catch up as often as needed.
2. **Freeze** the old site: a read-only banner, writes answer 503, at a quiet hour.
3. **Final catch-up run** of steps 1–6 (only what changed since the last run, by `saved_at` and created times),
   then the checks in step 9.
4. **Move the `livediagram.app` zone** to the liveworkspace account and run "When livediagram.app moves" in
   [stand-in-addresses.md](../livediagram/docs/specs/016-platform/stand-in-addresses.md), and the email domain
   move in [email.md](../liveworkspace/docs/specs/003-accounts/email.md).
5. Point the Google clients' redirect URIs at the real hosts, and the MCP server's OAuth at liveworkspace sign-in.
6. **Rollback** until step 10: point the zone back at the old account and lift the freeze. Nothing there changed.

## 8. Email everyone (once)

Sent at the end of the migration, once step 9's checks have passed, from `hello@livediagram.app` once that domain is onboarded:

- what changed: livediagram is part of liveworkspace, and sign-in is liveworkspace's, with the same email, by code
  or Google; nothing to do to keep their work;
- where their split documents went, as a short list of links built from `moved_parts`, for the people who had any;
- their API tokens still work until they expire, and are managed in liveworkspace's Settings now; their teams
  came across, managed in liveworkspace too;
- connected AI tools (MCP) keep working, but some may need reconnecting, especially when their token comes up for
  renewal: remove livediagram from the tool and add it again;
- Google Drive sync is paused for now, and how they'll know when it is back;
- the updated privacy page (Clerk is no longer a processor), and how to delete their account.

Cloudflare Email Service is for transactional mail and includes 3,000 a month, with a daily quota that starts low;
step 0's account count decides whether this goes in daily batches. A notice about someone's own account and data
is a service message, so it goes to everyone, unsubscribed or not.

## 9. Check

- Per account: documents, tabs per product, items, images, shares, teams and Timeline events on the new side match
  the old counts, written to a report per run.
- Nothing made on the new side before the switch changed: compare a count and checksum per table of rows not
  marked imported, before and after each run.
- Every split document opens in its product, and its parts link to each other.
- A sample of old URLs (documents, share links, embeds, forms, Community posts, help) answers the right page.
- Sign in as a few migrated accounts on staging: Google-only, by code, a team owner, someone who had already signed
  up on the new side, and a guest who comes back and then signs in.
- An old `lvd_` token answers on livediagram's api and MCP, a revoked or expired one doesn't, and an AI tool
  connected on the old site keeps working, then signs in again on its own after its token is made to lapse.
- A browser with an old guest id and old Local only documents (signed, unsigned, and holding Pages and Plan tabs)
  ends up with all its work, nothing dropped.

## 10. Clean up

After a set quiet period (30 days is a starting point):

- delete the users from Clerk and close the Clerk application;
- remove the Clerk passages from the old livediagram.app's privacy page (this repository has no Clerk code or
  copy: no `@clerk/react`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` or `CLERK_JWKS_URL`);
- export the old D1 and R2 one last time to cold storage for an agreed time, then delete them and the old
  account's Workers;
- archive the old livediagram.app repository;
- a later migration may drop livediagram's unread Plan tables.

## Tooling

Every step above is a command that can be rehearsed; the first run is a staging rehearsal (step 0). Four parts, one contract
(`packages/migration/src/contract.ts`):

**`@liveworkspace/migration`** (`packages/migration`): the contract, and the splitter, `splitOldDocument` and
`splitLocalDocument` (`src/split.ts`). Pure TypeScript with no product imports, so the tool, the Workers and the
editor share it; what it needs of a product (livediagram's stored-tab upgrades, a page's rectangle, an image's
owner, an id) is handed in. It classifies each tab and page (step 3), builds one `MigrationRoomPayload` per part,
freezes cross-product references into a picture slot and a link, recomputes card people for liveplanner (from
`input.people`; a person not in it keeps the old hash), and answers the `MovedParts` mapping and what it reports.
A liveplanner part may have no tabs (a plan with only cards and sheets).

**`@liveworkspace/migrate`** (`liveworkspace/apps/migrate`, runbook in its README): the Node command that runs
from a laptop. Nothing in it is deployed.

- `snapshot <export.sql> <snapshot.sqlite>`: loads a `wrangler d1 export` of the old database into a local SQLite file
  (`node:sqlite`) and refuses one whose last `d1_migrations` row isn't `OLD_SCHEMA_LEVEL`. Read-only toward the
  old account.
- `plan <snapshot> --clerk <users.csv> --accounts <existing-accounts.json> [--ledger <ledger.sqlite>]
[--oauth-kv <oauth-kv.json>] [--no-pictures] --out <bundle-dir>`: the whole migration as a
  bundle on disk: `manifest.json` (steps in apply order, the bundle id, the ledger generation it was planned
  against), `owner-map.json`, `sql/<db>/NNNN.sql` with `ledger/<db>/NNNN.jsonl` beside each chunk (accounts,
  index, media, community), `r2/images.json` (and `r2/pictures/` for drawn pictures), `rooms/rooms.jsonl`,
  `people/people.jsonl`, `kv/mcp-clients.json`, `moved-parts.json` and `report.json`. Deterministic: ids are
  name-based UUIDs, so the same snapshot and ledger make a byte-identical bundle. Tabs are upgraded with
  `@livediagram/document`'s `migrateStoredTabKeepingRetired` (every upgrade but the Pages and Plan drops). Each `CrossReference.picture` is
  drawn with liveplanner's renderer into a PNG and lands as a media image in the person's library. Export
  `existing-accounts.json` right before `plan`: a stale one can let a Clerk row clash with an account made since.
- `apply <bundle> --env staging|production --ledger <ledger.sqlite> [--dry-run] [--concurrency <n>]`: runs the steps in order (accounts, index, media and R2,
  the rooms through each app's migration door, livediagram's people (their shape libraries) through its person
  migration door, community, the MCP's KV), each command with only that side's credentials (it never passes the
  shell's `CLOUDFLARE_*` through), then records what it wrote in the ledger. A bundle planned against an older
  ledger generation is refused.
- `verify <bundle> --env … [--out <verify.json>]`: step 9's row counts, read back from each database (one
  wrangler call per 500 keys). It reads databases only, not the rooms.

What `plan` decides for you (all reported in `report.json`):

- **Onboarding emails**: every stage already due at the snapshot is stamped as sent, so the new lifecycle sweep
  doesn't send old accounts a welcome. New-side accounts with no old row keep their own series.
- **Settings**: a first run only fills keys the person doesn't have yet on the new side.
- **Share links**: each goes to the part holding its tab, else to the part that kept the old id. People it was
  shared with see every part; a part with no link of its own gets a generated one (`shared_with` needs a link).
  Codes that differ only in case are reported (the new side stores them upper case).
- **History**: Timeline events are written once, as `imp:<old id>`, each old kind under its index name (step 2).
  Kinds with no new equivalent are dropped and counted.
- **Shape libraries**: one `MigrationPersonPayload` per person who had any, sent to livediagram's person migration
  door. Added once and never updated: a library whose id the person already has is left as it is, and one whose
  name they already use takes the next free `(n)`.
- **Hidden from Recent**: each person's `recentExcludedIds` becomes `hidden` on their `opens` row for every part of
  each document it names.
- **Profiles and `legacy_guest`**: a `profile` row from each carried participant, and a `legacy_guest` row per old
  guest (step 6).
- **Tokens**: only live ones are copied; one revoked on the old site after an earlier run gets its `revokedAt`.

**Writing without overwriting.** Every SQL row is keyed by its old id. A first run inserts (`INSERT OR IGNORE`); a
catch-up run updates a row only where it still holds what the last run wrote
(`ON CONFLICT … DO UPDATE … WHERE <row>.updated_at = <the value in the ledger>`), so a row someone has changed on
the new side since is left alone and reported. Rows without a time of their own (favourites, image refs, liveplanner
cells and `sheet_refs`) are only ever inserted. Nothing is deleted. The ledger is a local SQLite file kept with the
bundles.

**The apps' migration door** (`@liveworkspace/index-app`'s `migration-door.ts`, wired in each app's api):
`PUT /api/internal/items/:id/migration` with a `MigrationRoomPayload`, behind `Bearer MIGRATION_KEY` (a new secret,
in each app's `.env.example`, set for the migration and removed after it; it opens no other door) or the app's
`INDEX_KEY` (the index's handoff, below); a plain 404 with neither set, 401 for a wrong key.

- The whole body is checked before anything is written: `v` 1, this app and this id, tab ids unique, at most
  32 MiB (413 `too_large`), each tab under `MAX_TAB_BYTES` (413 `tab_too_large` with `tabId`, `bytes` and `cap`;
  nothing is written).
- One transaction per item (`importMigrated`): the room with the times given, its changesets (authors kept as old
  owner ids), image owners and grants (their media rows are already in, since apply runs media first), and for
  liveplanner its card types, cards (keys kept), sheets, cells and form links. liveplanner keeps no image tables,
  so its parts' image owners and grants are dropped.
- `migration_tabs` keeps the revision it wrote per tab; a tab's first revision is the larger of 1 and its newest
  changeset's. On a re-run a tab is replaced only while the room still holds that revision; a tab deleted on the
  new side since counts as `edited` and is never re-created.
- Answers 200 `{ written, edited, meta }`, 400 for a body that isn't this app's payload, 503 when the write fails.
- The index item must exist first (the index SQL runs before the rooms, with summary `{"imported":"1"}`). The
  room's first summary push carries the item's old `savedAt` as its change time.

**The person migration door** (the same kit, livediagram's api only): `PUT /api/internal/people/:id/migration` with a
`MigrationPersonPayload` (`v` 1, the app, the person's new owner id, their shape libraries as the old rows held
them), behind `Bearer MIGRATION_KEY` alone; a plain 404 without it, or in an app that doesn't take one. The body is
checked whole first (at most 32 MiB, 413 `too_large`; 400 for anything else wrong), then the libraries join the
person's `PersonStore` as a guest's do when they sign in (`adoptShapeLibraries`): an id the store already holds is
left alone, a name already in use takes the next free `(n)`. Answers 200 `{ moved, renamed }`, 503 when the write
fails. The bundle lists the people in `people/people.jsonl`, one `people/<app>/<owner>.json` each.

**API tokens.** `packages/api-kit/src/api-token.ts` has `LEGACY_API_TOKEN_PREFIX` and `hasApiTokenPrefix`, and its
`isApiTokenFormat` takes `lvd_` beside `lwt_`. Every product's api-schema re-exports them, so the accounts Worker
(`src/tokens.ts`, `src/workbench/revoke.ts`, `src/workbench/routes.ts`), each app's `apps/api/src/index.ts` and
`auth/accounts.ts`, and each CLI accept a carried-over token. Nothing mints `lvd_`.

**Returning guests and Local only documents** (step 6):

- **Accounts**: the `legacy_guest` table (`migrations/0011_legacy_guest.sql`) and
  `POST /api/account/internal/legacy-guests/claim` `{ legacyId, signature | null, into }`, livediagram's client
  only, a plain 404 without `LEGACY_GUEST_ID_HMAC_SECRET` (the old site's `GUEST_ID_HMAC_SECRET`). The signature is
  checked before any row is read (403 `bad_signature`); an unsigned id is accepted only if first seen before
  `LEGACY_GUEST_SIGNING_LIVE_AT` (403 `signature_required`). It answers `{merged:false, reason:'unknown'}` with no
  row, `{merged:false, reason:'claimed'}` for one claimed by someone else, `{merged:true}` (also on a retry by the
  same person), 502 `merge_failed` when the index merge fails (nothing stamped), and 429 past 10 a minute per caller
  (`LEGACY_GUEST_LIMITER`).
- **Index**: `/internal/merge` with `legacy: true` lets the target be a guest; `person_app_merges` gains a `legacy`
  flag (`migrations/0006_person_app_merges_legacy.sql`), so each app's people merge is called with
  `{ into, legacy: true }`, and takes a guest as `into` only then. `POST /app/migration/handoff`: livediagram's key
  only, the person in `X-Index-Person` (an account or a guest); it makes the item (owner forced to the person, no
  team, 409 `item_exists` if the id is taken), calls the app's migration door with its `INDEX_KEY`, and deletes the
  item again with a 502 `migration_failed` if the app fails. 32 MiB and 60 a minute per person
  (`MIGRATION_LIMITER`).
- **livediagram's api**: `POST /api/legacy-guest/claim` forwards as the caller; a refusal that will never clear is a
  200 `{merged:false, reason}`, one that may clear is a 401, 429 or 503. `POST /api/migration/local-parts` takes the
  whole raw record (`LocalPartsRequest`, its id included), splits it with `splitLocalDocument`, and hands each part
  to the index; part ids are derived from the caller, the document id and the app, so a retry names the same items
  and a 409 `item_exists` counts as landed. Owner and team come from the caller; changesets, image owners and grants
  are dropped, so a browser can't forge them. 200 `{ parts, keep }`, or 502 `handoff_failed` with the parts that
  landed.
- **livediagram's editor**: the claim on `/new` and in the editor (not the Explorer), and the one-time pass over
  the Local only store: the version 3 upgrade sets each document's raw tabs aside in a `retired-parts` store before
  anything reads them, and **Move Them** sends each record and writes the answer's `keep` back.

**Measured** (2026-10-25, on a loaded laptop):

- `plan`: 10,000 documents in 10.4 s (1,000 of them split, with pictures), heap growth about 31 MB; every reader
  streams one document at a time. A picture takes 58 ms for 20 elements, 322 ms for 200.
- The door: a 200-tab, 40-element-per-tab item in 42 ms (43 ms on a re-run), a 1.96 MB tab in 10 ms. Budgets
  are kept in a test.
- The splitter: 5,000 elements over 20 pages in 114 ms.

**Known gaps and risks** (none blocks a rehearsal):

- **R2 copy speed**: one wrangler process per get and per put. At 50,000 images that is hours; if the rehearsal is
  slow, copy with an S3 client (rclone) under the same keys.
- **Picture time**: 10,000 pictures is roughly 10–50 minutes on one thread; worker threads would cut it.
- **Not carried**: tags and custom themes (livediagram has neither), and tabs shared between documents
  (`tab_shares`, a second pass not built). Invitations need an email after the switch.
- **Invitation reminders before the switch**: an imported pending invitation is on the accounts Worker's reminder
  sweep at once, while the old site still runs its own, so one that reaches a reminder age between the first run and
  the switch may hear that reminder from both.
- **A Community post** whose content moved to livedocuments or livedesign is skipped and reported.
- **Two images, one owner**: when a guest is folded into an account and both had the same bytes, only the first
  goes in (reported); places using the other show nothing.
- **Workshop Q&A voter hashes** aren't remapped; **an arrow pinned across a split tab** is left dangling.
- **An old-editor tab left open** during the editor's version 3 upgrade blocks the upgrade until it closes.
- **The handoff**: if the app's door times out after writing, the index deletes the item and the room is orphaned.
  Two claims of one guest at once can't both merge: the first holds the row while it merges
  (`claimingBy`, `claimingUntil`, accounts migration `0013_legacy_guest_claiming.sql`), and the second answers
  `claimed`.
- **Check on the first staging dry run**: wrangler's `--yes` and the shape of its `--json` output.

## Checked against the code (2026-10-25)

- **Old guest signing is on** in production and staging: the old site's `POST /api/guest-id` (stateless, writes
  nothing) answers with an `ownerSig` on both. So every guest since 2026-09-25 12:00 UTC has a signed id, and step
  6's door can prove possession for them.
- **`importCopy` doesn't fit the migration** (step 2): no changesets, times stamped as now, and it refuses a
  document with content. The migration has its own import door per product.
- **Team ids carry over** (step 1): plain UUIDs on both sides, the same two roles.
- **Tokens carry over** (step 1): the same SHA-256 lowercase hex of the whole token on both sides, the same six
  months, the same read-only flag; the old MCP's client registrations have the same KV key and shape as the new
  one's.
- **Guests and Local only documents** (step 6): the same origin (`www.livediagram.app`) and the same IndexedDB
  database (`livediagram-offline`, version 2) on both editors.

## Decided (owner, 2026-10-25)

- livediagram is the only source. The other apps may take work before the switch, and so may the new livediagram;
  none of it may be lost (rules, step 1's owner map, step 9's checks).
- Guests' documents are copied (step 6), Local only documents included.
- History is kept where it has a home (step 2).
- Teams are recreated in accounts (step 1).
- API tokens and AI tool connections are carried over (step 1).
- References that now cross products keep a picture and a link (step 3).
- One email, at the end of the migration (step 8).

## Open questions for the owner

1. **Order with liveworkspace.app's own move**: one switch for both domains, or livediagram.app first? (Later.)
2. **Quiet period** before step 10, and how long the cold export is kept. (Later.)
