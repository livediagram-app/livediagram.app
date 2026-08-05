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
  // Left out of the run without being deleted. Absent = shown. A separate
  // idea from deleting: a slide you might want next week, a backup detail
  // for a question you may not get, a section you cut for time.
  hidden?: boolean;
  // How long you MEAN to spend here. Optional, and only ever a target: the
  // deck never advances itself on it. See Pacing below.
  minutes?: number;
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

- **The slide list**, in deck order, each row with its position, name, tab, member count, and a **preview thumbnail** from the shared headless SVG renderer (`useSlideThumbnails`, the same renderer the Layers panel rows, the Map and the exports use). One difference from the layer previews and the reason it is its own hook: every layer preview shares ONE viewBox, the tab's content bounds, so each band shows where its elements sit. Slides cannot, because a deck spans tabs and two tabs share no coordinate space, so each slide is framed to its own bounds — which is also what the presentation does when it runs.
- **New slide from selection** — the primary authoring path. Select elements on the canvas, press the button; the slide takes the active tab. Also **Add selection to slide** for growing one, which is offered only while you are on that slide's own tab (a slide holds one tab's elements, so adding from another tab is not a thing to disallow politely, it is a thing that cannot be expressed).
- **An empty deck stays empty.** No seeded slides, no "one per tab" starter. A generated deck is a deck you have to read and prune before you can trust it, and pruning somebody else's guesses is slower than making the three slides you meant.
- **Remove from slide** — the other half of adding. Membership is edited for the life of the deck, not just when a slide is created.
- **Every verb lives in the row's `…` menu**, built from the shared menu furniture the Explorer's rows and the tab context menu use, in the same shape: a quick-action icon **toolbar** (rename, notes, duplicate, with delete pinned right), then labelled accordion categories — **Selection** (add / remove what you have selected, with a line above the buttons saying what they act on) and **Visibility** (hide this slide from the run, or show it again). A menu that looks like this one and like nothing else in the app is a menu people have to learn twice.
- **Deleting a slide asks first**, in a ConfirmPopover anchored to the row's own menu button. The elements survive, but the arrangement does not, and the arrangement is what you spent the time on.
- **Hidden slides** are skipped by `presentableSlides`, which is the ONE place the run is decided — so the count on the Present button, the `7 / 23` in the HUD, and what advancing lands on can never disagree about the deck's length. The row shows a struck-through name and an eye marker, so a hidden slide is visible in the panel and invisible in the show. A row itself does ONE thing — press it to open that slide — because a panel the width of the palette cannot carry five controls per row and stay legible.
- **Reorder** by dragging rows. The order does NOT change while you drag: a caret shows where the row will land and the move commits on release, the way the tab bar reorders (spec/30). Reordering live reshuffled the list under the pointer, which moved the very row you were aiming at. Pointer events rather than HTML5 dnd, so it works on touch.
- **Rename** inline, **delete**, and **duplicate** a slide.
- **Presenter notes** opened from the row's `…` menu, written in a text area under the list, with the slide's optional **time budget** beside them — the two things you decide about a slide while writing the talk rather than while giving it (see Pacing). Here rather than on the canvas, because a note is about the slide rather than about anything on it, and behind the menu rather than always-on so the panel never grows a text area you did not ask for.
- Selecting a row **switches to that slide's tab and highlights its members on the canvas**. This is how you check a slide without presenting, and it is why a slide names its tab rather than inferring one.
- **Present** — enters the full-screen deck at slide 1, with a badge carrying the slide count.

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
- **The pointing tools stay available**: Laser ([spec/111](111-laser-panel.md)) and Spotlight ([spec/112](112-spotlight-panel.md)) both work while presenting, and neither breaks the rule above because neither touches the diagram. This is the room the laser was built for — spec/111 opens by calling it "the presenting tool" — and a spotlight is how you read one lane of a dense slide to a room. Both keep their device-local recipes, so the pen and the shroud you tuned for this projector are the ones you get.
  - The laser still **broadcasts**, as it does everywhere else (spec/111, "Everyone sees your pen"). Presenting is local, but the laser is the diagram's tool and your camera is on a real tab: a collaborator reading that tab should see the dot you are pointing with, which is the whole point of a shared pointer. Suppressing it would mean a second laser path existing only here, to hide something somebody may be watching on purpose. Spotlight raises no such question — it is a local view treatment and always was ([spec/112](112-spotlight-panel.md), "Still local, still not broadcast").
  - The presenter still does not see anyone ELSE's cursor or laser, as above. It is your screen on a projector.
