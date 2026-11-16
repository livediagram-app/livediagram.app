# Public roadmap blueprint

Derived from [public-roadmap.md](../public-roadmap.md) (Work Tracker 936): the roadmaps table, the managing routes,
the public read and vote, the vote field and its sort, the editor's Publish as Roadmap dialog and the public page.

## Domain and naming

| Spec term        | Identifier                                                                                   |
| ---------------- | -------------------------------------------------------------------------------------------- |
| public roadmap   | `PublishedRoadmap` (api-schema), row type `RoadmapRow`, table `roadmaps`                     |
| roadmap settings | `RoadmapSettings` `{ title, columns, types, fields, voting, formCode }`                      |
| roadmap link     | `roadmapPath(planId, code)` → `/roadmap/<plan id>/<code>`                                    |
| roadmap code     | `code`, `ROADMAP_CODE_PATTERN` `^lpr_[A-Za-z0-9_-]{22}$`, made by `newRoadmapCode()`         |
| roadmap fields   | `RoadmapField`, the allowlist `ROADMAP_FIELDS`                                               |
| upvote           | `withPublicVote(item, voter, up)` (items), voter id `publicVoterId(planId, browser)` (`rv:`) |
| the public page  | `PublicRoadmap`, `PublicRoadmapColumn`, `PublicRoadmapCard` (api-schema)                     |
| suggestion form  | `RoadmapForm` `{ code, heading, tabName, statuses }`; `formStatusesOf(form)`                 |
| Unpublish        | `unpublishRoadmap(env, planId, boardId)`                                                     |
| who may publish  | `roadmapOwner(ctx, projectId)` (api), `roadmapScopeFor(input)` (editor)                      |

## Files

- `packages/api-schema/src/roadmap.ts`: the constants and wire types above, `ROADMAP_ERRORS`.
- `packages/items/src/public-votes.ts`: `PUBLIC_VOTER_PREFIX` (`rv:`), `withPublicVote`, `hasPublicVote`.
- `packages/items/src/board-sort.ts`: `votes` joins `BOARD_SORT_BUILT_INS`; custom `votes` fields join
  `BOARD_SORT_KINDS`; both read `itemVoteTotal`.
- `apps/api/src/roadmap/roadmap-store.ts`: `ROADMAPS_SCHEMA`, `publishRoadmap`, `setRoadmapSettings`,
  `unpublishRoadmap`, `roadmapsOf`, `roadmapByCode`, `takeRoadmapVote`.
- `apps/api/src/roadmap/roadmap-code.ts`: `newRoadmapCode()`, `publicVoterId(planId, browser)`.
- `apps/api/src/roadmap/roadmap-boards.ts`: `roadmapBoardsOf(env, planId)`, `roadmapFormsOf(env, planId)`,
  `formStatusesOf(form)`, `boardOnTab(tab, boardId)`.
- `apps/api/src/roadmap/roadmap-view.ts` (pure): `onRoadmap(roadmap, setup, item, types)`, `publicRoadmapOf(input)`.
- `apps/api/src/roadmap/roadmap-public.ts` (in the room): `answerRoadmap(ctx, planId, code, rest)`: the read and the
  vote.
- `apps/api/src/routes/roadmap-routes.ts`: `handleRoadmapRoutes(ctx)`, dispatched from
  `project-subresource-routes.ts` after the calendar feed's.
- `apps/api/src/routes/roadmap-public-route.ts`: `handleRoadmaps(ctx)`, the worker's `roadmaps` case: the path's
  shape, then the room's `roadmap(planId, request)` RPC (`plan-room.ts`, `plan-client.ts`), which answers null-plan
  ids `404` without making a schema (`bindStoredPlan`).
- `apps/api/src/index.ts`: `/api/roadmaps` limited per network on `FORM_RATE_LIMITER` (`roadmap:` for votes,
  `roadmap-read:` for reads) and kept out of the per-owner write limit, as `/api/forms` is.
- `plan-schema.ts`: V32, `ROADMAPS_SCHEMA`.
- Editor `components/roadmap/`: `roadmap-client.ts` (the three managing calls), `roadmap-gate.ts`
  (`roadmapScopeFor`), `roadmap-defaults.ts` (`defaultRoadmapSettings`, `TRIAGE_NAMES`), `RoadmapContext.tsx`,
  `RoadmapHost.tsx` (the door; the dialog loads on first open), `RoadmapDialog.tsx`, `RoadmapSettingsForm.tsx`,
  `RoadmapMenuRow.tsx`.
