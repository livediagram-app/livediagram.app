# 31 — Presentation mode

> **Status: implemented.** The deck model and its pure helpers live in
> `packages/diagram/src/slide-deck.ts`, persistence in migration 0041
> (`diagrams.presentation`), and the editor surface in `useSlideDeck.ts`,
> `SlideDeckPanel.tsx`, `PresentationHost.tsx`, `PresentationOverlay.tsx`,
> `PresentationHud.tsx` and `PresentationElementPopover.tsx`. The two open
> questions at the end are follow-ups, not blockers.

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
  // What you mean to SAY over this slide. The slide's own, not any
  // element's. See Presenter notes below.
  notes?: string;
};

type Deck = { slides: Slide[] };

// The stored envelope. An array from day one even though v1 ships exactly
// one deck: "the deck for the exec review" and "the deck for the team
// walkthrough" are an obvious want over the same diagram, and shipping
// `{ slides }` now would mean a data migration to add the second. An array
// with one member costs nothing today and keeps that door open.
type StoredPresentation = { decks: Deck[] };
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
- **Remove from slide** — the other half of adding. Select elements on the canvas and remove them from the open slide, or drop them from the slide's member list. Membership is edited for the life of the deck, not just at the moment a slide is created.
- **Reorder** by dragging rows, the pointer-event drag the Layers panel already uses (native HTML5 dnd is dead on touch).
- **Rename** inline, **delete**, and **duplicate** a slide.
- **Presenter notes** for the selected slide, in a text area under the list. Written here, not on the canvas, because a note is about the slide rather than about anything on it.
- Selecting a row **switches to that slide's tab and highlights its members on the canvas**. This is how you check a slide without presenting, and it is why a slide names its tab rather than inferring one.
- **Start** — enters the full-screen deck at slide 1.

### What the panel does not do

Reorder tabs. It was asked for while a slide belonged to a tab and the deck was "tab order, then layer order", and the model moved on: slide order is its own array now, so reordering tabs changes nothing about the deck. Everything that DOES affect the presentation lives in this panel; a control that looks like deck management but only reshuffles the tab bar would undermine exactly that promise.

## Presenting

- **Full screen.** Browser fullscreen where available, all chrome hidden (the zen treatment, spec/26).
- **One slide at a time.** Only that slide's elements render. This is a deck, not a progressive reveal of a diagram: advancing does not accumulate.
- **The backdrop is the slide's tab's** — its background colour, pattern and theme. Well-defined precisely because a slide belongs to one tab.
- **Framing:** fit to the content bounds of the slide's elements (`contentBounds` + `computeFitToScreen`), with padding. **If a slide contains exactly one frame element, its bounds are used instead** — that gives precise, authored framing using an element the product already has, with nothing new to learn.
- **Nothing on a slide can be CHANGED.** No editing, moving, resizing or deleting; and none of the session verbs either: no voting, no starting or pausing a timer, no ticking a Done check, no firing a reaction pad. You are on a projector in front of a room, and a stray click that alters the diagram is not a feature.
  - Live DATA still displays. A timer somebody started before the presentation goes on counting down on the slide, and a poll shows the results it has. That is the slide reporting the diagram, not the audience changing it, and freezing a running clock mid-sentence would read as a bug.
- **Everything on a slide can be READ.** Clicking an element opens a **read-only popover** carrying what that element has to say: its **note** (spec/05, rendered rich per spec/92), its **comment thread** (spec/09), and its **assigned actions** (spec/68) with assignee and status. Nothing in the popover is editable, and there is no composer: you can show the room the objection somebody left on this box, and you cannot answer it from here.
  - This is the line the whole mode runs on, and it is worth stating as one sentence: **read anything, change nothing.** Inspecting is not editing, and a presenter being unable to show the note attached to the thing they are pointing at would be a strange kind of presentation.
  - The element popover is a different thing from the HUD's notes popover, and they do not overlap. The HUD's carries the SLIDE's presenter note, what you mean to say. This one carries the ELEMENT's, what the diagram records about that box.
