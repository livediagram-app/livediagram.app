# Get Started tours

Six short guided tours of a knowledgebase, picked from the footer's **Get Started** button: **Your First Page**,
**Organise Your Knowledgebase**, **Trust a Page**, **Ask Your Knowledgebase**, **Connect an AI Agent** and **Share
and Work Together**. Each is three to six step cards on the real controls of the knowledgebase the person has open,
then a closing card with a link to its help article. Asked for by the owner on 2026-11-21 (Work Tracker 1348): "We
also need Get Started tours for liveknowledgebase, like we have in livediagram", and "In the settings under get
started I see show me for every element showing livediagram elements, not relevant to liveknowledgebase".

They follow livediagram's Get Started tours (`livediagram/docs/specs/007-editor/editor-tour.md`, its "Where it
appears" and "The stepped engine"): the one button, the taken record, Settings › Getting Started, one tour at a time,
dialogs first. Where this spec is silent, those rules hold. They replace the Pages tour and the element tours the
fork brought from livedocuments ([Pages tour](pages-tour.md), [Element tours](element-tours.md), both retired).

## Domain language

| Term                   | Means                                                                                                           |
| ---------------------- | --------------------------------------------------------------------------------------------------------------- |
| **Get Started tour**   | One of the six tours. In code, `KnowledgeTourId` (`first-page`, `organise`, `trust`, `ask`, `connect`, `share`) |
| **Get Started button** | The footer button that opens the list of tours                                                                  |
| **Get Started list**   | The popover the button opens (a sheet on a phone): the tours on offer, each a row                               |
| **Taken**              | A tour started at least once (finished or skipped), recorded for the person on every device                     |
| **Step plan**          | A tour's steps by id, with what each needs to be shown (`needs`), known before any step copy loads              |

## Where it appears

- **The Get Started button is the one way in.** It leads the footer's right-hand cluster, left of Knowledgebase
  Style and Tools ([The page surface](../030-knowledgebase/page-surface.md) "The footer"); on a phone it stands in
  the More card with the footer's other items. It reads **Get Started** (the glyph alone on a phone), as every
  app's does, and its accessible name is "Get Started, Knowledgebase Tours". No tour starts, prompts or offers itself:
  no banner, no card, no coach dock (the owner declined one before). The button being there is the first visit's
  prompt, as it is in livediagram.
- **A press opens the Get Started list**, the shared popover every app draws (`GetStartedPopover`, hero header
  "Get Started", "Quick tutorials to get you going."), with the tours on offer as rows in this order: **Your First
  Page**, **Organise Your Knowledgebase**, **Trust a Page**, **Ask Your Knowledgebase**, **Connect an AI Agent**,
  **Share and Work Together**. Each row has its glyph, its name, its length in a badge ("4 steps", counted for this
  person, see "Only what is there"), one line on what it teaches and a **Done** tick once taken. The line never
  names a step the person will not be shown: for a reader Organise reads "The page tree, search and the breadcrumb.",
  Trust "Who wrote a page, and its Page Health." and Share "See who wrote a page, and react to it."; for a
  Participant Share reads "See who wrote a page, react and comment." The badge and the Done tick stay whole on one line beside the name, which wraps
  if it must. Any row starts its
  tour, a taken one again too. A second press, Escape or a press outside closes the list; nothing is recorded.
- **On offer** while the knowledgebase is open in the full editor and usable: hydrated, no welcome overlay, the
  views offered (`useKnowledgeViewsOffered`: not an embed, not zen mode, not a workbench frame, not a Community visit,
  not a link confined to one page). A tour is on offer when at least two of its steps are there for this person; a
  tour with fewer is left out of the list.
- **Gone once taken, back from Settings.** The button is drawn while any tour on offer has not been taken. Once every
  one on offer is taken it is not drawn; a tour's switch in Settings › Getting Started puts it back (below).
- **One tour at a time.** A press, a pick or a Settings rerun while another tour is on screen does nothing.

## Taken, on every device

