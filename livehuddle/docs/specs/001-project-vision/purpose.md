# Purpose

Status: **approved, being built** (first approved on Work Tracker #99; refocused on meeting by Work Tracker #423,
2026-11-04). The code still carries what [Not in livehuddle](../002-project-scope/not-in-livehuddle.md) lists until
the parts of #423 remove it.

livehuddle is a web app where a team **meets in a shared space, in real time**. Everyone in the meeting has a
character in the space, walks to the room they want to talk in, hears the people near them, and meets around the
notes and pictures on the walls.

This is the root of livehuddle's spec tree: every other spec is a decision taken inside the boundaries set here. Like
every liveworkspace product's purpose, it keeps a [record of the boundaries that have moved](#boundaries-that-have-moved)
rather than quietly describing a product that no longer exists.

## Why it exists

livediagram grew three things that are about people being together rather than about diagrams:

- [Avatar mode](../008-canvas/avatar-mode.md): a pixel character for everyone in the room, who walks, sits, talks in
  speech bubbles, waves and shows a status.
- The **Space** elements, in the palette's Travel, Seating, Rooms and Amenities categories: portals, chairs, desks, sofas, fences, Avatar Pads and the
  [office pieces](../009-elements/office.md) (rooms, meeting tables, plants, bookshelves, water coolers, coffee
  machines, rugs).
- The **Spaces** templates ([Virtual Office and space templates](../012-collaboration/virtual-office-template.md)):
  offices (Virtual Office, Coworking Space, Team Pod, Focus Library), events (All-Hands Hall, Training Room),
  recreation (Rooftop Bar, Cafe), outdoor ones (Garden Retreat, City Park, Beach Offsite), an Expo Hall and whole
  campuses (Company Campus, Conference Venue, Startup HQ, School Quad, and the Hotel and Suites and Co-working Tower
  on floors joined by lifts).

In livediagram these sit inside Workshop mode, one mode among three, and a person looking for a place to hold a
meeting never thinks to open a diagram tool. livehuddle gives the meeting a product of its own: **Spaces, avatars,
rooms and calls** are the product (owner, 2026-11-04).

livediagram keeps every one of these features, and it keeps **all of Workshop mode** (retros, workshops, the
Collaborate elements, decks): running a workshop on a board is livediagram's job.

## What it is

A **Space** (the thing a person makes, opens and shares) is a place to meet: a floor plan of rooms and furniture that
everyone walks round as a character. It holds tabs, and every tab is a floor. Anyone with access to a Space can join,
see everyone's character and cursor, hear the people near them, and take part at the level their share link gives them.

The meeting is the product. Everything else exists because a team meeting together needs somewhere to stand, a way to
talk, and a few light tools to keep a meeting moving:

- **Somewhere to stand**: the Spaces templates, Avatar mode and the Space elements (Travel, Seating, Rooms, Amenities).
- **A way to talk**: [proximity audio](../012-collaboration/proximity-audio.md) and calls between the people near
  each other, speech bubbles, comments with mentions and reactions.
- **Light meeting tools**: a [Timer or Stopwatch](../009-elements/timer-and-stopwatch.md) on a room's wall and
  [Bring Focus](../012-collaboration/bring-focus.md), both on the board, nothing more ([Workshop mode](../012-collaboration/workshop-mode.md), the meeting
  board).
- **Light content on the walls**: sticky notes, text and stickers, for notes
  and decoration in a room. No diagram tools.

## Target users

- **Remote and hybrid teams** who want a standing place to meet: a virtual office they walk round, a team pod for a
  stand-up, an all-hands hall for a company meeting.
- **People hosting a meeting**: a stand-up, a one-to-one in a quiet room, an all-hands on a stage, who need a room
  that holds the people and a timer to keep it short.
- **Communities and event hosts** who want a place for a group to gather, walk up to each other and talk.

The unit of value is the **group in the room**. The entry point is still one person: the editor works without
signing in, and a guest gets a share link to send. The product earns the second person, and the third, by being the
place they meet.

