# Describe to set up

Status: **built** ([blueprint](blueprints/describe-to-set-up.md); the request and its reading are in the
[knowledge package blueprint](blueprints/knowledge-package.md)). Asked for by the owner on 2026-11-20; built-in AI by
default on 2026-11-21. Driven in a browser against a stand-in; no real model, built-in or the team's, has answered
it. What is not built is listed at the foot.

A new knowledgebase is empty, and an empty page tree is the hardest part of starting one. The person describes what
the knowledgebase is for, and AI proposes a sensible structure of pages for them to accept.

## The start screen

- **Nothing behind it** (owner 2026-11-21): the start stands alone over a plain backdrop the colour of the app; no page,
  page tree, rails or bars of the new knowledgebase show behind it.

Owner, 2026-11-21: "When creating a new knowledgebase, show a start screen like the other apps." (This reverses
the earlier "no start screen".)

Owner, 2026-11-21, on the first build of it: the start "should be less about an individual page and more about the
structure of the whole knowledgebase". So every choice on it is a whole knowledgebase's shape, never one page.

Owner, 2026-11-21, again: "Templates should do more than create a single page, they should be entire knowledgebase
structures, not about the content so much." So the **structures are liveknowledge's templates**, wherever a
template is offered: this start, the landing page's template gallery ([Marketing site](../019-marketing/marketing-site.md)
"Structure" 3) and Home's **Start a Knowledgebase From** tiles ([Knowledgebase Home](knowledgebase-home.md)). Each is
the shape of a whole knowledgebase (its pages, their one-line summaries and the headings their writing sits under),
never sample writing. Outside the editor a structure is a link, `/new?structure=<id>`
([New document route](../007-editor/new-document-route.md) "The other parameters"), which makes a new knowledgebase
and picks that structure on its start, so it is created exactly as a pick here is.

- `/new`, the Explorer's New button and Home's **Make Your First Knowledgebase** make the knowledgebase straight
  away (its one page, **Start Here**, saved to the account for a signed-in person, Offline for a guest, as
  [Knowledgebases and pages](knowledgebases-and-pages.md) says) and open it on the **start screen**, the shared
  start panel every liveworkspace editor shows on a new item: titled **Start Your Knowledgebase**, with the line
  "Pick a shape for the whole knowledgebase: its pages, already in place. Or start blank, or describe it."
- **Its choices**, in the rail:
  - **Start**, first: **Blank Knowledgebase** (the first card), which closes onto Start Here, the caret in its
    Title; and **Describe to Set Up** (where it is offered: a signed-in Editor, not Offline), a card that closes the
    start and opens this feature's dialog over the empty knowledgebase, so the AI proposes a structure.
  - Then the **knowledgebase structures**, thirty-two, four to a group, grouped by who they are for: **Company
    ** (Company Knowledgebase, Team Handbook, Onboarding, People Operations), **Engineering** (Engineering
    Handbook, Runbooks and On-Call, Design System, API Docs), **Product** (Product Docs, Research
    Library, Project Hub, Product Strategy), **Customers** (Support Knowledgebase, Sales Playbook, Customer
    Success, Marketing Playbook), **Operations** (IT and Security, Finance and Legal, Data and Analytics, Meetings
    and Decisions), **Community** (Client Projects, Open Source Project, Community and Nonprofit, Event
    Planning), **Education** (Course Handbook, Study Notes, Training Academy, Research Lab) and **Personal** (Second
    Brain, Job Search, Recipe Book, Home Manual). A group has one name, never two joined by "and" (owner,
    2026-11-21). Owner, 2026-11-21: "Add more templates to give structure for lots
    of different use cases people might have", so the second sixteen reach past the software company: the business
    underneath it, work done with people outside a team, teaching and learning, and a knowledgebase of one's own. The
    groups run in that order, work for a company first and a person's own last. Each card shows the structure, not a picture of a page, and
    its page count ("12 Pages"). The search finds a structure by its name, its line or any of its page titles.
  - **A card's picture** (owner, 2026-11-21: the outline tiles "need massive improvements"): the knowledgebase it
    makes, as a miniature liveknowledge window on a wash of its group's colour. At the left the page tree, the
    structure's own top pages in its real titles, the first page with subpages opened on one or two of them and
    chosen; at the right that page, with a cover band in the group's colour, the structure's **emblem** as its page
    icon over the cover's edge, its title and a few lines of writing. Each group has its colour (Company violet,
    Engineering sky, Product fuchsia, Customers emerald, Operations indigo, Community orange, Education amber,
    Personal rose) and each structure its own emblem, none shared (a chef's hat for Recipe Book, a shield for IT and
    Security, a git fork for Open Source Project), so no two of the thirty-two cards look alike. Blank
    Knowledgebase is the same window holding only Start Here and an empty page with a plus for its icon; Describe
    to Set Up holds sparkles for its icon and pages still to come, drawn as placeholders. The window is drawn in the
    theme's own colours in light and dark (never re-lit by inverting it). On a phone's small tile the tree goes and
    the page fills the window. On hover the window lifts and the emblem grows a little; under reduced motion neither moves.
    The picture is decorative: the card's accessible name stays its name and line.
  - At the rail's foot, as liveplanner's Import: **Import**, which opens the knowledgebase's Import dialog (Markdown
    folder, Notion or Confluence archive); Describe to Set Up stays there too, as on liveplanner's start. Then
    Connect File where connecting works.
  - Under the choices, the **Sync Knowledgebase to Server** switch ([Save locations](../006-document/save-locations.md)).
