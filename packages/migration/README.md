# @liveworkspace/migration

The shared contract of the move from the historical livediagram.app ([docs/migration.md](../../docs/migration.md),
"Tooling"): the payload each app's migration door takes, the moved-parts mapping, the browser's Local only handoff
and the legacy guest claim (`src/contract.ts`), and the splitter that turns one old document into its parts
(`src/split.ts`). Plain TypeScript with no product imports, used by the migrate tool, the apps' Workers and
livediagram's editor alike.

## The splitter

`splitOldDocument(input, hooks)` turns one old document (its row, tabs, Plan rows, changesets and image grants) into
one `MigrationRoomPayload` per app; `splitLocalDocument` does the same for a browser's Local only record, keeping
livediagram's tabs in the browser. `hasRetiredContent(tab)` says, without allocating, whether a raw tab holds any Pages
or Plan content. Everything product-specific comes through `SplitHooks`.

**Where each tab goes.** A Board, Sheet, Dashboard or Form tab, or any tab in Plan, goes to liveplanner. A tab in
Pages (`pages`, or its old names `illustrate` and `infographic`) goes to livedocuments when its pages are article,
slide or infographic pages (or have no kind, or there are none), and to livedesign when they are logo or wireframe (or
photo) pages. Everything else, and every event-storming board, stays in livediagram. A page of an unknown kind is read
as a documents page, with a note.

**A Pages tab with both kinds of page** is split by page. Each element goes with the page its centre is on (from
`hooks.pageRects`); an arrow goes with the element it is pinned to (or the arrow it sits on), else its ends'
midpoint; an element on no page, and every article margin note, goes with the documents half. Articles follow the
pages that show them, and an article no page shows stays with documents. Each half is laid out again by
`hooks.pageRects` (a half that lost the page carrying the row anchor takes it on its first page), and each element
moves by as much as its page did. The half with more pages keeps the tab's id (documents on a tie); the other gets
`newId('<doc>:<tab>:<app>')`.

**Parts.** One per app with content. livediagram keeps the old id when it has any tab; otherwise the app with most
tabs does (ties in `MIGRATION_APPS` order). The others get `newId('<doc>:<app>')`. Every part has the same name, owner
(`hooks.ownerOf`), team, times and source; the slide deck goes to livediagram (or livedesign). Changesets go with
their tab (a split tab's with the half that kept its id); one whose tab is gone goes to the part that kept the id.
`moved` is null when there is one part. Every tab body goes through `hooks.upgradeTab`, except livediagram's own tabs
on a Local only document, which stay raw for the editor's own read migrations.

**What an app doesn't read is settled before it is written.** livediagram's tabs lose `pages`, `articles` and
`pageOrientation`; every app but liveplanner loses `dashboard` and `form`; article margin notes leave every app but
livedocuments; livedocuments' and livedesign's tabs are written in `opensIn: 'pages'`. Each drop is a note.

**References that cross products are frozen.** A tab window onto a tab in another part (and every tab window in
livediagram, which has none now), and a Plan board, card, view or Sheet on a tab outside liveplanner, becomes a
**picture slot**: an image element with the same id, place, size, layer and rotation, `imageId: null` (which every
app draws as an image placeholder), and a link to where the content went. Its `CrossReference` carries `picture`, the
old tab (and element) to draw. The migrate tool draws it, uploads it to the media copy, sets `imageId` in that tab's
JSON by the element's id, and adds the image to the part's `imageOwners` before applying the payload. A chart reading
a sheet that is not in its part keeps its last read values (as livediagram's own read does), loses `chartSource` and
`sheetAnchor`, and links to the sheet's tab in liveplanner (a `chart-source` reference with no picture). Element and
table-cell links to tabs and elements now in another part, and links to this document from a part that didn't keep
its id, become address links (`hooks.partUrl`, else `PART_ORIGINS` with `#t=<tab>`) and `link` references. A link to
another document stays the app's own kind of link when `hooks.keptByOf` says that document is in the same app, and
becomes its address otherwise.

**Images.** A part's `imageOwners` are the images its tabs place (`elements[type=image].imageId` and
`pages[].background.fill.imageId`) that `hooks.imageOwner` knows. Its `imageGrants` are the old grants of those
images, plus one (at the document's creation time) for each it places whose media owner isn't the part's owner.

**Plan's rows** all go to the liveplanner part: every card (a document with cards and no Plan tab gets a liveplanner
part with no tabs, noted), and the sheets, cells and form links of its tabs. A sheet on any other tab is dropped with
a note (its frame became a picture). People on cards and sheets are stored as a hash of their owner id under
livediagram's prefix, and liveplanner hashes under its own (`liveplanner-item-person:`), so every person is
recomputed through the owner map, for the people `input.people` names and the owner. The splitter is synchronous, so
it carries a small SHA-256 of its own (`src/sha256.ts`, checked against `node:crypto`). A hash nobody named matches is
kept as it was, and counted in the notes.

**Local only.** A Local only record's `items` and `sheets` (optional on `LocalDocumentInput`, under the old offline
record's names) become the liveplanner part's plan; without them it has an empty one, noted. Every part gets a fresh
id, and the kept tabs keep the record's. Their picture slots stay placeholders unless the caller draws them.

**Cost.** Each body is parsed once and walked a fixed number of times, so the split is linear in its size
(`src/page-index.ts` finds an element's page through a grid, not by scanning every page). `src/split.perf.test.ts`
holds a tab of over 1 MB, of 5,000 elements over 20 mixed pages to a CPU budget.
