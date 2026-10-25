# Moving livediagram's people and documents onto liveworkspace

The historical livediagram.app runs on the previous Cloudflare account, signs people in with Clerk, and keeps
everything in one D1 database (`livediagram`, 97 migrations), the `livediagram-images` R2 bucket and its
`DocumentRoom` objects. The new livediagram runs on the liveworkspace account (`851be7d244b76a6557bcbe6c4ded80f5`)
and started fresh: sign-in is liveworkspace's accounts Worker, each document's content is its own SQLite
`DocumentRoom`, where a document is and who may reach it is the index's, images are the media service's, and Plan,
Pages and the design pages have left for liveplanner, livedocuments and livedesign.

So this is a move out of Clerk and the old account, not into Clerk. It copies people and documents across, splits
each mixed document by product, tells everyone, then switches livediagram.app over.

Related: [migrating-from-clerk.md](../liveworkspace/docs/migrating-from-clerk.md),
[livediagram/plans/0002-liveworkspace-accounts.md](../livediagram/plans/0002-liveworkspace-accounts.md),
[stand-in-addresses.md](../livediagram/docs/specs/016-platform/stand-in-addresses.md),
[gateway.md](../liveworkspace/docs/gateway.md).

## Rules that hold throughout

- **The old account is the source, and stays untouched.** Every step reads it and writes only to the new account.
  Nothing on the old account is changed or deleted until step 10, so it is always the rollback.
- **Split from the raw rows, never through the new read path.** The new livediagram drops Pages and Plan on read
  (`dropRetiredPages`, `dropRetiredPlan` in `packages/document`) and saves the result the next time a tab is
  saved. A migration that read old tabs through livediagram's parser would lose every page and board. The
  splitter reads the stored JSON and the Plan tables itself.
- **Ids stay.** Accounts keep their Clerk ids (`user_…`), and every document keeps its id in the product that keeps
  most of it, so owners, links, embeds and bookmarks still resolve. Documents made by the split get new ids.
- **Every step can re-run.** Each writes by id with upsert semantics, so step 0's rehearsal, the full copy and the
  final catch-up are the same scripts.
- **Old livediagram is frozen** for code from step 0 (no more features on `~/Code/livediagram`), so the schema the
  scripts read doesn't move under them.

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
2. Carry over the per-person data that has a new home:
   - unsubscribes and email preferences (`email_lifecycle`) into the accounts Worker, **before** step 8 sends
     anything;
   - `user_preferences` into the shared settings (`packages/settings`);
   - `shape_libraries`, `custom_themes` and `placement_defaults` into each person's `PersonStore`.
3. Left behind, as already decided (0002): old `ld_` API tokens are revoked (only `lwt_` tokens work), teams are
   managed separately by the owner, workbench pairings and sessions are gone, profile pictures are not kept.
   Drive connections can't move (their tokens are sealed with the old `DRIVE_TOKEN_KEY` and the Google client
   changes), so each person reconnects. MCP clients and the CLI sign in again. Step 8's email says all of this.

## 2. Copy documents into livediagram

One script, per document, in batches:

1. Read the document's row, its tabs (`diagrams`, `diagram_tabs`, `tabs`) and their Plan rows from the old D1.
2. Hand the tabs to the splitter (step 3). What stays in livediagram is written into the document's new
   `DocumentRoom` through an import door (the `importCopy` RPC, or a migration-only route behind a secret that
   reuses it), with its `image_refs`, `tab_stats`, comments and actions (these live in the element JSON already).
3. Register the document with the index: owner, team, folder, tags, favourites, Trash state, recent opens
   (`document_opens`), and who it's shared with (`shared_with`, `share_links`, keeping each link's token so old
   share URLs still work).
4. Shared tabs (one tab in several documents, `tab-document-many-to-many.md`) become `tab_shares` rows once every
   document holding the tab has been copied, so run that as a second pass.

Decide per table whether it's history worth keeping: `timeline_events` and `agent_changesets` (the Timeline and
changeset log), `collab_threads` and `collab_actions` (a projection, rebuilt from the JSON), `change_log`,
`events` (telemetry, not migrated).

## 3. Split mixed documents by product

A livediagram document can hold tabs that now belong to four products. Each tab goes to one:

| Tab in the old document                                                     | Goes to       | As                   |
| --------------------------------------------------------------------------- | ------------- | -------------------- |
| Diagram, Draw, Workshop (Q&A boards and cards included)                     | livediagram   | the same document id |
| Pages: articles, slides, infographics (`opensIn` pages and its older names) | livedocuments | a new document       |
| Logo, wireframe and photo pages                                             | livedesign    | a new design         |
| Board, Sheet, Dashboard, Form tabs, with their items, sheet cells and forms | liveplanner   | a new project        |

- **One new document per product**, not per tab: a document with a diagram, two slide decks and a board becomes
  one livediagram document, one livedocuments document holding both decks, and one liveplanner project.
- **The same name**, owner, team, folder, tags and sharing on every part, so each person finds them where they
  expect. A document with no diagram tabs keeps its id in the product that got most of it, so its links land
  there.
- **A pointer from the original.** The livediagram part (or its link, if it has no diagram tabs) carries where
  the rest went, so an old link to a mixed document can say "its pages are in livedocuments" and link there. A
  `moved_parts` mapping (old document id → new ids per product) is written alongside, and drives that notice,
  step 8's per-person list and the router's redirects.