- **The screen is kept awake** for the duration (`navigator.wakeLock`, released on exit). A slide you talk over for five minutes is a slide the laptop dims, and a presenter waking their own screen mid-sentence is a small indignity a deck should not cause. Where the API is absent or the request is refused, the deck runs exactly as before.
- **Advance** with `→`, `Space`, `Page Down`, or click. **Back** with `←`, `Page Up`. `Home` / `End` jump to the ends.
- Advancing past the last slide shows an end state; one more advance exits.

### Motion

A deck should feel like a deck, and the transitions are what sell it.

- **Entering**: the first slide animates in as a card arriving on screen (scale up from slightly small, fading in) over the darkened editor behind it. Starting a presentation should look like something opened, not like the page swapped.
- **Between slides**: the outgoing slide slides out to the LEFT while the incoming one slides in from the RIGHT, moving together. Going **back** mirrors it: out to the right, in from the left, so the direction always says which way you are travelling through the deck.
- **Exiting**: the reverse of entry, back to the editor.
- Motion honours `prefers-reduced-motion`: those users get a cross-fade at the same durations, so the deck still reads as changing slides without the travel.
- The travel is **the full width of the screen**, and the animated node is the canvas SURFACE, so the backdrop goes with it: the whole screen moves rather than the diagram sliding around inside a stationary frame. A gentle nudge was tried first and read as a wobble.
- The curve is a plain **decelerate** with no overshoot. Easing with a long slow tail reads as rubber-banding — the slide appears to arrive, then keeps creeping.
- The transition attribute is cleared on the animation's **own `animationend`**, never on a timer. A timer has to guess the duration, and guessing even slightly short yanks the attribute mid-animation: the element snaps from wherever it had got to straight to its resting place, which is the little bounce at the end that reads as rubber-banding even once the curve is right. A long failsafe timeout still runs, so a missing surface or an animation that never fires cannot leave the attribute stuck and block the next transition.
- Transitions are **CSS transforms on the slide surface**, not per-element animation. One moving layer is cheap at any slide size, so a hundred-element slide transitions exactly as fast as a one-element slide.
- The animation must NEVER target the canvas's content wrapper, which carries the pan/zoom transform: a CSS animation on `transform` replaces the inline one for its whole duration, which drops the slide to unzoomed top-left for the length of the transition. For the same reason the fit measures `offsetWidth/offsetHeight` (layout size) rather than `getBoundingClientRect` (the transformed box), or it fits each slide to a viewport the entry animation was mid-way through shrinking.

### The HUD

Top-right, carrying: the position (`7 / 23`), the slide's name, **previous** and **next** buttons, a **jump button**, a **notes button**, a **settings cog**, and a **close button**. The two nav buttons exist because a presenter on a projector often has a mouse and no keyboard within reach, and "click anywhere to advance" is neither discoverable nor able to go back. It **fades out when the pointer is idle and returns on any pointer movement**, so a still screen is clean for the room and every control is one twitch of the mouse away.

The HUD does not fade while a popover is open, or the popover would be left orphaned over the slide.

**Jumping to a slide.** `→` and `←` walk the deck and `Home` / `End` reach its ends, which is everything you need while the talk goes to plan. It goes to plan until somebody asks about the diagram you showed nine slides ago, and arrowing back through nine slides in front of a room is the moment a deck feels like a toy.

