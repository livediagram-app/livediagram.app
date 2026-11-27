# Blueprint: Comments on the Writing

Derived from [Comments on a page](../page-comments.md) "Comments on the writing" (Work Tracker 1484), with
[Article pages](../../007-editor/article-pages.md) "Comments and actions" and [Assigned actions](../../012-collaboration/assigned-actions.md).
A comment or an action on some words is the existing **margin note**: a `note` mark on the words and an
`article-note` element beside them whose `commentThread` and `action` are the platform's element thread and action.
This blueprint adds the read-mode door, detached notes, the Comments list, the due day and the MCP anchor; it adds no
storage, route or room op.

## Domain and naming

| Term                      | Identifier                                                                                                                                         |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| note                      | an `article-note` element (`ArticleNoteElement`) and the `note` mark naming it (`ArticleRun.note`)                                                 |
| anchor, the note's words  | the runs carrying its mark: `noteAnchorTexts(articles)` (`@liveknowledge/document` `article-note-anchors.ts`)                                      |
| holds a conversation      | `noteHoldsConversation(el)`: at least one comment, or an action                                                                                    |
| detached                  | a note element no writing of the tab marks: `detachedNoteIds(tab)`; derived, never stored                                                          |
| reading selection bar     | `ReadingNoteBar` (`apps/editor/components/page-notes/`)                                                                                            |
| a note made while reading | `ArticlesView.addReadingNote(flow, kind)` (`hooks/editor/useArticles.ts`)                                                                          |
| the menu's note rows      | `SelectionMenuActions.comment`, `.addAction`, fed by `setSelectionNoteEntry` (`@liveworkspace/workbench` `selection-menu/selection-note-entry.ts`) |
| the list's card           | `PageNoteCard`, from `pageNotesOf(tab)` (`apps/editor/lib/page-notes/page-notes.ts`)                                                               |
| the notes' look           | `noteMarkStyles(tab)`, drawn by `PageNotesLook`                                                                                                    |
| due day                   | `ElementAction.due` (`'YYYY-MM-DD'`), worded by `actionDueWords` (`@liveworkspace/index-client/action-due`)                                        |
| anchor on the wire        | `DocumentCommentThread.anchor`: `CommentThreadAnchor` = `{ text } \| { detached: true }`                                                           |

## Behaviour and state

- **Reading, words picked** (`readingPick`): inside one `.article-flow[data-readonly]` (the writing's view while
  read), not starting or ending in `h1` (the Title) or `table`. Otherwise no bar, no keys, no rows.
- **Bar shown**: a non-touch `pointerup` with a reading pick, next frame. Hidden on: the selection leaving
  (`selectionchange` with no pick), a `pointerdown` outside the bar, Escape, a scroll or resize that leaves the words
  off screen (else it follows them), a press of either button.
- **Keys**: `noteKeyOf` reads `KeyM` (comment) and `KeyA` (action) with Alt and the platform's modifier (Meta on an
  Apple device, Ctrl elsewhere), no Shift, by `code`.
- **Menu rows**: `bindSelectionMenu` opens the menu where `canSendHere() || canNoteHere(view.dom)`; the rows'
  verbs pick the words again (`restore`) then call the entry. The sends are null where the session cannot send.
- **addReadingNote**: refused for `!canEdit` and for `articleLocked(activeTab, flow)` (a locked page); the lens's own
  `locked: true` is not a refusal. `markNote` takes the browser's selection when the view's own is empty
  (`domPicked`), adds the mark, the host commits the flow's blocks and the marker in one `commitTabs` over the real
  tab (no edit lens while reading, so it writes the saved flow), then `openNote(id, kind)`.
