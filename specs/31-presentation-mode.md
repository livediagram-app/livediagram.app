# 31 — Presentation mode

Status: **draft** (design agreed, open questions at the end are narrower than the ones this replaces).

Present a diagram as a **slide deck**: full-screen, one slide at a time, each slide showing a set of elements you picked. Built for the "walk someone through this on a call or a projector" moment.

## Why

A finished diagram shows everything at once, which is great for reference and bad for narration. Presenters today zoom around manually with the laser pointer, and the audience watches the mouse hunt for the next box.

## What a slide is

**A slide is an explicit, ordered set of elements you chose, from one tab.** Not a region of canvas, not a camera position, not a layer.

- **A slide belongs to a single tab**, and names elements on it. **The DECK is what spans tabs**: slide 1 can come from Tab A, slide 2 from Tab C, slide 3 from Tab A again. The presentation is a view over the whole diagram; each slide within it is not.
- Keeping a slide inside one tab is what makes it well-defined. A slide mixing tabs has no answer to which backdrop it wears, and elements from two tabs share no coordinate space, so "fit this slide" would have no meaning.
- **An element can be on any number of slides.** Membership is a list, not a partition, so a title that belongs on every slide simply appears in every slide's list.
- **Slide order is the deck's own order**, independent of tab order, element array order, and z-order. Reordering slides never restacks anything on the canvas.

### Why not layers

Layers (spec/74) were the obvious candidate and were considered in detail: they are already an ordered list of element groups with a management panel, drag-reorder, per-band preview thumbnails, and a local render override (hover-solo) that is exactly the "show these bands only, without touching persisted state" mechanism a presentation needs. Reusing them would have been cheap.

They were rejected because a layer means something else, and the collisions were not superficial:

- **Layers are z-order bands**, so slide order would have been stacking order: reordering the deck would restack the drawing.
- **Bring to Front / Send to Back create and prune layers** (spec/74). Casually clicking "bring to front" would mint a slide, and emptying a layer would silently delete one.
- **An element belongs to exactly one layer.** A title on every slide would have been unexpressible, and so would any element appearing on more than one.

Slides are their own concept for the same reason layers were: overloading one structure with two meanings costs more in surprise than it saves in code. **Layers stay purely diagram structure.** Nothing in spec/74 changes.

## Data model

Diagram-level. A slide belongs to one tab, but the DECK does not: its order interleaves tabs freely (A, C, A), so no single tab can own the list.

```ts
type Slide = {
  id: string;
  // Shown in the panel and the presenter HUD. Absent = "Slide N".
  name?: string;
  // The one tab this slide draws from. Its backdrop, theme and coordinate
  // space are the slide's.
  tabId: TabId;
  elementIds: ElementId[];
};

type Deck = { slides: Slide[] };
```

- **Dangling ids resolve at read time.** An element deleted after being added to a slide is skipped, exactly as spec/74 resolves an unknown `layerId` rather than rewriting element data on delete. No cleanup pass, no delete-path coupling, and undo restores the element back onto its slides for free. A slide whose whole TAB is deleted is skipped the same way.
- A slide whose ids all dangle renders empty rather than being auto-removed: silently deleting someone's slide because they deleted its contents is worse than an empty slide they can see and fix.
- **Arrows come along.** An arrow whose endpoints are both on the slide is included automatically even when it was not added explicitly, so building a slide from a selection of boxes does not need the connectors hand-picked. An arrow added explicitly always shows.

### Persistence

This is the one part of the feature that is not free. `diagrams.data` was dropped in migration 0006 and tab bodies live in their own table, so there is **no diagram-level JSON blob to extend** — unlike layers, which ride the opaque tab body and needed no api change at all.

- A new `presentation TEXT NULL` column on `diagrams` (the ninth such column; `source`, `share_password` and `team_id` are the pattern), holding the serialised `Deck`.
- The api's diagram DTO in `@livediagram/api-schema` carries it through, and the read / save routes round-trip it.
- Null / absent = no deck, which is every existing diagram.

