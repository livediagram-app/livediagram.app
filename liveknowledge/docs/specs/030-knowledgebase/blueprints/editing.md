# Editing blueprint

Derived from [Reading and editing a page](../editing.md), with [Verification](../verification.md) "Created and
Updated" and [Knowledgebases and pages](../knowledgebases-and-pages.md) "Share roles". A page opens to read; Edit opens
the page's one shared draft, a second article flow on the tab that the existing room ops sync, so co-editing, carets
and presence are the engine's own. Each section says what is built; "Not built" at the foot is the work left.

## The choice: a second flow, and the editor edits it through a lens

The engine edits an article by its flow id: the page names its flow (`Page.flow`), the writing's editor is mounted
per flow, the layout writes the page's height for its flow, the carets and holds name it, and every commit maps the
tabs and writes `articles[flow]`. Two ways were open.

- **Give the page a second page naming the draft flow while editing.** Rejected: the page's height, the reading
  column's clip, the zone settle and the right rail all follow the page, so the draft would grow a second page
  (or be clipped by the saved page's height) and every reader of `pagesOf` would see it.
- **A lens over the active tab (chosen).** While this editor is in edit mode on a page, the tab the editor works on
  (`activeTab`) is the page **as its draft**: the saved flow's key holds the draft's writing, the page's height is the
  draft's, and no `draft` key is there. Every commit and tick on that tab is lifted into the lens before its map runs
  and lowered back after it, so the map writes the saved flow's key and the lowering moves that writing into
  `articles.draft`. Nothing in the article engine knows a draft exists. Out of edit mode the lens is the page as it
  is saved, read only (`locked: true`), so the whole canvas engine reads the page as it reads a locked page: no caret,
  no toolbar, no slash menu, no drag handles, no element changes.

## Domain and naming

| Term                        | Identifier                                                                                                 |
| --------------------------- | ---------------------------------------------------------------------------------------------------------- |
| the draft flow              | `DRAFT_FLOW` (`'draft'`), `Tab.articles.draft` (`packages/document/src/page-draft.ts`)                     |
| the draft's record          | `Tab.draft: TabDraft` `{ by, at, height?, base }`, read by `draftOf(tab)`                                  |
| the saved flow              | the flow the page's sheet names: `savedFlowOf(tab)` (first page's `flow`, else the first non-draft flow)   |
| the saved writing           | `savedArticlesOf(tab)`: every flow but `DRAFT_FLOW`; `savedArticleOf(tab)`: the saved flow's writing       |
| the base                    | `TabDraft.base`: each saved block's fingerprint (`blockPrint`) when the draft was made                     |
| edit mode                   | this editor's `editingTabId === activeTab.id` (`useEditorDocument`), never stored                          |
| who is editing              | presence: a session's `editing` (a tab id), set by the `page-editing` presence op, read by `pageEditorsOf` |
| the lens                    | `pageEditLens(tab)` (edit mode) and `pageReadLens(tab)` (read mode), `apps/editor/lib/page-edit/lens.ts`   |
| lifting, lowering           | `liftTabs(ts, editing)`, `lowerTabs(real, lifted, mapped, editing)`                                        |
| making the draft            | `withDraftMade(tab, from, by, at)`: the first change in edit mode makes it, never Edit itself              |
| Save                        | `withDraftSaved(tab)`, then the `page-saved` presence op                                                   |
| Discard                     | `withDraftDiscarded(tab)`                                                                                  |
| differs from the saved page | `draftDiffers(tab)`                                                                                        |
| an agent changed the saved  | `savedMovedUnderDraft(tab)`: a saved block's print is not the base's                                       |
| the draft bar               | `PageEditBar` (`apps/editor/components/page-edit/PageEditBar.tsx`), in the top row before Share            |
| the note readers see        | `BeingEditedNote` in the meta row                                                                          |

"Unsaved changes" means `draftDiffers(tab)`. "Draft" never names a document, a tab or a kind.

## Behaviour and state

States of a page, per editor: **reading** and **editing**; per page in the knowledgebase: **no draft** and **draft**.

