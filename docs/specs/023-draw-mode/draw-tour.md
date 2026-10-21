# Draw tour

A short, optional guided tour of [Draw mode](draw-mode.md), offered the first time a person works in Draw. It is
the [Plan tour](../026-plan/plan-tour.md)'s sibling: the same welcome card, anchored step cards,
glide, dimming ring, Skip, Back and outro card, driven by the same engine. Where this spec is silent, the
Plan tour's rules hold.

## Domain language

| Term             | Means                                                               |
| ---------------- | ------------------------------------------------------------------- |
| **Draw tour**    | This tour                                                           |
| **Diagram tour** | The Diagram mode tour, [Diagram tour](../007-editor/editor-tour.md) |
| **Dock**         | Draw mode's floating bar of tool groups ([Draw mode](draw-mode.md)) |

## Where it appears

- **The first time a person is in Draw mode** on a tab they may edit: switching a tab to Draw, or opening a
  document whose tab opens in Draw. The editor has to be usable (hydrated, no welcome overlay, not read-only, not
  an embed), and the tab not locked.
- **Not before the synced preferences are in**, so an answer given on another device holds on a new one.
- **On its own, never at the same time as another tour.** It also waits while a template start panel is on screen
  ([Start Diagramming](../007-editor/start-diagramming.md) "The tours wait"); Draw has no start panel of its own,
  since it offers no templates, so this only matters mid-switch.
- **Optional.** The offer is the opt-in: **Yes** starts it, **No** declines it.
- **Once ever per person**, through the synced `drawTourSeen` user preference
  ([User preferences](../007-editor/user-preferences.md)): taken, skipped mid-way or declined, it never offers
  itself again, on any device.
- **Replayable from Settings**: the **Draw Tour** switch in Settings' **Tours** category, beside
  **Workshop** and built the same way (on means "not seen yet"). Turning it on from off and closing Settings runs
  the tour straight away when the person is in Draw, or offers it the next time they enter Draw.

## Tour content

None. The tour points at the dock and the Quick style panel and places nothing, so there is nothing to take away
and nothing in the document's history. The one tool it picks up (a marker, to show Quick Style) it puts down
again.

## The steps

A welcome card, four steps, then an outro card. The bookend cards sit outside the step count. Three steps ring one
of the dock's groups by its `data-tour-id` (`dock-drawing`, `dock-shapes`, `dock-settings`, carried by every dock
group as `dock-<group>`); one rings the [Quick style panel](../008-canvas/quick-style-panel.md) (`quick-style`). The exact strings live in `apps/live/components/tour/draw-tour-steps.ts`.

0. **Getting started with Draw?** (the offer): centred card with its own illustration (a whiteboard where a marker
   scribble draws itself on over a highlighter swipe and a star is circled), offering a quick tour of the pens,
   shapes and tools, then **No** and **Yes**.
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

Only someone who may edit the tab is offered the tour: an **Editor**. A **Participant** or a **Viewer** is never
offered it, since the dock's drawing tools are not theirs to use.

## Telemetry ([Telemetry](../017-telemetry/telemetry.md))

The mode tours' funnel, with its own tokens:

- **Offer**: `UI` · `Opened` · `DrawTourOffer` when its welcome card shows; `UI` · `Closed` · `DrawTourOffer` on No.
- **Start**: `UI` · `Started` · `DrawTour`.
- **Stage views**: `UI` · `View` · `DrawTourStep<Id>` once per step entry (`DrawTourStepDrawingTools`,
  `DrawTourStepQuickStyle`, `DrawTourStepShapes`, `DrawTourStepSettings`, `DrawTourStepOutro`).
- **End**: `UI` · `Ended` · `DrawTourCompleted` | `DrawTourSkipped`.
- **Settings row**: `UI` · `Toggled` · `DrawTourSeenOn` | `DrawTourSeenOff`.

## Power user mode

[Power user mode](../007-editor/power-user-mode.md) marks the Draw tour seen alongside the Diagram and Plan
tours.