- Editor public page: `app/roadmap/[slug]/page.tsx` (one placeholder), `lib/roadmap-path.ts`
  (`ROADMAP_PLACEHOLDER_PATH`, `isRoadmapPath`, `roadmapFromPath`, `roadmapUrlFor`), `lib/api/roadmaps-public.ts`,
  `components/roadmap/public/RoadmapPage.tsx`, `RoadmapColumn.tsx`, `RoadmapCard.tsx`, `lib/public-browser-id.ts`
  (shared with the form footer). `src/worker.ts` rewrites `/roadmap/*` onto the placeholder. `LIVE_ROUTE_SEGMENTS`
  gains `roadmap`.

## Data and persistence

```sql
CREATE TABLE IF NOT EXISTS roadmaps (
  plan_id     TEXT    NOT NULL REFERENCES plan (id) ON DELETE CASCADE,
  board_id    TEXT    NOT NULL,          -- the plan-board element id
  tab_id      TEXT    NOT NULL,          -- the tab the board was on when published
  code        TEXT    NOT NULL,          -- lpr_…, the link's code; kept plain (a public address)
  settings    TEXT    NOT NULL,          -- RoadmapSettings as JSON
  created_at  INTEGER NOT NULL,
  hour_start  INTEGER NOT NULL DEFAULT 0, -- the vote cap's window and count
  hour_count  INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (plan_id, board_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS roadmaps_code ON roadmaps (code);
```

- Classification: configuration only; no person is stored (votes live on the cards). Not copied with the plan, not
  in exports or the Drive file; purge drops it with the plan's storage. A plan schema step, append-only; a room
  migrates itself on first use (no D1 migration, nothing applied remotely).

## Behaviour and state

- `roadmapOwner`: `requireOwner` (401); the plan (`getProject`, 404); no `token`, no `workbench`; `grantOn` set with
  `shareCode === null`, `tabScope === null` and not `community`. Else 403 `roadmap_needs_owner`, logged
  `[roadmap] refused { reason }` (`not_in_person`, `no_owner_grant`).
- Settings check (`readSettings(raw, board, forms)`): `title` a string trimmed to 1..`ROADMAP_TITLE_MAX`; `columns`
  a non-empty list of distinct statuses of the board's columns; `types` a non-empty list of distinct ids among the
  types the board shows; `fields` distinct members of `ROADMAP_FIELDS`; `voting` a boolean; `formCode` null or a
  form `roadmapFormsOf` lists. Stored in the board's column order and the catalogue's type order. Else 400
  `roadmap_invalid`; a form landing in a chosen column: 400 `roadmap_suggestions_public`. The board must be
  publishable: found on a board tab, not `allCards`, not `archive`, with columns (else 400 `roadmap_invalid`).
- `PUT /roadmaps/:boardId`: no row: `publishRoadmap` (a fresh code), 201; a row: `setRoadmapSettings` (same code;
  `tab_id` refreshed), 200. Both answer `{ roadmap }`.
- `DELETE /roadmaps/:boardId`: the row deleted; 204 either way.
- `GET /roadmaps`: `{ roadmaps, boards, forms }`, roadmaps of boards that still exist only.
- Public read: the path `^/api/roadmaps/([A-Za-z0-9_-]{1,200})/(lpr_[A-Za-z0-9_-]{22})(/votes)?$` (else 404);
  `GET` for the read, `POST` for `/votes` (else 405); the room: `bindStoredPlan` (false: 404 `no_plan`), the plan row
  and not trashed (`getProject`; trashed or none: 404); `roadmapByCode` (404 `unknown_code`); the board on its tab
  (`boardOnTab`, publishable; else 404 `no_board`); then the view.
- `publicRoadmapOf`: for each chosen column in the board's order, the live cards (`!isArchived`, status not
  `trash`) with that status whose type is chosen and the board shows (`boardShowsType`), sorted by the board's
  `sortBy` (`sortCards`) else rank; `count` all of them, `cards` the first `ROADMAP_COLUMN_CARDS_MAX`. Each card is
  built field by field from the allowlist (`id`, `title` always; `votes` and `voted` with voting; each chosen field
  only when it has a value): never a spread of the item.