- **Abandoned**: the note `addReadingNote` put is watched through `openNoteId` (the Assign dialog's note, else the
  open thread's). Once it has opened and closed again holding nothing (`noteHoldsConversation` false),
  `withAbandonedNoteDropped` takes its mark and its marker off in one `commitTabs`. Once per note.
- **Text deleted**: `useArticleIntake` and `write_article` (`article-write.ts`) call `withEmptyNoteMarkersRemoved`:
  only notes holding nothing lose their marker. Save keeps markers as before; Discard still drops the notes only the
  draft marked (`withDraftDiscarded`, unchanged).
- **Restore**: `restoredTab` ends with `withHeldNotesKept(next, stored)`.
- **Closed**: `isOpenAction(action)` false, or `commentThread.resolved`.

## Interfaces and contracts

- `@liveknowledge/document`: `noteHoldsConversation`, `withEmptyNoteMarkersRemoved`, `detachedNoteIds`,
  `noteAnchorTexts` (`NOTE_ANCHOR_MAX` 280), `articlesWithoutNoteMarks` (runs joined again with `normaliseRuns`),
  `withHeldNotesKept`. Pure; the same object back when nothing changes.
- api: `savedPageChanged` compares the saved writing without note marks and the elements without `article-note`
  markers, only after the plain comparison says they differ. `threadsOfTab` adds `anchor` to an `article-note`
  thread: `{ text }` from `savedArticlesOf(tab)`, `{ detached: true }` when no writing marks it, none when only the
  draft does. The index push (`document-outbox.ts`) titles a note's thread and action rows by their words through
  `withNoteQuotes` (`document-room/note-row-labels.ts`), parsing the saved writing only when a row is a note's.
- editor: the page scroller's press-off-the-writing release (`read-selection.ts`) skips a press from outside the
  scroller, which reaches it only through a React portal, so the bar's buttons keep the words they act on.
- agent-verbs: `ListedCanvasThread.anchor`, described in `list_threads`' output schema.
- workbench: `setSelectionNoteEntry({ canNote, note })` answers its unregister; `selectionNoteVerb`, `canNoteHere`.
  `SelectionMenuActions.sendToPlan` is now nullable.
- editor: `SaveActionInput.due` (`string | null`; null clears it).

## Data and persistence

No schema step and no new field but `ElementAction.due` (optional, in the tab body as every action field, synced,
kept in snapshots and versions, ignored by every reader that does not know it). A note's mark and marker are
written into the saved page as any element and run are; copies and exports keep them as before.

## Errors and edge cases

- No words picked, or only spaces: nothing. Words across the writing's edge: nothing.
- A handle with no layout for the words (`markNote` finds no box): nothing written, false.
- A page locked after the bar showed: `addReadingNote` refuses.
- A note's words left only in a draft: anchored for the editors in edit mode; for readers its marker is hidden (the
  read lens holds no mark) and the api lists it with no anchor rather than read the draft.
- An id that is not a plain token: escaped in the style sheet (`cssString`).
- A due day that is not a calendar day: shown as none.

## Security and trust

The room and the api gate the note's element thread and action as every element's (share roles unchanged). The
editor gates every door on `can.takePart`. The anchor never reads a draft. Mentions are the composer's existing
team-member rule; nothing new is sent to anyone.

## Performance and limits

- Listeners while a session may note: `pointerdown`/`pointerup` (capture), `selectionchange`, `keydown`, a passive
  `scroll` and `resize`. A `selectionchange` runs `readingPick` (one range, a closest() each end); none run per
  keystroke in the writing's own handlers.
- `pageNotesOf` and `noteMarkStyles` run in a memo on the active tab's `elements` and `articles`; both return at once
  on a page with no note, and otherwise make one pass over the runs (`noteAnchorTexts`).
- The style sheet holds one selector per closed or detached note; empty pages write no `<style>`.

## Presentation and UX

The bar: `TOOLBAR_CARD`, 232 x 44, 8 px from the words, two labelled 36 px buttons (touch target 44), hover tinted
indigo or emerald, brand focus ring, `motion-safe:animate-fade-in`. The cards: the thread card's surface, a 28 px
glyph chip in the note's colour, the quote with a 2 px left rule in its colour, two lines at most; Detached in an
amber chip; due day red once past while open. Light and dark tokens throughout.

## Accessibility

The bar is a `toolbar` named "Comment on these words"; each button's name carries its keys. A card is one `button`
named "Comment on “words”" or "Comment, its words were deleted". Colour is never the only signal (glyph, Detached
chip, the words "Due").

## Observability

`debugLog('[article] margin note added', { reading })`; telemetry as the spec lists.

## Testing

| Rule                                                      | Test                                                                       |
| --------------------------------------------------------- | -------------------------------------------------------------------------- |
| anchor survives edits, undo; detached kept, empty gone    | `apps/editor/lib/article/article-note-anchoring.test.ts`                   |
| the package helpers                                       | `packages/document/src/article-note-anchors.test.ts`                       |
| addReadingNote writes the saved page, refusals, abandoned | `apps/editor/hooks/editor/useArticles.reading-note.test.ts`                |
| bar, keys, menu rows and the list, by role                | `apps/editor/components/page-notes/page-notes-roles.test.tsx`              |
| list derivation, styles, the pick, the bar's place, keys  | `apps/editor/lib/page-notes/*.test.ts`                                     |
| not an update, restore keeps notes, the anchor on wire    | `apps/api/src/knowledge/note-anchors-api.test.ts`                          |
| agent write keeps detached notes                          | `packages/edit-operations/src/pages/article-write.test.ts`                 |
| menu rows and entry, due words                            | workbench `selection-menu/*.test.ts(x)`, index-client `action-due.test.ts` |
| MCP anchor                                                | `packages/agent-verbs/src/mcp/thread-run.test.ts`                          |

## Constants and configuration

`NOTE_ANCHOR_MAX` 280 (the email quote's length, comment-mentions.md); `NOTE_BAR_SIZE` 232 x 44 and `NOTE_BAR_GAP`
8 (the toolbar card's own sizes).

## Not built

Starting a note on words from an agent; re-attaching a detached note to new words; the due day in the Inbox and the
assign email.