- **A click on empty space advances the slide; a click on an element opens its popover.** The disambiguation matters, because click-to-advance and click-to-inspect are the same gesture on different targets. Clicking outside an open popover closes it rather than advancing, so dismissing never skips a slide.
- **Rendered by the real canvas**, not by the static SVG renderer. Two reasons, and the first one is now load-bearing rather than tidy: a slide has to RESPOND to clicks and carry live element state, which a rasterised or SVG snapshot cannot do at all. The second is that there is then exactly one thing that knows how an element looks, so presenting cannot drift from the canvas the first time an element gains a feature.
- **Advance** with `→`, `Space`, `Page Down`, or click. **Back** with `←`, `Page Up`. `Home` / `End` jump to the ends.
- Advancing past the last slide shows an end state; one more advance exits.

### Motion

A deck should feel like a deck, and the transitions are what sell it.

- **Entering**: the first slide animates in as a card arriving on screen (scale up from slightly small, fading in) over the darkened editor behind it. Starting a presentation should look like something opened, not like the page swapped.
- **Between slides**: the outgoing slide slides out to the LEFT while the incoming one slides in from the RIGHT, moving together. Going **back** mirrors it: out to the right, in from the left, so the direction always says which way you are travelling through the deck.
- **Exiting**: the reverse of entry, back to the editor.
- Motion honours `prefers-reduced-motion`: those users get a cross-fade at the same durations, so the deck still reads as changing slides without the travel.
- Transitions are **CSS transforms on the slide surface** (translate + scale + opacity), not per-element animation. One moving layer is cheap at any slide size, and it means a hundred-element slide transitions exactly as fast as a one-element slide.

### The HUD

Top-right, carrying four things: the position (`7 / 23`), the slide's name, a **notes button**, and a **close button**. It **fades out when the pointer is idle and returns on any pointer movement**, so a still screen is clean for the room and every control is one twitch of the mouse away.

The HUD does not fade while the notes popover is open, or the popover would be left orphaned over the slide.

**Notes open in a popover** from the notes button (or `N`), anchored under it, sized so the slide stays readable behind. Click again, `Esc`, or advancing the slide closes it. The button carries a **dot when the current slide has notes**, so you can see there is a script waiting without opening anything, and pressing it on a slide with none is not a dead click.

On demand is the whole point: nothing about your script is on screen until you ask for it. It is worth being clear-eyed that the room sees the popover while it is open, because there is one screen and you are sharing it. That is the deliberate trade for not building a second-window presenter console, which stays out of scope.

### Leaving

Two ways out, because a presenter mid-sentence should not have to remember one:

- **`Esc`**, any time.
- **The close button** in the HUD.

Exiting restores the previous tab, viewport and chrome.

- Available to **every role including share-link viewers**: presenting is read-only by nature, and a viewer narrating a shared diagram is a core case.

### Cross-tab loading

Tabs load lazily (spec/13), so a deck whose slides reach into a tab nobody has visited would stall mid-presentation. `loadAllTabs()` already exists in `usePerTabLoad.ts` — a one-shot parallel fetch of every unloaded tab, built for cross-tab element search — and Start awaits it. A slide whose tab still cannot be resolved is skipped rather than blocking the deck.

## Presenter notes

**Each slide carries its own notes**, written and edited in the Slide Deck panel: pick a slide, type what you mean to say over it. They are the slide's, stored on the slide.

They are deliberately NOT the elements' existing `note?` field (spec/05, rich text per spec/92), which the previous draft reused. That field is a note about a _thing_ — "this queue is the one that backs up" — and it belongs to the element wherever it appears. What a presenter needs is a note about a _moment_ in a talk, and the same element on two slides usually wants two different things said about it. Deriving slide notes by gathering up element notes gives you neither: a caption assembled from three elements' annotations, in element order, saying nothing you chose to say.

- Plain text in v1, not rich text. It is a script you read off, and the rich-text editor is a surface to maintain for something nobody will bold.
- During a presentation they live behind the HUD's notes button, opened on demand. See The HUD above.

## Realtime: presenting is local, and that is the design

**Presenting broadcasts nothing.** The delivery mechanism is you sharing your screen in the meeting you are already in. Collaborators with the diagram open see the diagram, not your deck; nobody is pulled into your slide, nobody's viewport moves, nobody has to be told a presentation started.

