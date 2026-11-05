# Templates by mode

Status: **shipped** (Work Tracker #423, part 3).

Every template opens on a meeting board, livehuddle's one [editor mode](editor-modes.md)
([The meeting board](../012-collaboration/workshop-mode.md)). They wait on an empty tab in Start a Space
([Template starts](start-diagramming.md)). livehuddle is for meeting in Spaces, so the catalogue is the Spaces and the
blank and nothing else ([Templates](../012-collaboration/workshop-mode.md#templates)); the retrospectives, workshops,
planning boards and games are livediagram's ([Not in livehuddle](../002-project-scope/not-in-livehuddle.md)).

## A template's mode

- A template's tab opens on a meeting board (`Tab.opensIn: 'workshop'`, through `templateCanvasOverrides`).

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
- Popular, in order: Blank Space, Virtual Office, Team Pod, Coworking Space, All-Hands Hall
  ([Template categories](../008-canvas/canvas-and-palette.md#template-categories)).

## The catalogue

- Ten Spaces in four categories ([Template categories](../008-canvas/canvas-and-palette.md#template-categories),
  [Virtual Office template](../012-collaboration/virtual-office-template.md)):
  - **Office**: **Virtual Office** (`virtual-office`), **Coworking Space** (`coworking-space`), **Team Pod**
    (`team-pod`) and **Focus Library** (`focus-library`).
  - **Events**: **All-Hands Hall** (`all-hands-hall`) and **Training Room** (`training-room`).
  - **Recreation**: **Rooftop Bar** (`rooftop-bar`) and **Cafe** (`cafe`).
  - **Outdoor**: **Garden Retreat** (`garden-retreat`) and **City Park** (`city-park`).
- Start a Space shows each category as a group, Office first, then Recommended, then Events, Outdoor and Recreation
  ([Start diagramming](start-diagramming.md) "The Spaces lead").
- **Gone** (part 3): the Retrospectives family (`retrospective`, `start-stop-continue`, `mad-sad-glad`, `four-ls`,
  `sailboat`), `town-hall`, `lean-coffee`, `crazy-eights`, `meeting-agenda`, `workshop-board`, `brainstorm`, the
  dot-vote boards (`affinity-map`, `prioritization-matrix`, `risk-matrix`), the fill-in-together boards
  (`incident-postmortem`, `user-persona`, `empathy-map`, `journey`, `objectives-planner`, `roadmap`, `raci-matrix`,
  `user-story-map`, `swot`, `pestle-analysis`, `business-model-canvas`, `value-proposition-canvas`,
  `stakeholder-map`, `opportunity-solution-tree`, `kwl-chart`) and the games (`pub-quiz`, `icebreaker-questions`,
  `two-truths-and-a-lie`, `would-you-rather`, `people-bingo`). A link, an agent or a seed naming one is answered with
  Blank Space (`retired-templates.test.ts`). The Meetings & Workshops, Retrospectives, Workshops, Planning, Strategy
  and Quizzes & Games categories leave with them.

## Testing

- Every template opens on a meeting board (`templates.test.ts`).
- Popular starts with Blank Space (`popular.test.ts`).
- Every category holds a template (`template-categories.test.ts`).
- The catalogue is the ten Spaces and the blank, eleven templates (`templates.test.ts`'s kind list, the `TemplateKind`
  union and `TEMPLATES` move together).
- Every Space is walkable (`template-builders-spaces-more.test.ts` and `template-builders-office.test.ts`): its floors
  lie first, it has one Walk In with open floor under it, every piece in a room sits inside its walls, no seat stands
  in a doorway's first 80 px, and no two pieces of furniture overlap.

## The tab's name

- A template picked on a start or on /new names the tab it fills after itself, (a retrospective's tab is
  "Virtual Office"): the template's title. It does
  so whatever the tab was called before. A blank template leaves the name as it was (`templateTabName`).

## The document's name

- A template picked on a start names the **document** after itself too, as /new names a document after the template
  it is made from: "Untitled Virtual Office", the blank "Untitled Space" (`untitledNameForTemplate`).
- Only while the document still has a default name: one of those untitled names (`isDefaultDocumentName`, any
  template's, or the legacy "Untitled diagram"; a blank's names are the shared `isUntitledName` list, which the first label's naming uses too). A name someone gave it, or the first element's label the editor
  named it after ([Name length](../006-document/name-length.md)), is kept.
- Only for the document's **first** tab: a template filling a later tab names that tab, not the document.
- It is the document's name like any other: saved with it, shown in the header and the Explorer at once, and changed
  by renaming. No telemetry: it is not a person's rename.
