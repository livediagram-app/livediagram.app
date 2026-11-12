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

**Blank Space** (`blank-session`) is the one blank: a tab holding only an [Avatar Pad](../009-elements/avatar-pad.md#every-space-and-blank-tab-has-one)
a little below the middle of the view, where people arrive, and a space named "Untitled Space"
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

- Twenty-six Spaces in eight categories ([Template categories](../008-canvas/canvas-and-palette.md#template-categories),
  [Virtual Office template](../012-collaboration/virtual-office-template.md), its "The catalogue plan" lists the
  element types each one uses):
  - **Office**: **Virtual Office** (`virtual-office`), **Coworking Space** (`coworking-space`), **Team Pod**
    (`team-pod`) and **Focus Library** (`focus-library`).
  - **Events**: **All-Hands Hall** (`all-hands-hall`), **Training Room** (`training-room`) and **Expo Hall**
    (`expo-hall`, also in Venues).
  - **Recreation**: **Rooftop Bar** (`rooftop-bar`) and **Cafe** (`cafe`), and the Sports Bar cross-listed.
  - **Outdoor**: **Garden Retreat** (`garden-retreat`), **City Park** (`city-park`) and **Beach Offsite**
    (`beach-offsite`, also in Campus), and the Festival Field cross-listed.
  - **Campus**: **Company Campus** (`company-campus`), **Startup HQ** (`startup-hq`), **School Quad** (`school-quad`)
    and **Co-working Tower** (`coworking-tower`, three floors): the company and education sites, rooms joined by a
    garden or a building's floors ([Campus Spaces](../012-collaboration/virtual-office-template.md#campus-spaces)).
  - **Games Rooms**: **Arcade Lounge** (`arcade-lounge`), **Games Night Den** (`games-night-den`) and **Sports Bar**
    (`sports-bar`, also in Recreation) ([Games Rooms](../012-collaboration/virtual-office-template.md#games-rooms)).
  - **Homes**: **Family House** (`family-house`, two floors), **City Townhouse** (`city-townhouse`, three floors) and
    **Country Cottage** (`country-cottage`, two floors), Downstairs and Upstairs joined by Stairs
    ([Homes](../012-collaboration/virtual-office-template.md#homes)).
  - **Venues**: **Conference Venue** (`conference-venue`), **Hotel and Suites** (`hotel-and-suites`, three floors) and
    **Music Hall** (`music-hall`) and **Festival Field** (`festival-field`, the open-air venue, also in Outdoor), and
    the Expo Hall cross-listed
    ([Venues](../012-collaboration/virtual-office-template.md#venues)).
- Start a Space shows Recommended first, then each category as a group: Campus, Events, Games Rooms, Homes, Office,
  Outdoor, Recreation and Venues
  ([Start diagramming](start-diagramming.md) "Recommended leads").
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
- The catalogue is the twenty-six Spaces and the blank, twenty-seven templates (`templates.test.ts`'s kind list, the `TemplateKind`
  union and `TEMPLATES` move together).
- Every Space is walkable (`template-builders-spaces-more.test.ts` and `template-builders-office.test.ts`): its floors
  lie first, every tab (a building's every floor) has exactly one [Avatar Pad](../009-elements/avatar-pad.md#every-space-and-blank-tab-has-one)
  and no Selection Mode button, the pad and the character standing on it touch no wall and no furniture, every piece in
  a room sits inside its walls, no seat stands in a doorway's first 80 px, and no two pieces of furniture overlap.
- Blank Space is one pad, centred across and below the middle (`build-template.test.ts`).
- **Every Space is roomy**: a walk between seats never brushes one. Two seats (chairs, desks, sofas, stools,
  benches, tables) side by side are either one row (at most 16 px apart) or an aisle apart, and two seats one behind
  the other either share an edge (a desk cluster's facing pair) or are an aisle apart. An aisle is at least
  `TEMPLATE_AISLE`, 120 canvas px: two Regular characters' footprints (2 x 40 px x 1.5) side by side, plus the
  distance at which a seat catches a character, which is none, since a character sits only once its feet are inside
  a seat it was going to ([Chair](../009-elements/chair.md) "Only the chair you are going to"). Rooms grew to fit
  (`template-builders-spaces-more.test.ts` "keeps every aisle between seats wide enough to walk"). A Podium is held
  like a seat but stands on a stage, not in a row, so the rule leaves it out
  ([Venue pieces](../009-elements/venue-pieces.md#speaking-from-the-podium)).
- Every Campus Space is joined up (`template-builders-campus.test.ts`): every room is closed with exactly one Door on
  its walls and a Garden Path outside it, the first 96 px inside each Door is clear, every room has a Room Sign that
  reads it, the Directory waits inside the gate above the Avatar Pad, the aisles are roomy and the hall's centre aisle is
  at least 160 px. A template's floors are held to the same rules, floor by floor (`template-floors.test.ts`): rooms
  closed with a signed Door, pieces inside their walls or clear of them, roomy aisles, no furniture on furniture, and
  named Elevators, the same number on every floor of the Co-working Tower. The Games Rooms and the Venues are held to
  the Campus rules; the Homes to the same rules without the Room Signs, and `template-homes.test.ts` checks that each
  floor is named, has one flight of Stairs in the same place as every other floor's, its pad beside them upstairs,
  windows only on walls, glass on the rooms the plan names, and no Directory or Elevator.

## A template with floors

- A template may have **floors**: more tabs after its first (`templateFloors`, in `@livehuddle/templates`), each with
  its own name, floor pattern and builder. The Hotel and Suites, the Co-working Tower and the City Townhouse have
  three, the Family House and the Country Cottage two
  ([Spaces with floors](../012-collaboration/virtual-office-template.md#spaces-with-floors),
  [Homes](../012-collaboration/virtual-office-template.md#homes)); every other template has none.
- **Made together.** `/new?template=` and the workspace frame's New document make the document with every floor as a
  tab, in order ([New document route](new-document-route.md)). Picked on Start a Space, the template lands on the empty
  tab as always, and its other floors are added as new tabs straight after it, each loaded at once (it has no server
  row to fetch yet), in the tab's theme. Undo takes the pick back as one step.
- **Names.** The first tab is named after the template's first floor ("Lobby", "Ground Floor", "Downstairs"), the others after
  theirs, so the [Elevator](../009-elements/elevator.md) panel reads as the building's floors. The document is still
  named after the template ("Untitled Hotel and Suites").
- **Agents** (`buildTemplateTab`, an API create or tab add) get the first floor only, for now; the floors are a
  follow-up for the agents' catalogue.

## The tab's name

- A template picked on a start or on /new names the tab it fills after itself, (a retrospective's tab is
  "Virtual Office"): the template's title, or its first floor's name for a template with floors
  ([A template with floors](#a-template-with-floors)). It does
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