- A synced user preference, `knowledgeTours` ([User preferences](user-preferences.md)), lists the tours taken. A tour
  joins it as it starts, so a reload mid-tour leaves it taken, and finishing or skipping changes nothing more. Closing
  the Get Started list takes nothing.
- `knowledgeToursSeen` counts every tour as taken: **Get Started Tours** switched off in Settings writes it, with every
  tour listed. Turning one tour's switch on lifts it for that tour alone.
- The retired tours' records (`pagesTourSeen`, `pagesTourKinds`, `elementToursSeen`, `elementTourKinds`) are read by
  nothing and kept as stored, as every retired preference is.

## Settings

Settings' **Getting Started** category holds only these tours, under one **Offer Again** section note ("Start a tour
from Get Started in the bottom bar. A switch is on until you have taken its tour."):

- **Get Started Tours**, one switch over them all ("All six tours at once."): on while any is untaken; off marks
  every tour taken; on forgets every record.
- Nested under it, one switch per tour, named for it: **Your First Page**, **Organise Your Knowledgebase**, **Trust a
  Page**, **Ask Your Knowledgebase**, **Connect an AI Agent**, **Share and Work Together**, each with a one-line
  description and a **Learn More** link to its help article. On means not taken yet; off marks it taken, on forgets
  it.
- **Rerun.** Closing Settings with one tour newly switched on starts that tour when it is on offer right then; with
  several newly on it opens the Get Started list; otherwise it does nothing, and the button is there when the person
  is somewhere the tour can run.
- Every switch is inverted against its preference, and its telemetry tokens describe the preference, as every tour
  switch's do ([User preferences](user-preferences.md) "Getting Started").
- Nothing else is in the category: the element tours' **Show Me** section and its eleven switches (Sankey Diagram,
  Layer Stack, Pyramid and the rest) are gone with the tours.

## The tours

Each step names the control exactly as it is labelled and says what to do with it, in one idea and about twenty words
at most. The exact strings live in `apps/editor/components/tour/knowledge-tour-steps.ts`. Each tour's cards name it
in their eyebrow (**Your First Page tour**). Every tour's last card reads **You're ready**-style words of its own, a
**Help** link to its article (opened in a new tab) and **Done**.

A step **opens what it explains** where the control opens something (the page tree's sheet on a phone, a page's
options menu, the Page Info panel, another view): it presses the real control, rings what opened, and closes it again
as the step ends, however it ends. A step on another view (Ask, AI Knowledge, Connect) switches to it by its footer
tab, as a press on the tab would; a step on Pages switches back. Ending a tour leaves the person on the view its last
step showed: a person who just learned Ask is left on Ask to try it. The tours place nothing and change nothing of
the knowledgebase: no page is made, no draft opened, nothing verified, shared or sent.

In every tour the steps on the page come before those in the page tree, so a phone's Pages sheet opens once, for the
tree's steps, and stays until the tour ends.

### Your First Page

For whoever may write pages (an Editor or a Participant). Help: **Writing on a Page**.