## Entry and the Slide Deck panel

**Slide Deck is a canvas tool**, alongside Select, Hand, Eraser, Format, Highlighter, Laser, Spotlight, Avatar and Isometric. Picking it from the tool dropdown does **not** start presenting: it opens the **Slide Deck panel**, where you build and administer the deck. Starting is a deliberate second act.

The tool and the panel are both called **Slide Deck** — the thing you are making — rather than "Presentation", which names the act of showing it. You spend far more time building a deck than running one, and the tool you pick is the workbench, not the performance. "Presentation mode" stays the name of what Start puts you into, and of this spec.

It joins `CanvasTool` only, **not** `SELECTION_MODES` — there is no Slide Deck Mode Button, because handing a collaborator's screen into a full-screen deck is not something one person should do to another.

The **Slide Deck panel** is the seventh tool panel, on exactly the contract the other six share (`useCanvasToolPanels`): mounted only while its tool is active, joins the corner-docking stack, gets a mobile dock button. It is the **single home for everything about the deck** — build it, order it, check it, start it — so there is never a second place to look. It carries:

- **The slide list**, in deck order, each row with its name, a member count, and a preview thumbnail rendered by the shared headless SVG renderer (the same one the Layers panel rows use).
- **New slide from selection** — the primary authoring path. Select elements on the canvas, press the button; the slide takes the active tab. Also **Add selection to slide** for growing one, which is offered only while you are on that slide's own tab (a slide holds one tab's elements, so adding from another tab is not a thing to disallow politely, it is a thing that cannot be expressed).
- **An empty deck stays empty.** No seeded slides, no "one per tab" starter. A generated deck is a deck you have to read and prune before you can trust it, and pruning somebody else's guesses is slower than making the three slides you meant.
- **Reorder** by dragging rows, the pointer-event drag the Layers panel already uses (native HTML5 dnd is dead on touch).
- **Rename** inline, **delete**, and **duplicate** a slide.
- Selecting a row **switches to that slide's tab and highlights its members on the canvas**. This is how you check a slide without presenting, and it is why a slide names its tab rather than inferring one.
- **Start** — enters the full-screen deck at slide 1.

### What the panel does not do

Reorder tabs. It was asked for while a slide belonged to a tab and the deck was "tab order, then layer order", and the model moved on: slide order is its own array now, so reordering tabs changes nothing about the deck. Everything that DOES affect the presentation lives in this panel; a control that looks like deck management but only reshuffles the tab bar would undermine exactly that promise.

## Presenting

- **Full screen.** Browser fullscreen where available, all chrome hidden (the zen treatment, spec/26).
- **One slide at a time.** Only that slide's elements render. This is a deck, not a progressive reveal of a diagram: advancing does not accumulate.
- **The backdrop is the slide's tab's** — its background colour, pattern and theme. Well-defined precisely because a slide belongs to one tab.
- **Framing:** fit to the content bounds of the slide's elements (`contentBounds` + `computeFitToScreen`), with padding. **If a slide contains exactly one frame element, its bounds are used instead** — that gives precise, authored framing using an element the product already has, with nothing new to learn.
- **A slide is inert.** No click reaches any element, for anybody, whatever their role. Not just no editing: no voting, no starting a timer, no ticking a Done check, no firing a reaction pad. You are on a projector in front of a room, and a stray click that changes the diagram is not a feature. The session tools stay where they are used, on the canvas.
  - Live DATA still displays. A timer somebody started before the presentation goes on counting down on the slide, and a poll shows the results it has. That is the slide reporting the diagram, not the audience changing it, and freezing a running clock mid-sentence would read as a bug.