| Transition                             | Guard                                                                   | Effect                                                                                           |
| -------------------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| reading → editing (Edit)               | `can.editPage` (an Editor of the knowledgebase), the page loaded        | `editingTabId = tab`, `page-editing { tabId }` sent; undo history starts here (`markCheckpoint`) |
| first change while editing             | the page has no draft                                                   | the lowering makes the draft: `withDraftMade(real, viewAfter, by, now)`                          |
| any change while editing               | the draft exists                                                        | the lowering writes `articles.draft`, `draft.height`, `draft.by`/`at` (at most once a minute)    |
| Save (button, `Mod-S`)                 | editing, the writing flushed (`articleHandleOf(flow).flush()`)          | commit `withDraftSaved`; `page-saved` sent; editing → reading; history reset                     |
| Cancel, others editing                 | `othersEditing(tab) > 0`                                                | editing → reading; the draft stays                                                               |
| Cancel, last, no changes               | `!draftDiffers(tab)`                                                    | commit `withDraftDiscarded` when a draft exists; editing → reading                               |
| Cancel, last, changes                  | `draftDiffers(tab)`                                                     | asks "Discard your changes to this page?" (Discard Changes / Keep Editing)                       |
| Discard Changes                        | the question answered                                                   | commit `withDraftDiscarded`; editing → reading; history reset                                    |
| leaving (another page, close, offline) | none                                                                    | editing → reading (`page-editing { tabId: null }`); the draft stays                              |
| a peer's Save arrives                  | this editor editing that page                                           | stays editing; the lens now shows the new saved page; toast "<name> saved the page"              |
| a new page made here                   | made by this editor (New Page, Add Subpage, Describe to Set Up's first) | opens editing, the caret in its Title (`usePageTitleFocus`)                                      |
| daily upkeep                           | `draft.at` older than `DRAFT_KEEP_MS`                                   | the room writes `withDraftDiscarded` to the stored tab                                           |

- **One draft a page.** The draft is made by whoever changes the page first in edit mode; two editors changing it
  first at once both make it from the same saved blocks with the same block ids, so their `created` article frames
  merge block by block as any two writers' do.
- **Saving.** `withDraftSaved(tab)` writes the saved flow's blocks as `mergeDraftOverSaved(base, draft, saved)`: the
  draft's blocks in the draft's order, except a block the draft left as the base had it and the saved page has since
  changed (an agent's write) takes the saved page's version, and a block the saved page gained since the base (an
  agent's insert) is kept after the block it follows. With no agent write in between it is the draft. The page's
  name becomes the saved writing's Title (`pageNameFromTitle`, the same function the Title-to-name sync uses), and
  the draft and its record go. The page's height is the draft's.
- **Ordering.** Save is one commit, so the sync sends its consequences in order on the room's stream: the saved
  flow's block ops, the draft's `removed`, then a `tab-meta` patch (`name`, `pages`, `clear: ['draft']`). Every peer
  applies them as any frame; a peer in edit mode whose lens loses its draft shows the new saved page, which is the
  draft it was writing, and its next change makes a fresh draft. A peer's writing still waiting on its idle commit
  when the save lands commits into that fresh draft.
- **Title.** Out of edit mode the Title is the saved page's; in edit mode it is the draft's, and the page's name does
  not follow it (`usePageNameFromTitle` and the live tree title stand down) until Save.
- **Undo** works inside the editing session: Edit marks the history, Save and Discard reset it, so undo never
  reaches behind the session or undoes a save. Undo is off while reading (the lens is locked).
- **Read mode for everyone.** The read lens hides the draft, so a reader, an Editor reading and a Viewer draw the same
  saved page. The room never sends a Viewer or a link visitor the draft (Security and trust).

## Interfaces and contracts

| Function                                                   | Input                                  | Output                                                                                                                                                   |
| ---------------------------------------------------------- | -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `draftOf(tab)`                                             | any tab                                | `{ flow, record }` or null; null when either half is missing or unreadable                                                                               |
| `parseTabDraft(v)`                                         | unknown                                | `TabDraft` or undefined: `by` a string (cut to 80), `at` a finite number, `height` a positive px, `base` an id→print map of at most `MAX_ARTICLE_BLOCKS` |
| `savedArticlesOf(tab)`                                     | any tab                                | `articlesOf(tab)` without `DRAFT_FLOW`, the same object while `articles` is                                                                              |
| `withoutDraft(tab)`                                        | a stored tab                           | the tab with neither `articles.draft` nor `draft`; the same tab when it has none                                                                         |
| `withDraftMade(tab, writing, by, at)`                      | the real tab, the lens's saved writing | the tab with the draft and its record (`base` from the saved flow)                                                                                       |
| `withDraftSaved(tab)`                                      | a tab                                  | the saved tab; the same tab with no draft                                                                                                                |
| `withDraftDiscarded(tab)`                                  | a tab                                  | the tab without the draft; the same tab with none                                                                                                        |
| `draftDiffers(tab)`, `savedMovedUnderDraft(tab)`           | a tab                                  | boolean                                                                                                                                                  |
| `mergeDraftOverSaved(base, draft, saved)`                  | prints, two flows                      | the flow Save writes                                                                                                                                     |
| `pageEditLens(tab)`, `pageReadLens(tab)`                   | a real tab                             | the lens; one object per real tab (cached), so a commit that changes nothing returns the real tab                                                        |
| `liftTabs(ts, id)`, `lowerTabs(real, lifted, mapped, ctx)` | tabs                                   | the lens list; the real list, the same array when nothing changed                                                                                        |

Room frames (`packages/api-schema/src/room-messages.ts`, presence: never ordered, never logged):

- `{ kind: 'page-editing', tabId: string | null }`: the sender is editing that page, or none. The room keeps it on the
  session's presence (`editing`, clamped to `MAX_TAB_ID_LEN`) and sends the roster again; never relayed as sent.
  Dropped from a session whose role is not `edit`.
- `{ kind: 'page-saved', tabId: string }`: the sender just saved that page. Relayed to the others; a receiver shows
  "<name> saved the page" with the sender's roster name. Dropped from a session whose role is not `edit`.

## Data and persistence

- `Tab.articles.draft` (an `ArticleFlow`) and `Tab.draft` (`TabDraft`) are stored in the tab's body, synced as an
  `article` frame and a `tab-meta` patch, kept in snapshots and versions as the body is. No schema step: the body is
  JSON. Nothing else is stored; who is editing is presence.
- `TabDraft.base` is written once, with the draft; `by` and `at` move with the draft's changes, at most once a
  minute (`DRAFT_TOUCH_MS`), so a typing stream sends no record. `height` follows the draft's layout.
- **The saved writing is what is stored outside `articles.draft`.** Every reader of a page's writing reads
  `savedArticlesOf` (Security and trust lists them).
- **Created and Updated** (`page_authors`): a whole-tab save notes the writer only when the saved writing or the name
  changed (`savedWritingChanged(before, after)`, `apps/api/src/knowledge/page-authors.ts`), so a draft's autosaves
  move nothing and the save that publishes it moves "updated" to the person who pressed Save (their editor wrote it).
  "Changed since verified" is worked out from the saved writing on each read, so Save moves it.
- **Upkeep:** `maintain` (document-room-content.ts) reads the tabs whose `$.draft.at` is older than `DRAFT_KEEP_MS`
  and writes each through `withDraftDiscarded`, at its revision.
- **Offline:** an Offline knowledgebase stores its tabs in this browser; the draft is the same two fields in that
  copy, so Edit, Save and Cancel work with no room, and nobody else edits it.

## Errors and edge cases

- **A draft with no record, or a record with no draft** (a half-written save from an old editor): `draftOf` answers
  null; the next change in edit mode makes a draft whole, and Save or Discard drops both halves.
- **The saved flow missing** (an empty tab): there is nothing to edit; the lens is the tab, and the first change
  makes the page's article as today.
- **A peer saves while this editor's writing waits to commit:** the commit lowers into a fresh draft made from the new
  saved page, so the keystrokes are kept, as a change on the new saved page.
- **Two people press Save together:** the first commit's frames remove the draft; the second editor's Save finds no
  draft (`withDraftSaved` answers the same tab) and only leaves edit mode.
- **Cancel by the last editor while a peer's join is in flight:** the count is read from the roster at the press;
  a peer who arrives after the discard finds the saved page, as if nobody had edited.
- **A Participant's or a Viewer's draft frames** are dropped by the room's role gate, as their writing frames are.
- **An agent writes the saved page under a draft:** `savedMovedUnderDraft` shows "An agent changed the saved page"
  in the draft bar, with the count of blocks it changed in its hover card; Save merges as above.
- **A version restored** writes the stored body as it was, draft included: a restore under an open draft brings back
  that version's draft, or none.

## Security and trust

- **The room never sends the draft to a session that cannot edit.** `frameFor` (document-room-sockets.ts) answers, for
  a socket whose role is not `edit`: no `article` frame of `DRAFT_FLOW`; a `tab-meta` patch without `draft` (none at
  all when nothing else is left), with `clear` keeping `draft` (clearing a field nobody has costs nothing); a whole
  `tab` without either half (`withoutDraft`). The catch-up replay filters the same way. A Viewer and a link visitor
  read the tab GET without either half.
- **Tokens and agents** read every tab without the draft: the tab GET for a token, document views, `read_page`, the
  MCP's reads and the CLI's go through `withoutDraft` / `savedArticlesOf`. An agent's article write names the saved
  flow and never `DRAFT_FLOW` (`article_not_found` for it).
- **The index** (`pageBlocks`), Ask's sources, the backlink and link tables, reading time, On This Page, hover cards,
  exports, the Explorer preview and the emails read `savedArticlesOf`.
- **Who may edit:** an Editor of the knowledgebase (`can.editPage`), on the client and again in the room (the role
  gate drops a non-Editor's `article`, `tab-meta`, `page-editing` and `page-saved`). A Participant reads, as
  [Knowledgebases and pages](../knowledgebases-and-pages.md) "Share roles" has it: writing on a page is an Editor's.

## Performance and limits

- **Reading adds nothing per keystroke**: a reader types nothing; the read lens is made once per stored tab (cached by
  the tab object) and filters nothing but the `draft` key.
- **Editing**: each commit lifts and lowers the one edited tab: two object spreads, no walk of the writing. The
  draft's fingerprints (`blockPrint`, FNV-1a over the block's JSON) are taken once, when the draft is made, and again
  only when the saved flow's object changes (an agent's write), memoised by that object.
- **Entering edit mode** writes nothing and lays nothing out again: the lens's writing is the same object as the saved
  flow's until the first change. Measured on a 5,000 word page (blueprint "Testing", `page-draft.perf.test.ts`).
- **Save** is one commit: one merge pass over the blocks (linear), one diff the sync already makes. Measured there.
- Limits: the draft is an article flow under the article's caps (`MAX_ARTICLE_BLOCKS`, `MAX_ARTICLE_BLOCK_TEXT`); the
  tab byte cap counts both flows, so a page at the cap has half the room while a draft is open (the cap is far above
  any page: 100,000 characters is about 120 KB a flow).

## Presentation and UX

- **Read mode**: the top row's left is empty (no formatting bar). At its right, before Page Info and Share: **Edit**
  (`Button` primary, `sm`, the pencil glyph, `HoverCard` "Edit / Change this page with anyone else editing it. E"),
  for an Editor only. Nothing else changes on the page.
- **Being edited**: in the meta row, after the other items, a quiet line: up to three discs (the editors' colours and
  initials, `TabPresenceStack`'s look) and "Being edited by Priya", "by Priya and Sam", "by Priya and 2 others". Shown
  to everyone not editing, Editors included.
- **The draft bar** (edit mode), in Edit's place, one quiet row of the top row's height: the discs of the others
  editing (none when alone), then the status in `text-slate-500`: nothing when the draft is the saved page;
  "Unsaved changes" once it differs; "Unsaved changes from Priya, 2 hours ago" when this editing session opened onto a
  draft someone left (`by` is not this person, or `at` is before Edit); "An agent changed the saved page" in amber,
  with a `HoverCard` of what changed ("3 blocks changed. Saving keeps your changes and theirs."). Then **Cancel**
  (`Button` ghost) and **Save** (`Button` primary, `HoverCard` "Save / Publish this draft for everyone. Ctrl+S" with
  the platform's modifier). On a phone the status shortens to a dot and the buttons keep their words.
- **The question** is the shared confirm dialog, centred: title "Discard your changes to this page?", message
  "Nobody else is editing it, so your changes go for good.", **Discard Changes** and **Keep Editing**.
- **Toasts**: "<name> saved the page" (info) to everyone else editing it; "Page saved" to the saver.
- **Keys**: `E` while reading (not in a field, no modifier) is Edit; `Mod-S` while editing is Save (and never the
  browser's Save Page); `Escape` while editing with the caret not in a menu or dialog is Cancel.

## Accessibility

- Edit, Cancel and Save are buttons with their words; the status is a polite live region; the discs carry their
  names as the group's label ("Also editing: Priya, Sam"). The question is the shared dialog (focus trap, Escape is
  Keep Editing). The keys are announced in the hover cards.

## Observability

- `debugLog('[page-edit] ...')` at entering, making the draft, saving, cancelling, discarding, a peer's save and a
  lowering that kept a peer's late writing. The room logs `[room] draft withheld` once per frame kind it filters for
  a Viewer (counted, never the writing), and `[upkeep] drafts dropped { count }`.
- Telemetry: `Page` `Opened` `Edit`, `Page` `Saved` `Draft`, `Page` `Discarded` `Draft` (one-liners in the handlers).

## Testing

| Rule                                                                                                                 | Test                                                                                     |
| -------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| the draft's helpers, merge, prints, upkeep cut-off                                                                   | `packages/document/src/page-draft.test.ts`                                               |
| entering edit and Save on a 5,000 word page under budget                                                             | `packages/document/src/page-draft.perf.test.ts`                                          |
| lift and lower: the draft written, the saved flow untouched, no-op identity, a peer's save                           | `apps/editor/lib/page-edit/lens.test.ts`                                                 |
| the mode switch, the bar's states, Cancel's three cases, Mod-S                                                       | `apps/editor/components/page-edit/PageEditBar.test.tsx`, `usePageEditing.test.tsx`       |
| role gate: Editor edits, Participant and Viewer and a link read                                                      | `apps/editor/lib/page-edit/page-edit-roles.test.ts`, `apps/api/src/room-op-gate.test.ts` |
| the room withholds the draft from a Viewer                                                                           | `apps/api/src/room-draft-filter.test.ts`                                                 |
| the draft never reaches the index, agent reads or the tab GET of a Viewer or token                                   | `apps/api/src/knowledge/page-draft-reads.test.ts`                                        |
| Created and Updated move on Save only                                                                                | `apps/api/src/routes/tab-put-route.test.ts`                                              |
| upkeep drops a 30 day old draft                                                                                      | `apps/api/src/document-room/draft-upkeep.test.ts`                                        |
| two contexts co-edit one draft, a third reads the saved page, Save publishes, Cancel/Discard, reload keeps the draft | `apps/editor/e2e/signed-in/page-editing.spec.ts`                                         |

## Constants and configuration

| Constant         | Value         | Why                                                                   |
| ---------------- | ------------- | --------------------------------------------------------------------- |
| `DRAFT_FLOW`     | `'draft'`     | an article id (`isArticleId`), never a generated flow id (`art-N`)    |
| `DRAFT_KEEP_MS`  | 30 days       | the spec's "untouched for 30 days"                                    |
| `DRAFT_TOUCH_MS` | 60,000 ms     | how stale `at` may be: "2 hours ago" never needs better than a minute |
| `DRAFT_BY_MAX`   | 80 characters | a person's display name, as presence cuts it                          |

## Defaults ledger

Rows D8 to D12 in [DEFAULTS.md](DEFAULTS.md).

## Not built

- **Objects placed in the writing** (pictures, charts, drawings, embeds) are the tab's elements, shared by the saved
  page and the draft: placing, moving or removing one in edit mode changes it for readers at once. Drafting them
  means copying a zone's elements into the draft and swapping them on Save (zone membership is by position,
  `zoneCanvasRect`). The writing around them is drafted.
- **Version history records draft autosaves too**: the idle version trigger (versions/version-schema.ts) compares
  revisions, not the saved writing. Keeping saves only means a schema step that rewrites the trigger's `WHEN` to
  compare the body without `$.articles.draft` and `$.draft`.
- **"An agent changed the saved page" names the blocks, not the change** ("3 blocks changed"); a diff view is not
  built.
