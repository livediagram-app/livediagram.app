# Templates by mode

Every template opens in one [editor mode](editor-modes.md): **Diagram**, **Draw**,
**Facilitate**, **Illustrate** or **Plan**. Quick Start ([Templates](../008-canvas/canvas-and-palette.md#templates))
says which on every card, and lets a person narrow the whole catalogue to one mode, so someone who came to sketch or to
make a poster sees only what starts there. The New Document wizard asks for the mode itself
([New document route](new-document-route.md) "Choosing a mode"), and each mode's templates wait on an empty tab in
its own start ([Template starts](start-diagramming.md)).

## A template's mode

- A template's mode is the mode its tab **opens in** (`Tab.opensIn`, absent = Diagram).
- `templateEditorMode(kind)` in `packages/templates` is the one place it is declared. The template's
  canvas overrides (`templateCanvasOverrides`) take `opensIn` from it, so the mode a card shows and
  the mode the tab opens in can never disagree.
- Draw templates: Blank Whiteboard and the eight [Draw templates](#draw-templates) below.
- Illustrate templates: Blank Illustration, Article, Slide deck, Logo design, Group card and the
  eight [Illustrate templates](#illustrate-templates) below.
- Plan templates: Blank Plan and the twenty-two [Plan templates](../026-plan/plan-templates.md), Kanban Board
  among them. Plan templates come with no cards: each but Blank Plan sets up a way of working across
  several tabs, or a ready-made spreadsheet (the twelve
  [spreadsheet templates](../026-plan/plan-templates.md#spreadsheet-templates)), every tab opening in Plan.
- Facilitate templates: Blank Session and the twelve [Facilitate templates](#facilitate-templates)
  below.
- Every other template is a Diagram template.

## The mode filter

- A **dropdown** sits **to the left of the search box**, as tall as it, named "Show templates for":
  a chip showing the choice in force (its glyph, its name, a chevron) over a menu of
  **Everything**, **Diagram**, **Draw**, **Facilitate**, **Illustrate** and **Plan**, each with its glyph (a grid for
  Everything, `EDITOR_MODE_ICON` for the modes, the glyphs of the mode switch) and how many
  templates it holds, in a count badge. A dropdown, not a row of buttons, so a mode added later is one more row.
  **Everything** is the default and is chosen each time Quick Start opens; the choice is not
  remembered.
- **Hovering the chip** with a mouse opens the menu without moving focus, so the choice is in plain
  sight; it closes a moment (`HOVER_CLOSE_MS`, 200ms) after the pointer leaves the chip and menu. A
  press or the keyboard opens it as a menu button does (focus on the checked row); opened that way
  it stays until a choice, Escape or an outside press. A press on a menu the hover opened keeps it.
- On a phone (below `sm`) the control takes its own full-width row above the search box, so the
  search keeps its width.
- Choosing a mode narrows **everything the step shows** to templates of that mode:
  - **Popular** shows that mode's own curated list, the mode's blank first (`POPULAR_BY_MODE` in
    `packages/templates`, [Template categories](../008-canvas/canvas-and-palette.md#template-categories)), as the
    marketing gallery's does.
  - The **open shelf** shows only its templates of that mode, cross-listed ones included.
  - **Explore More Categories** shows only categories holding at least one template of that mode,
    each tile's count, fan and the "N more categories, M more templates" line counting only
    those templates.
  - **Search** results are the matches of that mode only; the empty state names the mode
    ("No Draw templates match …"), and when the search does match in other modes it offers them:
    a **Show N matches in Everything** button switches to Everything, the search kept.
- If the open shelf has none of the mode's templates, **Popular** opens instead.
- If the selected template is not of the mode, the selection moves to the mode's blank (Blank
  Diagram, Blank Whiteboard, Blank Session, Blank Illustration or Blank Plan; Everything keeps the selection), so one card is always
  selected and Next never starts something the person filtered away.
- The control is a menu button (docs/specs/004-interface-design/menus.md): the chip says it opens a
  menu and whether it is open, the rows are `menuitemradio` with the choice checked.
- Each choice sends `UI` / `Toggled` / `TemplateModeAll`, `TemplateModeDiagram`, `TemplateModeDraw`,
  `TemplateModeIllustrate`, `TemplateModePlan` or `TemplateModeFacilitate` ([Telemetry](../017-telemetry/telemetry.md)).

## The mode on a card

- Every template card shows its mode's glyph **to the left of its title**, in the muted text
  colour, 14px. The glyph is a picture only: a screen reader hears "Opens in <Mode>" **after** the
  title (", Opens in Draw"), so a card's accessible name still starts with its title.
- Category tiles carry no glyph: a category can hold templates of several modes.

## Five blanks

Popular opens with one blank per mode, in mode order. Each blank also leads its mode's Recommended in that mode's
start ([Template starts](start-diagramming.md)), and is what the New Document wizard creates for the mode chosen:

| Template           | Kind id              | Opens in   | What it makes                                                                  |
| ------------------ | -------------------- | ---------- | ------------------------------------------------------------------------------ |
| Blank Diagram      | `blank`              | Diagram    | An empty canvas (was "Blank Canvas").                                          |
| Blank Whiteboard   | `whiteboard`         | Draw       | An empty board to draw on (was "Whiteboard").                                  |
| Blank Session      | `blank-session`      | Facilitate | An empty tab in Facilitate, named "Untitled Session".                          |
| Blank Illustration | `blank-illustration` | Illustrate | One empty page that asks what it is for (Infographic, Article, Slide or Logo). |
| Blank Plan         | `blank-plan`         | Plan       | An empty Plan tab that opens on Start Planning.                                |

**Blank Spreadsheet** (`blank-spreadsheet`, Plan) is a sixth blank beside them (`EXTRA_BLANK_TEMPLATES`): one tab
holding an empty Sheet that fills it, made from the `blank-spreadsheet` start, an empty grid with no template, no
charts and no setup to await ([Sheet store](../029-sheets/sheet-store.md#template-starts)). It is a blank like the five
(`isBlankTemplate`): in no category and on no category shelf. It is not a mode's blank, so it leads no start and is
not what the New Document wizard creates; the editor's Popular lists are unchanged (the Quick Start finds it by
search), and Start Planning, which has its own Empty Sheet, does not offer it. The landing page's **Blank Slate**
shelf lists it after Blank Plan ([Marketing site](../019-marketing/marketing-site.md)).

- The kind ids of the first two are unchanged, so `/new?template=blank` and
  `/new?template=whiteboard` links keep working.
- None of the blanks is on a category shelf or a category tile.
- Popular under Everything, in order: Blank Diagram, Blank Whiteboard, Blank Session, Blank Illustration, Blank Plan,
  Mind map, Flowchart, Kanban Board, Sailboat retrospective, Budget Planner, Org chart, Sketchnote, Article. Under a
  mode, its own list ([Template categories](../008-canvas/canvas-and-palette.md#template-categories)).

## Draw templates

Drawn with the marks a person makes in Draw mode: freehand strokes (with a slight hand wobble, so
the board reads as drawn, not ruled), sticky notes, text and stickers. Each is a real example to
draw over, not an empty frame.

- **Sketchnote** _(Brainstorm)_: visual notes from a talk ("How we ship on Fridays"): a hand-lettered
  banner title, the speaker and date, a cloud holding the big idea at the centre, three framed
  areas (Key points, Quotes, Questions) joined to it by drawn arrows, a lightbulb doodle and a
  takeaway banner along the bottom.
- **Rich Picture** _(Strategy)_: a systems-thinking rich picture of a problem (a hospital's
  discharge delays): stick-figure stakeholders with what they say in speech bubbles, the system in
  a drawn cloud, crossed swords where interests clash, an eye for who is watching, and a legend
  that teaches the symbols.
- **Comic Strip** _(Presentations)_: a six-panel product story ("Maya finds the bug") in hand-drawn panels,
  each with a caption, speech bubbles and a sticker for the moment it shows.
- **Doodle Warm-Up** _(Brainstorm)_: a meeting icebreaker, "Draw your teammate in 60 seconds": six
  hand-drawn frames each named for a teammate, the rules on a sticky note, a timer and a
  "best likeness" vote with sticker stars.
- **Paper Prototype** _(Design)_: three hand-drawn phone screens of a made-up app, lo-fi UI in
  marker, tap arrows from one screen to the next, and stickies with what to test with users.
- **Journey Doodle** _(Design)_: a customer's day as a winding drawn road, each stop a doodle with
  a face for how it felt, the dip where it goes wrong ringed, and opportunities on stickies.
- **Pre-Mortem** _(Workshops)_: "It's a year from now and the project failed": a drawn wreck in the
  middle, the reasons on stickies round it by theme, and what to do now with tick boxes.
- **Idea Garden** _(Brainstorm)_: ideas grown as a drawn tree: the question at the roots, themes as
  branches, ideas as leaves, the best ones as fruit, and a legend.

## Illustrate templates

Each opens on pages of its own ([Templates on pages](../008-canvas/canvas-and-palette.md#templates-on-pages)),
already infographic pages, built with the page layouts' kit.

- **Event Poster** _(Presentations)_: one A3 portrait page for a community event ("Night Market"): a
  bold title over a colour band, the date, time and place, an image placeholder, three highlights
  and a footer line.
- **Year in Review** _(Presentations)_: a four-page A4 report for a small team: a cover, a page of
  headline numbers, a timeline of the year's moments, and a thank-you page with a quote.
- **Résumé** _(Presentations)_: one A4 page: name and role, contact line, a profile, an experience timeline,
  skills and education in a side column.
- **Recipe Card** _(Presentations)_: a Square page and a Portrait post page for sharing a recipe: the dish,
  serves and timings with icons, the ingredients, and the method in numbered steps.
- **Data Story** _(Presentations)_: one A4 page telling one story in numbers: a headline stat set huge,
  a pictogram row, a then-and-now comparison, a small chart and a source line.
- **How It Works** _(Presentations)_: one Story (9:16) page: five illustrated steps down a winding
  path, from first tap to done, under a title and over a call to action.
- **Versus** _(Presentations)_: one Portrait post (4:5) page split between two options, a VS badge,
  matched rows of pros and cons, and a verdict at the foot.
- **Social Carousel** _(Presentations)_: five Square slides for a LinkedIn or Instagram carousel: a hook,
  three tips and a call to action, with slide numbers and swipe cues.

## Facilitate templates

Session formats open in Facilitate ([Facilitate mode](../012-collaboration/facilitate-mode.md#templates)),
so the Collaborate kit and the Session strip are there when the session starts. Their content is
unchanged; only the mode they open in moved from Diagram.

- The Retrospectives family's **Retrospective** (`retrospective`), **Start, Stop, Continue**
  (`start-stop-continue`), **Mad, Sad, Glad** (`mad-sad-glad`), **4Ls** (`four-ls`) and **Sailboat**
  (`sailboat`). **Team Retro** (`team-retro`) stays in Plan: it is a board of cards.
- **Town Hall Q&A** (`town-hall`), **Lean Coffee** (`lean-coffee`), **Crazy Eights**
  (`crazy-eights`) and **Meeting Agenda** (`meeting-agenda`).
- The boards that ship a dot vote: **Affinity map** (`affinity-map`), **Prioritization matrix**
  (`prioritization-matrix`) and **Risk matrix** (`risk-matrix`). Diagram has no Session strip, so a
  vote on a Diagram tab could be started but not watched, ended or kept; every template carrying a
  session tool opens in Facilitate.

## Testing

- Every template's mode equals the mode its overrides open it in (`templates.test.ts`).
- Every template carrying a session tool (timer, vote, poll) opens in Facilitate (`templates.test.ts`).
- Every Popular list starts with its mode's blank and holds only that mode's templates (`popular.test.ts`).
- Every category holds a template in at least one mode (`template-categories.test.ts`).
- The filter: each option narrows Popular, shelves, tiles, counts and search to its
  mode; an emptied open shelf falls back to Popular; a filtered-away selection falls back to the
  mode's blank.
- Every card shows its mode glyph with "Opens in <Mode>".

## The tab's name

- A template picked in the Quick Start or on /new names the tab it fills after itself, in every mode (a flowchart's
  tab is "Flowchart", an infographic's its template's title): the template's own name for the tab where it gives one
  (a Plan template's tabs), else for a Board or Sheet template the board's title, else the template's title. It does
  so whatever the tab was called before. A blank template leaves the name as it was (`templateTabName`).
