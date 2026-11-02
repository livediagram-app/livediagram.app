# Purpose

Status: **proposed**, awaiting the owner's approval (Work Tracker #99).

livehuddle is a web app where teams **meet, run workshops and collaborate together, in one shared space, in real
time**. Everyone in the meeting has a character on the board, walks to the room or the topic they are talking about,
and works on the same board while they talk.

This is the root of livehuddle's spec tree: every other spec is a decision taken inside the boundaries set here. Like
every liveworkspace product's purpose, it keeps a [record of the boundaries that have moved](#boundaries-that-have-moved)
rather than quietly describing a product that no longer exists.

## Why it exists

livediagram grew three things that are about people being together rather than about diagrams:

- [Avatar mode](../../../../livediagram/docs/specs/008-canvas/avatar-mode.md): a pixel character for everyone in the
  room, who walks, sits, talks in speech bubbles, waves and shows a status.
- The **Navigate** elements: portals, chairs, desks, sofas, fences, Avatar Pads, link cards and the
  [office pieces](../../../../livediagram/docs/specs/009-elements/office.md) (rooms, meeting tables, plants,
  bookshelves, water coolers, coffee machines, rugs).
- The **Spaces** templates ([Virtual Office and space templates](../../../../livediagram/docs/specs/012-collaboration/virtual-office-template.md)):
  Virtual Office, Coworking Space, Team Pod and All-Hands Hall.

Around them sits [Workshop mode](../../../../livediagram/docs/specs/012-collaboration/workshop-mode.md), the kit that
runs a session: timers, votes, polls, quizzes, Q&A, agendas, reveals, the facilitator baton and Bring Focus.

In livediagram these are one mode among three, reached through a Selection Mode button on a board, and a person
looking for a place to hold a meeting never thinks to open a diagram tool. livehuddle gives them a product of their
own, built around **collaboration, workshops and meetings**.

livediagram keeps every one of these features (Work Tracker #99). livehuddle gets its own copy, by forking, and the
parts that can be shared without either product reading the other's element union move to `packages/` first
([Build plan](../005-project-roadmap/build-plan.md)).

## What it is

A multiplayer board in the browser, made for meeting on. A **space** (the thing a person makes, opens and shares)
holds tabs, and every tab is a board in Workshop's look: a canvas with the session tools, the Collaborate elements,
stickies, text, frames, arrows, icons, stickers and media. Anyone with access to a space can join, see everyone's
character and cursor, and take part at the level their share link gives them.

The meeting is the product. Everything else exists because a team meeting together needs somewhere to stand, a way
to talk over the board, and a way to run the session: start a timer, take a vote, ask a question, bring everyone's
view to one place.

## Target users

- **Remote and hybrid teams** who want a standing place to meet: a virtual office they walk round, a team pod for a
  stand-up, an all-hands hall for a company meeting.
- **Facilitators** running a retrospective, a workshop, a lean coffee or a town hall, who need the session tools and
  a room that holds the people.
- **Teachers and event hosts** running a quiz, an icebreaker or a game with a room of participants.

The unit of value is the **group in the room**. The entry point is still one person: the editor works without
signing in, and a guest gets a share link to send. The product earns the second person, and the third, by being the
place they meet.

## Core capabilities (v1)

The full list, with what each brings over from livediagram, is in [v1 scope](../002-project-scope/v1-scope.md).

- **Being together on the board**: Avatar mode first-class, live cursors, presence, follow-me, Bring Focus.
- **Spaces to meet in**: the four Spaces templates and every Navigate element to build more.
- **Running the session**: all of Workshop mode, the Session strip (Timer, Vote, Poll) and every Collaborate element.
- **Talking without a call**: avatar speech bubbles, comments with mentions, reactions.
- **The liveworkspace platform**: one account, the One Explorer, teams, share links with the three roles, media,
  telemetry.

## What it is _not_

- **Not a diagramming tool.** No Diagram or Draw mode, no flowcharts, mind maps, Event Storming or concept graphics.
  That is livediagram.
- **Not a document, design or planning tool.** No pages, slides, logos, boards of cards or spreadsheets: those are
  livedocuments, livedesign and liveplanner.
- **Not a video-call app, yet.** v1 carries no audio, video or screen sharing. They are the planned next step
  ([Future work](../005-project-roadmap/future-work.md)), and v1 is designed so they can join without reshaping it.
- **Not a paid product.** Free and open source like every liveworkspace product: no tier, no billing, no feature
  flags gating the core.

## Boundaries that have moved

A boundary nobody maintains is not a boundary. When one moves, it gets recorded here in the same change, with the
spec that moved it.

- None yet. livehuddle begins as livediagram cut down to Workshop, with Avatar mode made first-class.

## Why it matters

A team that meets online usually has a call in one tab and a board in another, and the board has no idea who is in
the meeting. livehuddle puts the people on the board. The honest check on any new feature is: "does a group meeting
together in a space need this?"
