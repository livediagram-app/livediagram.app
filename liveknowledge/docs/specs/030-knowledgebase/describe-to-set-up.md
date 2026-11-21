# Describe to set up

Status: **built** ([blueprint](blueprints/describe-to-set-up.md); the request and its reading are in the
[knowledge package blueprint](blueprints/knowledge-package.md)). Asked for by the owner on 2026-11-20. Driven in a
browser against a stand-in; no real model has answered it. What is not built is listed at the foot.

A new knowledgebase is empty, and an empty page tree is the hardest part of starting one. The person describes what
the knowledgebase is for, and AI proposes a sensible structure of pages for them to accept.

## The start screen

Owner, 2026-11-21: "When creating a new knowledgebase, show a start screen like the other apps." (This reverses
the earlier "no start screen".)

- `/new`, the Explorer's New button and Home's **Make Your First Knowledgebase** make the knowledgebase straight
  away (its one page, **Start Here**, saved to the account for a signed-in person, Offline for a guest, as
  [Knowledgebases and pages](knowledgebases-and-pages.md) says) and open it on the **start screen**, the shared
  start panel every liveworkspace editor shows on a new item: titled **Start Your Knowledgebase**, with the line
  "Start blank, from a template, from a description, or from what you already have."
- **Its choices**, in the rail:
  - **Start**, first: **Blank Knowledgebase** (the first card): the start closes onto Start Here, the caret in its
    Title.
  - Then the template categories (Engineering, Handbooks, Onboarding, Product, Support), each with its writing
    templates and the Community's tiles for that category. A template lands on Start Here, which takes its writing
    and its name, and the start closes onto it. Templates of writing only: no slide, infographic or canvas choice.
  - At the rail's foot, as liveplanner's Describe a Plan and Import: **Describe to Set Up**, which opens this
    feature's dialog over the empty knowledgebase (offered where the sidebar's control is: a signed-in Editor, not
    Offline), and **Import**, which opens the knowledgebase's Import dialog (Markdown folder, Notion or Confluence
    archive). Then Connect File where connecting works.
  - Under the choices, the **Sync Knowledgebase to Server** switch ([Save locations](../006-document/save-locations.md)).
- The start cannot be closed by itself: Blank Knowledgebase is the way past it. Choosing any foot entry closes it
  first, so cancelling that dialog leaves the person on the empty Start Here page.
- **Only for a knowledgebase just made here.** The start shows on the knowledgebase `/new` made, in the browser tab
  that made it (kept for that tab's session, so a reload keeps it), while Start Here is untouched (nothing written
  beyond its Title) and the person may edit it. Nobody else, and no other knowledgebase, ever sees it: a collaborator
  who opens the knowledgebase meanwhile sees the empty page.
- `/new?blank=1` (Start Blank) and `/new?template=<kind>` (links from the marketing site, the Community and Home's
  **Start a Page From** tiles) skip it: they already say what to start with.
- **A tab with no page kind** (made by an agent, a script or an older client, with nothing on it) is read as an
  empty knowledgebase page as it is loaded, everywhere a stored tab is read (`withKnowledgebasePage` in
  `migrateStoredTab`), so it opens as an empty article page and never shows a start. Deleting a knowledgebase's
  last page from the page menu leaves an empty page to write on, not an empty tab.
- **Share roles:** an Editor of the knowledgebase only; a Participant or a Viewer is never shown it.
- **Telemetry:** the shared start's events as every app sends them (`Template·Used·<kind>`), plus
  `UI·Opened·DescribeToSetUp` and `UI·Opened·KnowledgeImport` from its foot, and `UI·Used·StartBlank` for Blank
  Knowledgebase.

## The control

- While a knowledgebase is **empty**, the sidebar shows **Describe to Set Up** directly above **New Page**: a
  full-width button with the sparkle icon and one line under it, "Tell AI what this is for and get a page
  structure." Empty means: at most three pages, none with any writing beyond a title. The editor answers this from
  the pages it already holds: a page whose writing it has not loaded is not known to be empty, and no page is
  loaded to find out. On a phone the same button sits in the Pages sheet, above New Page; the sheet closes as the
  dialog opens over the page.
- Once the knowledgebase is no longer empty the control leaves the sidebar. It stays in the knowledgebase menu as
  **Describe to Add Pages**, which adds to what is there instead of starting it. Until that menu is built it is a
  command of the command palette.
