# Describe to Set Up blueprint

Derived from [Describe to set up](../describe-to-set-up.md). The request, its limits and the reading of a reply are
the [knowledge package blueprint](knowledge-package.md)'s ("Describe to Set Up"); this is the editor's side.
**Built.** Driven in a browser by `e2e/signed-in/knowledge-setup.spec.ts` against the model stand-in; **no real
model was called**, and the dialog's look has not been reviewed by a person.

## Domain and naming

| Term (spec)           | Identifier                                                            |
| --------------------- | --------------------------------------------------------------------- |
| Describe to Set Up    | `SetupMode` `'set-up'`; the sidebar's `DescribeToSetUpButton`         |
| Describe to Add Pages | `SetupMode` `'add'`; `useDescribeToAddPages()`, the palette's command |
| empty                 | `knowledgebaseIsEmpty(tabs, loaded)`                                  |
| the untouched page    | `untouchedOnlyPage(tabs, loaded)`                                     |
| a page under review   | `ReviewPage`: a `KnowledgeSetupPage` with `ticked`                    |
| the three steps       | `SetupStep`: `describe`, `suggesting`, `review`, `creating`, `done`   |

## Modules

| Piece                                   | File                                                                       |
| --------------------------------------- | -------------------------------------------------------------------------- |
| whether it is open, and what is offered | `lib/knowledge-setup/setup-open.ts`                                        |
| the empty check                         | `lib/knowledge-setup/setup-empty.ts`                                       |
| the Review step's state, the limits     | `lib/knowledge-setup/setup-tree.ts`                                        |
| the plan the write path is handed       | `lib/knowledge-setup/setup-plan.ts`                                        |
| the run                                 | `lib/knowledge-setup/run-setup.ts`                                         |
| the route's client                      | `lib/knowledge-setup/setup-api.ts`                                         |
| every word                              | `lib/knowledge-setup/setup-words.ts`                                       |
| who is offered it                       | `components/setup/useSetupOffered.ts`                                      |
| the sidebar's button                    | `components/setup/DescribeToSetUpButton.tsx`                               |
| the host, the menu item                 | `components/setup/SetupHost.tsx`                                           |
| the dialog, its steps and states        | `SetupDialog.tsx`, `DescribeStep.tsx`, `ReviewStep.tsx`, `SetupStates.tsx` |
| the flow's state                        | `components/setup/useSetupFlow.ts`                                         |

Hook-ins, each one line or a few: `PageTreeSidebar.tsx` (the button above New Page), `EditorTabDialogs.tsx` (the
host, beside the dialogs it does not depend on), `lib/editor-commands.ts` and `hooks/canvas/useEditorCommands.ts`
(the palette's command), and `lib/knowledge-import/save-layers.ts` (`replaceId`).

## The start screen

Derived from the spec's "The start screen". The panel is the shared one (`createStartPanel`, as every editor's), bound
in `components/start/`.

- **Offered by /new.** `app/new/page.tsx` makes Start Here as before (`newDocumentContent`: `templateChosen: true`,
  `newKnowledgebasePageContent()`). When the address asks for no template and no blank (`newDocumentStartsBlank`),
  it calls `offerKnowledgebaseStart(tabId)` (`components/start/knowledgebase-start.ts`) and asks no Title focus;
  otherwise `wantTitleFocus` as before. The offer is a key in `sessionStorage`
  (`liveknowledge:v2:start-offered:<tabId>`): this browser tab only, kept over a reload, never stored on the
  knowledgebase, so no other person or device sees it. `useKnowledgebaseStartOffered(tabId)` reads it through
  `useSyncExternalStore`; `closeKnowledgebaseStart(tabId)` removes it. Storage that throws reads as not offered.
- **When it shows** (`showsTemplateStart`, `template-start-mode.ts`): hydrated, not zen, not an embed, the session
  may edit, no draw tool armed, the tab not connected, no elements, its pages one article page whose writing is
  untouched (`pageIsUntouched`: nothing beyond the Title), and offered. A kindless page never qualifies.
  `useTemplateStartOpen` (the canvas holds the page back while it is up) is the same answer.
