# History

An item's own record of what happened to it, shown by **History** on its menu in the shared Explorer. liveworkspace's
index keeps a short-lived log of events for every app; livedocuments reports who edited which document, and the dialog is
rendered through [`@liveworkspace/explorer`](../../../../packages/explorer/README.md)
(`packages/explorer/src/library/HistoryDialog.tsx`). The call and its types are in
[one-explorer-contracts.md](../../../../liveworkspace/docs/specs/004-index/one-explorer-contracts.md).

**Retired (November 2026).** The Explorer's Timeline (its sidebar row and `/explorer/timeline` view, the Cards and
Calendar modes, its filters, New marks and count, Remove from Timeline, the Upcoming band and the share-link expiry
warning), Home's What Happened and a team's Team Activity are gone: 11 Timeline interactions in 30 days out of
47,236 events. An old `/explorer/timeline` address opens Home. History stays, and is the one place the event log
shows.

## 1. What is recorded

The index records what it changes itself, in the same batch as the change: a document made (`created`, with `source`
`ai` for an MCP create and `import` for a CLI one, or `copiedFrom` for a copy), `renamed`, `moved`, `trashed`,
`restored`, `shared` (a share link made, with its level), `unshared` and `favourited`.

livedocuments reports `edited`. The document's room records the editor of every save made through an HTTP route that
carries an identity (`document-room.ts`, `recordItemEditor` from `@liveworkspace/index-app`): one outbox row per person, replaced on each
save, so a burst of saves is one row. The outbox drains them with the document's other index reports, up to
`APP_EVENTS_MAX` a batch, as `PUT /app/items/:id/events`. The index keeps one `edited` event per person, document and
UTC day, moving its time forward, and records a use day for that person, so editing a document counts toward Most Used.
The create (`POST /api/documents`) is not an edit: the index records the making as `created`, and whether making it is
a use is the create's `markUsed` ([Marking a document used](../015-api/api.md#marking-a-document-used)).
Writes from a WebSocket participant carry no account and are not attributed.

How long the index keeps an event is the index's
([one-explorer-contracts.md](../../../../liveworkspace/docs/specs/004-index/one-explorer-contracts.md)).

## 2. Who sees it

History is on the menu of a document the person reaches directly: one in their own space, or a team's document for a
team they belong to (including what happened before they joined). A document reached through a share link has no
History, and the index refuses the read. The index keeps no names: an entry says "You" for the reader's own doing,
the name an app reported, or "a teammate".

## 3. The dialog

History is a dialog rather than a page, because "what happened to this?" is asked while looking at the row. Every
app's Explorer, the liveworkspace.app Explorer and the editors' Explorer panel open the same one. It reads one page
at a time with `itemHistory(itemId, { limit, cursor })`.

- **Whose history.** The header is the [dialog hero
  header](../../../../liveworkspace/docs/specs/004-index/dialog-hero-header.md): the item's name as the dialog's
  heading, and its one line "History", its app's mark (`AppMark`, never a coloured dot) with its kind word, and its
  owner ("You", the team, or the owner's name). Its art is an item's record over time: the baseline grid fading toward the title, a clock
  rising in the bottom left with an arrow turning back over it, and in the bottom right a timeline of versions, a
  dashed arrow arching back from the newest to the one restored, in the accent, its ring spreading twice; a clock
  turning back is its mark, in place of the item's thumbnail (the row it opened from shows that).
- **At a glance.** A strip under the header: how many events are loaded ("30+" while older ones remain), how many
  people took part (their avatars, up to three), when it was made and when it last changed.
- **Filter.** One chip per kind of event present in what is loaded (Edits, Renames, Sharing, Organisation,
  Comments, ...), with **All** first; shown only when two or more kinds are present. One chip at a time, each a
  toggle button (`aria-pressed`). With nothing matching, the list says so and offers Show older events and Show all.
- **The rail.** Events newest first on a vertical rail, one ordered list per day under a sticky day heading:
  **Today**, **Yesterday**, the weekday within the last week, then the date ("Tue, 5 Aug", with its year when not
  this year's). Each heading and time is a `<time datetime>`.
- **An event.** Its kind's glyph in a disc on the rail, in its tone (red for the Trash, amber for renamed, moved and
  sharing, green for made and edited), always with the reason line in words ("Document Renamed"), so colour is never
  the only signal. Then who did it (an avatar with their initials, in a stable colour from the presence palette,
  and their name or "You"), the detail ("Was “Q3”", "To Launches", "Anyone with the link can edit"), a comment's or
  action's words quoted beneath, and the time.
- **Runs.** Consecutive events of one kind by one person on one day fold into one entry ("Renamed 3 times · You ·
  13:47–14:00"); **Show all 3** (`aria-expanded`) deals the run out beneath it.
- **Paging.** Pages of 30 (`HISTORY_PAGE`). **Show older events** under the rail reads the next page and says how
  many are shown; the button is gone at the end of the history. No other request is made: people's names come from
  the Explorer's shared people store, the one that names the Owner column, gathered into one batch and cached.
- **States.** Loading: a rail-shaped skeleton (`aria-busy`). Nothing yet: the shared empty state. A failed first
  read says so with **Try again**, never "nothing has happened"; a failed later page keeps what is shown and
  offers Try again beside the button.
- **Fit.** A centred panel up to 36 rem wide on a desktop, its body scrolling under the fixed header; edge to edge
  and full height on a phone. Light and dark. Hover transitions are `duration-micro`; a run dealt out fades in, not
  under reduced motion. Escape closes and focus returns to the menu's row.
- **Speed.** The dialog's code loads when it is first opened. The days, runs, chips and summary are worked out once
  per loaded page and filter (memoised); 1,000 loaded events group in well under a frame (a test keeps a budget).

## 4. Webhooks and the Audit Log

**Webhooks** sits on the same menu, after History, for a signed-in account who can edit the whole document (its owner,
its team's people, or an Editor link to every tab; never a guest, a Viewer, a Participant or a one-tab Editor). It
opens the shared Webhooks dialog, "Webhooks for “<document>”", whose webhooks report on this document alone and say so;
each of the person's other documents has its own (up to 10). Each one picks where it posts, what it sends in the
document's own words, and Who Did It (Anyone or Only Me). The index checks the role on every call
([webhooks.md](../../../../liveworkspace/docs/specs/004-index/webhooks.md)).

A team's view carries, for the team's admins alone, the team's **Audit Log** under its library, closed until
opened, with filters by person, kind and date, Show More and Export CSV. It is the platform's, specified in
[team-audit-log.md "The Audit Log on a team's view"](../../../../liveworkspace/docs/specs/004-index/team-audit-log.md#the-audit-log-on-a-teams-view).

An API token's expiry warning is the liveworkspace account's, sent by email
([liveworkspace/docs/specs/003-accounts/accounts.md](../../../../liveworkspace/docs/specs/003-accounts/accounts.md)).

## 5. Telemetry

History sends none of its own. The Timeline's events (`Timeline·Changed`, `Timeline·Selected`, `Timeline·Loaded`,
`Timeline·Opened`, `Timeline·Removed`) and Home's What Happened ones are no longer sent; the telemetry page lists
them as retired, so older rows still read ([telemetry.md](../017-telemetry/telemetry.md)).