## Core capabilities

The full list is in [v1 scope](../002-project-scope/v1-scope.md).

- **Being together in a Space**: Avatar mode first-class, live cursors, presence, follow-me, Bring Focus.
- **Spaces to meet in**: the eighteen Spaces templates, every Space element to build more.
- **Talking**: proximity audio and calls ([Future work](../005-project-roadmap/future-work.md) and the calls specs in
  `012-collaboration/`), speech bubbles, comments with mentions and reactions.
- **Keeping a meeting moving**: the Timer and Stopwatch pieces, and Bring Focus.
- **Light content**: sticky notes, text and stickers.
- **The liveworkspace platform**: one account, the One Explorer, teams, share links with the three roles, media,
  Offline Mode, Google Drive sync, the Community, the MCP server and the CLI, telemetry.

## What it is _not_

- **Not a workshop tool.** No retrospective or workshop templates, no quizzes or games, no polls, Q&A boards, agendas,
  reveal zones or any other Collaborate element. Running a workshop on a board is livediagram's Workshop mode.
- **Not a diagramming tool.** No shapes, connectors, flowcharts, mind maps, layout containers, charts or drawing
  tools. That is livediagram.
- **Not a document, presentation, design or planning tool.** No Page element, slide decks or presenting, no logos,
  boards of cards or spreadsheets: those are livedocuments, livedesign and liveplanner.
- **Not a paid product.** Free and open source like every liveworkspace product: no tier, no billing, no feature flags
  gating the core.

## Boundaries that have moved

A boundary nobody maintains is not a boundary. When one moves, it gets recorded here in the same change, with the
spec that moved it.

- livehuddle begins as livediagram cut down to Workshop, with Avatar mode made first-class.
- **Diagram and Draw are cut** (build plan step 5.1, Work Tracker #182): the mode switch goes and every tab is
  Workshop; flowcharts, mind maps and org charts, sequence diagrams, Sankey diagrams, entities, the concept graphics
  but the Timeline, device frames, the Technology palette category, Draw's dock, the Fill and Path tools and the
  templates built from them leave with it. Pencil, highlighter, arrow and line stay as Workshop's Draw category
  ([Editor modes](../007-editor/editor-modes.md)).
- **Meet-first, not workshops** (Work Tracker #423, owner, 2026-11-04): livehuddle was "for meeting, running workshops
  and collaborating", with every tab a Workshop board. It is now for meeting in Spaces. The retrospective and workshop
  templates, the quizzes and games, every Collaborate element (polls, quizzes, Q&A, agendas, reveals and the rest),
  slide decks, building a deck, presenting, the Page element, and the diagram tools left over from Workshop (shapes,
  arrows and lines, the Draw tools, the Layout containers, tables, charts, the components and the
  embeds) leave livehuddle, and the Frame went later; livediagram keeps them all. What stays: Spaces, avatars, rooms, calls, a timer
  (now the Timer and Stopwatch pieces) and Bring Focus, and light content (sticky notes, text, stickers); the Icons category, images and link cards went later.
  The full list, and the build part that removes each, is [Not in livehuddle](../002-project-scope/not-in-livehuddle.md).
- **The Reaction Pads, the laser, the spotlight, Isometric and Zen went too** (owner, 2026-11-05): in a Space your
  character points, walks up to things and celebrates with its own Reactions
  ([Not in livehuddle](../002-project-scope/not-in-livehuddle.md#the-presenting-tools-isometric-and-zen)). Pencil,
  highlighter and the video and website embeds leave as well.
- **Decks, presenting and the Page are gone** (Work Tracker #423, part 2): nothing in livehuddle offers them; a
  document's stored deck is kept untouched and a stored Page still draws.

## Why it matters

A team that meets online usually has a call in one tab and a board in another, and neither has any idea who is near
whom. livehuddle puts the people in a place: walk up to someone to talk, walk away to stop. The honest check on any
new feature is: "does a group meeting together in a Space need this?" A feature that helps a group _work_ on a board
belongs in livediagram.
