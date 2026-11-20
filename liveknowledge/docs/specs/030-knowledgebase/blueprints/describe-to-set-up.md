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

## No start screen

`/new` asks nothing (`app/new/page.tsx`): it makes the knowledgebase as it mounts and hands it to the editor in
place. With no parameters the one tab is **Start Here**, already a knowledgebase page (`newDocumentContent`:
`templateChosen: true` and `newKnowledgebasePageContent()`), so the template start (`showsTemplateStart`) is never
up over it, and `wantTitleFocus` puts the caret in its Title. A signed-in person's is saved to the account, a
guest's is kept Offline (`useNewDocumentLocation`). The Explorer's New (`newDocumentHref`) and Home's Make Your
First Knowledgebase (`NEW_KNOWLEDGEBASE_HREF`) are `/new`. `/new?template=<kind>` and `/new?blank=1` are unchanged.
This was already so when Describe to Set Up was built; nothing was removed for it. The e2e spec holds it for a
signed-in `/new`: the editor's address, the caret in the Title, one page in the tree, no start over it.

**Not removed:** the template start's code (`components/start/**`, `useTemplateFlow`) is still in the editor for a
tab that is empty with its one page unchosen (a tab stored by the fork before pages had one kind); no route of
liveknowledge makes such a tab. Taking it out, with the tests and help keys that pin it, is not done.

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
  `Button` with the sparkle glyph and "Describe to Set Up", and under it "Tell AI what this is for and get a page
  structure." (the button's `aria-describedby`). 44 px tall on a coarse pointer. It opens the dialog
  (`openSetup('set-up')`) and sends `UI·Opened·DescribeToSetUp`. It is not drawn in the collapsed rail.
- **Describe to Add Pages**: `useDescribeToAddPages()` answers `{ label, onSelect }` or `null`, for the
  knowledgebase menu. **That menu is not built yet**, so today the way in is the command palette's **Describe to
  Add Pages** (`describe-to-add-pages`, offered while `usePublishedSetupOffered() === 'add'`: the host publishes
  what is offered, so the palette reads no editor store for it).
- **Not built:** the button in a phone's Pages sheet (`PageTreeSheet.tsx`).

## The dialog

`SetupWhenOpen` (in `EditorTabDialogs`, always mounted) draws nothing until `useSetupOpen()` names a mode and the
session is offered it; it closes itself when the session stops being offered it. `SetupDialog` is `next/dynamic`
(`ssr: false`) inside `AreaErrorBoundary area="Modals"`: the dialog, its steps, the write path and the Markdown
reader behind it are one chunk fetched on the first open. Over Pages the host also draws AI Settings when it is
opened from the dialog (over Ask or AI Knowledge the views' host draws it).

`Dialog` `size="lg"`, a sheet on a phone, centred. The body is one height whatever shows
(`h-[29rem] max-h-[calc(100dvh-13rem)]`), with the three step names above it (`aria-current="step"`).

| State             | When                            | Shows                                                                                   | Footer                                    |
| ----------------- | ------------------------------- | --------------------------------------------------------------------------------------- | ----------------------------------------- |
| loading           | the AI settings are being read  | the room held                                                                           | Cancel                                    |
| could not be read | `GET ai` failed                 | an error callout, **Try Again**                                                         | Cancel                                    |
| no key            | `hasKey` false                  | "Describe to Set Up Needs Your Team's AI Key", **Open AI Settings**                     | Cancel                                    |
| Describe          | step 1                          | the field, the example, three chips, the counter from 900; a failure's callout above it | Cancel, **Suggest a Structure**           |
| suggesting        | the request is out              | one line and a skeleton in the tree's place (`SkeletonRows`)                            | Cancel (aborts, back to Describe)         |
| Review            | step 2                          | the name (while untitled), the tree, the note or the limit's callout                    | Cancel, **Try Again**, **Create N Pages** |
| creating          | step 3                          | "Making Pages: 20 of 30" and a bar                                                      | Stop (between batches)                    |
| done              | the run did not make every page | how many were made, each page that was not with why                                     | Done                                      |

- **No key.** Adding a key in AI Settings writes the settings store, which the dialog reads: step 1 is there when
  AI Settings closes. Nothing is asked of the api before a key exists.
- **Describe.** `TextArea`, focused on open, labelled "What Is This Knowledgebase For?" ("What Pages Should Be
  Added?" when adding). Under it the example, or what stops the description (under 20, over 1,000); the counter
  shows from 900 characters. Three chips fill the field (Engineering Handbook, Customer Support, Company Handbook).
  Cmd or Ctrl and Enter sends. Adding sends the existing titles in tree order with their depth (`pageTreeRows`).
- **The request** (`apiSuggestSetup`): one `POST setup/suggest` with an `AbortController` (Cancel, and the dialog
  going, abort it) joined to a 90 second bound. A failure is a kind, never the route's message:
  `setupFailureWords(kind, { provider })` words a model failure as Ask does (`askFailureWords`, "ask again" read
  as "try again") and the limits, a reply with no structure ("Could Not Suggest a Structure") and a lost connection
  in words of their own. It shows above the field with the description kept; a bad key or model offers **Open AI
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
- The team's key is never in the editor. The route is an Editor's in person; the api is the rule, the editor's
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

`UI·Opened·DescribeToSetUp`, `UI·Opened·DescribeToAddPages`, `UI·Used·SetupSuggested`, `Tab·Created·FromSetup`.
Each is a fixed token: an event has no number in it, so **no count is sent** (how many pages were suggested,
ticked or created would need a field the telemetry vocabulary does not have; the spec says so too). The
description, the titles and the key are never sent.

## Testing

| Rule                                                             | Test                                        |
| ---------------------------------------------------------------- | ------------------------------------------- |
| Empty: three pages, nothing beyond a title, only what is loaded  | `lib/knowledge-setup/setup-lib.test.ts`     |
| The check's cost on a keystroke                                  | the same, "costs next to nothing"           |
| Ticks, renames, the limits                                       | the same, "the Review step"                 |
| The words, each failure with its next step                       | the same, "the words"                       |
| Batches of 20 in tree order; the untouched page taken over       | `lib/knowledge-setup/run-setup.test.ts`     |
| Title, italic line, headings with room to write                  | the same                                    |
| Markup from a model is text                                      | the same; `components/setup/Setup.test.tsx` |
| `replaceId` in the save layer                                    | `lib/knowledge-import/save-layers.test.ts`  |
| Who is offered it, per role and state                            | `components/setup/Setup.test.tsx`           |
| Every state of the dialog; Cancel aborts; no key and back        | the same                                    |
| The palette's command                                            | `lib/editor-commands.test.ts`               |
| In a browser: no start screen, describe to tree, the no-key path | `e2e/signed-in/knowledge-setup.spec.ts`     |

## Not built, or not known

- The knowledgebase menu's **Describe to Add Pages** item (the menu does not exist; the hook for it does).
- The button in a phone's Pages sheet.
- Counts in telemetry.
- The template start's removal ("No start screen").
- A real model's reply has never been read: whether 4,000 tokens is enough, and how good a structure is, are
  unknown.