- **Picking a structure** closes the start and creates its whole tree of pages in the knowledgebase, by the same
  path a Describe to Set Up suggestion is created by (step 3 of "The flow"): Start Here becomes the structure's
  first page, every page gets its title, its one italic line on what belongs on it and its headings with room to
  write under each, and the knowledgebase opens on its first page. The knowledgebase takes the structure's name
  ("Team Handbook") while it is still "Untitled Knowledgebase". A structure is at most 30 pages, 3 levels deep, its
  titles unique under each parent: the bounds a suggestion keeps. It is one undo step. Whoever picks it owns its pages
  (verification.md "The owner"): Start Here's place keeps the owner the create gave it, and each page added takes its
  creator from the save that makes it.
- The writing templates (Meeting Notes, Design Doc and the rest, `@liveknowledge/templates`) are a page's, so they
  are not on this start; the Community's tiles, which are pages too, are not either. No surface lists them any more:
  the landing gallery and Home offer structures. `/new?template=<kind>` still makes one, so an older link still opens.
  Adding a page from a writing template inside an existing knowledgebase is not built (see "Not built").
- The start cannot be closed by itself: Blank Knowledgebase is the way past it. Describe to Set Up and Import close
  it first, so cancelling their dialog leaves the person on the empty Start Here page.
- **Only for a knowledgebase just made here.** The start shows on the knowledgebase `/new` made, in the browser tab
  that made it (kept for that tab's session, so a reload keeps it), while Start Here is untouched (nothing written
  beyond its Title) and the person may edit it. Nobody else, and no other knowledgebase, ever sees it: a collaborator
  who opens the knowledgebase meanwhile sees the empty page.
- `/new?blank=1` (Start Blank) and `/new?template=<kind>` (older links to a writing template) skip it: they already
  say what to start with. `/new?structure=<id>` (the landing gallery's cards and Home's Start a Knowledgebase From
  tiles) opens it already picked: the knowledgebase is made, the start is offered and that structure is chosen on it
  at once, without the start being drawn, so its tree, its name and its one undo step are the pick's. An unknown id
  opens the start as `/new` does.
- **A tab with no page kind** (made by an agent, a script or an older client, with nothing on it) is read as an
  empty knowledgebase page as it is loaded, everywhere a stored tab is read (`withKnowledgebasePage` in
  `migrateStoredTab`), so it opens as an empty article page and never shows a start. Deleting a knowledgebase's
  last page from the page menu leaves an empty page to write on, not an empty tab.
