# Team pieces

Status: **approved** (owner, 2026-11-07; Work Tracker #546, #547, #558, #548). The pieces that make a Space feel like
a team's own place: a **Calendar Wall** with notes pinned to days, a **Suggestion Box** anyone taking part can drop an
anonymous note into, a **Signpost** whose arrows walk you to the nearest places, and a **Team Photo Wall** showing the
people in the Space now. They are [Office](office.md) pieces in every way not said here: drawn upright from the room's
camera, placed at a fixed size, aspect locked, no settings `…`, no words of their own, an Editor's to place, move and
delete, and seen by everyone in [Avatar mode](../008-canvas/avatar-mode.md).

## Why

Teams like a shared view of the month, a low-pressure way to share an idea, a way to find their way round a big
outdoor campus, and a wall that shows who belongs. A real office has all four; a Space built only from rooms and
desks has none.

## Where they live

| Category   | Tiles, in palette order                                                 |
| ---------- | ----------------------------------------------------------------------- |
| **Meet**   | Calendar Wall, Suggestion Box and Team Photo Wall after the World Clock |
| **Travel** | Signpost after the Directory                                            |

Shape kinds: `calendar-wall`, `suggestion-box`, `signpost`, `photo-wall`.

## How each one walks

| Piece           | Default size | Walking                                                                   |
| --------------- | ------------ | ------------------------------------------------------------------------- |
| Calendar Wall   | 200 × 160    | Hangs on a wall: never blocks, never a destination                        |
| Suggestion Box  | 64 × 112     | Scenery: its foot blocks                                                  |
| Signpost        | 120 × 144    | Scenery: its foot blocks                                                  |
| Team Photo Wall | 176 × 112    | Hangs on a wall: never blocks, never a destination; a click walks past it |

A walking click on the Calendar Wall opens its calendar, on the Suggestion Box opens the box, and on the Signpost
walks you to its top place (the nearest); a click on one of the Signpost's arrows walks you to that arrow's place.

## Calendar Wall

A large wall planner: a red header band hung from two binder rings, a white sheet ruled into a month of days.

- **The face shows this month** on the viewer's own clock: the month and year in the header, the weekday initials
  (Monday first), the day numbers, and today circled in the theme's red. A day holding notes shows a small note tab in
  its corner in the colour of its newest note, and a count when it holds more than one. The month turns over on its own
  at midnight, the same minute clock the World Clock uses.
- **A note** is the [Notice Board](social-pieces.md#notice-board)'s note with a **day**: a short title (optional), a
  body, the author's name, the date it was pinned, an optional colour, and the day it is pinned to (`YYYY-MM-DD`). A
  note with no day (none is made, but one could be stored) counts on the day it was pinned. A calendar holds up to 50
  notes, as a board does; once full, pinning says so.
- **Opening it**: the face's **Calendar** button (a walking click anywhere on it) opens the calendar large: the month
  with **‹** and **›** to step a month, **Today** to come back, each day a button showing its notes' tabs. A note's
  day is from 2000 to 2100, so **‹** stops at January 2000 and **›** at December 2100, and a day spilling over past
  either end is an empty cell rather than a day to pin to. Pressing a
  day selects it (today is selected on opening) and lists its notes below, newest first, each with its title, body,
  author and pin date, and an **Unpin** for those who may. Under the list, for those who may pin, the add box: title,
  body with a live 280 counter, the five colours and **Pin to 5 Nov**. While walking it opens in the reader, at reading
  size; otherwise as a popover by the button.
- **It changes as a Notice Board does**: a pin and an unpin are each one delta (`notice-pin`, `notice-unpin`), the
  note carrying its day; the room relays a Participant's only when signed with its own adder key, and the participant
  content rule merges a calendar's notes exactly as a board's. Not undoable, like a comment.
- **Export** draws the sheet ruled and blank: the month shown is the viewer's, so a still image has none.

## Suggestion Box

A wooden box on a post, a slot in its lid with a note half posted, a lightbulb on its front.

**Turned** ([Turning furniture](furniture-facing.md)): from behind, its plain back with the door it is emptied by and
a brass lock, the note still standing in the slot; to face left, its lid down the canvas with the slot along it, its
end toward you and a strip of its front with the lightbulb down the left. The **Suggest** button stays under the box,
centred and never mirrored, at every facing.

- **Dropping a note**: the face's **Suggest** button (a walking click anywhere on it) opens the box: a text box (up to
  500 characters, with a live counter) and **Drop It In**. A dropped note leaves no name, no colour and no title; the
  box thanks you (**Dropped in. Only Editors read these, and never who wrote them.**) and is ready for another.
- **Truly anonymous to its readers.** A note is stored as its text and the day it was dropped (`YYYY-MM-DD`, UTC),
  nothing else: no author, no adder key, no time of day, no share link, no network address. The api writes no log line
  that names the sender with the note, and the note never rides the room, so nobody's screen sees it arrive. What an
  Editor reads is the text and the day.
- **Not part of the Space's content.** Notes are kept beside the Space, in its own store (`suggestions`, in the
  Space's Durable Object), never in the box element. So they are in no tab read, export, copy, template, version, API
  or agent read, Community post or Download All My Data; nothing but the box's own read below reaches them.
- **Editors read them**: an Editor's box opens on the notes, newest day first (and newest first within a day), each
  with its day ("5 Nov") and **Remove**, the add box below theirs too. A **Refresh** fetches again: a drop is not sent
  live. The box reads **No Notes Yet** when empty.
- **Up to 200 notes a box.** A full box refuses a drop (**The box is full. An Editor can empty it.**). A box never
  closes otherwise: livehuddle has no element lock ([Element and Tab Locking](../002-project-scope/not-in-livehuddle.md#element-and-tab-locking)).
- **Where notes go**: deleting the box leaves its notes unread (undo brings the box back with them); they go with
  the tab or the Space. Removing a note removes it for good.
- **A Space saved in This Browser** has nobody else to collect from: the box says **Share this Space to collect
  suggestions.** and drops nothing.

## Signpost

A wooden signpost on a mound of grass: a post with a cap and up to three arrow boards.

- **Its places** are the [Directory](directory.md)'s, on the signpost's own tab: the Rooms, Office Pods and Stages,
  named as the Directory names them (an unnamed one by its position, "Room 2"). The signpost shows the **three
  nearest**, by the distance from the post's foot to each place's arrival point, nearest on the top board.
- **Each board names its place** and points the way: right when the place's arrival lies right of the post, left
  otherwise. A long name is cut with an ellipsis; the whole name is in its tooltip (**Walk to Kitchen**).
- **Pressing an arrow walks you there**, by the Directory's **Walk There**: round the place's own walls to its doorway,
  then in. Not walking, it enters Avatar mode first, as the Directory does. A walking click anywhere else on the
  signpost walks to the top board's place.
- **No places yet**: the boards stay blank and the signpost's tooltip says **No Places Yet: add a room, an office pod
  or a stage and it appears here.** A signpost with fewer than three places leaves the rest blank.
- It stores nothing: the places are the tab's, so every screen shows the same boards.
- **Export** draws the post and its boards blank.

## Team Photo Wall

A long wooden panel with a brass plate, holding eight picture frames in two rows of four.

- **It shows the people in the Space now**, from presence (the decision on the card: never the share list, so it
  shows nothing a visitor cannot already see on the canvas): you first, then everyone else in the Directory's order
  (the people on this tab, then those on other tabs). Each fills a frame with their character's portrait, front on,
  on a wash of their colour, named in a tooltip and in the wall's label for a screen reader (**Team photo wall: Sam
  (you), Priya and Jo**).
- **Their look** is the character they walk as; someone this screen has not seen walking shows the default character
  in their colour.
- **Eight frames at most.** Up to eight people fill eight frames; more than eight fill seven and the last reads
  **+N** with everyone left in its tooltip. The frames never grow, so a big Space never makes a big wall.
- **An empty frame** is part of the drawing: a pale mat with a soft silhouette, so a wall with few people looks like a
  wall with room to grow, never broken. An export, a preview and a palette tile draw every frame empty.
- Nothing is stored, nothing is sent: it reads the presence this screen already holds, and changes only when someone
  arrives, leaves or changes their look or name.

## The wire

- **Calendar Wall**: the Notice Board's `notice-pin` and `notice-unpin` element deltas, unchanged, the note's `day`
  validated with the rest of the note. The room's signer rule, the ledger, the participant content rule and the
  editor's merge all treat a calendar's notes as a board's.
- **Suggestion Box**: three routes on the Space ([API](../015-api/api.md)):
  - `POST /api/documents/:id/tabs/:tabId/suggestions` `{ elementId, text }`: drop a note. Participants and Editors
    (`gateParticipate`); 201 with an empty body (no id, so a dropper cannot later point at their note). 400 for no
    text or text over 500 characters, 404 for no such box on the tab, 409
    `box_full` at 200.
  - `GET /api/documents/:id/tabs/:tabId/suggestions?elementId=`: the box's notes, `{ suggestions: [{ id, text, day
}] }`, newest first. Editors only (`gateEdit`).
  - `DELETE /api/documents/:id/tabs/:tabId/suggestions/:suggestionId`: remove one. Editors only; 204, 404 when it is
    not there.
- **Signpost** and **Team Photo Wall**: nothing. The signpost reads the tab, the photo wall presence.

## Share roles

| Who             | Calendar Wall                                  | Suggestion Box                                 | Signpost         | Team Photo Wall |
| --------------- | ---------------------------------------------- | ---------------------------------------------- | ---------------- | --------------- |
| **Editor**      | Places it; pins notes, unpins any              | Places it; drops notes, reads and removes them | Places it; walks | Places it; sees |
| **Participant** | Pins notes signed with its key, unpins its own | Drops notes; never reads any, its own included | Walks            | Sees            |
| **Viewer**      | Reads the notes                                | Sees the box; drops nothing, reads nothing     | Walks            | Sees            |

A Viewer reads a calendar for the reason it reads a Notice Board: it is the Space's content. It drops no suggestion
because a Viewer adds nothing to a Space; a team that wants visitors' ideas gives them a Participant link.

## Telemetry ([Telemetry](../017-telemetry/telemetry.md))

- Placing one: `Element · Added · <Kind>` (`Calendar-wall`, `Suggestion-box`, `Signpost`, `Photo-wall`).
- Pinning or unpinning a calendar note: `Element · Changed · Calendar-wall`; dropping a suggestion:
  `Element · Changed · Suggestion-box`. Never the note, never who.

## Not in scope

- A calendar that shows a month other than the viewer's own on its face, events with times, repeats or reminders, or
  a link to an outside calendar.
- Replying to a suggestion, voting on one, or telling its writer it was read.
- A signpost whose places an Editor picks, or arrows that point to another tab.
- A photo wall of the Space's members, uploaded photos, or a wall that remembers who was in.
