# Templates by mode

Every template opens in Workshop, livehuddle's one [editor mode](editor-modes.md). They wait on an empty tab in Start a
Workshop ([Template starts](start-diagramming.md)), grouped by the catalogue's categories. Templates built from the
elements cut with Diagram and Draw are not in the catalogue, and step 5.4 of the
[Build plan](../005-project-roadmap/build-plan.md) cut the rest to Workshop's and the Spaces: the catalogue is the
templates below and nothing else ([Templates](../012-collaboration/workshop-mode.md#templates)).

## A template's mode

- A template's tab opens in Workshop (`Tab.opensIn: 'workshop'`, through `templateCanvasOverrides`).

## The blank

**Blank Space** (`blank-session`) is the one blank: an empty tab, and a space named "Untitled Space"
([Domain language](../003-system-architecture/domain-language.md#space)). It leads Popular and Start a Space's
Recommended, is on no category shelf or tile, and is what a new space starts from. It was **Blank Workshop**, making
"Untitled Workshop", before the noun settled; a space still carrying that name, or "Untitled canvas", counts as
untitled.

- livediagram's other blanks, Blank Diagram (`blank`) and Blank Whiteboard (`whiteboard`), left with step 5.4. A link,
  an agent or a seed naming either is answered as any unknown kind is, with Blank Space.
- Boards, Sheets and form templates (Blank Plan, Blank Spreadsheet, Kanban Board and the rest) are liveplanner's
  ([Editor modes](editor-modes.md) "Stored tabs from other products' modes"). A link, an agent or a seed naming one
  is answered as any unknown kind is (`retired-templates.test.ts`).
- Popular, in order: Blank Space, Sailboat retrospective, Retrospective, Town Hall Q&A, Lean Coffee, Crazy 8s, Pub
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
- Start a Space groups them by the catalogue's categories, as every start does ([Start
  diagramming](start-diagramming.md) "Recommended and groups").

## Testing

- Every template opens in Workshop (`templates.test.ts`).
- Popular starts with Blank Space (`popular.test.ts`).
- Every category holds a template (`template-categories.test.ts`).
- The catalogue is the Workshop templates above, thirty-nine with the blank (`templates.test.ts`'s
  kind list, the `TemplateKind` union and `TEMPLATES` move together).

## The tab's name

- A template picked on a start or on /new names the tab it fills after itself, (a retrospective's tab is
  "Retrospective"): the template's title. It does
  so whatever the tab was called before. A blank template leaves the name as it was (`templateTabName`).

## The document's name

- A template picked on a start names the **document** after itself too, as /new names a document after the template
  it is made from: "Untitled Retrospective", the blank "Untitled Space" (`untitledNameForTemplate`).
- Only while the document still has a default name: one of those untitled names (`isDefaultDocumentName`, any
  template's, or the legacy "Untitled diagram"; a blank's names are the shared `isUntitledName` list, which the first label's naming uses too). A name someone gave it, or the first element's label the editor
  named it after ([Name length](../006-document/name-length.md)), is kept.
- Only for the document's **first** tab: a template filling a later tab names that tab, not the document.
- It is the document's name like any other: saved with it, shown in the header and the Explorer at once, and changed
  by renaming. No telemetry: it is not a person's rename.