- Vote: body `{ card, browser, up, website }` (`card` 1..200, `browser` `ROADMAP_BROWSER_PATTERN`, `up` boolean; else
  400 `roadmap_vote_invalid`). Voting off: 404. `website` filled: 201 `{ votes: 0, voted: false }`, nothing written,
  logged `dropped`. The card must pass `onRoadmap` (else 404 `card_not_found`). `takeRoadmapVote` (500 an hour; else
  429 `roadmap_busy`). Then `writeItemsWithRetry` with `withPublicVote`: unchanged (already voted, or not voted and
  taking back): nothing written; full (500 voters, adding): 409 `roadmap_votes_full`, the hour's count given back. The
  write relays the card to every open editor (`relay`), keeps no history entry (as a tally keeps none), and the room
  notes the write (`noteWrite`) so the index hears of it. Answer 200 `{ votes, voted }`.
- `withPublicVote(item, voter, up)`: `up` and `voter` absent: votes `{ ...votes, [voter]: 1 }` unless
  `ITEM_VOTERS_MAX` voters already (`'full'`); `!up` and present: the voter removed; else `'same'`. A change raises
  `rev` by one and leaves `updatedAt`, `updatedBy` as they were (a vote is not an edit).
- `publicVoterId`: `rv:` + the first 24 hex of SHA-256(`<plan id>:<browser>`).

## Interfaces and contracts