- **Rendered by the real canvas**, inert, rather than by the static SVG renderer. Not for interactivity, which is now gone, but so there is exactly ONE thing that knows how an element looks. A second renderer for presenting is a second renderer to keep in step, and it would drift the first time an element gained a feature. It also keeps the live-data rule above free.
- **Advance** with `→`, `Space`, `Page Down`, or click. **Back** with `←`, `Page Up`. `Home` / `End` jump to the ends. `Esc` exits and restores the previous tab, viewport and chrome.
- A minimal HUD shows position (`7 / 23`) and the slide's name, fading when idle.
- Advancing past the last slide shows an end state; one more advance or `Esc` exits.
- Available to **every role including share-link viewers**: presenting is read-only by nature, and a viewer narrating a shared diagram is a core case.

### Cross-tab loading

Tabs load lazily (spec/13), so a deck whose slides reach into a tab nobody has visited would stall mid-presentation. `loadAllTabs()` already exists in `usePerTabLoad.ts` — a one-shot parallel fetch of every unloaded tab, built for cross-tab element search — and Start awaits it. A slide whose tab still cannot be resolved is skipped rather than blocking the deck.

## Notes

An element's existing `note?` (spec/05, rich text per spec/92) renders in a caption panel at the bottom when the slide's elements carry one. Several notes on one slide stack in slide-member order.

## Realtime

v1 is **local-only**: entering presentation broadcasts nothing, and remote cursors / lasers are hidden from the presenter's view. Edits arriving mid-presentation are applied underneath; a slide re-renders if one of its members changed.

Follow-the-presenter (a `presentation` room op so viewers' screens track the presenter's slide) is the natural v2 and slots into the presence-op family (`cursor`, `select`, `laser`, `tab-focus`) in `@livediagram/api-schema`.

## Implementation shape

Per the no-god-files rule: `useSlideDeck.ts` (deck state, current index, keyboard, camera targets), `SlideDeckPanel.tsx` (the seventh tool panel, built like `EraserPanel` / `HighlighterPanel`), and `PresentationOverlay.tsx` (the full-screen surface Start puts you into: HUD, captions, end state). Deck helpers stay pure and live in `packages/diagram` beside the element helpers: resolving a slide to its elements, pulling in implied arrows, and computing a slide's bounds are all `(Deck, Tab[]) -> ...` functions with no React in them, so they are testable and reusable by the api and MCP worker.

## Telemetry

Per spec/22: `track('UI', 'Opened', 'SlideDeck')` when the tool is picked, `track('UI', 'Started', 'Presentation')` on Start, `track('UI', 'Closed', 'Presentation')` on exit, and `track('UI', 'Added', 'Slide')` when a slide is created. No per-slide events: chatty, low signal.

## Out of scope (v1)

- Follow-the-presenter sync.
- Presenter-only notes view / dual-screen console.
- Export the deck to PDF or PPT. (The framing rule above makes it tractable later: every slide already has bounds, and the export renderer already draws a bounded element set.)
- Transitions and per-element build animation within a slide.
- Auto-generating a deck from a diagram (see the empty-deck rule above: deliberate, not deferred).
- A slide that mixes tabs. Ruled out by the model, not postponed.
- Interaction during a presentation. Also ruled out, not postponed: a slide is inert.

## Settled

The three questions this draft opened with are answered, and the answers are in the body above rather than left hanging here:

- **Empty deck** — it stays empty. No seeding.
- **Interaction while presenting** — none. A slide is inert for everybody; live data still displays.
- **Slide backdrop** — the slide's tab's, which is well-defined because a slide belongs to one tab.

## Open questions

1. **Duplicating a slide across tabs.** Duplicate copies a slide within its tab. Should there be a "copy this slide's layout to another tab" that maps to the equivalent elements, or is that a fantasy given elements are not equivalent across tabs?
2. **A deleted tab's slides.** They are skipped at read time (above), so a deck can carry invisible slides that come back if the tab is restored by undo. Is silent-skip right, or should the panel show them struck through so you know they are there?