This is a stance, not a v1 shortcut. "Follow the presenter" was the obvious v2 and is **not planned**: it makes presenting something that happens TO other people, which is the opposite of the point. You are showing a room what you want them to see, on your screen. Somebody else reading the same diagram in another window is doing their own work and should be left alone.

What it saves is real. Presenting needs **no room op, no api-schema change, and nothing in the Durable Object**. Remote cursors and lasers are hidden from the presenter's own view (they would puncture the illusion on a projector), and edits arriving mid-presentation apply underneath as normal, so a slide re-renders if one of its members changed.

### Deck edits are ordinary diagram data

The deck itself IS shared: a teammate opening the diagram sees your slides and can edit them. Deck changes ride the normal diagram save and arrive for other people on their next load, like the diagram's name does.

**No live `deck` room op in v1.** It was specced and dropped once presenting went local: a deck is small, rarely touched, and in practice authored by one person for one meeting, so the realtime path would be carrying a message almost nobody sends. The cost is last-write-wins at whole-deck granularity if two people edit slides in the same session without reloading, which is the same exposure the diagram name already has and is proportionate to how often it will happen. If it turns out to bite, a `deck` op carrying the whole (small) deck is a small addition, deliberately unlike the granular per-element merge in spec/75.

## Implementation shape

Per the no-god-files rule: `useSlideDeck.ts` (deck state, current index, keyboard, camera targets), `SlideDeckPanel.tsx` (the seventh tool panel, built like `EraserPanel` / `HighlighterPanel`), and `PresentationOverlay.tsx` (the full-screen surface Start puts you into: the slide surface and its transitions, the auto-hiding HUD, the notes, the end state). The element popover reuses the existing read surfaces rather than growing a third rendering of a comment thread: the same components the canvas popover and the Collaborate panel already draw, with their composers and action buttons not passed. `CommentPanelFace` already takes its handlers optionally for exactly this reason (a surface with no comment session renders the thread readable but inert), so presenting is a caller that omits them. Deck helpers stay pure and live in `packages/diagram` beside the element helpers: resolving a slide to its elements, pulling in implied arrows, and computing a slide's bounds are all `(Deck, Tab[]) -> ...` functions with no React in them, so they are testable and reusable by the api and MCP worker.

## Telemetry

Per spec/22: `track('UI', 'Opened', 'SlideDeck')` when the tool is picked, `track('UI', 'Started', 'Presentation')` on Start, `track('UI', 'Closed', 'Presentation')` on exit, and `track('UI', 'Added', 'Slide')` when a slide is created. No per-slide events: chatty, low signal.

## Out of scope (v1)

- Follow-the-presenter sync. **Not planned**, see Realtime above: it inverts what presenting is for.
- Dual-screen presenter console (notes on your laptop, slide on the projector). Per-slide notes ship; a second-window console does not.
- Export the deck to PDF or PPT. (The framing rule above makes it tractable later: every slide already has bounds, and the export renderer already draws a bounded element set.)
- Per-element build animation WITHIN a slide (clicking to reveal one box at a time). Slide-to-slide transitions ship, see Motion; building up a single slide does not.
- Auto-generating a deck from a diagram (see the empty-deck rule above: deliberate, not deferred).
- A slide that mixes tabs. Ruled out by the model, not postponed.
- CHANGING anything from a presentation. Ruled out, not postponed. Reading is in (see Presenting): clicking an element shows its note, comments and actions.

## Settled

The three questions this draft opened with are answered, and the answers are in the body above rather than left hanging here:

- **Empty deck** — it stays empty. No seeding.
- **Interaction while presenting** — read anything, change nothing. Clicking an element opens a read-only popover of its note, comments and actions; no session verb and no edit is reachable. Live data still displays.
- **Slide backdrop** — the slide's tab's, which is well-defined because a slide belongs to one tab.
- **Presenter notes on screen** — behind a notes button in the HUD, opened in a popover on demand.

## Open questions

1. **Duplicating a slide across tabs.** Duplicate copies a slide within its tab. Should there be a "copy this slide to another tab" that maps to equivalent elements, or is that a fantasy given elements are not equivalent across tabs?
2. **A deleted tab's slides.** They are skipped at read time (above), so a deck can carry invisible slides that come back if the tab is restored by undo. Is silent-skip right, or should the panel show them struck through so you know they are there?
