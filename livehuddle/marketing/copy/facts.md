# Fact sheet

The canonical facts all marketing copy is built from. If something
below stops being true, fix it here first, then propagate to the taglines and
descriptions. Mirrors [Purpose](../../docs/specs/001-project-vision/purpose.md),
[Not in livehuddle](../../docs/specs/002-project-scope/not-in-livehuddle.md) and the marketing site's
golden rule ([Marketing site](../../docs/specs/019-marketing/marketing-site.md)): every claim maps to a
shipped feature.

## One line

Meet your team in a Space. Walk in from a link, find everyone, gather round
the table.

## What it is

A web app where a team meets in a shared Space, in real time. Everyone has a
little pixel character, walks to the room they want to meet in, and sees who
is around. A Space is also a board: sticky notes on the walls, and a Timer or a
Stopwatch in the room keeps a meeting moving. It never sits behind a
sign-in wall: open a link and you are in.

## Who it's for

- Remote and hybrid teams who want a standing place to meet: a virtual office
  to walk round, a team pod for the stand-up, an all-hands hall for the
  company meeting.
- People hosting a meeting: a stand-up, a one-to-one in a quiet room, an
  all-hands on a stage.
- Communities and groups who want a place to gather and find each other.

The unit of value is the group in the room.

## What it does

- Spaces: 26 templates (Blank Space, offices such as the Virtual Office, Team
  Pod and All-Hands Hall, the Campus templates (Company Campus, Startup HQ,
  School Quad, Co-working Tower), the Venues (Conference Venue, Hotel and
  Suites, Music Hall), the Games Rooms (Arcade Lounge, Games Night Den, Sports
  Bar), the Homes (Family House, City Townhouse, Country Cottage), Expo Hall,
  Beach Offsite, bars, gardens and more), many with several floors, and
  pieces to build more: rooms with real doors, walls, desks,
  chairs, sofas, meeting tables, rugs, plants, bookshelves, a water cooler, a
  coffee machine, portals between rooms and tabs, fences and Avatar Pads.
- Avatar mode: a pixel character per person with outfits, a status worn on the
  character (eleven, from Available and Focusing's headphones to Out to Lunch's
  sandwich and Angry's steaming ears), speech bubbles, five moves (jumping jacks,
  wave, spin, cheer, dance) and Follow to go wherever a teammate goes.
- Light meeting tools: the Timer and Stopwatch pieces in the palette's Meeting
  category, the facilitator baton, Bring Focus and Follow, and five bursts
  round your own character (Confetti, Sparkles, Hearts, Applause, Fireworks).
- Light content on the walls: sticky notes, text and stickers.
- Real-time presence: live cursors, characters, selection rings and presence on
  each tab.
- Comments with mentions and reactions, and actions assigned to a teammate.
- 25 themes in the picker that recolour the whole Space in one click.
- Undo and redo (Cmd/Ctrl+Z, Cmd/Ctrl+Shift+Z), personal to each person.
- Tabs per Space (each a floor), nested folders in the Explorer.
- Teams: shared team Spaces with their own folders, members and invites.
- Share links as Editor or Participant (the default), with an optional expiry
  and password, revocable any time. A Participant always walks, talks, comments
  and reacts, and adds nothing to the Space; Viewer links made before still
  work, as Viewer (Legacy).
- Export a tab as PNG, SVG, PDF or a livehuddle JSON file, which imports back.
- Offline Mode (This Browser): a Space kept only in your browser, never on our
  servers. Google Drive sync for signed-in users.
- The Community: a public gallery of Spaces people share.
- A REST API with personal API tokens, free.
- Email notifications (comments, mentions, assigned actions, team invites),
  each with its own switch.
- Anonymous first-party telemetry with a public dashboard. No third-party
  analytics.

## Open source and price

- MIT-licensed and publicly viewable.
- Hosted free at livehuddle.app. No paid tier and no plan to introduce one.
- Sign-in through liveworkspace accounts is optional; without it a guest gets
  the full editor, and a new Space stays in their browser until they press
  Share.

## Stack

Runs entirely on Cloudflare: Workers for the API and routing, a Durable Object
per Space for its content and its realtime room, Workers Static Assets for
the Next.js frontends.

## Do not claim

- **Voice or video.** Proximity audio and calls are built but off in
  production ([Proximity audio](../../docs/specs/012-collaboration/proximity-audio.md)).
  Never say people can talk by voice or video in livehuddle today; say they
  can't yet and to run their usual call alongside.
- Workshops, retros, polls, Q&A, quizzes, estimates, agendas, decks,
  presenting, diagrams, shapes and arrows, pens and highlighters, embeds, or
  Mermaid, Markdown and draw.io imports. All of these left livehuddle with the
  meet-first refocus (Work Tracker #423); livediagram has them.
- Conflict-free (CRDT) editing. Edits to different elements merge; two people
  changing the same element at the same moment is last-writer-wins, by design.
- A paid tier, or any feature reserved for one.

## Links

- Hosted: https://www.livehuddle.app
- Open a Space: https://www.livehuddle.app/new