- Editor only, signed in. A Participant or Viewer never sees it, nor does anyone in a knowledgebase kept Offline.

## The flow

One centred dialog of steady height, in three steps.

1. **Describe.** A text field, "What Is This Knowledgebase For?", with an example under it ("The engineering
   handbook for a 12 person logistics startup: how we ship, on-call, architecture and decisions."), 20 to 1,000
   characters, and three example chips that fill it. The primary button is **Suggest a Structure**.
2. **Review.** The proposed page tree, indented as the sidebar draws it, each page with its title and one line on
   what belongs there. Every row has a checkbox (ticked) and its title can be renamed in place; unticking a page
   unticks its subpages, and ticking one ticks the pages above it. Above the tree: a suggested name for the knowledgebase, used only while it is still
   "Untitled Knowledgebase", editable. Buttons: **Create 14 Pages** (the count follows the ticks), **Try Again**
   (back to step 1 with the description kept) and Cancel. Nothing has been written yet.
3. **Create.** The pages are made in tree order under the top level (or under the current page, from **Describe to
   Add Pages**), in batches of 20 through the same write path as [Import](../020-import-export/knowledgebase-import.md),
   with a progress line. Each new page holds its title, its one line as the first paragraph in italics, and its
   suggested headings (Heading 1), each with an empty paragraph under it. The dialog closes on the first new page;
   if a page could not be made it stays open and says which.

- If the knowledgebase still has its untouched **Start Here** page, that page becomes the structure's first page
  (its writing replaced, since it had none); otherwise nothing existing is changed.
- New pages are Never Verified and have no owner. Nothing here verifies anything.
- One undo step per batch, as an import is; the dialog says so.

## The model

Describe to Set Up runs on the team's own AI key, Claude's or OpenAI's ([Providers](search-and-ask.md#providers)),
as [Ask](search-and-ask.md#ask) does: liveknowledge pays for no model.

- **No key yet:** step 1 is replaced by the same explanation Ask shows, with **Open AI Settings** for the Editor.
  Adding a key returns to step 1. **Offline** knowledgebases do not show the control (they have no server to hold
  a key).
- `POST …/setup/suggest` takes the description (and, for adding pages, the existing page titles in tree order) and
  answers a structure: a name, and up to **30** pages no more than **3** levels deep, each `{ title, summary,
headings (up to 6), parent }`. The api asks the model for JSON in a fixed shape and validates every field: titles
  at most 80 characters, summaries at most 200 (text over a bound is cut to it), no duplicate titles among siblings,
  a parent that is unknown or leads back to itself dropped with its subpages, anything else dropped. An answer
  that does not parse or leaves no valid page is "Could Not Suggest a Structure", with Try Again; never a raw error.
- The description is untrusted text to the model and the answer is untrusted text to the app: it is fenced in the
  request, and what comes back is only ever placed as text.
- The route answers a signed-in Editor in person only: not an API token, a guest or a share link's visitor.
- **Limits:** 5 suggestions a person an hour and 20 a knowledgebase a day (`SETUP_*`, counted in the room beside
  Ask's counters); one request, 4,000 output tokens at most. Failures (bad key, no credit, rate limited,
  overloaded, refused) read in the words Ask uses.
- Creating the pages meets the knowledgebase's page and depth limits; a structure that would pass them says so in
  step 2 and creates nothing.

## Share roles

| Action                         | Editor | Participant | Viewer |
| ------------------------------ | ------ | ----------- | ------ |
| See and use Describe to Set Up | yes    | no          | no     |
| See the pages it made          | yes    | yes         | yes    |

## Telemetry

One event when a structure is suggested (`UI·Used·SetupSuggested`) and one when pages are created
(`Tab·Created·FromSetup`), and one each time the dialog is opened (`UI·Opened·DescribeToSetUp`,
`UI·Opened·DescribeToAddPages`). Each event is three fixed words and nothing else: never the description, the
titles or the key, and **no count** (how many pages were suggested, ticked or created is not sent). An event has
no number field, and adding one is a change to the platform's telemetry, which this feature does not make.

## Not built

- **Describe to Add Pages** in the knowledgebase menu (the menu itself is not built); it is in the command palette.
- Counts in telemetry (how many pages were suggested or created): left out on purpose, see "Telemetry".