The jump button (or `G`) opens a popover listing every slide by position and name, with the current one marked; picking one goes straight there. It reuses the panel's thumbnails — the shared headless SVG renderer that already draws the Layers rows — so the list is scannable by picture rather than by remembering what you called slide 12. Hidden slides appear, greyed and marked, because a backup detail kept out of the run is exactly the slide a question sends you looking for. Click again, `Esc`, or picking a slide closes it.

`Esc` closes an open popover before it leaves the deck. Both popovers can be open over a slide and both take `Esc`, so without an order the key that dismisses a list would end the presentation.

**Announcing the slide.** The HUD carries an `aria-live="polite"` region reading the position and name on every change ("Slide 7 of 23, Architecture"). The deck is otherwise an entirely visual surface, and a presenter driving it with a screen reader gets nothing back from a slide changing silently.

**Notes open in a popover** from the notes button (or `N`), anchored under it, sized so the slide stays readable behind. Click again, `Esc`, or advancing the slide closes it. The button carries a **dot when the current slide has notes**, so you can see there is a script waiting without opening anything, and pressing it on a slide with none is not a dead click.

On demand is the whole point: nothing about your script is on screen until you ask for it. It is worth being clear-eyed that the room sees the popover while it is open, because there is one screen and you are sharing it. That is the deliberate trade for not building a second-window presenter console, which stays out of scope.

### Pacing

Both parts are off by default and both are the presenter's, not the diagram's.

**Elapsed time** — a clock in the HUD counting from Start. You cannot pace a talk you cannot time, and the alternative is a phone face-up beside the laptop.

**Per-slide budget** — when the current slide carries `minutes`, the HUD shows the time spent on it against that target and marks it once it is over. Budgets are authored per slide in the Slide Deck panel, beside the notes, because deciding a slide is worth four minutes is a thing you do while writing the talk, not while giving it.

The deck **never advances itself** on a budget, and going over is marked rather than enforced. A slide that moved on because its four minutes were up would cut off the answer you were giving. The agenda element ([spec/127](127-agenda.md)) already models minutes-per-segment this way for a room, and it does not drive the clock either; this is the same idea pointed at the presenter instead of the audience.

### Presenter settings

The cog opens six things. The number is not the rule — the rule is that this
popover opens ON a projector, in front of a room, usually because something is
not behaving the way the presenter wants right now, so every entry has to be a
decision they can make in one glance and undo in one more. A toggle qualifies.
Anything needing thought belongs in the panel, before you start, which is why
per-slide budgets are authored there and only their DISPLAY is switched here.

- **Transition** — Slide, Fade or None, plus a **speed** (Quick / Normal / Slow) which disappears when the transition is None, rather than sitting there greyed out. The speed drives the animation through a `--lvd-slide-ms` custom property, so the keyframes stay one definition.
- **Auto-advance** — Off, 5s, 10s, 30s or 60s. With Loop, this is the whole "leave it running on the wall" setup. Paused while a popover is open, because something the presenter is reading must not be swept away by a timer they had forgotten about.
- **Zoom** — Fill screen (a small slide is blown up) or Actual size (never past 100%), for authors whose slides are already the size they meant.
- **Keep controls visible** — stop the HUD fading when the pointer rests.
- **Hide the pointer** — a still cursor left on a projector is a distraction. Driven by the same idle signal that fades the HUD, so the two come back together; a hidden cursor you could not bring back would be a trap.
- **Click to advance** — off for a presenter who gestures at the screen with
  the mouse and would rather drive from the keys alone.
- **Loop the deck** — the last slide returns to the first instead of the end
  state, for a deck left running in a room.
- **Show position** — the counter and slide name, off for a clean screen.
- **Show elapsed time** — the clock counting from Start. Off by default: a
  timer nobody asked for is a timer reminding the room you are behind.
