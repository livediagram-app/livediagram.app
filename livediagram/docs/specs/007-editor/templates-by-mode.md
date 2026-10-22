# Templates by mode

Every template opens in one [editor mode](editor-modes.md): **Diagram**, **Draw**,
**Workshop** or **Plan**. The New Document wizard asks for the mode itself
([New document route](new-document-route.md) "Choosing a mode"), and each mode's templates wait on an empty tab in
its own start ([Template starts](start-diagramming.md)), so someone who came to sketch or to run a session sees only
what starts there. A search on a start also finds the other modes' templates, each saying which mode it opens in
([Found in other modes](start-diagramming.md#found-in-other-modes)).

## A template's mode

- A template's mode is the mode its tab **opens in** (`Tab.opensIn`, absent = Diagram).
- `templateEditorMode(kind)` in `packages/templates` is the one place it is declared. The template's
  canvas overrides (`templateCanvasOverrides`) take `opensIn` from it, so the mode a card shows and
  the mode the tab opens in can never disagree.
- Draw templates: Blank Whiteboard and the eight [Draw templates](#draw-templates) below.
- Plan templates: Blank Plan and the twenty-two [Plan templates](../026-plan/plan-templates.md), Kanban Board
  among them. Plan templates open on a worked example of cards: each but Blank Plan sets up a way of working across
  several tabs, or a ready-made spreadsheet (the twelve
  [spreadsheet templates](../026-plan/plan-templates.md#spreadsheet-templates)), every tab opening in Plan.
- Workshop templates: Blank Session and the [Workshop templates](#workshop-templates)
  below.
- Every other template is a Diagram template.

## The mode on a card

- On its own mode's start a card needs no mode: every card there opens in it.
- Found from another mode's start, a card says where it leads: a quiet chip under its line, the mode's glyph
  (`EDITOR_MODE_ICONS`, the glyphs of the mode switch) and "Opens in <Mode>", and a screen reader hears "in <Mode>"
  **after** the title, so a card's accessible name still starts with its title
  ([Found in other modes](start-diagramming.md#found-in-other-modes)).

## Four blanks

Popular opens with one blank per mode, in mode order. Each blank also leads its mode's Recommended in that mode's
start ([Template starts](start-diagramming.md)), and is what the New Document wizard creates for the mode chosen:

| Template         | Kind id         | Opens in | What it makes                                       |
| ---------------- | --------------- | -------- | --------------------------------------------------- |
| Blank Diagram    | `blank`         | Diagram  | An empty canvas (was "Blank Canvas").               |
| Blank Whiteboard | `whiteboard`    | Draw     | An empty board to draw on (was "Whiteboard").       |
| Blank Session    | `blank-session` | Workshop | An empty tab in Workshop, named "Untitled Session". |
| Blank Plan       | `blank-plan`    | Plan     | An empty Plan tab that opens on Start Planning.     |

**Blank Spreadsheet** (`blank-spreadsheet`, Plan) is a fifth blank beside them (`EXTRA_BLANK_TEMPLATES`): one tab
holding an empty Sheet that fills it, made from the `blank-spreadsheet` start, an empty grid with no template, no
charts and no setup to await ([Sheet store](../029-sheets/sheet-store.md#template-starts)). It is a blank like the four
(`isBlankTemplate`): in no category and on no category shelf. It is not a mode's blank, so it leads no start and is
not what the New Document wizard creates; the editor's Popular lists are unchanged (a start's search finds it, under
Plan in [other modes](start-diagramming.md#found-in-other-modes)), and Start Planning, which has its own Empty Sheet, does not offer it. The landing page's **Blank Slate**
shelf lists it after Blank Plan ([Marketing site](../019-marketing/marketing-site.md)).

- The kind ids of the first two are unchanged, so `/new?template=blank` and
  `/new?template=whiteboard` links keep working.
- None of the blanks is on a category shelf or a category tile.
- Popular under Everything, in order: Blank Diagram, Blank Whiteboard, Blank Session, Blank Plan,
  Mind map, Flowchart, Kanban Board, Sailboat retrospective, Budget Planner, Org chart, Sketchnote. Under a
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
- **Comic Strip** _(Design)_: a six-panel product story ("Maya finds the bug") in hand-drawn panels,
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

## Workshop templates

Session formats open in Workshop ([Workshop mode](../012-collaboration/workshop-mode.md#templates)),
so the Collaborate kit and the Session strip are there when the session starts. Their content is
unchanged; only the mode they open in moved from Diagram.

- The Retrospectives family's **Retrospective** (`retrospective`), **Start, Stop, Continue**
  (`start-stop-continue`), **Mad, Sad, Glad** (`mad-sad-glad`), **4Ls** (`four-ls`) and **Sailboat**
  (`sailboat`). **Team Retro** (`team-retro`) stays in Plan: it is a board of cards.
- **Town Hall Q&A** (`town-hall`), **Lean Coffee** (`lean-coffee`), **Crazy Eights**
  (`crazy-eights`), **Meeting Agenda** (`meeting-agenda`), **Workshop Board** (`workshop-board`) and
  **Brainstorm Board** (`brainstorm`).
- The boards that ship a dot vote: **Affinity Map** (`affinity-map`), **Prioritization Matrix**
  (`prioritization-matrix`) and **Risk Matrix** (`risk-matrix`). Diagram has no Session strip, so a
  vote on a Diagram tab could be started but not watched, ended or kept; every template carrying a
  session tool opens in Workshop.
- The boards a team fills in together in a session, rather than a diagram one person draws: **Incident
  postmortem** (`incident-postmortem`, a look back, under Retrospectives), **User Persona** (`user-persona`),
  **Empathy Map** (`empathy-map`) and **User Journey** (`journey`), under Workshops, the **Planning** group's **Objectives Planner** (`objectives-planner`), **Roadmap** (`roadmap`),
  **RACI Matrix** (`raci-matrix`) and **User Story Map** (`user-story-map`), and the **Strategy** group's **SWOT** (`swot`), **Business
  Model Canvas** (`business-model-canvas`), **Value Proposition Canvas** (`value-proposition-canvas`), **Stakeholder
  map** (`stakeholder-map`) and **Opportunity Solution Tree** (`opportunity-solution-tree`). Their catalogue
  categories are unchanged. **A board built from sticky notes for a group to add theirs to is a Workshop
  template**: a note per voice is the room's work. SWOT, Empathy Map and User Journey moved from Diagram for it; a
  Diagram template may still carry a sticky or two as an annotation (Family Tree, Flywheel, Sequence Diagram) and
  stays a diagram. Event Storming is its own kind of tab and keeps its own mode.
- The **Spaces** group, after Meetings: **Virtual Office** (`virtual-office`), **Coworking Space**
  (`coworking-space`), **Team Pod** (`team-pod`) and **All-Hands Hall** (`all-hands-hall`), "Offices and halls to walk
  round together in Avatar mode." ([Virtual Office template](../012-collaboration/virtual-office-template.md)).
- The **Quizzes & Games** group, after Spaces: **Pub Quiz** (`pub-quiz`), **Icebreaker Questions**
  (`icebreaker-questions`), **Two Truths and a Lie** (`two-truths-and-a-lie`), **Would You Rather**
  (`would-you-rather`) and **Find Someone Who Bingo** (`people-bingo`), "Quizzes, icebreakers and games to warm up
  the room." ([Quiz and game templates](../012-collaboration/quiz-and-game-templates.md)).

## Testing

- Every template's mode equals the mode its overrides open it in (`templates.test.ts`).
- Every template carrying a session tool (timer, vote, poll) opens in Workshop (`templates.test.ts`).
- Every Popular list starts with its mode's blank and holds only that mode's templates (`popular.test.ts`).
- Every category holds a template in at least one mode (`template-categories.test.ts`).
- A card found from another mode's start shows "Opens in <Mode>" (`StartPanel.test.tsx`).

## The tab's name

- A template picked on a start or on /new names the tab it fills after itself, in every mode (a flowchart's
  tab is "Flowchart"): the template's own name for the tab where it gives one
  (a Plan template's tabs), else for a Board or Sheet template the board's title, else the template's title. It does
  so whatever the tab was called before. A blank template leaves the name as it was (`templateTabName`).

## The document's name

- A template picked on a start names the **document** after itself too, as /new names a document after the template
  it is made from: "Untitled Flowchart", "Untitled Kanban Board", a blank naming what it makes ("Untitled
  Whiteboard"), Blank Diagram "Untitled document" (`untitledNameForTemplate`).
- Only while the document still has a default name: one of those untitled names (`isDefaultDocumentName`, any
  template's, or the legacy "Untitled diagram"). A name someone gave it, or the first element's label the editor
  named it after ([Name length](../006-document/name-length.md)), is kept.
- Only for the document's **first** tab: a template filling a later tab names that tab, not the document.
- **Start Planning's own picks name it too**: a board preset, a sheet start, a form, a dashboard layout or a
  visualisation picked for the first tab names a still-untitled document after the title that tab takes ("Untitled
  Bug Tracker", "Untitled Gantt Chart"), read once the tab has changed (`usePlanStartDocumentName`). Before, only
  Start Planning's template cards did, so most new Plan documents stayed "Untitled Plan". Only a change seen in the
  session counts (opening a document on a Plan tab is not a start), only for someone who can edit, and a name the
  start gave the document itself (a template's) is kept.
- It is the document's name like any other: saved with it, shown in the header and the Explorer at once, and changed
  by renaming. No telemetry: it is not a person's rename.
