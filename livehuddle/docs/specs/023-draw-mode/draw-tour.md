# Draw tour ("Start Draw Tour")

A short, optional guided tour of [Draw mode](draw-mode.md), started from the footer's **Start Draw Tour** button. It
is the [Workshop tour](../012-collaboration/workshop-tour.md)'s sibling: the same Start Tour button, anchored step
cards, glide, dimming ring, Skip, Back and closing card, driven by the same engine. Where this spec is silent, the
Workshop tour's rules hold.

## Domain language

| Term             | Means                                                               |
| ---------------- | ------------------------------------------------------------------- |
| **Draw tour**    | This tour. On the Start Tour button: **Start Draw Tour**            |
| **Diagram tour** | The Diagram mode tour, [Diagram tour](../007-editor/editor-tour.md) |
| **Dock**         | Draw mode's floating bar of tool groups ([Draw mode](draw-mode.md)) |

## Where it appears

- **On the Start Tour button, in Draw mode.** The footer's button, left of Search
  ([Diagram tour](../007-editor/editor-tour.md) "Where it appears"), reads **Start Draw Tour** while the open tab is in
  Draw on a tab the person may edit, unless something more specific is on offer. The editor has to be usable
  (hydrated, no welcome overlay, not read-only, not an embed), and the tab not locked. It is not on offer while a
  template start panel is on screen ([Start Diagramming](../007-editor/start-diagramming.md) "The tours wait"); Draw
  has no start panel of its own, since it offers no templates, so this only matters mid-switch.
- **Never on its own.** Until 25 October 2026 it offered itself, once ever, the first time a person was in Draw
  ("Getting started with Draw?", **No** / **Yes**); the button replaced that offer.
- **It stays on offer once taken.** Pressing the button again reruns it; a press while another tour is on screen
  does nothing. A press starts the first step.
- **Taken, on every device.** However a run ends, the synced `drawTourSeen` user preference
  ([User preferences](../007-editor/user-preferences.md)) records it, for Settings' row only.
- **Rerun from Settings**: the **Draw Tour** switch in Settings' **Tours** category, beside **Workshop** and built
  the same way (on means "not seen yet"). Turning it on from off and closing Settings runs the tour straight away
  when the person is in Draw and it is on offer; otherwise the button is there when they get there.

## Tour content

None. The tour points at the dock and the Quick style panel and places nothing, so there is nothing to take away
and nothing in the document's history. The one tool it picks up (a marker, to show Quick Style) it puts down
again.

## The steps

Four steps, then an outro card, which sits outside the step count. There is no welcome card. Three steps ring one
of the dock's groups by its `data-tour-id` (`dock-drawing`, `dock-shapes`, `dock-settings`, carried by every dock
group as `dock-<group>`); one rings the [Quick style panel](../008-canvas/quick-style-panel.md) (`quick-style`). The exact strings live in `apps/editor/components/tour/draw-tour-steps.ts`.

1. **Pens and Tools**: rings the Drawing tools group. Select, three markers, Text, the Path tool and the Eraser;
   pressing the marker in hand again changes its colour and width.
2. **Quick Style**: rings the Quick style panel. Colour and width for the marker in hand, or for whatever is
   selected, so a stroke, shape or text box is restyled after it is drawn. The panel shows with a pen in hand or a
   selection; with neither, the step picks up the first marker from the dock, as a person would, and its cleanup
   picks Select again. Left out on a phone, which has no Quick style panel.
3. **Shapes**: rings the Shapes group. The sticky note and shapes pinned for one tap; Shapes opens every shape and
   a search, and favourites pin to the dock.
4. **Board Settings**: rings the Settings cog. The board's background, the cursor, and whether rough shapes snap
   into clean ones.
5. **You're ready to draw** (outro): a help-centre link to the Draw mode article (new tab) and **Start**,
   which completes the tour.

- The dock shows on every surface, a phone included (its groups scroll sideways); Quick Style, a desktop's panel,
  is left out on a phone up front, so the count stays honest. A step whose target never appears is skipped, as in
  the Diagram tour.
- If the tour can no longer run where it started (the person's edit rights go, they leave Draw, or they open
  another tab) it ends as skipped.

## Share roles

Only someone who may edit the tab sees the button for this tour: an **Editor**. A **Participant** or a **Viewer**
never does, since the dock's drawing tools are not theirs to use.

## Telemetry ([Telemetry](../017-telemetry/telemetry.md))

The Workshop tour's funnel, with its own tokens:

- **Offer**: `UI` · `Opened` · `DrawTourOffer` the first time the Start Tour button shows this tour in a page load.
  Until 25 October 2026 it counted the welcome card showing, and `UI` · `Closed` · `DrawTourOffer` counted **No**;
  nothing sends Closed now.
- **Start**: `UI` · `Started` · `DrawTour` on a press of the button (or the Settings rerun).
- **Stage views**: `UI` · `View` · `DrawTourStep<Id>` once per step entry (`DrawTourStepDrawingTools`,
  `DrawTourStepQuickStyle`, `DrawTourStepShapes`, `DrawTourStepSettings`, `DrawTourStepOutro`).
- **End**: `UI` · `Ended` · `DrawTourCompleted` | `DrawTourSkipped`.
- **Settings row**: `UI` · `Toggled` · `DrawTourSeenOn` | `DrawTourSeenOff`.

## Power user mode

[Power user mode](../007-editor/power-user-mode.md) marks the Draw tour seen alongside the Diagram and
Workshop tours.