- **Show slide budget** — the time on this slide against its `minutes`, for the
  slides that carry one. Off by default, and inert on a deck where nobody set
  any.

They are grouped Transition / Playback / Display, because the list grew past the point where a flat one reads as a list.

Device-local (`lib/presentation-config.ts`), like the eraser's brush and the
laser's pen: how YOU drive a deck on THIS machine, not a property of the
diagram. Never sent to the api.

### Leaving

Two ways out, because a presenter mid-sentence should not have to remember one:

- **`Esc`**, any time.
- **The close button** in the HUD.

Exiting restores the previous tab, viewport and chrome. The viewport matters more than it sounds: a deck leaves the camera wherever the last slide needed it, often 250% on one box, so without the restore you came back to a diagram you had to go and find.

- Available to **every role including share-link viewers**: presenting is read-only by nature, and a viewer narrating a shared diagram is a core case.

### Cross-tab loading

Tabs load lazily (spec/13), so a deck whose slides reach into a tab nobody has visited would stall mid-presentation. `loadAllTabs()` already exists in `usePerTabLoad.ts` — a one-shot parallel fetch of every unloaded tab, built for cross-tab element search — and Start awaits it. A slide whose tab still cannot be resolved is skipped rather than blocking the deck.

## Presenter notes

**Each slide carries its own notes**, written and edited in the Slide Deck panel: pick a slide, type what you mean to say over it. They are the slide's, stored on the slide.

They are deliberately NOT the elements' existing `note?` field (spec/05, rich text per spec/92), which the previous draft reused. That field is a note about a _thing_ — "this queue is the one that backs up" — and it belongs to the element wherever it appears. What a presenter needs is a note about a _moment_ in a talk, and the same element on two slides usually wants two different things said about it. Deriving slide notes by gathering up element notes gives you neither: a caption assembled from three elements' annotations, in element order, saying nothing you chose to say.

- Plain text in v1, not rich text. It is a script you read off, and the rich-text editor is a surface to maintain for something nobody will bold.
- During a presentation they live behind the HUD's notes button, opened on demand. See The HUD above.

## Exporting the deck

The Export dialog already scopes to a derived element set: `exportScope` is
`'tab' | 'selection'` today, and "Export selection" builds a tab whose elements
are the multi-selection and renders every format from it (spec/09). **A slide is
that same shape** — a bounded set of one tab's elements — so the deck becomes a
third scope rather than a new surface.

- **Export deck** is offered in the tab's Export dialog whenever the diagram has
  a deck with at least one visible slide. The heading reads "Export deck", the
  way "Export selection" already reads.
- **One page per slide, in deck order**, each framed by the rule Presenting
  uses: the slide's content bounds, or its single frame element's bounds when it
  has one. That is what makes this tractable — the framing question was answered
  when presenting was specced, so the export inherits it rather than inventing a
  second idea of what a slide's edges are.
- **Every visual format the dialog already draws**: PDF as one document of N
  pages, PNG and SVG as N files. Nothing new to render — the export renderer
  already draws a bounded element set, N times instead of once.
- **Hidden slides are left out**, matching what Present does. A slide kept back
  for a question is not part of the document you hand over.
- **The slide's tab supplies the backdrop**, theme and pattern, for the same
  reason it does when presenting: a slide belongs to one tab, so this is
  well-defined per page rather than per document.
- Markdown and File stay **tab-scoped**. A deck is a sequence of framed
  pictures; the JSON round-trip and the Markdown outline are about a tab's
  content and mean nothing sliced by slide.

This is deliberately the cheap half of what "export the deck" usually means.
It produces the artefact people actually ask for — something to put in a doc, a
ticket or a message — without a PPT writer or a bespoke deck renderer.

## Realtime: presenting is local, and that is the design

**Presenting broadcasts nothing.** The delivery mechanism is you sharing your screen in the meeting you are already in. Collaborators with the diagram open see the diagram, not your deck; nobody is pulled into your slide, nobody's viewport moves, nobody has to be told a presentation started.