- **Share roles:** an Editor or a Participant of the whole knowledgebase; a Viewer is never shown it.
- **Telemetry:** `UI·Used·StartBlank` for Blank Knowledgebase, `Tab·Created·FromStructure` when a structure's
  pages are made, and `UI·Opened·DescribeToSetUp` and `UI·Opened·KnowledgeImport` from its cards and foot. Which
  structure is not sent: the event is three fixed words.

## The control

- While a knowledgebase is **empty**, the sidebar shows **Describe to Set Up** directly above **New Page**: a
  full-width button with the sparkle icon. What it does ("Tell AI what this is for and get a page structure.") is
  its hover card, not a line under it. Empty means: at most three pages, none with any writing beyond a title. The editor answers this from
  the pages it already holds: a page whose writing it has not loaded is not known to be empty, and no page is
  loaded to find out. On a phone the same button sits in the Pages sheet, above New Page; the sheet closes as the
  dialog opens over the page.
- Once the knowledgebase is no longer empty the control leaves the sidebar. It stays in the knowledgebase menu as
  **Describe to Add Pages**, which adds to what is there instead of starting it. Until that menu is built it is a
  command of the command palette.
- An Editor or a Participant, signed in. A Viewer never sees it, nor does anyone in a knowledgebase kept Offline.

## The flow

One centred dialog of steady height, in three steps.