- **The structures** (`packages/knowledge/src/setup-structures.ts`, `SETUP_STRUCTURES`): each `{ id, name, line,
group, pages }`, its pages a nested outline (title, one-line summary, headings, subpages). `structureSuggestion`
  flattens one into the shape a model's reply has and reads it with `parseSetupSuggestion`, the parser a reply goes
  through, so a structure is a `SetupSuggestion` exactly as an AI one is: ids `p1`, `p2`, ... in tree order, depth
  from 1, within `SETUP_MAX_PAGES` and `SETUP_MAX_DEPTH`, sibling titles unique. `setup-structures.test.ts` pins every
  structure to those bounds and to its outline surviving the parser whole.
- **The rail** (`start-structure-items.ts`): a first group **Start** (`id: 'start'`) holding `blank` (Blank
  Knowledgebase) and, where `useSetupOffered() === 'set-up'`, `describe` (Describe to Set Up); then **Team**,
  **Engineering** and **Product and Support** from each structure's `group`. The search matches a structure's name,
  line and page titles (`searchStructures`). A card (`structure-card.tsx`) draws the outline (`structureOutline`:
  each top page, then its subpages' titles after a colon, at most five lines, or four and "and N More"; a phone's small tile keeps the top level only) with the page
  count, in place of a picture. The foot (`footLead`): Describe to Set Up and Import (an Editor); then Connect File
  (`useConnectStart`). The footer is `StartSaveSwitch`.
- **Choosing** (`EditorStartPanels`): `blank` closes the offer, asks Title focus for the tab and sends
  `UI·Used·StartBlank`; `describe` closes it, sends `UI·Opened·DescribeToSetUp` and `openSetup('set-up')`; Import
  closes it, sends `UI·Opened·KnowledgeImport` and `setImportOpen(true)`. A structure closes it and runs
  `createStructure` (`components/setup/create-structure.ts`, loaded on the pick): `runSetup` with the structure's
  pages all ticked and Start Here as `replaceId`, the knowledgebase named after it while untitled, the first page
  opened, `Tab·Created·FromStructure`. Describe to Set Up's Create runs the same `createStructure`. No
  `StartAgainTray`: a closed knowledgebase start never comes back.
- **A kindless tab reads as a page.** `migrateStoredTab` (`packages/document/src/stored-tab.ts`) ends with
  `withKnowledgebasePage`, so a tab with no elements and one page of no kind is an empty knowledgebase page wherever
  a stored tab is read (the api's reads, the offline store, a file, a peer's tab). `removePage` on a tab's last page
  commits `newKnowledgebasePageContent()` instead of an empty tab.

## Who is offered it

`useSetupOffered()` answers `'set-up'`, `'add'` or `null` from the chrome store in one read: an Editor of the
whole knowledgebase (`can.editPages && !isStructureReadOnly`) with an account (`accountUserId`), the document
hydrated, not in an embed, a workbench or a Community view, and not kept Offline (`useIsOfflineDocument`). Empty is
`'set-up'`, anything else `'add'`. It reads the store through `useSyncExternalStore` with the context optional, so
a sidebar drawn with no editor store (a test, a preview) is offered nothing. The answer is a short string, so a
reader renders only when it changes.

**Empty** (`knowledgebaseIsEmpty`): one to three pages, every one loaded in this editor and untouched (no element,
and no block that is not an empty paragraph or the Title; a page of more than `EMPTY_SCAN_BLOCKS`, 24, is not
untouched whatever it holds). A page this editor has not loaded is **not known to be empty**, so the knowledgebase
is then not called empty and the session is offered `'add'`: no page is loaded and no request is made to find out.
Where the spec says "at most three pages, none with any writing beyond a title", this is that rule for the pages
the editor holds.