This is a stance, not a v1 shortcut. "Follow the presenter" was the obvious v2 and is **not planned**: it makes presenting something that happens TO other people, which is the opposite of the point. You are showing a room what you want them to see, on your screen. Somebody else reading the same diagram in another window is doing their own work and should be left alone.

What it saves is real. Presenting needs **no room op, no api-schema change, and nothing in the Durable Object**. Remote cursors and lasers are hidden from the presenter's own view (they would puncture the illusion on a projector), and edits arriving mid-presentation apply underneath as normal, so a slide re-renders if one of its members changed.

### Deck edits are ordinary diagram data

The deck itself IS shared: a teammate opening the diagram sees your slides and can edit them. Deck changes ride the normal diagram save and arrive for other people on their next load, like the diagram's name does.

**No live `deck` room op in v1.** It was specced and dropped once presenting went local: a deck is small, rarely touched, and in practice authored by one person for one meeting, so the realtime path would be carrying a message almost nobody sends. The cost is last-write-wins at whole-deck granularity if two people edit slides in the same session without reloading, which is the same exposure the diagram name already has and is proportionate to how often it will happen. If it turns out to bite, a `deck` op carrying the whole (small) deck is a small addition, deliberately unlike the granular per-element merge in spec/75.

## Implementation shape

Per the no-god-files rule: `useSlideDeck.ts` (deck state, current index, keyboard, camera targets), `SlideDeckPanel.tsx` (the seventh tool panel, built like `EraserPanel` / `HighlighterPanel`), and `PresentationOverlay.tsx` (the full-screen surface Start puts you into: the slide surface and its transitions, the auto-hiding HUD, the notes, the end state). The element popover reuses the existing read surfaces rather than growing a third rendering of a comment thread: the same components the canvas popover and the Collaborate panel already draw, with their composers and action buttons not passed. `CommentPanelFace` already takes its handlers optionally for exactly this reason (a surface with no comment session renders the thread readable but inert), so presenting is a caller that omits them. Deck helpers stay pure and live in `packages/diagram` beside the element helpers: resolving a slide to its elements, pulling in implied arrows, and computing a slide's bounds are all `(Deck, Tab[]) -> ...` functions with no React in them, so they are testable and reusable by the api and MCP worker.

The additions above land on that same shape rather than growing the overlay. The jump popover and the pacing readout are HUD components fed by `useSlideDeck`; the wake lock and the elapsed clock are effects it owns, both released on exit beside the viewport restore that already happens there. The presenter settings gain two booleans in `lib/presentation-config.ts`, which is device-local and already carries the other four. Laser and Spotlight need nothing new at all — they are canvas tools the overlay stops suppressing. The deck export is a third value on the existing `exportScope` union plus a loop over slides in the export path, and the per-slide bounds it needs is the pure helper above, which is the reason it costs so little.

## Telemetry

Per spec/22: `track('UI', 'Opened', 'SlideDeck')` when the tool is picked, `track('UI', 'Started', 'Presentation')` on Start, `track('UI', 'Closed', 'Presentation')` on exit, and `track('UI', 'Added', 'Slide')` when a slide is created. Exporting the deck rides the export dialog's existing event with the deck scope as its `type`. No per-slide events: chatty, low signal. Nothing for jumping, pointing, or the pacing toggles — a presenter driving a deck is one session, not a stream of interactions worth counting.

## Out of scope (v1)

- Follow-the-presenter sync. **Not planned**, see Realtime above: it inverts what presenting is for.
- Dual-screen presenter console (notes on your laptop, slide on the projector). Per-slide notes ship; a second-window console does not.
- Export the deck to **PPT**, or any editable deck format. PDF / PNG / SVG ship as a third export scope (see Exporting the deck above); a PowerPoint writer, with its own shape vocabulary to map onto, does not.
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