- `GET /api/roadmaps/:planId/:code[?browser=]` 200 `PublicRoadmap`:
  `{ title, voting, suggestPath: '/form/<code>' | null, look: FormLook, columns: { name, count, cards }[] }`, a card
  `{ id, title, votes?, voted?, description?, number?, type?, labels?, start?, due? }` (`description` cut to
  `ROADMAP_DESCRIPTION_MAX`, `start`/`due` `YYYY-MM-DD` only, `labels` strings, `type` the type's name).
- `POST /api/roadmaps/:planId/:code/votes` 200 `RoadmapVoteResponse` `{ votes, voted }`.
- Refusals: JSON `{ error }`, one of `ROADMAP_ERRORS`: `roadmap_not_found`, `card_not_found`, `roadmap_vote_invalid`,
  `roadmap_busy`, `roadmap_votes_full`, `roadmap_needs_owner`, `roadmap_invalid`, `roadmap_suggestions_public`.
- Every public answer: `Cache-Control: no-store`, `X-Robots-Tag: noindex`, `Referrer-Policy: no-referrer`.
- Managing: `GET` 200 `RoadmapsResponse`; `PUT` body `RoadmapSettings` 201/200 `RoadmapResponse`; `DELETE` 204;
  another method 405; all `no-store`.

## Errors and edge cases

- An id nothing has written: the room answers 404 without making a schema.
- Board deleted, moved to another tab (a new element), or turned into All Cards or archive: 404 until published again.
- A chosen column renamed: its status is kept, so it still shows (by its new name); a column deleted: it is left out.
- A chosen type deleted: its cards' type no longer matches; nothing shows for it.
- A suggestion form deleted, suspended or now sending to a shown column: `suggestPath` null; the dialog lists the
  roadmap's form as gone.
- Two votes racing on one card: the write loop rereads and retries (`writeItemsWithRetry`), so neither is lost.

## Security and trust

- The allowlist is code, not configuration: `publicRoadmapOf` builds each card from named fields, and each field it
  may send has a test that it is absent when not chosen; people, comments, custom fields and the rest have a test
  that they are never in the body, however they are set on the card.
- The read never takes an Authorization header's identity into account (the room answers as no one), sets no cookie
  and logs no code or browser key.
- The browser key only marks this browser's own votes; the voter id is a salted hash, so a plan's votes do not link
  one browser across plans.
- Abuse: per-network limits (60 a minute each for reads and votes), 500 votes an hour a roadmap, the hidden field,
  500 voters a card. Guessing codes costs one indexed miss each and needs the plan id too.

## Performance and limits

- A read: the room's plan row, one roadmap row (indexed), one tab, the catalogue and the plan's items
  (`listItems`, as the calendar feed and Inbox push read them, bounded by the plan's item cap), then linear work over
  the cards. Body at the caps: 200 cards a column × at most `PLAN_COLUMNS_MAX` columns × about 1.3 KB.
- A vote: one row update for the cap, one item read and one guarded write.
- The editor's dialog and the public page's code each load on their own (`next/dynamic`, its own route bundle).

## Observability

- `[roadmap] refused { reason }` (`not_in_person`, `no_owner_grant`, `invalid`, `suggestions_public`),
  `[roadmap] manage { action }` (`published`, `changed`, `unpublished`), `[roadmap] read.missed { reason }`
  (`malformed`, `no_plan`, `unknown_code`, `no_board`), `[roadmap] vote { result }` (`added`, `removed`, `same`,
  `full`, `busy`, `dropped`).

## Constants and configuration

| Constant                   | Value | Why                                                     |
| -------------------------- | ----- | ------------------------------------------------------- |
| `ROADMAP_CODE_BYTES`       | 16    | 128 bits, 22 base64url characters                       |
| `ROADMAP_TITLE_MAX`        | 80    | A heading, as a form's                                  |
| `ROADMAP_COLUMN_CARDS_MAX` | 200   | Bounds the body; a roadmap column is a curated list     |
| `ROADMAP_DESCRIPTION_MAX`  | 1000  | A summary, not the whole card                           |
| `ROADMAP_VOTES_PER_HOUR`   | 500   | As a form's responses an hour (safe range 100..2000)    |
| `FORM_RATE_LIMITER`        | 60/m  | The forms binding's own window, keyed `roadmap(-read):` |

## Presentation and UX

- Dialog: `Dialog` size `md`, `phoneSheet`, the hero header with a signpost of three columns; a board `Select` when
  the tab holds several; Title (text field), Columns and Card Types (checkbox lists, each with its count shown),
  Fields (checkbox list), Voting (`SettingsToggleRow`), Suggest an Idea (`Select`, unpickable forms disabled with
  their reason); the note; footer: Publish Roadmap, or Copy Link, Open Roadmap and Unpublish (`ConfirmPopover`).
  Published: each change `PUT`s at once (optimistic, rolled back with "Couldn't save. Try again.").
- Public page: the form page's look (`formLookProps`, `FormCanvasLayer`); a header card (title, Suggest an Idea in
  the accent), columns at 300px on a row that scrolls sideways at `sm` and up, stacked below; each card a box with
  number, title, chips, dates, description clamped to three lines with Show More, and the vote button (▲ and the
  count, `aria-pressed`, the accent when voted). Skeleton, Not available, Error and empty column copy as the spec.

## Accessibility

- The vote button names its card: "Upvote {title}" / "Remove your upvote for {title}", `aria-pressed`, and the count
  in a polite live region. Columns are `section`s labelled by their names; cards are `article`s.
- Every control is a button or link, reachable by Tab, with the focus ring; the dialog's checkboxes are labelled.
- Text on the backdrop sits on white or dark boxes, so contrast holds in both appearances whatever the theme.

## Testing

- `packages/items` `public-votes.test.ts` (add, take back, same, full, rev, stamps kept) and `board-sort.test.ts`
  (Votes offered and sorted by total, custom Votes fields).
- `apps/api` `roadmap/roadmap-view.test.ts`: the allowlist: each optional field absent unless chosen; people
  (assignee, Person fields, makers, voters), comments and threads, custom fields, priority, estimate, checklist,
  attachments, parent and links, status and stamps never present; unchosen columns and types, archived and trashed
  cards left out; order, count and the cap; voting off leaves no votes.
- `routes/roadmap-routes.test.ts`: owner and team member publish, change (code kept), unpublish; editor, participant,
  viewer and tab links, tokens, workbench and community refused on every route with nothing changed; invalid bodies;
  a suggestion form landing in a shown column refused; 405.
- `routes/roadmap-public-route.test.ts`: the read (200, headers, `voted` by browser), unpublish revokes at once (the
  next read 404), republish makes a new code, unknown code and malformed paths 404, a trashed plan 404, a deleted
  board 404, the vote (add, take back, idempotent, card not on the roadmap 404, voting off 404, hidden field
  dropped, full 409, the hourly cap 429), 405, the per-network limit (index.ts).
- Editor: `roadmap-gate.test.ts`, `roadmap-defaults.test.ts`, `roadmap-client.test.ts`, `RoadmapDialog.test.tsx`,
  `roadmap-path.test.ts`, `roadmaps-public.test.ts`, `RoadmapPage.test.tsx`.

## Defaults ledger

D127 to D130 in [DEFAULTS.md](DEFAULTS.md).