| Role or state                           | Sidebar button | Describe to Add Pages |
| --------------------------------------- | -------------- | --------------------- |
| Editor, signed in, empty                | yes            | no                    |
| Editor, signed in, not empty            | no             | yes                   |
| Participant, Viewer, a page-scoped link | no             | no                    |
| Not signed in; kept Offline; an embed   | no             | no                    |

## The control

- **The sidebar** (`DescribeToSetUpButton`): in the sidebar's foot, directly above New Page, a full-width primary
  `Button` with the sparkle glyph and "Describe to Set Up"; what it does, "Tell AI what this is for and get a page
  structure.", is its hover card (and the button's description), not a line under it. 44 px tall on a coarse pointer. It opens the dialog
  (`openSetup('set-up')`) and sends `UI·Opened·DescribeToSetUp`. It is not drawn in the collapsed rail.
- **Describe to Add Pages**: `useDescribeToAddPages()` answers `{ label, onSelect }` or `null`, for the
  knowledgebase menu. **That menu is not built yet**, so today the way in is the command palette's **Describe to
  Add Pages** (`describe-to-add-pages`, offered while `usePublishedSetupOffered() === 'add'`: the host publishes
  what is offered, so the palette reads no editor store for it).
- **On a phone** the same button is in the Pages sheet (`PageTreeSheet.tsx`), above New Page, at least 44 px
  tall; `onOpen` closes the sheet as the dialog opens. Each button's line has its own id (`useId`), since the
  sidebar's and the sheet's can both be on the page.

## The dialog

