# Watch It Built

Status: **approved** (owner, 2026-11-08, Work Tracker #58 "New & Improved Page Tours": direction E, Watch It Built,
picked from six designs; "the Tour offers to show us, and then the cursor moves to build a basic diagram and shows
things like the context menu / toolbar etc in action"). Replaces the six-step [Diagram tour](editor-tour.md#the-steps).
Extended (owner, 2026-11-08): "The tour shouldn't start immediately, it should offer me what I want to learn ... show
me the basics, but also ... how to change the look and feel etc, find useful topics"; "do the same for draw and
workshop modes ... create a working and amazing curriculum". So Watch It Built is now a set of short **topics** per
mode, picked on a start panel, and it replaces the stepped Draw and Workshop tours too.

**Watch It Built** is the editor's tour in every mode (Diagram, Draw, Workshop). A press asks **What would you like to
learn?** and lists that mode's **topics**; picking one plays a short replay in which a cursor named **Example**, drawn
exactly like a collaborator's, does the thing on the canvas using the real chrome: the palette opens, shapes drop in,
menus and panels open, a look is picked. A player bar under it has chapters, pause and **Your Turn**. Nothing it builds
or changes is kept: Your Turn hands the canvas back exactly as it was.

## Why

The stepped tour told people where controls were in a row of cards, the look the owner wants gone (#58). Diagramming
is a handful of gestures, and the fastest way to learn a gesture is to see it done. A live cursor is native to a
multiplayer canvas, so the tour also previews working together.

## Domain language

| Term               | Means                                                                                                |
| ------------------ | ---------------------------------------------------------------------------------------------------- |
| **Watch It Built** | This tour. In the interface: **Watch It Built** on the footer button and in Settings' Tours category |
| **A topic**        | One thing to learn, played as one replay: **The Basics**, **Look and Feel**, **Sketch**, ...         |
| **The curriculum** | A mode's topics, in the order the start panel lists them                                             |
| **Start panel**    | What a press opens: "What would you like to learn?" and the mode's topics                            |
| **The replay**     | One run of a topic, from the pick to its end                                                         |
| **Example**        | The replay's cursor and its name chip                                                                |
| **Demo elements**  | What the replay builds: drawn on the canvas, never part of the document                              |
| **A chapter**      | One named part of a topic's replay (The Basics: **Add**, **Connect**, **Label**, **Style**)          |
| **The player**     | The bar the replay shows under the canvas: pause or play, the chapters, **Your Turn**                |
| **welcome tour**   | Kept only in code identifiers and telemetry tokens, as before                                        |

## Where it appears

- **The footer's Start Tour button offers it** in each mode, reading **Watch It Built**, at the mode tour's rank
  (`TOUR_OFFER_RANK.mode`), under the same rules as every tour ([Diagram tour](editor-tour.md#where-it-appears)): to an
  Editor, once the editor is ready and the tab's start is done; never in read-only, an embed, a locked tab or for a
  Participant. It never starts or offers itself. It is on the button while the mode has a topic not yet taken, and back
  from Settings.
- **A press opens the start panel, never a replay.** See [The start panel](#the-start-panel).
- **One tour at a time**, as before. Leaving the mode mid-replay or switching tab ends it. No dialog of the person's can
  open while it runs: the shield takes every press and key but the player's.

## The start panel

Opened by a press on Watch It Built (or a Settings rerun), in the player's place low over the canvas, as a card of the
player's look:

- **"What would you like to learn?"** and one line: "Short replays on your own canvas. Nothing is saved."
- The mode's topics as rows, each with its name, one line on what it shows, about how long it runs ("30 s"), and a
  **Done** tick once taken. Any row plays its topic; a taken one plays again.
- **Not Now** closes the panel. Nothing is recorded and the button stays.
- Keyboard: the rows are buttons in order (Tab, Enter); Escape is Not Now. The panel takes focus when it opens.
- A topic ending (Your Turn, or Done under reduced motion) offers **More Topics** beside Your Turn when the mode has
  another; it reopens the panel. Escape and leaving end the run without it.
- Taken: a topic is taken when it is picked (so a reload mid-replay leaves it taken). The record is the synced
  `watchTopics` list of topic ids. A mode's button goes once every one of its topics is taken. The older `tourSeen`
  (someone who watched the first Watch It Built) counts as **The Basics** taken; `drawTourSeen` and `workshopTourSeen`
  (the stepped tours) count as nothing, since those tours showed none of these replays.

## The curriculum

Each topic is a short replay (10 to 35 s) of two to four chapters, on its mode's canvas, built round the middle of the
view. Lines name clicks on a computer and taps on a touch screen.

### Diagram

| Topic             | Line on the start panel                            | Chapters: what Example does with the real chrome                                                                                                                                                                                                                                                                                                                                                        |
| ----------------- | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **The Basics**    | Add shapes, join them, name them and colour one.   | Add, Connect, Label, Style, as [The replay](#the-replay) below                                                                                                                                                                                                                                                                                                                                          |
| **Look and Feel** | Give the whole tab a new look and background.      | **Open Style**: presses the footer's Style; the real Tab Style dialog opens and the player moves to the top. **Pick a Look**: presses two looks on its first page in turn (Spectrum, then Whiteboard, or the next ones when the tab already wears one); the canvas, the demo and the dialog restyle as a press would. **Canvas**: opens Fine-tune's Canvas and picks a new background (Graph, or Lines) |
| **Style a Shape** | Border, shadow and font for one shape.             | **Border**: right-clicks the shape, opens Style, then Border, and picks Thick, then Dashed. **Shadow**: opens Shadow and picks Lifted. **Font**: opens Text, then Font, and picks Caveat (handwriting); the menu closes. (Colours are The Basics' Style chapter)                                                                                                                                        |
| **Find Anything** | Search every shape by name or use, and drop it in. | **Search**: presses Search on the strip and types "database". **Drop**: drags the Database result onto the canvas (a cylinder). **Again**: searches "decision" and drags the Decision result (a diamond) beside it                                                                                                                                                                                      |
| **Tidy Up**       | Lay a messy flow out neatly in one press.          | **The Mess**: five joined steps land one by one, each a little off. **Tidy Up**: opens the footer's Tidy Up and picks Auto Layout; the shapes glide to exactly where that press puts them (lib/tab-cleanup.ts)                                                                                                                                                                                          |

### Draw

| Topic                   | Line on the start panel                            | Chapters                                                                                                                                                                                                                                           |
| ----------------------- | -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Sketch**              | Pick up a marker and draw.                         | **Pick Up**: presses the first marker on the dock; it shows in hand. **Draw**: a wavy line and a little house (walls, roof, door) are drawn under the cursor, in that marker                                                                       |
| **Shape Recognition**   | Wobbly lines become clean shapes when you hold.    | **Turn On**: opens the dock's Settings cog and presses Shape recognition. **Hold**: a wobbly circle is drawn, the cursor rests half a second and it snaps into a clean ellipse (the line names Alt). **Again**: a rough box snaps into a rectangle |
| **Pens and Colours**    | Choose each marker's colour and width.             | **Open**: presses Marker 2, then presses it again; its flyout opens. **Colour**: picks Green, then Thick. **Draw**: a stroke in the new pen                                                                                                        |
| **Shapes and Stickies** | Add shapes and sticky notes from the dock.         | **Shapes**: opens the dock's Shapes, searches "rectangle", picks it and drags one out. **Sticky**: opens Shapes again, searches "sticky", picks the sticky note, clicks the board and types on it                                                  |
| **Erase and Board**     | Rub things out and change what's behind your work. | **Erase**: picks the Eraser and rubs out one of three strokes. **Board**: opens the dock's Settings cog and picks Dots, then Grid; the board changes behind the strokes                                                                            |

Draw's topics never change the person's tools: the marker in hand, its colour and width, Shape recognition and the
board are shown on the dock and the canvas from the replay (the dock draws them in while it runs), never picked or
stored, so the tool in hand and every Draw setting are exactly as they were when it ends. Example's presses on a
flyout's options only show a ring; the flyouts themselves are opened by their own dock buttons.

### Workshop

| Topic                     | Line on the start panel                             | Chapters                                                                                                                                                                                                                                                     |
| ------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Ask the Room**          | Dot votes, polls and check-ins everyone can join.   | **Dot Vote**: opens the palette's Ask and drags a Dot Vote onto the canvas. **Poll**: drags a Poll beside it. **Check-In**: drags a Temperature Check under them                                                                                             |
| **Stickies and Stickers** | Sticky notes for ideas, stickers to react.          | **Stickies**: opens Write and drags out three stickies in a row. **Write**: double-clicks each and types an idea. **Stickers**: opens Stickers, picks Reactions and drags a thumbs up and a heart onto two of them                                           |
| **Reactions and Reveals** | Reaction pads and a reveal zone that hides answers. | **Reactions**: opens Session, picks React and drags a Confetti pad onto the canvas. **Reveal**: picks Session's Reveal Zone and draws it over two answer stickies; they hide under its cover                                                                 |
| **Run the Room**          | Start a timer and a dot vote for everyone.          | **Timer**: presses a Timer button on the board; it counts down there and on the Session strip. **Vote**: presses Dot Vote; dots land on the notes as the room votes. **Results**: presses Vote on the Session strip to end it; the most-voted notes light up |

Ask holds Dot Vote, Poll and Temperature Check; the Timer, Reveal Zone and reaction pads are in Session, whose groups
(Tools, React, ...) the replay picks on Session's rail, putting the rail back on its first group as it closes. Run the
Room's timer and vote are drawn from the replay (as Look and Feel's theme is), never started: the room sees nothing.

## The replay

The replay is the same for every topic; The Basics is described here as the example.

- **A pick starts it at once.** The canvas fades back (the person's elements at a quarter strength), the player appears
  low over the canvas with Example's line in it, and Example sets off. Nothing sits over the toolbar or palette, so
  every press Example makes is in view. The tab's empty-canvas card and tray stay away while the demo fills it. The demo
  is built round the middle of the view, in whatever space is there; the view never pans or zooms.
- **The chapters** (The Basics), each a few seconds, in order. Each chapter's one short line sits in the player, after
  **Example**:

  | Chapter | What Example does, with the real chrome                                                                                                               | Example's line                                                |
  | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
  | Add     | Opens the palette's **Shapes** (the real flyout), drags a shape onto the canvas: "Order received" (a start). Then a second step                       | "Pick a shape from the palette and drop it on the canvas."    |
  | Connect | Selects the first shape: its handles and the **selection toolbar** show. Drags from the quick-connect ring onto the second shape: an arrow joins them | "Drag from the ring round a shape onto another to join them." |
  | Label   | Double-clicks the second shape: its label opens for editing and "Check stock" is typed, letter by letter                                              | "Double-click a shape to name it."                            |
  | Style   | Right-clicks it: the real **element menu** opens beside it, Example opens **Style**, then **Presets**, and picks **Success**: the shape turns green   | "Right-click anything for its colours and options."           |

  On a touch screen the words name taps and long-presses ("Tap a shape, then drag from its ring…", "Long-press
  anything…").

- **The chrome is real.** The palette flyout, the selection handles and toolbar, the quick-connect ring and the element
  menu are the editor's own components, shown on the demo elements, so what people see is exactly what they will use.
- **The page waits.** While the replay runs the canvas and chrome take no presses, wheel or keys (the shared tour
  shield), except the player and Escape. Escape ends the replay as skipped.
- **It ends**:
  - **Your Turn** (in the player, and after the last chapter, where the player holds on the finished diagram):
    the demo goes, the canvas comes back to full strength exactly as it was, and the tour is finished. **More Topics**
    beside it does the same and opens the start panel.
  - **Escape**, a change of tab or mode, or leaving the page: the same, recorded as skipped.

## The player

- A card centred under the canvas, above the bottom dock: Example's line for the chapter on top, then a round
  **Pause** / **Play** button, the four chapters (each a name over a thin progress line that fills as it plays), and
  **Your Turn** in green.
- **A chapter's name replays it**: pressing it starts that chapter from its beginning, with the demo set to how the
  chapters before it left it.
- After the last chapter the replay holds on the finished diagram, the play button reading **Replay**.
- Keyboard: Space pauses or plays, the left and right arrow keys go to the previous or next chapter, Escape ends.
  The player takes focus when it appears, so these work at once; its buttons have visible focus rings.

## Nothing is kept

The replay never changes the document:

- **A look shown is not applied.** Look and Feel and Erase and Board show a theme or a board background on the canvas
  (and in the Tab Style dialog while it is open) from the replay, not the tab or the person's settings; the tab and
  the person's Draw background are exactly as they were when it ends.
- **A session shown is not started.** Run the Room shows a running timer and a dot vote on the canvas and the Session
  strip from the replay, not the tab: nothing starts for the room, and the tab's own timer and vote are as they were.
- **Demo elements are never in the document's tabs.** They are drawn on the canvas beside the person's own, so autosave,
  the unload save, the offline copy, undo, export, the minimap's document and every collaborator never see them.
- **Its selection is its own.** Selecting a demo element shows the real handles and toolbar on this screen only; the
  person's selection, and what collaborators see of it, does not change.
- **Writes are refused while it runs.** Any edit that reaches the document while the replay runs is dropped (a second
  guard for an editor component that commits on its own, such as a label on blur).
- **Collaborators carry on.** Their edits arrive and draw as usual under the faded layer, and are there when the
  replay ends. They never see Example.
- **Chrome it opens is closed again.** Example opens the editor's own panels by their own buttons (the palette, the Tab
  Style dialog, Search, Tidy Up, a dock flyout, a menu section) and closes each as the replay moves on or ends, the
  last opened first. A press that would change the tab (a look, a tile, Auto Layout) is never made: only its ring
  shows, and the replay draws what that press would give.
- **Nothing it presses is counted** as the person's use of a feature in telemetry.

## Motion

- Example moves at a person's pace (about 900 px a second, eased), pauses briefly before each press, and shows a small
  ring where it presses. A drag carries the shape under the cursor, as the real drag does.
- **Reduced motion** (the system's setting or the editor's own Reduce Motion): no gliding. Each chapter shows its end state, with the chrome it used open for a moment, and the
  player steps from chapter to chapter (the play button reads **Next**, then **Done** on the last chapter, which
  finishes the tour as Your Turn does).
- **On a phone** Example is a touch dot (a soft ring) instead of an arrow, and the player is narrower, chapter names
  shortened to fit (Add, Join, Label, Style). While the element menu is open (a sheet up from the bottom on a phone) the
  player moves to the top of the canvas, so the sheet's presets stay in view.

## Telemetry

- `UI·Opened·TourOffer` (the button first offering it in a page load), as before.
- `UI·Opened·WatchStart` when the start panel opens (a press or a Settings rerun).
- `UI·Started·Tour` when a topic is picked, plus `UI·View·WatchTopic<Topic>` naming it (`WatchTopicBasics`,
  `WatchTopicLook`, ...; one token per topic id).
- `UI·View·TourStep<Chapter>` as each chapter starts (The Basics: `TourStepAdd`, `TourStepConnect`, `TourStepLabel`,
  `TourStepStyle`; other topics' chapters likewise, by their chapter id).
- `UI·Ended·TourCompleted` (Your Turn, More Topics, Done) or `UI·Ended·TourSkipped`.

The dashboard's Tour Steps ranking reads The Basics' four chapters in order ([Telemetry](../017-telemetry/telemetry.md)).

## Settings

Settings' Tours (Getting Started) category, section **Offer Again**: one switch per mode over all its topics (**Watch
It Built**, **Watch It Built in Draw**, **Watch It Built in Workshop**, on while any of its topics is not taken), and
one switch per topic nested under it, named by the topic ("The Basics", "Look and Feel", ...). On means not yet taken.
A mode's switch turned on from off forgets its topics; a topic's switch forgets that topic. Turned on and Settings
closed, the start panel opens if the editor is in that mode.

## Out of scope

- The element tours keep the stepped engine. The stepped Draw and Workshop tours are retired: Watch It Built in Draw
  and Workshop replaces them.
- The demo cannot be kept as the person's own diagram. It is a demonstration, and the templates are where a diagram
  starts.