1. **Describe.** A text field, "What Is This Knowledgebase For?", with an example under it ("The engineering
   handbook for a 12 person logistics startup: how we ship, on-call, architecture and decisions."), 20 to 1,000
   characters, and three example chips that fill it, above the field (owner, 2026-11-22: "the try an example bits in
   the describe with AI screens should be above the textbox, not below it"). The primary button is **Suggest a
   Structure**.
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

Owner, 2026-11-21: Describe to Set Up runs on **built-in AI** by default, as liveplanner's
Describe a Plan does, so it works with no key at all.
The team's own AI key, Claude's or OpenAI's ([Providers](search-and-ask.md#providers)), is optional and is used when
one is set. (This reversed "runs on the team's own key; liveknowledge pays for no model", first for this feature;
since 2026-11-21 Ask, the conflict check and drafting a page from a gap run on built-in AI too:
[Built-in AI](search-and-ask.md#built-in-ai).)

- **Built-in AI.** With no key set, the suggestion is asked of Cloudflare Workers AI through the api's `AI` binding:
  no key and no secret, the binding is the credential, billed to liveknowledge's account. The model is the one
  liveplanner's Describe a Plan uses (`@cf/google/gemma-4-26b-a4b-it`, its thinking turned off). Under the field
  the dialog says, quietly, **Uses built-in AI**.
- **The team's key.** When the knowledgebase has a key, the suggestion runs on it instead, and the dialog says
  **Uses your team's key**. A key that is stored but cannot be opened is refused as Ask refuses it; it is never
  quietly swapped for built-in AI.
- **No key is no longer a stop.** The dialog has no "add your key" step: step 1 is there whether or not a key is
  set, and an Editor who never opens AI Settings can still set a knowledgebase up. **Offline** knowledgebases still
  do not show the control (there is no server to ask).
- `POST …/setup/suggest` takes the description (and, for adding pages, the existing page titles in tree order) and
  answers a structure: a name, up to **30** pages no more than **3** levels deep, each `{ title, summary,
headings (up to 6), parent }`, and which AI answered (`provider`: `built-in`, `anthropic` or `openai`). The api
  asks the model for JSON in a fixed shape and validates every field: titles at most 80 characters, summaries at
  most 200 (text over a bound is cut to it), no duplicate titles among siblings, a parent that is unknown or leads
  back to itself dropped with its subpages, anything else dropped. On built-in AI a reply that does not read is
  asked once more, with what was wrong with it (never the model's own earlier text): two asks at most, counted as
  one suggestion. An answer that still does not parse or leaves no valid page is "Could Not Suggest a Structure",
  with Try Again; never a raw error.
- The description is untrusted text to the model and the answer is untrusted text to the app: it is fenced in the
  request, and what comes back is only ever placed as text.
- The route answers a signed-in Editor or Participant in person only: not an API token, a guest or a share link's
  visitor.
- **Limits**, whichever AI answers: 5 suggestions a person an hour and 20 a knowledgebase a day (`SETUP_*`,
  counted in the room beside Ask's counters); one request, 4,000 output tokens at most. **On built-in AI also** 10
  a person a UTC day across every knowledgebase (`SETUP_BUILT_IN_PER_PERSON_PER_DAY`, liveplanner's per-account
  draft count of 10), since liveknowledge pays for those: a new knowledgebase never buys another ten. That count
  guards a bill, so a fault reaching it refuses the suggestion rather than lifting the cap. A built-in call that
  takes over 60 seconds is given up.
- **Failures read in words.** On the team's key: bad key, no credit, rate limited, overloaded, refused, in the
  words Ask uses. On built-in AI: "Built-in AI Is Not Set Up Here" (a deployment with no `AI` binding; adding the
  team's key in AI Settings is the way on), "You Have Used Today's 10 Built-In Suggestions" (try tomorrow, or add
  the team's key), and "The Built-In AI Could Not Answer" (try again in a moment).
- Creating the pages meets the knowledgebase's page and depth limits; a structure that would pass them says so in
  step 2 and creates nothing.

## Share roles

| Action                         | Editor | Participant | Viewer |
| ------------------------------ | ------ | ----------- | ------ |
| See and use Describe to Set Up | yes    | yes         | no     |
| See the pages it made          | yes    | yes         | yes    |

## Telemetry

One event when a structure is suggested, saying which AI answered (`UI·Used·SetupSuggested` on the team's key,
`UI·Used·SetupSuggestedBuiltIn` on built-in AI), and one when pages are created
(`Tab·Created·FromSetup`), and one each time the dialog is opened (`UI·Opened·DescribeToSetUp`,
`UI·Opened·DescribeToAddPages`). Each event is three fixed words and nothing else: never the description, the
titles or the key, and **no count** (how many pages were suggested, ticked or created is not sent). An event has
no number field, and adding one is a change to the platform's telemetry, which this feature does not make.

## Describe Structure on a page

Owner, 2026-11-21: "When I create a new page It goes into edit mode, id expect to see a button to the left of cancel
for Describe Structure which uses our built in AI or connected AI to define an initial structure for that page. Id
also expect to see it to the left of edit on a page with nothing written yet."

Describe to Set Up shapes a whole knowledgebase; **Describe Structure** shapes one empty page: the headings its writing
will sit under, a line under each on what goes there, and where it helps a list, a table or a callout to fill in.

- **Where it is.** A calm secondary button with the sparkle icon, named **Describe Structure**, standing on its own
  beside the floating page buttons (editing.md "The buttons"):
  - **while editing**, to the left of Cancel, while the draft has nothing under its Title (a page just made with New
    Page or Add Subpage opens here);
  - **while reading**, to the left of Edit, on a page with nothing written yet (the page "Nothing Written Yet" shows).
    Pressing it opens edit mode first, then the dialog.
  - Once the page has writing it is gone, in either mode. "Nothing written" is the test the empty page and Describe
    to Set Up use: nothing but the Title (and empty lines) in the page's writing, no drawing on it.
- **Who sees it:** a signed-in person who may edit the page (an Editor or a Participant of the knowledgebase, or a
  signed-in person with an edit link to that one page), never a Viewer, a link visitor without an account, an agent,
  or anyone in a knowledgebase kept **Offline** (there is no server to ask). It shows on Pages alone: not over Version
  History, Ask, Insights or a new knowledgebase's start screen.
- **The dialog**, centred (on a phone a sheet from the foot): titled **Describe Structure**, the line "Say what this
  page is for and AI drafts its headings. Nothing is saved until you press Save." One field, **What Is This Page For?**
  (up to 500 characters, optional when the page has a title), its placeholder built from the title ("What goes on
  Deploys, in your own words."), and under it the quiet line saying which AI answers, as Ask and Describe to Set Up say
  it (**Uses built-in AI**, or the key that answers Ask: the knowledgebase's, the team's or the person's own,
  [Which key answers](search-and-ask.md); where a key answers and built-in AI is here, the person's choice in Ask's
  picker applies here too). Buttons: Cancel and **Describe** (primary; `Mod-Enter` in the field). While it
  works the field is locked and Describe reads "Drafting..."; Cancel stops the request.
- **What it writes.** The structure lands in the page's **draft** at the top, under the Title: never saved, so it is the
  person's to change, Save or Cancel as any edit (Cancel on the bar asks before throwing it away, as it does for any
  unsaved change). It is one undo step. It holds at most 12 headings (Heading 2, with Heading 3 under them), each
  followed by one short italic line on what belongs there; where it helps, a bulleted, numbered or to-do list of
  placeholders, a table (its header row and one empty row) or a callout (a quote paragraph). At most 4,000 characters
  in all. It is plain text: no links, no pictures, nothing the app runs.
- **What the AI is told:** the page's title, the person's words, the knowledgebase's name and the titles of the pages
  in its tree (at most 200, with their depth), so the headings fit what is around them. Never any page's writing. A
  link to one page sends that page's title alone. All of it is fenced as material, never instructions, and the reply is
  read as JSON of blocks in one fixed shape, every field checked and cut to its bound; anything else is dropped.
- **The route:** `POST .../pages/<tab>/describe-structure` with `{ purpose, ai? }` (`ai: "built-in"` when the person
  chose built-in AI over a key) answers `{ blocks, provider }`; it writes nothing. A signed-in person in
  person who may edit pages; an API token is refused with 403 `needs_a_person`; a person without an account, 403.
- **Limits.** 10 a person an hour and 50 a knowledgebase a day, whichever AI answers (`STRUCTURE_*`, the room's
  counters). On built-in AI also **10 a person a UTC day** across every knowledgebase, counted apart from Describe to
  Set Up's suggestions; that count guards a bill, so a fault reaching it refuses rather than lifts the cap. On
  built-in AI a reply that does not read is asked once more, counted once. 2,000 output tokens at most.
- **Failures in words**, in a callout in the dialog: "Built-In AI Is Not Set Up Here", "You Have Used Today's 10
  Built-In Drafts", "You Have Asked for 10 Structures This Hour", "The AI Could Not Draft This Page" (a reply with no
  heading that reads, or built-in AI not answering), and on the team's key the words Ask uses for a bad key, no credit,
  a rate limit or a busy provider.

| Action                         | Editor          | Participant     | Viewer | Link visitor                                  | Agent                     |
| ------------------------------ | --------------- | --------------- | ------ | --------------------------------------------- | ------------------------- |
| See and use Describe Structure | yes (signed in) | yes (signed in) | no     | no (an edit link to one page: signed in only) | no (403 `needs_a_person`) |

- **Telemetry:** `UI·Opened·DescribeStructure` when the dialog opens, `UI·Used·DescribeStructure` when a structure
  lands in the draft. Three fixed words: never the words, the title or how many headings.

## Not built

- **Describe to Add Pages** in the knowledgebase menu (the menu itself is not built); it is in the command palette.
- Counts in telemetry (how many pages were suggested or created): left out on purpose, see "Telemetry".
- Built-in AI's spend across every account together has no ceiling of its own beyond the per-person and
  per-knowledgebase counts; an AI Gateway with a spend limit (liveplanner's `AI_GATEWAY`) is not wired here.
- **A page from a writing template inside a knowledgebase** (New Page from Meeting Notes, say): no entry offers it.
  The writing templates stay in `@liveknowledge/templates` for `/new?template=` and for that entry when it is built.