`SetupWhenOpen` (in `EditorTabDialogs`, always mounted) draws nothing until `useSetupOpen()` names a mode and the
session is offered it; it closes itself when the session stops being offered it. `SetupDialog` is `next/dynamic`
(`ssr: false`) inside `AreaErrorBoundary area="Modals"`: the dialog, its steps, the write path and the Markdown
reader behind it are one chunk fetched on the first open. Over Pages the host also draws AI Settings when it is
opened from the dialog (over Ask or AI Knowledge the views' host draws it).

`Dialog` `size="lg"`, a sheet on a phone, centred. The body is one height whatever shows
(`h-[29rem] max-h-[calc(100dvh-13rem)]`), with the three step names above it (`aria-current="step"`).

| State      | When                            | Shows                                                                                                | Footer                                    |
| ---------- | ------------------------------- | ---------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| Describe   | step 1, at once on open         | the field, the example, three chips, the counter from 900; a failure's callout above it; the AI line | Cancel, **Suggest a Structure**           |
| suggesting | the request is out              | one line and a skeleton in the tree's place (`SkeletonRows`)                                         | Cancel (aborts, back to Describe)         |
| Review     | step 2                          | the name (while untitled), the tree, the note or the limit's callout                                 | Cancel, **Try Again**, **Create N Pages** |
| creating   | step 3                          | "Making Pages: 20 of 30" and a bar                                                                   | Stop (between batches)                    |
| done       | the run did not make every page | how many were made, each page that was not with why                                                  | Done                                      |

- **No key is no stop** (owner, 2026-11-21). Step 1 shows at once, whatever the AI settings say and before they
  are read. The dialog still reads them (`aiSettingsStore.load`) for one quiet line under the field
  (`setupAiLine(settings)`, `data-setup-ai`): **Uses built-in AI** with no key, **Uses your team's key** with one,
  nothing while unread or unreadable. The api, not the line, decides which AI answers; the answer names it
  (`provider`). There is no no-key state, no loading state and no "could not be read" state any more.
- **Describe.** `TextArea`, focused on open, labelled "What Is This Knowledgebase For?" ("What Pages Should Be
  Added?" when adding). Under it the example, or what stops the description (under 20, over 1,000); the counter
  shows from 900 characters. Three chips fill the field (Engineering Handbook, Customer Support, Company Handbook).
  Cmd or Ctrl and Enter sends. Adding sends the existing titles in tree order with their depth (`pageTreeRows`).
- **The request** (`apiSuggestSetup`): one `POST setup/suggest` with an `AbortController` (Cancel, and the dialog
  going, abort it) joined to a 90 second bound. A failure is a kind, never the route's message:
  `setupFailureWords(kind, { provider })` words a model failure as Ask does (`askFailureWords`, "ask again" read
  as "try again") and the limits, built-in AI's three (`built-in-unavailable`, `built-in-limit`, `built-in-failed`;
  the first two offer **Open AI Settings**, since the team's key is the way past them), a reply with no structure
  ("Could Not Suggest a Structure") and a lost connection in words of their own. It shows above the field with the description kept; a bad key or model offers **Open AI
  Settings**.
- **Review.** A list named "Suggested Pages", each row indented by its level as the sidebar's rows are
  (`10 + (depth - 1) * 18` px): a native checkbox ("Create <title>"), the page glyph, the title in a text input
  ("Page Title", 80 characters, struck and disabled while unticked) and the summary under it. Unticking a page
  unticks its subpages; ticking one ticks the pages above it (`withTick`). The knowledgebase's name is offered
  only when setting up and only while the name is empty or "Untitled Knowledgebase". **Create N Pages** counts the
  ticks and is disabled at none. Everything shown came from a model and is a text node or an input's value.
- **Limits** (`setupLimitRefusal`): the ticked pages against `MAX_KNOWLEDGEBASE_PAGES` (500; the replaced page is
  not counted twice) and the landing page's depth plus the structure's against `MAX_PAGE_DEPTH` (8). A refusal is a
  callout in Review ("These Pages Do Not Fit") and Create is disabled: nothing is created. Unticking clears it.

## Creating the pages

`runSetup` hands `setupPlan(tickedPages)` to `writeImportPlan` (the Import write path) with
`openKnowledgebaseLayer`: batches of `IMPORT_BATCH_PAGES` (20) in tree order, each one `commitTabs` (one undo
step) stored by the autosave before the next begins. 30 pages are two batches (`run-setup.test.ts` holds it).

- **A page's writing** (`setupPageMarkdown`): `*summary*`, then `# heading` for each heading, read by the
  article's own Markdown reader. Each line goes through `plainLine` first (one line; `\`, backtick, `*`, `_`,
  brackets, parentheses, braces, `#`, `~`, `|`, `!` escaped, and a leading list, quote or number marker), so a
  title or heading that writes Markdown, a link or a picture is its characters. Angle brackets are left: the
  reader knows no HTML. `withRoomUnderHeadings` then puts an empty paragraph under each heading (Markdown cannot
  say one) before the batch is stored.
- **The untouched page.** When setting up and the knowledgebase is one untouched page, `runSetup` gives the plan's
  first page that page's id (`newId` answers it first) and passes `replaceId`: `openKnowledgebaseLayer` swaps the
  page in place in the same edit as its batch (its place in the tree kept) and waits for its save with the rest.
  Otherwise nothing existing is changed. Adding lands under the open page (`parent: activeId`).
- **After the suggestion.** `UI·Used·SetupSuggested` when the answer's `provider` is the team's (`anthropic`,
  `openai`), `UI·Used·SetupSuggestedBuiltIn` when it is `built-in`.
- **After.** `Tab·Created·FromSetup`; the suggested name is given (`nameDocument`) only if the knowledgebase is
  still untitled; the first new page is opened (`selectPage`); the dialog closes. A run that did not make every
  page (a refusal of the tree, a stalled save, Stop) stays open on **done**.
- New pages carry no knowledge fields: Never Verified, no owner.

## Security and trust

- The description is fenced in the request by the package; the reply is validated field by field by the api
  (`parseSetupSuggestion`) before the editor sees it, and checked for its shape again by `apiSuggestSetup`.
- Titles, summaries, headings and the name are drawn as text nodes and input values, and written through
  `plainLine` and the Markdown reader, which keeps `http`, `https` and `mailto` links only and no HTML. Tests hold
  `<script>`, `<img onerror>`, `[x](javascript:…)` and `![x](…)` as characters in the dialog and in the page made.
- The team's key is never in the editor, and neither is any built-in AI credential (the binding is the api's). The route is an Editor's in person; the api is the rule, the editor's
  gate is presentation.