- **References that now cross products**: a slide's tab window onto a diagram tab, a chart anchored to a sheet,
  a diagram's link to a board. Each keeps its last picture or value and becomes a link to the other product's
  document; none stays live. List them in the rehearsal and look at real ones before deciding.
- **Plan data lives in tables, not tabs** (`items`, `sheets`, `sheet_cells`, `sheet_refs`, `plan_board_statuses`,
  `form_links`, `form_reports`, `form_reads`), so the liveplanner copy reads those by tab id. A form's public link
  keeps working: the old form URL redirects to liveplanner's.
- **A tab that is mostly a diagram but carried pages** (Pages kept a tab's ordinary elements on the canvas): the
  elements stay in livediagram, the pages and articles go to livedocuments.

Each product needs the same import door as step 2 (or its own `importCopy`), and its own writes to the index.

## 4. Images

1. Copy the bytes from the old `livediagram-images` bucket into the media service, owned by the same `user_` id
   (`liveworkspace/docs/media.md`).
2. Rewrite each tab's image references to the media ids, in every product a tab went to, and give a split part an
   `image_grants` row for each image it places that its owner didn't upload.
3. Previews and share cards are drawn fresh by the previews service; nothing is copied.

## 5. Community

Copy `community_posts`, their tags, likes, copies and open reports into the Community service
(`liveworkspace/docs/community.md`), pointing each post at the livediagram document, or at the part that now
holds what was posted. `apps/community` is the last livediagram app on Clerk; it moves with this.

## 6. Guests

Guests' work on the old site belongs to guest ids in that browser. Either copy guest-owned documents under the
same guest ids, so the new site's guest token and `POST /api/migrate` can still adopt them on sign-in, or leave
guests behind and say so on the old site before the switch. This needs a decision (below); copying is more work
but loses nobody's work.

## 7. The switch

1. **Rehearse** steps 1–6 end to end on staging, then run them on production while the old site is still live.
   Re-run to catch up as often as needed.
2. **Freeze** the old site: a read-only banner, writes answer 503, at a quiet hour.
3. **Final catch-up run** of steps 1–6 (only what changed since the last run, by `saved_at` and created times),
   then the checks in step 9.
4. **Move the `livediagram.app` zone** to the liveworkspace account and run "When livediagram.app moves" in
   [stand-in-addresses.md](../livediagram/docs/specs/016-platform/stand-in-addresses.md), and the email domain
   move in [email.md](../liveworkspace/docs/email.md). If liveworkspace.app moves at the same time, also
   [gateway.md](../liveworkspace/docs/gateway.md).
5. Point the Google clients' redirect URIs at the real hosts, and the MCP server's OAuth at liveworkspace sign-in.
6. **Rollback** until step 10: point the zone back at the old account and lift the freeze. Nothing there changed.

## 8. Email everyone (once)

Sent after the switch, from `hello@livediagram.app` once that domain is onboarded:

- what changed: livediagram is part of liveworkspace, and sign-in is liveworkspace's, with the same email, by code
  or Google; nothing to do to keep their work;
- where their split documents went, as a short list of links built from `moved_parts`, for the people who had any;
- what they must redo: API tokens (old ones stopped), MCP clients and the CLI (sign in again), Google Drive
  (reconnect), team owners (teams are set up in liveworkspace);
- the updated privacy page (Clerk is no longer a processor), and how to delete their account.

Points to settle: Cloudflare Email Service is for transactional mail and includes 3,000 a month, with a daily quota
that starts low; step 0's account count decides whether this goes in daily batches, and whether a service notice
this size belongs there. Respect step 1's unsubscribes only for what is marketing; a notice about someone's own
account and data is a service message. A short notice a week before, as well, would cost little and lower
surprise.

## 9. Check

- Per account: documents, tabs per product, items, images and shares on the new side match the old counts,
  written to a report per run.
- Every split document opens in its product, and its parts link to each other.
- A sample of old URLs (documents, share links, embeds, forms, Community posts, help) answers the right page.
- Sign in as a few migrated accounts on staging (Google-only, code, team owner, guest who signs in).

## 10. Clean up

After a set quiet period (30 days is a starting point):

- delete the users from Clerk and close the Clerk application;
- remove Clerk from the codebase (`@clerk/react`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_JWKS_URL`) and the
  "still uses Clerk" passages from liveworkspace's privacy page;
- export the old D1 and R2 one last time to cold storage for an agreed time, then delete them and the old
  account's Workers;
- archive `~/Code/livediagram` and finish the switch-over in [structure.md](structure.md);
- a later migration may drop livediagram's unread Plan tables.

## Open questions for the owner

1. **liveplanner, livedocuments and livedesign**: do any of them have people or documents of their own from before
   accounts moved, or is livediagram the only source?
2. **Guests** (step 6): copy their documents, or leave them behind with notice?
3. **History**: keep the Timeline and changeset log, or start them fresh?
4. **Teams**: 0002 says teams are managed separately. Is that still the plan with real team members on the old
   site, or should step 1 create them in accounts?
5. **Cross-product references** (step 3): is a static picture plus a link acceptable?
6. **Email**: one email after the switch, or a notice before as well? Cloudflare Email Service, or a broadcast tool
   for this one send?
7. **Order with liveworkspace.app's own move**: one switch for both domains, or livediagram.app first?
8. **Quiet period** before step 10, and how long the cold export is kept.
