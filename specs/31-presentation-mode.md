# 31 — Presentation mode

Status: **draft** (design agreed, open questions at the end are narrower than the ones this replaces).

Present a diagram as a **slide deck**: full-screen, one slide at a time, each slide showing a set of elements you picked. Built for the "walk someone through this on a call or a projector" moment.

## Why

A finished diagram shows everything at once, which is great for reference and bad for narration. Presenters today zoom around manually with the laser pointer, and the audience watches the mouse hunt for the next box.

## What a slide is

**A slide is an explicit, ordered set of elements you chose.** Not a region of canvas, not a camera position, not a layer.

- A slide's members are `(tabId, elementId)` pairs, so **one slide can draw elements from several tabs**. The presentation is a view over the whole diagram, not a per-tab feature.
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

Diagram-level, because a slide spans tabs and no single tab owns the deck.

```ts
type SlideRef = { tabId: TabId; elementId: ElementId };

type Slide = {
  id: string;
  // Shown in the panel and the presenter HUD. Absent = "Slide N".
  name?: string;
  refs: SlideRef[];
};

type Deck = { slides: Slide[] };
```

- **Dangling refs resolve at read time.** An element deleted after being added to a slide is skipped, exactly as spec/74 resolves an unknown `layerId` rather than rewriting element data on delete. No cleanup pass, no delete-path coupling, and undo restores the element back onto its slides for free.
- A slide whose refs all dangle renders empty rather than being auto-removed: silently deleting someone's slide because they deleted its contents is worse than an empty slide they can see and fix.
- **Arrows come along.** An arrow whose endpoints are both on the slide is included automatically even when it was not added explicitly, so building a slide from a selection of boxes does not need the connectors hand-picked. An arrow added explicitly always shows.

### Persistence

This is the one part of the feature that is not free. `diagrams.data` was dropped in migration 0006 and tab bodies live in their own table, so there is **no diagram-level JSON blob to extend** — unlike layers, which ride the opaque tab body and needed no api change at all.

- A new `presentation TEXT NULL` column on `diagrams` (the ninth such column; `source`, `share_password` and `team_id` are the pattern), holding the serialised `Deck`.
- The api's diagram DTO in `@livediagram/api-schema` carries it through, and the read / save routes round-trip it.
- Null / absent = no deck, which is every existing diagram.

## Entry and the Presentation Panel

**Presentation is a canvas tool**, alongside Select, Hand, Eraser, Format, Highlighter, Laser, Spotlight, Avatar and Isometric. Picking it from the tool dropdown does **not** start presenting: it opens the panel where you build and administer the deck. Starting is a deliberate second act.

It joins `CanvasTool` only, **not** `SELECTION_MODES` — there is no Presentation Mode Button, because handing a collaborator's screen into a full-screen deck is not something one person should do to another.

The **Presentation Panel** is the seventh tool panel, on exactly the contract the other six share (`useCanvasToolPanels`): mounted only while its tool is active, joins the corner-docking stack, gets a mobile dock button. It carries:

- **The slide list**, in deck order, each row with its name, a member count, and a preview thumbnail rendered by the shared headless SVG renderer (the same one the Layers panel rows use).
- **New slide from selection** — the primary authoring path. Select elements on the canvas, across as many tabs as you like, press the button. Also **Add selection to slide** for growing one.
- **Reorder** by dragging rows, the pointer-event drag the Layers panel already uses (native HTML5 dnd is dead on touch).
- **Rename** inline, **delete**, and **duplicate** a slide.
- Selecting a row **highlights its members on the canvas** and, if they are on another tab, switches to it. This is how you check a slide without presenting.
- **Start** — enters the full-screen deck at slide 1.

### One consequence worth stating

Reordering tabs from this panel was discussed and is **not** included. It made sense while a slide belonged to a tab and the deck was "tab order, then layer order". Now that slide order is its own array, tab order has no effect on the deck at all, so a tab reorder control here would change nothing about the presentation and would only be a confusing second place to do something the tab bar already does.

## Presenting