## Performance and limits

- **The empty check on a keystroke:** asked on every store change. Past three pages it reads nothing; each page's
  answer is kept against the page object in a `WeakMap` (a keystroke replaces only the page being written), and a
  page is read at most 24 blocks deep. Measured in `setup-lib.test.ts`: 20,000 keystrokes' worth of checks on a
  three page knowledgebase and 100,000 on a 500 page one each stay inside `cpuBudgetMs(150)` and `(100)`.
- **No request** is made for the check, and no page is loaded for it.
- **Bundle:** the editor's first load gains the offer hook, the button, the open store and the words; the dialog
  and the run are one chunk on first open. Not measured: the bytes added to the first load.
- **Creating 30 pages:** two batches, two edits; `run-setup.test.ts` holds the conversion of 30 pages inside
  `cpuBudgetMs(400)`. Each batch waits for the autosave (up to `IMPORT_SAVE_WAIT_MS`, 60 s).
- **Not ruled out:** the render of the Review list is one row a page with no windowing, bounded at 30 rows.

## Accessibility

Labels on the field, the name and every checkbox and title; the steps as an ordered list with
`aria-current="step"`; the counter `aria-live="polite"`; failures and the limit as `role="alert"`; the skeleton
and the progress line as `status`, the bar a `progressbar`; focus rings on every control and on a row whose field
has the focus; 44 px targets on a coarse pointer; colour changes on the motion tokens under `motion-safe`. Not
checked in a browser: contrast in dark mode, and the dialog at phone width.

## Telemetry

`UI·Opened·DescribeToSetUp`, `UI·Opened·DescribeToAddPages`, `UI·Used·SetupSuggested` (the team's key) or
`UI·Used·SetupSuggestedBuiltIn` (built-in AI), `Tab·Created·FromSetup`.
Each is a fixed token: an event has no number in it, so **no count is sent** (how many pages were suggested,
ticked or created would need a field the telemetry vocabulary does not have; the spec says so too). The
description, the titles and the key are never sent.

## Testing

| Rule                                                                                                            | Test                                                                                     |
| --------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Empty: three pages, nothing beyond a title, only what is loaded                                                 | `lib/knowledge-setup/setup-lib.test.ts`                                                  |
| The check's cost on a keystroke                                                                                 | the same, "costs next to nothing"                                                        |
| Ticks, renames, the limits                                                                                      | the same, "the Review step"                                                              |
| The words, each failure with its next step                                                                      | the same, "the words"                                                                    |
| Batches of 20 in tree order; the untouched page taken over                                                      | `lib/knowledge-setup/run-setup.test.ts`                                                  |
| Title, italic line, headings with room to write                                                                 | the same                                                                                 |
| Markup from a model is text                                                                                     | the same; `components/setup/Setup.test.tsx`                                              |
| `replaceId` in the save layer                                                                                   | `lib/knowledge-import/save-layers.test.ts`                                               |
| Who is offered it, per role and state                                                                           | `components/setup/Setup.test.tsx`                                                        |
| Every state of the dialog; Cancel aborts; no key goes straight to step 1 and says built-in AI                   | the same                                                                                 |
| The palette's command                                                                                           | `lib/editor-commands.test.ts`                                                            |
| In a browser: the start screen's Describe to Set Up, describe to tree, built-in AI with no key, an OpenAI key   | `e2e/signed-in/knowledge-setup.spec.ts`                                                  |
| The start screen: shown by `/new`, Blank Knowledgebase, a structure's whole tree, Import; skipped by `?blank=1` | `e2e/knowledge-start.spec.ts`; `components/start/*.test.ts*`; `setup-structures.test.ts` |

## Not built, or not known

- The knowledgebase menu's **Describe to Add Pages** item (the menu does not exist; the hook for it does).
- Counts in telemetry.
- A real model's reply has never been read, built-in or the team's: whether 4,000 tokens is enough, how good a
  structure is, and whether the built-in model finishes inside its 60 seconds, are unknown.
