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

- Thirty-three Spaces in eight categories ([Template categories](../008-canvas/canvas-and-palette.md#template-categories),
  [Virtual Office template](../012-collaboration/virtual-office-template.md), its "The catalogue plan" lists the
  element types each one uses):
  - **Office**: **Virtual Office** (`virtual-office`), **Coworking Space** (`coworking-space`), **Team Pod**
    (`team-pod`), **Focus Library** (`focus-library`), **Interview Suite** (`interview-suite`), **Client Lounge**
    (`client-lounge`) and **Document Room** (`document-room`, the room a call about a file opens in).
  - **Events**: **All-Hands Hall** (`all-hands-hall`), **Training Room** (`training-room`), **Expo Hall**
    (`expo-hall`, also in Venues), **Classroom** (`classroom`), **Hackathon Hall** (`hackathon-hall`) and **Art Gallery** (`art-gallery`).
  - **Recreation**: **Rooftop Bar** (`rooftop-bar`), **Cafe** (`cafe`) and **Wellness Studio** (`wellness-studio`),
    and the Sports Bar cross-listed.
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

## Room to move

The owner, 2026-11-18: "in templates rooms should generally be bigger and less cramped", and wall pieces "are often
floating in the middle of a room". Every Space's plan, each floor of a building too, is drawn at its builder's size and
then opened out by one rule (`roomier`, `packages/templates/src/template-roomy.ts`), so no builder carries spacing of its
own:

- **Rooms grow** by a quarter (`TEMPLATE_ROOMY`, 1.25) about the template's centre: rooms, corridors, lawns and car
  parks both ways, a Garden Path or a fence along its length only. Rooms that shared a wall still share it: a room
  with no outline grows by its wall lines (5 px in at its sides and front, 31 px in at its back), not its box, so two
  rooms on one wall line still stand on one after.
- **Furniture keeps its size**, moved in groups: pieces within 16 px of each other in one room move together (a desk
  and its chair, a sofa on its rug, a counter with the microwave on it), and wall pieces in one run along a wall (a
  counter and a sink at one height) stay in line.
- **Near a wall, a group keeps its distance from it** (within 64 px: a Door, a Window, a counter, a plant in a
  corner); out in the floor it keeps its biggest piece's share of the room, so a stage centred in its hall stays
  centred.
- **Wall pieces go back to the wall**: a piece that stands against a wall (a counter, a fridge, a bookshelf, lockers,
  a fireplace, a vending machine, an arcade machine, a jukebox) standing more than 96 px out is pushed back against
  its back or a side wall, never the front wall it would turn its back to you from; a hung piece (a Notice Board, a
  Screen, a clock) onto the back wall or, its foot on it, the front wall. A push stops short of anything in the way.
- **Nothing stands on anything**: a group left on another piece slides to the nearest free spot inside its walls.
- **A Room Sign stays by its Door.**
- **Outside the rooms, a group keeps its place beside the plan**: one beside the rooms moves as the plan's near edge moves, so the gap between them stays and a wall never grows under it; one
  between them keeps its share of the plan, as a piece in a room does.

A Blank Space (no rooms) is left as drawn. The pass runs once, when the Space is made (under 1 ms for the biggest,
measured), never while it is open.

A builder drawn at its final size opts out by naming its kind in `DRAWN_TO_SIZE` (`template-roomy.ts`); none does yet.

## Made for 3D

The owner, 2026-11-27: "Rebuild all of the templates for livehuddle to suit the 3d, items against walls, facing the
right way etc, not too tight spaces". The Space is always 3D ([3D view](../008-canvas/3d-view.md)), and a piece's model
stands on its front drawing's footprint, turned to its facing, on its box
([3D engine](../008-canvas/3d-engine.md) "Block models"), not on the whole flat box. A template is laid out for where
that model stands (`modelFloorBox`, `packages/templates/src/template-model-box.ts`):

- **Wall pieces flush.** After `roomier`, one more pass (`flushToWalls`, `template-flush.ts`) moves each piece made to
  stand against a wall (a kitchen counter or sink, a fridge or drinks fridge, a drinks cabinet, lockers, a vending or
  arcade machine, a jukebox, a copier, a printer, a coffee machine, a water cooler, a Phone Booth) straight back until
  its model's back is 1 px off the wall face behind it (the wall line plus 4 px), with the microwave, kettle or coffee
  machine on its worktop. It reaches at most 200 px and stops if another piece's model is in the way. The box may then
  poke over the wall line, as a fridge's empty top does. The Phone Booth's model is its front 56 px (the stool and the
  back wall just behind it); the rest of its box is empty floor.
- **A piece faces the way it is placed.** A builder's `facing` on a piece that turns turns its box too (`placePiece`,
  `template-office-parts.ts`), so a machine on a side wall stands side-on, not stretched.
