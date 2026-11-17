# Walkthroughs

Record yourself talking someone through a design, and let them play it back later over the canvas itself: your
voice, your camera as a round bubble in a corner if you turn it on, and every pan, zoom and tab change you
made, with your pointer. A viewer can pause, look around the live canvas, and resume where you were. This is
the asynchronous half of [Presentation mode](presentation-mode.md), which runs only live: Loom's walkthrough,
Miro's Talktrack and Pitch's recorded presentations, kept inside the canvas rather than in a video that goes out of
date and can't be clicked into.

One behaviour, one look and one copy in all four canvas apps (livediagram, livedocuments, livedesign,
liveplanner): `@liveworkspace/walkthrough` holds the recorder, the player and every piece of their UI, and each
editor binds only what is its own (its viewport store, its tabs, its slides where it has them, its api). Where the
walkthroughs are stored, what they may be and when they go is the platform's
([Walkthroughs](../../../../liveworkspace/docs/specs/006-media/walkthroughs.md)).

## What is recorded

**A walkthrough is a recording you choose to make.** Nothing is recorded until you press Start Recording, and a
call (livehuddle's) is never recorded, here or anywhere ([the privacy policy](https://www.liveworkspace.app/privacy)).

- **Your voice**, from the microphone you pick.
- **Your camera**, if you leave one on: shown to you while recording as a round bubble in a corner, and played back
  the same way. With No Camera the recording is sound alone.
- **The camera path**: where the view is, as the canvas point at its centre and the zoom, sampled at most ten times
  a second while it moves, and each tab you change to.
- **Your pointer** over the canvas, at most ten times a second, and each press on an element (played back as a ring
  on it).

**Nothing about the content is recorded.** A walkthrough plays over the canvas as it is when someone plays it, so
the events carry ids and coordinates, never an element's text, colours or notes.

## Recording

**Record Walkthrough** is in the **Walkthroughs** panel, opened from the footer's **Tools** (below). Pressing it opens the **recording dock**
at the bottom centre of the canvas, in place: the canvas stays where it is and stays yours to move around.

1. **Set up.** The dock shows your camera live in its bubble (in the corner you pick, bottom left to start, moved up or down to stay clear of the Map and across past a docked Contents sidebar), a
   **Microphone** and a **Camera** picker (the devices this browser can see, plus **No Camera**), a live level meter
   so you can see the microphone hears you, and **Hide From Recording** (below). The browser asks for the
   microphone and camera the first time; a refusal says so in the dock and offers the choice again, and recording
   with no microphone at all is refused ("Allow the microphone to record a walkthrough").
   The editor's `Permissions-Policy` header must therefore allow `camera=(self)` and `microphone=(self)`, as the
   walkthroughs need them; when the policy blocks the microphone the dock says "This page can't use the microphone.
   Reload to get the latest version." instead of asking for a browser permission.
2. **Start Recording** counts down 3, 2, 1 over the canvas, then records. Moving around the canvas, changing tab and
   pointing are all part of it.
3. **While recording** the dock is a compact bar: a pulsing red dot, the time so far against ten minutes
   (`1:24 / 10:00`, amber in the last minute with "1 minute left"), the level meter, Hide From Recording, **Finish**
   and **Discard**. At ten minutes it finishes on its own and says so.
4. **Save.** The dock shows the length and a **Title** field (it starts as "Walkthrough of <tab name>"), with
   **Save** and **Discard**. Save uploads it, showing that it is uploading; when it is stored the Walkthroughs panel lists it.
   A refusal says why in the dock ("This walkthrough is over 40 MB", "You have 50 walkthroughs already. Delete one to
   save another.") and keeps the recording so you can **Download a Copy** rather than lose it.

Discard (in the bar or the save card) asks first, in a confirm beside the button: "Discard this recording? It
can't be recovered."

### Hide From Recording

A selection mode that picks elements viewers of the walkthrough won't see: a private note, an unfinished corner, a
name you shouldn't show.

- **Hide From Recording** in the dock turns the mode on: the pointer becomes a crosshair, and each element you
  press is hidden from the recording (press it again to show it). Presses do nothing else while the mode is on.
  **Hide Selection** hides what is already selected. The button's badge counts what is hidden, and **Done** (or
  `Esc`) leaves the mode.
- **You still see them**, faded inside a dashed outline, so you know what the recording leaves out. Viewers of the
  walkthrough never see them: the player hides them for as long as it is open.
- **They stay out of what is stored**, not only out of the player: a press on a hidden element is not recorded, and
  your pointer over one is recorded as off the canvas, so the stored events cannot trace one. The stored list of
  hidden ids holds ids alone.
- It hides elements from the walkthrough, not from the canvas: anyone who can open the design can still see them
  there.

## Playing

Pressing a walkthrough in the Walkthroughs panel plays it.

- **The view follows the recording**: the tab, the camera path (fitted to your screen, so a smaller window shows the
  same region) and the presenter's pointer, a soft dot with a ring for each press. The hidden
  elements are hidden.
- **The presenter's bubble** sits in the corner they recorded it in, playing their camera, or, recorded with no
  camera, a round mark with their initial that pulses while the walkthrough plays.
- **The player bar** at the bottom centre: play and pause, a scrubber you can drag or click (with a mark at each tab
  change), the time (`1:02 / 3:24`), the speed (1x, 1.5x, 2x), and close. `Space` plays and
  pauses, `←` and `→` skip five seconds, `Esc` closes.
- **Pause, pan and resume.** Any pan, zoom or press of your own on the canvas pauses it and leaves the view with
  you; the bar says "Paused. Look around, then Resume." **Resume** puts the view back on the recording's and plays
  on.
- **Edited since recording.** When the design has changed since it was recorded (any tab it visits), a line above the
  bar says "Edited since recording. It plays over the canvas as it is now." It still plays; an element that has gone
  is simply not there.
- **Closing** puts you back on the tab and view you had, and shows the hidden elements again.

### Steps

livedesign has no slide deck, so a walkthrough's steps are its tabs: the scrubber marks each tab change, and
the player changes tab where the presenter did. In livediagram and livedocuments a walkthrough also replays the
slide deck.

## In Tools

**Walkthroughs** is a row in the footer's [Tools](../../../../liveworkspace/docs/specs/004-index/footer-tools-menu.md)
menu, under **Collaborate**: its glyph, **Walkthroughs**, one line ("Record yourself talking through it." for an
Editor, "Play a recorded talk-through." for anyone else) and, at its end, the count of recorded walkthroughs (none at
0). It is an ordinary Tools row, so it never has a button of its own in the header or the footer. Pressing it closes
Tools and opens the **Walkthroughs** panel from the Tools button, the way Tools opens (a popover with a pointer at the
button):

- **Each walkthrough** as a row: a play mark, its title, and its length, who made it ("You" for yours, else the name
  they had) and when ("2 days ago"). Pressing the row plays it. A row you may delete carries a delete button, with a
  confirm beside it ("Delete this walkthrough? It is deleted for everyone who can open this canvas.").
- **Record Walkthrough**, for an Editor, at the foot.
- **Empty**, for an Editor: "Record yourself talking through this canvas. Anyone who can open it can play it back."
  For anyone else there is nothing to show, so there is no row.

Escape or a press outside closes the panel. The row is not in Tools on a phone (below `sm`, where recording has no
dock), in an embed or the workbench frame, before the design has hydrated, for a design kept in This Browser, or
for a tab-scoped link. Opening Tools fetches nothing: the row is drawn from the list the editor already asked for once
it was idle after opening the item.

## Share roles

| Role        | Play | Record | Delete                        |
| ----------- | ---- | ------ | ----------------------------- |
| Editor      | Yes  | Yes    | Any walkthrough on the design |
| Participant | Yes  | No     | Their own                     |
| Viewer      | Yes  | No     | Their own                     |

Recording is an Editor's because a walkthrough speaks for the design to everyone who opens it, as an edit does.
"Their own" covers someone who recorded while they were an Editor and has since become a Participant or a Viewer.
The api enforces all of it; the panel only leaves out what the role may not do.

## Limits

Ten minutes, and 40 MB for the recording (the platform spec says why). The recorder stops itself at ten minutes and
records at a bit rate that keeps ten minutes under the size limit, so the size refusal is for a browser that
overshoots. A person keeps up to 50 walkthroughs, and 1 GB of them, across every app; a design holds up to 50.

## Deleting

Deleting a walkthrough deletes its recording and its events from the media service. Purging the design from the
Trash deletes every walkthrough on it, and deleting an account deletes every walkthrough it recorded.

## Out of scope

- Recording your screen or another window: a walkthrough records the canvas's own moves, never pixels.
- Editing a recording (trimming, cutting), and captions or a transcript.
- Comments on a moment in a walkthrough.
- A walkthrough link for someone who cannot open the design.
- Telemetry, which comes with its dashboard cards.
