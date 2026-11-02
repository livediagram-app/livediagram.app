# Templates by mode

Every template opens in Workshop, livehuddle's one [editor mode](editor-modes.md). They wait on an empty tab in Start a
Workshop ([Template starts](start-diagramming.md)), grouped by the catalogue's categories. Templates built from the
elements cut with Diagram and Draw are not in the catalogue
([Templates](../012-collaboration/workshop-mode.md#templates)); step 5.4 of the
[Build plan](../005-project-roadmap/build-plan.md) cuts the rest to Workshop's and the Spaces.

## A template's mode

- A template's tab opens in Workshop (`Tab.opensIn: 'workshop'`, through `templateCanvasOverrides`).

## The blank

**Blank Workshop** (`blank-session`) is the one blank: an empty tab named "Untitled Workshop". It leads Popular and
Start a Workshop's Recommended, is on no category shelf or tile, and is what a new document starts from.

- livediagram's other blanks, Blank Diagram (`blank`) and Blank Whiteboard (`whiteboard`), stay in the catalogue
  until build plan step 5.4, each an empty general tab that opens in Workshop. Neither leads Popular or a start.
- Boards, Sheets and form templates (Blank Plan, Blank Spreadsheet, Kanban Board and the rest) are liveplanner's
  ([Editor modes](editor-modes.md) "Stored tabs from other products' modes"). A link, an agent or a seed naming one
  is answered as any unknown kind is (`retired-templates.test.ts`).
- Popular, in order: Blank Workshop, Sailboat retrospective, Retrospective, Town Hall Q&A, Lean Coffee, Crazy 8s, Pub
  Quiz ([Template categories](../008-canvas/canvas-and-palette.md#template-categories)).

## Workshop templates

The session formats ([Workshop mode](../012-collaboration/workshop-mode.md#templates)), with the Collaborate kit and
the Session strip there when the session starts:

- The Retrospectives family's **Retrospective** (`retrospective`), **Start, Stop, Continue**
  (`start-stop-continue`), **Mad, Sad, Glad** (`mad-sad-glad`), **4Ls** (`four-ls`) and **Sailboat**
  (`sailboat`).
- **Town Hall Q&A** (`town-hall`), **Lean Coffee** (`lean-coffee`), **Crazy Eights**
  (`crazy-eights`), **Meeting Agenda** (`meeting-agenda`), **Workshop Board** (`workshop-board`) and
  **Brainstorm Board** (`brainstorm`).
- The boards that ship a dot vote: **Affinity Map** (`affinity-map`), **Prioritization Matrix**
  (`prioritization-matrix`) and **Risk Matrix** (`risk-matrix`).
- The boards a team fills in together in a session, rather than a diagram one person draws: **Incident
  postmortem** (`incident-postmortem`), **User Persona** (`user-persona`), **Empathy Map** (`empathy-map`), **User
  Journey** (`journey`), **Objectives Planner** (`objectives-planner`), **Roadmap** (`roadmap`), **RACI Matrix**
  (`raci-matrix`), **User Story Map** (`user-story-map`), **SWOT** (`swot`), **PESTLE Analysis**
  (`pestle-analysis`), **Business Model Canvas** (`business-model-canvas`), **Value Proposition Canvas**
  (`value-proposition-canvas`), **Stakeholder map** (`stakeholder-map`), **Opportunity Solution Tree**
  (`opportunity-solution-tree`) and **KWL Chart** (`kwl-chart`, a class's board). A board built from sticky notes for a group to add theirs to is a session's work: a note per voice.
- The spaces: **Virtual Office** (`virtual-office`), **Coworking Space** (`coworking-space`), **Team Pod**
  (`team-pod`) and **All-Hands Hall** (`all-hands-hall`), in the **Virtual Spaces** category ([Virtual Office
  template](../012-collaboration/virtual-office-template.md)).
- The games: **Pub Quiz** (`pub-quiz`), **Icebreaker Questions** (`icebreaker-questions`), **Two Truths and a Lie**
  (`two-truths-and-a-lie`), **Would You Rather** (`would-you-rather`) and **Find Someone Who Bingo**
  (`people-bingo`), in **Quizzes & Games** ([Quiz and game templates](../012-collaboration/quiz-and-game-templates.md)).
- Start a Workshop groups them by the catalogue's categories, as every start does ([Start
  diagramming](start-diagramming.md) "Recommended and groups").

## Drawn templates

Drawn in freehand strokes (with a slight hand wobble, so
the board reads as drawn, not ruled), sticky notes, text and stickers. Each is a real example to
draw over, not an empty frame. They open in Workshop like every template; each one's category is in [Template
categories](../008-canvas/canvas-and-palette.md#template-categories).

- **Sketchnote**: visual notes from a talk ("How we ship on Fridays"): a hand-lettered
  banner title, the speaker and date, a cloud holding the big idea at the centre, three framed
  areas (Key points, Quotes, Questions) joined to it by drawn arrows, a lightbulb doodle and a
  takeaway banner along the bottom.
- **Rich Picture**: a systems-thinking rich picture of a problem (a hospital's
  discharge delays): stick-figure stakeholders with what they say in speech bubbles, the system in
  a drawn cloud, crossed swords where interests clash, an eye for who is watching, and a legend
  that teaches the symbols.
- **Comic Strip**: a six-panel product story ("Maya finds the bug") in hand-drawn panels,
  each with a caption, speech bubbles and a sticker for the moment it shows.
- **Doodle Warm-Up**: a meeting icebreaker, "Draw your teammate in 60 seconds": six
  hand-drawn frames each named for a teammate, the rules on a sticky note, a timer and a
  "best likeness" vote with sticker stars.
- **Paper Prototype**: three hand-drawn phone screens of a made-up app, lo-fi UI in
  marker, tap arrows from one screen to the next, and stickies with what to test with users.
- **Journey Doodle**: a customer's day as a winding drawn road, each stop a doodle with
  a face for how it felt, the dip where it goes wrong ringed, and opportunities on stickies.
- **Pre-Mortem**: "It's a year from now and the project failed": a drawn wreck in the
  middle, the reasons on stickies round it by theme, and what to do now with tick boxes.
- **Idea Garden**: ideas grown as a drawn tree: the question at the roots, themes as
  branches, ideas as leaves, the best ones as fruit, and a legend.

## Testing

- Every template opens in Workshop (`templates.test.ts`).
- Popular starts with Blank Workshop (`popular.test.ts`).
- Every category holds a template (`template-categories.test.ts`).

## The tab's name

- A template picked on a start or on /new names the tab it fills after itself, (a retrospective's tab is
  "Retrospective"): the template's title. It does
  so whatever the tab was called before. A blank template leaves the name as it was (`templateTabName`).

## The document's name

- A template picked on a start names the **document** after itself too, as /new names a document after the template
  it is made from: "Untitled Retrospective", the blank "Untitled Workshop" (`untitledNameForTemplate`).
- Only while the document still has a default name: one of those untitled names (`isDefaultDocumentName`, any
  template's, or the legacy "Untitled diagram"; a blank's names are the shared `isUntitledName` list, which the first label's naming uses too). A name someone gave it, or the first element's label the editor
  named it after ([Name length](../006-document/name-length.md)), is kept.
- Only for the document's **first** tab: a template filling a later tab names that tab, not the document.
- It is the document's name like any other: saved with it, shown in the header and the Explorer at once, and changed
  by renaming. No telemetry: it is not a person's rename.