- **Rooms side by side share one wall**: the next room starts 10 px before the last ends (stacked: 36 px), or stands a
  corridor (120 px) apart.

Every tab of the rebuilt templates passes one pure check (`template3dFit`, `template-3d-fit.ts`, test-only), which names
each issue's rule:

- `wall`: a Door or Window stands in a wall; a hung piece hangs on a wall face; a wall piece's model back is within
  8 px of a wall face, facing into the room.
- `facing`: a seat within 48 px of its table, desk or bar faces it; in a room with a stage or screen and four or more
  of the same seat, each faces within 60 degrees of it; any other loose seat (a chair, sofa, stool, bench, bean bag or
  reading nook) has no wall within 60 px in front and looks at something or into its room.
- `overlap`: no two models stand on each other (a machine on a worktop, a lamp on a desk, a podium under curtains
  aside), no model stands in a wall, and the door's width for 60 px either side of every Door is clear.
- `reach`: from the Avatar Pad, a walk a character's width (60 px) wide reaches every seat (a desk from its sitter's
  side, behind it) and the front of every piece someone uses.
- `shared-wall`: box rooms side by side either share one wall line or stand at least 120 px apart.
- `indoor` (the owner, 2026-11-27: "some templates seem to put an indoor chair outside which is weird, don't do
  that"): on a site out of doors (a tab with Grass or a Garden Path), indoor furniture (`INDOOR_ONLY`: chairs, desks,
  sofas, tables, shelves, bar, kitchen and bathroom pieces, machines, Bean Bags, Bar Stools, lamps, Nap Pods, gym
  pieces) stands inside a room, a corridor, an Office Pod or a Phone Booth, never in the open air. Outdoors seats people
  on Benches, Picnic Tables and Hammocks; a bar and its stools stand in a tent. A building's open floor is indoors.

The check runs in 2 to 40 ms a tab, measured.

## Testing

- Every template opens on a meeting board (`templates.test.ts`).
- Popular starts with Blank Space (`popular.test.ts`).
- Every category holds a template (`template-categories.test.ts`).
- The catalogue is the thirty-two Spaces and the blank, thirty-three templates (`templates.test.ts`'s kind list, the `TemplateKind`
  union and `TEMPLATES` move together).
- Every Space is walkable (`template-builders-spaces-more.test.ts` and `template-builders-office.test.ts`): its floors
  lie first, every tab (a building's every floor) has exactly one [Avatar Pad](../009-elements/avatar-pad.md#every-space-and-blank-tab-has-one)
  and no Selection Mode button, the pad and the character standing on it touch no wall and no furniture, every piece in
  a room sits inside its walls, no seat stands in a doorway's first 80 px, and no two pieces of furniture overlap.
- Every tab of the templates rebuilt for 3D (the Virtual Office, Coworking Space, Team Pod, All-Hands Hall, Focus
  Library, Interview Suite, Client Lounge, Document Room, Company Campus, Conference Venue, Startup HQ, School Quad,
  Co-working Tower and Hotel and Suites, every floor) passes `template3dFit`, each rule has a case of its own, and a
  check stays under a 400 ms budget (`template-3d-fit.test.ts`). The walkable and room checks judge a piece where its
  model stands, not its drawn box.
- Blank Space is one pad, centred across and below the middle (`build-template.test.ts`).
- **Every Space is roomy**: a walk between seats never brushes one. Two seats (chairs, desks, sofas, stools,
  benches, tables) side by side are either one row (at most 16 px apart) or an aisle apart, and two seats one behind
  the other either share an edge (a desk cluster's facing pair) or are an aisle apart. An aisle is at least
  `TEMPLATE_AISLE`, 120 canvas px: two Regular characters' walking footprints (2 x 40 px x 1.5, the width they collide at, which stayed when Regular was drawn larger on 2026-11-27) side by side, plus the
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