1. **Edit** (the page's Edit button): opens the page to write, or press E. Everyone editing shares one live draft
   until Save.
2. **Type / for Blocks** (the writing's first block, its Title): headings, lists, tables, pictures, charts
   and links to other pages.
3. **New Page** (the page tree's New Page): adds a page at the top level, ready to name and write.
4. **Add a Subpage** (the + on the open page's row in the tree): adds a page inside this one. Not on a phone,
   whose row has only its ⋯ (Add Subpage is in that menu).
5. Closing card: **Your page is ready** "Write something, then Save. Cancel puts the page back as it was."

### Organise Your Knowledgebase

For everyone; a reader's steps say what they can do. Help: **The Page Tree**.

1. **Where You Are** (the breadcrumb above the Title): the pages this one sits inside. Press one to go up.
2. **The Page Tree** (the tree's list of pages): every page of the knowledgebase. Drag a page onto another to nest
   it, or between rows to move it. A reader reads "Press a page to open it; its arrow folds the pages inside."
3. **Page Options** (the open page's row ⋯, opened): rename, duplicate, move or delete the page. For a writer.
4. **Search** (the tree's Search): finds pages and what they say. Cmd or Ctrl K opens it from anywhere (on a phone,
   the step leaves the keys out).
5. **The Trash** (the Trash at the foot of the tree, once a page has been deleted): deleted pages wait here to be
   restored. For a writer, and only while the Trash holds a page.
6. Closing card: **Everything in its place**.

### Trust a Page

For everyone; the Verify step for a writer. Help: **Owners and Verifying**.

1. **Who Wrote It** (the page's meta row): who made the page and last changed it, a person or an agent, and how long
   it takes to read.
2. **Verify** (the meta row's Verify): says the page is right today. It asks before it does anything. For a writer,
   signed in and Online (a guest's Offline page has no Verify).
3. **Page Health** (Page Info's Page Health, its panel opened where it is folded away): how fresh the page is, its
   owner, when it was verified and when it comes due for review. Shown Offline too: Page Info draws it there.
4. **Request Approval** (Page Health's approval row): ask another member to approve the page. For a writer, signed
   in and Online.
5. Closing card: **Pages people can rely on**.

### Ask Your Knowledgebase

For everyone signed in, Online. Help: **Ask**.

1. **Ask** (the footer's Ask tab): answers questions from your pages, numbering each source it used.
2. **Ask a Question** (Ask's question field, on the Ask view): type a question and press Enter. A follow-up keeps the
   conversation.
3. **Your Questions** (Ask's list of questions): every question you asked here, to open again.
4. **AI Knowledge** (the footer's AI Knowledge tab): what agents read, questions nobody could answer, and pages that
   disagree.
5. Closing card: **Ask away**.

A session Ask turns away (no AI to answer it) sees only the steps it can reach; with fewer than two it is not on offer.

### Connect an AI Agent

For everyone signed in, Online, not on a phone (an AI app is set up on a computer). Help: **Connecting an Agent**.

1. **Connect** (the footer's Connect tab): connects Claude, ChatGPT, Cursor or another AI app over MCP.
2. **Pick Your AI App** (the app cards, on the Connect view): its steps follow your pick.
3. **Add liveknowledge** (the picked app's steps): copy the address, or press the button that opens the app's
   settings.
4. **What It May Do** (the access rows): reads for everyone; suggesting and writing follow your role.
5. **Check It Worked** (the status): it turns to Connected once the app reads a page.
6. Closing card: **Your agent can read along**.

### Share and Work Together

For everyone; each step for whoever has the control. Help: **Sharing**.

1. **Share** (the top row's Share): invite people as Editors, Participants or Viewers, or make a link. For an Editor.
2. **Who Made It** (the top row's avatars, while reading): everyone who wrote this page, its creator first.
3. **Reactions** (the page's reactions, beside Edit): react to a page with any emoji. Signed in.
4. **Comments** (the threads at the page's foot): start a thread or reply; the people in it hear about it. For a
   writer.
5. Closing card: **Better together**.

## Only what is there

A step whose control this person does not have is left out before the tour starts, so the "N of M" count and the
row's length badge are right from the first step; one whose control still never appears is skipped, the way the
person was going, never pointing at nothing:

- **By role** (`needs`): `write` (an Editor or a Participant: New Page, Add a Subpage, Edit, Page Options, the Trash,
  Verify, Request Approval, Comments), `share` (an Editor: Share), `signedIn` (Ask, Reactions, Connect, Verify, Request Approval), and a
  Viewer's own words where a step reads differently for one (The Page Tree).
- **Offline** (`online`): Ask, AI Knowledge, Connect, Verify, Request Approval, Who Made It, Reactions and Comments
  need the room on the server (found in the browser check: an Offline page draws none of them). Page Health stays.
- **On a phone** (`desktop`): Connect and Add a Subpage are not on offer. The page tree is the **Pages** sheet: a tree step opens it and
  closes it again as it ends. Page Info is its button's sheet. The other steps are the same.
- **On screen at the start:** a step on the Pages view whose control is not drawn when the tour starts (the Trash with
  nothing in it, the breadcrumb, Who Made It on a page nobody has saved yet) is left out. On a phone, where the
  Trash row is in the shut Pages sheet, it is judged by whether the Trash holds pages, so the count matches the run.
- **Gone mid-tour:** edit rights going, the knowledgebase closing or another knowledgebase opening ends the tour as
  skipped, closing whatever it opened.

## How a tour runs

The shared stepped engine every app's tours run on (`useTourEngine`, `TourStage`, `TourPopover`, `TourSpotlight` in
`@liveworkspace/workbench/components/tour`), as livediagram's `editor-tour.md` "The stepped engine" and "Mechanics"
describe it: a dim with a rounded hole round the step's control, the card beside it (never over it), Back, Next and
Skip, the arrow keys and Escape, targets awaited and brought into view, a step that opens a menu reopening it if it is
dismissed, and the tour stepping aside while a dialog that is not its own is open. The page stays usable while a step
is up (no shield), as the steps ask the person to try things. Every tour wears the app's own light or dark colours
(`tour-colours.ts`).

## Share roles

| Tour                        | Editor  | Participant    | Viewer                                  |
| --------------------------- | ------- | -------------- | --------------------------------------- |
| Your First Page             | yes     | yes            | not offered (no step is a reader's)     |
| Organise Your Knowledgebase | 5 steps | 5 steps        | The Page Tree, Search, Where You Are    |
| Trust a Page                | 4 steps | 4 steps        | Who Wrote It, Page Health               |
| Ask Your Knowledgebase      | yes     | yes            | yes                                     |
| Connect an AI Agent         | yes     | yes            | yes (its access rows say it only reads) |
| Share and Work Together     | 4 steps | Share left out | Who Made It, Reactions                  |

The tours add no right of their own: each step points only at a control the person already has. A signed-out guest or
link visitor gets the tours without the signed-in steps (Ask and Connect are not on offer).

## Performance

The tours cost nothing until they are used. The host is in the editor's deferred code (`lib/editor-deferred-code.ts`),
loaded after the first paint, never in the first load. Its offer is worked out from the step plan (ids and needs, no
copy); the steps' words and prepares load at the first press of a row or a length count (`import('./knowledge-tour-
steps')`), so the first load carries no tour copy at all. `document-lazy-load.test.ts` ("keeps the Get Started tours out of the first load") keeps it so.

## Telemetry ([Telemetry](../017-telemetry/telemetry.md))

- **Offer**: `UI` · `Opened` · `KnowledgeToursOffer` the first time the Get Started button shows in a page load.
- **List**: `UI` · `Opened` · `KnowledgeTours` when the Get Started list opens.
- **Start**: `UI` · `Started` · `<Tour>Tour`, one token per tour: `FirstPageTour`, `OrganiseTour`, `TrustTour`,
  `AskTour`, `ConnectTour`, `WorkTogetherTour`.
- **Stage views**: `UI` · `View` · `KnowledgeTourStep<Tour><Step>` once per step entry, the closing card included
  (`KnowledgeTourStepFirstPageNewPage`, `KnowledgeTourStepTrustVerify`, ...).
- **End**: `UI` · `Ended` · `<Tour>TourCompleted` | `<Tour>TourSkipped`.
- **Settings rows**: `UI` · `Toggled` · `KnowledgeToursSeenOn` | `KnowledgeToursSeenOff`, and `<Tour>TourSeenOn` |
  `<Tour>TourSeenOff` per tour.

The retired tours' events (the element tours', the Pages tour's and the page panel's Show Me) are retired on the
dashboard ([Telemetry](../017-telemetry/telemetry.md) "Retired features").

## Code

- `lib/knowledge-tours.ts`: the tour ids, the step plan (`KNOWLEDGE_TOUR_PLAN`, ids and needs), the taken record and
  the Settings rerun event.
- `components/tour/KnowledgeToursHost.tsx`: the offer, the Get Started list, the engine and the record; mounted once
  in `EditorTours`.
- `components/tour/knowledge-tour-steps.ts`: each step's words, selector and prepare, loaded at the press.
- `components/tour/knowledge-tour-dom.ts`: opening and closing what a step shows (a view, the Pages sheet, Page Info,
  a row's menu), and putting it back as the tour ends.