- **Full screen.** Browser fullscreen where available, all chrome hidden (the zen treatment, spec/26), canvas non-interactive for editing regardless of role.
- **One slide at a time.** Only that slide's elements render. This is a deck, not a progressive reveal of a diagram: advancing does not accumulate.
- **Framing:** fit to the content bounds of the slide's elements (`contentBounds` + `computeFitToScreen`), with padding. **If a slide contains exactly one frame element, its bounds are used instead** — that gives precise, authored framing using an element the product already has, with nothing new to learn.
- **Rendered by the real canvas**, not the static SVG renderer. A slide is not a picture: timers keep counting, polls and votes stay open, reaction pads still fire, done checks still tick (spec/105, spec/135, spec/137). A deck you can run a session from is the point of presenting inside the tool rather than exporting to one.
- **Advance** with `→`, `Space`, `Page Down`, or click. **Back** with `←`, `Page Up`. `Home` / `End` jump to the ends. `Esc` exits and restores the previous tab, viewport and chrome.
- A minimal HUD shows position (`7 / 23`) and the slide's name, fading when idle.
- Advancing past the last slide shows an end state; one more advance or `Esc` exits.
- Available to **every role including share-link viewers**: presenting is read-only by nature, and a viewer narrating a shared diagram is a core case.

### Cross-tab loading

Tabs load lazily (spec/13), so a deck drawing on a tab nobody has visited would stall mid-presentation. `loadAllTabs()` already exists in `usePerTabLoad.ts` — a one-shot parallel fetch of every unloaded tab, built for cross-tab element search — and Start awaits it. Slides that still cannot resolve a tab render their resolvable members and the presentation continues.

## Notes

An element's existing `note?` (spec/05, rich text per spec/92) renders in a caption panel at the bottom when the slide's elements carry one. Several notes on one slide stack in slide-member order.

## Realtime

v1 is **local-only**: entering presentation broadcasts nothing, and remote cursors / lasers are hidden from the presenter's view. Edits arriving mid-presentation are applied underneath; a slide re-renders if one of its members changed.

Follow-the-presenter (a `presentation` room op so viewers' screens track the presenter's slide) is the natural v2 and slots into the presence-op family (`cursor`, `select`, `laser`, `tab-focus`) in `@livediagram/api-schema`.

## Implementation shape

Per the no-god-files rule: `usePresentation.ts` (deck state, current index, keyboard, camera targets), `PresentationPanel.tsx` (the seventh tool panel, built like `EraserPanel` / `HighlighterPanel`), and `PresentationOverlay.tsx` (full-screen surface, HUD, captions, end state). Deck helpers stay pure and live in `packages/diagram` beside the element helpers: resolving refs to elements, pulling in implied arrows, and computing a slide's bounds are all `(Deck, Tab[]) -> ...` functions with no React in them, so they are testable and reusable by the api and MCP worker.

## Telemetry

Per spec/22: `track('UI', 'Opened', 'Presentation')` when the tool is picked, `track('UI', 'Started', 'Presentation')` on Start, `track('UI', 'Closed', 'Presentation')` on exit, and `track('UI', 'Added', 'Slide')` when a slide is created. No per-step events: chatty, low signal.

## Out of scope (v1)

- Follow-the-presenter sync.
- Presenter-only notes view / dual-screen console.
- Export the deck to PDF or PPT. (The framing rule above makes it tractable later: every slide already has bounds, and the export renderer already draws a bounded element set.)
- Transitions and per-element build animation within a slide.
- Auto-generating a deck from a diagram.

## Open questions

1. **Empty-deck affordance.** A diagram with no slides opens the panel to an empty list. Is "New slide from selection" enough of a start, or should the panel offer to seed a deck (one slide per tab, or one per frame element)?
2. **Editing while presenting.** Presenting is specced non-interactive for editing, but the live session elements stay live. Is pressing a Done check or casting a vote from within a presentation clearly not "editing"? The current answer is yes, and the line is: element interactions work, canvas authoring does not.
3. **Slide-level backdrop.** A slide inherits the backdrop of the tab its first member belongs to. For a slide mixing tabs, is that the right rule, or should the deck carry its own background?
