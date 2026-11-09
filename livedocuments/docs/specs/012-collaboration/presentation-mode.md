# Presentation mode

> The deck model and its pure helpers live in
> `packages/document/src/slide-deck.ts`, persistence in the document's store (the `presentation` column of the
> room's `document` table), and the editor surface in `useSlideDeck.ts`,
> `page-row-slides.tsx` (a page's place in the deck, in Contents), `PresentationHost.tsx`, `PresentationOverlay.tsx`,
> `PresentationHud.tsx` and `PresentationElementPopover.tsx`.

Present a document as a **slide deck**: full-screen, one slide at a time, each slide showing a set of elements you picked. Built for the "walk someone through this on a call or a projector" moment.

## Why

A finished canvas shows everything at once, which is great for reference and bad for narration. Presenters today zoom around manually with the laser pointer, and the audience watches the mouse hunt for the next box.

## What a slide is

**A slide is an explicit, ordered set of elements you chose, from one tab.** Not a region of canvas, not a camera position, not a layer.

- **A slide belongs to a single tab**, and names elements on it. The stored deck holds every tab's slides in one list (it is document data), but **a presentation is one tab's**: Present runs the open tab's slides alone ("One tab, one show" below).
- Keeping a slide inside one tab is what makes it well-defined. A slide mixing tabs has no answer to which backdrop it wears, and elements from two tabs share no coordinate space, so "fit this slide" would have no meaning.
- **An element can be on any number of slides.** Membership is a list, not a partition, so a title that belongs on every slide simply appears in every slide's list.
- **Slide order is the deck's own order**, independent of tab order, element array order, and z-order. Reordering slides never restacks anything on the canvas.

### Why not layers

Layers ([Layers](../006-document/layers.md)) were the obvious candidate and were considered in detail: they are already an ordered list of element groups with a management panel, drag-reorder, per-band preview thumbnails, and a local render override (hover-solo) that is exactly the "show these bands only, without touching persisted state" mechanism a presentation needs. Reusing them would have been cheap.

They were rejected because a layer means something else, and the collisions were not superficial:

- **Layers are z-order bands**, so slide order would have been stacking order: reordering the deck would restack the drawing.
- **Bring to Front / Send to Back create and prune layers** ([Layers](../006-document/layers.md)). Casually clicking "bring to front" would mint a slide, and emptying a layer would silently delete one.
- **An element belongs to exactly one layer.** A title on every slide would have been unexpressible, and so would any element appearing on more than one.

Slides are their own concept for the same reason layers were: overloading one structure with two meanings costs more in surprise than it saves in code. **Layers stay purely document structure.** Nothing in [Layers](../006-document/layers.md) changes.

## Data model

Document-level. A slide belongs to one tab, but the DECK does not: its order interleaves tabs freely (A, C, A), so no single tab can own the list.

```ts
type Slide = {
  id: string;
  // Shown in the presenter HUD. Absent = the slide's own words, else "Slide N".
  // Nothing writes one any more (the panel that did is retired); a stored name still shows.
  name?: string;
  // The one tab this slide draws from. Its backdrop, theme and coordinate
  // space are the slide's.
  tabId: TabId;
  elementIds: ElementId[];
  // A page slide: a page of the tab, of any kind, resolved live
  // (what is on the page now, framed to the page; elementIds empty). While it presents,
  // the canvas shows that page's sheet alone. See
  // docs/specs/007-editor/pages-mode.md "Slides".
  pageId?: string;
  // What you mean to SAY over this slide, as note cards in order: the
  // slide's own, not any element's. See Presenter notes below and
  // speaker-note-cards.md.
  noteCards?: { id: string; text: string }[];
  // The cards' text joined by a blank line, kept for older readers; a slide
  // written before note cards has only this, read as one card.
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
// walkthrough" are an obvious want over the same document, and shipping
// `{ slides }` now would mean a data migration to add the second. An array
// with one member costs nothing today and keeps that door open.
type StoredPresentation = { decks: Deck[] };
```

- **Dangling ids resolve at read time.** An element deleted after being added to a slide is skipped, exactly as [Layers](../006-document/layers.md) resolves an unknown `layerId` rather than rewriting element data on delete. No cleanup pass, no delete-path coupling, and undo restores the element back onto its slides for free. A slide whose whole TAB is deleted is skipped the same way.
- A slide whose ids all dangle renders empty rather than being auto-removed: silently deleting someone's slide because they deleted its contents is worse than an empty slide they can see and fix.
- **Arrows come along.** An arrow whose endpoints are both on the slide is included automatically even when it was not added explicitly, so building a slide from a selection of boxes does not need the connectors hand-picked. An arrow added explicitly always shows.

### Persistence

This is the one part of the feature that is not free. Tab bodies live in their own table, so there is **no document-level JSON blob to extend**, unlike layers, which ride the opaque tab body and needed no api change at all.

- A new `presentation TEXT NULL` column on `documents` (the ninth such column; `source`, `share_password` and `team_id` are the pattern), holding the serialised `Deck`.
- The api's document DTO in `@livedocuments/api-schema` carries it through, and the read / save routes round-trip it.
- Null / absent = no deck, which is every existing document.

## Building the deck: Contents

In livedocuments the deck is **built from the pages**, in Contents ([Pages](../007-editor/pages-mode.md) "Slides"):

- **Every slide page is a slide**, in its tab's page order, whoever made the page. A Slide Deck template opens
  ready to present.
- **Any other page joins with Add to Slides**, on its ⋯ menu in Contents, as a page slide (the page, resolved live).
- **Hide in Slides** / **Show in Slides** on the same menu keep a slide but leave it out of the run, and
  **Present From Here** starts the show at that page.
- **The order is Contents'**: the show is the open tab's slides in its page order (`presentableSlides`). Moving a
  page moves its slide.
- **Speaker notes** are written in the page's title bar (**Notes**, [Speaker note cards](speaker-note-cards.md)).

**Retired 2026-11-04: the Slide Deck panel.** The Slide Deck canvas tool, its command, its tool panel and the Pages
**Slides** popover over a cluster button were a second list of the pages Contents already lists, so they are gone
([Pages](../007-editor/pages-mode.md) "Retired: the Slide Deck panel"). With them went slides made from a selection
of elements, adding to or removing from a slide, duplicating, renaming, reordering and deleting a slide by hand,
and writing a slide's minute budget. **A stored deck keeps presenting**: a selection slide, a copy of a page's slide,
a name, notes, a budget and a hidden flag all load and present as stored, in their tab's run; nothing edits or
deletes them except the follow pass, which still removes the slides of a deleted page. Nothing is migrated.

**Every role presents**, from the header's Present; Present From Here is on the Contents menu, which is an
Editor's. A phone (below the 640px `sm` breakpoint) presents nothing, as before.

### One tab, one show

**A presentation is the tab's, not the document's** (2026-11-04). Contents is the one place a deck is organised,
and Contents lists one tab, so a show that ran every tab's slides one tab after another put slides in an order
nobody could see or change. So Present, Present From Here, the header's count, the HUD's "7 / 23" and the speaker
notes all read **the open tab's slides alone**, in its page order (`presentableSlides(deck, tab)`). Another tab's
slides are that tab's show: open it and press Present.

- **A deck stored across tabs** (an older deck, or slides added on two tabs) needs nothing migrated: each tab
  presents its own slides; the stored list is never rewritten.
- **The show holds to the tab it started on.** Changing the open tab while presenting (a peer's tab move, a
  shortcut) never changes the show under the presenter; once it ends, Present offers the open tab's show again.
- **Its own tab deleted** mid-show (a peer): no slides are left, so the end card shows; never another tab's
  slides.
- **Settings stay the person's** (Settings > Presenting): they are about how a show runs, not which, so one set
  covers every tab.
- **Only the open tab loads**: it is already loaded, so Start waits for the overlay's code alone (the cross-tab
  load before Start is retired, "Cross-tab loading" below).

### The header's Present button

A tab's show should be one press away. So while the open tab has **at least one presentable slide**
(`presentableSlides`: its slides that are not hidden), the editor header carries a **Present**
button (a play glyph and the word), immediately to the **left of Share** (or, for a visitor, of the
account controls, where Share would sit). Pressing it starts the open tab's show at its slide 1 (`start()`,
the overlay preload; Present From Here runs the same with its slide);
while that load runs the button reads **Starting** and is disabled. Its hover card names the count:
"Present this tab: 6 slides."

- **Not shown** when the open tab has no slides, when every one of them is hidden, on a
  phone (below `sm`, where presenting is not offered), during the welcome flow, or before the
  document has hydrated. Nothing to present means no button, never a disabled one.
- **Every role**, as presenting itself is: an Editor, a Participant and a Viewer on a share link
  all see it, because presenting changes nothing.
- Telemetry `UI · Opened · HeaderPresent` on the press, before `start()` logs
  `UI · Started · Presentation`.

## Presenting

- **Full screen.** Browser fullscreen where available, all chrome hidden (the zen treatment, [Zen mode](../007-editor/zen-mode.md)). A refused request (no user gesture, a browser that declines) leaves the deck running in the window and logs `[presentation] fullscreen-refused` with the reason; leaving it logs `[presentation] fullscreen-exit-failed` if that is refused.
- **One slide at a time.** Only that slide's elements render. This is a deck, not a progressive reveal of a canvas: advancing does not accumulate.
- **The backdrop is the slide's tab's**: its background colour, pattern and theme. Well-defined precisely because a slide belongs to one tab.
- **Framing:** fit to the content bounds of the slide's elements (`contentBounds` + `computeFitToScreen`), with padding. A **page slide** frames to exactly its page with **no padding**, its surround blacked out, so the page fills the screen ([Pages](../007-editor/pages-mode.md) "Slides").
- **Nothing on a slide can be CHANGED.** No editing, moving, resizing or deleting, and no ticking a checklist. You are on a projector in front of a room, and a stray click that alters the document is not a feature.
  - Live DATA still displays. A collaborator's edit made while you present shows on the slide. That is the slide reporting the document, not the audience changing it.
- **Everything on a slide can be READ.** Clicking an element opens a **read-only popover** carrying what that element has to say: its **note** ([Document structure](../006-document/document-structure.md), rendered rich per [Rich-text notes](../009-elements/rich-text-notes.md)), its **comment thread** ([Canvas and palette](../008-canvas/canvas-and-palette.md)), and its **assigned actions** ([Assigned actions](assigned-actions.md)) with assignee and status. Nothing in the popover is editable, and there is no composer: you can show the room the objection somebody left on this box, and you cannot answer it from here.
  - This is the line the whole mode runs on, and it is worth stating as one sentence: **read anything, change nothing.** Inspecting is not editing, and a presenter being unable to show the note attached to the thing they are pointing at would be a strange kind of presentation.
  - The element popover is a different thing from the HUD's notes popover, and they do not overlap. The HUD's carries the SLIDE's presenter note, what you mean to say. This one carries the ELEMENT's, what the document records about that box.
- **A click on empty space advances the slide; a click on an element opens its popover.** The disambiguation matters, because click-to-advance and click-to-inspect are the same gesture on different targets. Clicking outside an open popover closes it rather than advancing, so dismissing never skips a slide.
- **Rendered by the real canvas**, not by the static SVG renderer. Two reasons, and the first one is now load-bearing rather than tidy: a slide has to RESPOND to clicks and carry live element state, which a rasterised or SVG snapshot cannot do at all. The second is that there is then exactly one thing that knows how an element looks, so presenting cannot drift from the canvas the first time an element gains a feature.
- **The pointing tools stay available**: Laser ([Laser Panel](../008-canvas/laser-panel.md)) and Spotlight ([Spotlight Panel](../008-canvas/spotlight-panel.md)) both work while presenting, and neither breaks the rule above because neither touches the document. This is the room the laser was built for ([Laser Panel](../008-canvas/laser-panel.md) opens by calling it "the presenting tool"), and a spotlight is how you read one lane of a dense slide to a room. Both keep their device-local recipes, so the pen and the shroud you tuned for this projector are the ones you get. `L` arms the laser and `S` the spotlight; the same key again puts the pointer back, so arming one is never a trap.
  - While one is armed the click-catcher stands down, because both tools need the pointer on the canvas to work at all. Click-to-advance goes with it: mid-stroke a click means "point", not "next slide". The keys and the HUD's own buttons still advance, and the tool is handed back on exit so a presenter does not land in the editor still holding the laser.
  - The laser still **broadcasts**, as it does everywhere else ([Laser Panel](../008-canvas/laser-panel.md), "Everyone sees your pen"). Presenting is local, but the laser is the document's tool and your camera is on a real tab: a collaborator reading that tab should see the dot you are pointing with, which is the whole point of a shared pointer. Suppressing it would mean a second laser path existing only here, to hide something somebody may be watching on purpose. Spotlight raises no such question: it is a local view treatment and always was ([Spotlight Panel](../008-canvas/spotlight-panel.md), "Still local, still not broadcast").
  - The presenter still does not see anyone ELSE's cursor, laser or selection, as above: no outline, badge or borrowed border colour on a box someone has selected (the selection lock has nothing to guard on a slide). It is your screen on a projector.
- **The screen is kept awake** for the duration (`navigator.wakeLock`, released on exit). A slide you talk over for five minutes is a slide the laptop dims, and a presenter waking their own screen mid-sentence is a small indignity a deck should not cause. Where the API is absent or the request is refused, the deck runs exactly as before.
- **Advance** with `→`, `Space`, `Page Down`, or click. **Back** with `←`, `Page Up`. `Home` / `End` jump to the ends.
- **The editor's own shortcuts are off** for as long as a deck is running. The overlay consumes the keys it uses, but everything else propagated straight through, so pressing `G` in front of a room armed a parallelogram on a canvas you cannot draw on and the next click dropped it. One derived flag (`keyboardEnabled = shortcutsEnabled && !presenting`) feeds every keyboard surface (the shortcut hook and the canvas a11y traversal) rather than the overlay swallowing keys it does not understand, so a surface added later is covered by the flag it already takes.
- Advancing past the last slide shows an end state; one more advance exits.

### Motion

A deck should feel like a deck, and the transitions are what sell it.

- **Entering**: the first slide animates in as a card arriving on screen (scale up from slightly small, fading in) over the darkened editor behind it. Starting a presentation should look like something opened, not like the page swapped. It **waits for the screen to settle** first: going fullscreen resizes the canvas and the slide is refitted to it, and an entrance that started before that landed arrived and then jumped. Until then the slide is held hidden (`data-slide-move="pending"`); it waits for the fullscreen change (or its refusal, or a 600 ms failsafe) and two frames for the refit, and where there is no fullscreen to wait for it arrives at once (`whenScreenSettles`). The reveal then runs as a transition typed `slide-in`, which the surface's View Transition animates as the card arriving.
- **Between slides**: the outgoing slide slides out to the LEFT while the incoming one slides in from the RIGHT, moving together. Going **back** mirrors it: out to the right, in from the left, so the direction always says which way you are travelling through the deck. A **Fade** crosses the two; **None** cuts.
- **How a move animates**: the move runs in `startTransition` typed `slide-forward`, `slide-back` or `slide-fade` (`slideTransitionType`). The canvas `<main>` sits in a `<ViewTransition default="none">` whose `update` is keyed by those types, so the browser takes a picture of the surface before and after the move and animates the two pictures (`::view-transition-old` / `::view-transition-new`, in `canvas-motion.css`). Nothing is copied in the DOM and nothing waits on `animationend`. **None** and reduced motion run the move without a transition.
- **Why a View Transition**: measured at 4x CPU slowdown on a 100-element slide, a key press paints in under 16 ms (136 to 144 ms with the earlier DOM copy) and the longest main-thread task drops from about 112 ms to 41 to 81 ms, for about the same total work.
- **Quick presses all land**: React holds a transition while a View Transition runs, so a step (`←`, `→`, a click, the HUD's buttons) counts from the slide last asked for, not the slide on screen, and the deck then animates to it.
- **Only the slide moves**: the document root takes no part in the transition, so the HUD and the darkened editor neither cross-fade nor freeze. Editing never starts a View Transition: the surface animates only for the slide types.
- **Exiting**: back to the editor at once, the view restored in the same commit.
- **Reduced motion** (the OS setting or the in-app preference) cuts between slides and shows the first slide without the card arriving, like every other motion under reduced motion ([Motion](../004-interface-design/motion.md) "Reduced motion").
- The travel is **the full width of the screen**, and what travels is the picture of the whole canvas SURFACE, so the backdrop goes with it: the whole screen moves rather than what's on the canvas sliding around inside a stationary frame. A gentle nudge was tried first and read as a wobble.
- The curve is a plain **decelerate** with no overshoot. Easing with a long slow tail reads as rubber-banding: the slide appears to arrive, then keeps creeping.
- One moving picture at any slide size: a hundred-element slide moves as smoothly as a one-element slide, and the canvas's content wrapper, which carries the pan/zoom transform, is never animated. The fit measures `offsetWidth/offsetHeight` (layout size) rather than `getBoundingClientRect` (the transformed box).

### The HUD

Top-right, carrying: the position (`7 / 23`), the slide's name, **previous** and **next** buttons, a **jump button**, a **notes button**, a **settings cog**, and a **close button**. The two nav buttons exist because a presenter on a projector often has a mouse and no keyboard within reach, and "click anywhere to advance" is neither discoverable nor able to go back. It **fades out when the pointer is idle and returns on any pointer movement**, so a still screen is clean for the room and every control is one twitch of the mouse away.

The HUD does not fade while a popover is open, or the popover would be left orphaned over the slide. To a screen reader it is a region named "Presentation controls", so the position and name it shows belong to a landmark while the editor's own are hidden.

**Jumping to a slide.** `→` and `←` walk the deck and `Home` / `End` reach its ends, which is everything you need while the talk goes to plan. It goes to plan until somebody asks about the part of the canvas you showed nine slides ago, and arrowing back through nine slides in front of a room is the moment a deck feels like a toy.

The jump button (or `G`) opens a popover listing every slide by position and name, with the current one marked. A slide's name there, in the HUD and in what a screen reader is told, is the first it has of: its own name, an item slide's card, the headline on it (as the deck panel's row reads it), the name of the page it shows, the name of its tab, and only then "Slide n" (`presentedSlideName`); picking one goes straight there. The list is the RUN, in deck order. Hidden slides are not in it, because a slide left out of the presentation has no position to jump to. Click again, `Esc`, or picking a slide closes it, and `Esc` closes it before it leaves the deck (the popover precedence below).

`Esc` closes an open popover before it leaves the deck. Both popovers can be open over a slide and both take `Esc`, so without an order the key that dismisses a list would end the presentation.

**Announcing the slide.** The HUD carries an `aria-live="polite"` region reading the position and name on every change of slide or of the deck's length ("Slide 7 of 23, Architecture"), never on an edit that leaves the slide on screen as it is. The deck is otherwise an entirely visual surface, and a presenter driving it with a screen reader gets nothing back from a slide changing silently.

**Notes open in a popover** from the notes button (or `N`), anchored under it, sized so the slide stays readable behind: the slide's note cards, one at a time, flipped with Previous Card / Next Card or `↑` / `↓` ([Speaker note cards](speaker-note-cards.md) "Presenting"). Click again, `N` or `Esc` closes it. Advancing the slide keeps it open on the next slide's first card, so the speaker's cards stay up for the whole talk.

**The button is only there when the slide HAS notes**, and `N` is inert without them. It began as a permanent button carrying a dot when a script was waiting; a control that opens an empty card lies about there being something to read, and its ABSENCE says "nothing to say here" faster than any dot could. The presence of the button is the signal now. Advancing onto a slide with no script hides the popover (it comes back on the next slide that has cards), so an empty card can never be left sitting over a slide.

On demand is the whole point: nothing about your script is on screen until you ask for it. It is worth being clear-eyed that the room sees the popover while it is open, because there is one screen and you are sharing it. That is the deliberate trade for not building a second-window presenter console, which stays out of scope.

### Pacing

Both parts are off by default and both are the presenter's, not the document's.

**Elapsed time**: a clock in the HUD counting from Start. You cannot pace a talk you cannot time, and the alternative is a phone face-up beside the laptop.

**Per-slide budget**: when the current slide carries `minutes`, the HUD shows the time spent on it against that target and marks it once it is over. Budgets were authored per slide in the retired Slide Deck panel; nothing writes a new one, and a stored budget still shows here.

The deck **never advances itself** on a budget, and going over is marked rather than enforced. A slide that moved on because its four minutes were up would cut off the answer you were giving.

### Presenter settings

The presenter settings live in **Settings > Presenting** (a top-level category of its own, right after
Editor), set before the talk, and follow the person's account. The rule is that the HUD's cog opens ON a
projector, in front of a room, so it keeps only what is changed there: **Transition** with its **Speed**, then
**Pacing** (**Show Elapsed Time**, **Show Slide Budget**), and a line saying the rest is in Settings, under
Presenting. Anything needing thought belongs before you start, in Settings.

- **Transition**: Slide, Fade or None, plus a **speed** (Quick / Normal / Slow) which disappears when the transition is None, rather than sitting there greyed out. The speed drives the animation through a `--lvd-slide-ms` custom property, so the keyframes stay one definition.
- **Auto-Advance**: Off, 5s, 10s, 30s or 60s. With Loop, this is the whole "leave it running on the wall" setup. Paused while a popover is open, because something the presenter is reading must not be swept away by a timer they had forgotten about. The timer runs from the slide's arrival; a re-render (a collaborator's edit, the clock) never restarts it.
- **Slide Size**: Fill Screen (a small slide is blown up) or Actual Size (never past 100%), for authors whose slides are already the size they meant.
- **Keep Controls Visible**: stop the HUD fading when the pointer rests.
- **Hide the Pointer**: a still cursor left on a projector is a distraction. Driven by the same idle signal that fades the HUD, so the two come back together; a hidden cursor you could not bring back would be a trap.
- **Click to Advance**: off for a presenter who gestures at the screen with
  the mouse and would rather drive from the keys alone.
- **Loop the Deck**: the last slide returns to the first instead of the end
  state, for a deck left running in a room.
- **Show Position**: the counter and slide name, off for a clean screen.
- **Show Elapsed Time**: the clock counting from Start. Off by default: a
  timer nobody asked for is a timer reminding the room you are behind.
- **Show Slide Budget**: the time on this slide against its `minutes`, for the
  slides that carry one. Off by default, and inert on a deck where nobody set
  any.

Settings groups them **Slides** (Transition, Speed, Slide Size), **Playback** (Auto-Advance, Click to Advance, Loop
the Deck) and **While Presenting** (Show Position, Keep Controls Visible, Hide the Pointer, Show Elapsed Time, Show
Slide Budget).

The person's own, not a property of the document: one `presentation` object in their preferences
(`lib/presentation-config.ts` reads and writes it, trusting it only once parsed), so the settings follow a
signed-in account and stay in this browser for a guest. Until the first change, what this browser kept before
(its old device-local key) is read, so nobody loses their choices in the move.

### Leaving

Two ways out, because a presenter mid-sentence should not have to remember one:

- **`Esc`**, any time.
- **The close button** in the HUD.

Exiting restores the previous tab, viewport, chrome and **keyboard focus**: back on the control that started the deck (the header's Present, or the Contents menu's Present From Here), or the canvas when that control is gone, never the page itself, where a keyboard user had to Tab in again from the top. The viewport matters more than it sounds: a deck leaves the camera wherever the last slide needed it, often 250% on one box, so without the restore you came back to a canvas you had to go and find.

- Available to **every role including share-link viewers**: presenting is read-only by nature, and a viewer narrating a shared document is a core case.

### Cross-tab loading

Retired 2026-11-04 with "One tab, one show": a show is the open tab's, which is loaded, so Start no longer pulls
every unloaded tab (`loadAllTabs()` stays, for search). A slide whose tab cannot be resolved is in no show.

## Presenter notes

**Each slide carries its own notes**, written and edited in the page's title bar (Notes): a short stack of note cards, one point each ([Speaker note cards](speaker-note-cards.md)). They are the slide's, stored on the slide.

They are deliberately NOT the elements' existing `note?` field ([Document structure](../006-document/document-structure.md), rich text per [Rich-text notes](../009-elements/rich-text-notes.md)), which the previous draft reused. That field is a note about a _thing_ ("this queue is the one that backs up"), and it belongs to the element wherever it appears. What a presenter needs is a note about a _moment_ in a talk, and the same element on two slides usually wants two different things said about it. Deriving slide notes by gathering up element notes gives you neither: a caption assembled from three elements' annotations, in element order, saying nothing you chose to say.

- Plain text, not rich text. It is a script you read off, and the rich-text editor is a surface to maintain for something nobody will bold. Each card is a few lines, so a card is what you glance at, not a page you search.
- During a presentation they live behind the HUD's notes button, opened on demand. See The HUD above.

## Realtime: presenting is local, and that is the design

**Presenting broadcasts nothing.** The delivery mechanism is you sharing your screen in the meeting you are already in. Collaborators with the document open see the document, not your deck; nobody is pulled into your slide, nobody's viewport moves, nobody has to be told a presentation started.

This is a stance, not a v1 shortcut. "Follow the presenter" was the obvious v2 and is **not planned**: it makes presenting something that happens TO other people, which is the opposite of the point. You are showing a room what you want them to see, on your screen. Somebody else reading the same document in another window is doing their own work and should be left alone.

What it saves is real. Presenting needs **no room op, no api-schema change, and nothing in the Durable Object**. Remote cursors, lasers and selections are hidden from the presenter's own view (they would puncture the illusion on a projector), and edits arriving mid-presentation apply underneath as normal, so a slide re-renders if one of its members changed.

**The presenter stays on their slide.** The running deck remembers the slide on screen by its id, not its place in the run, so a collaborator deleting another tab, or hiding, adding or moving a slide, never moves the presenter to another slide or ends the deck. When the slide on screen itself goes, the one now in its place shows (the last one if it was last); the end state comes only once no slide is left. Such an edit is not a move: no transition plays, the auto-advance timer keeps running from the slide's arrival, and nothing is announced.

### Deck edits are ordinary document data

The deck itself IS shared: a teammate opening the document sees your slides and can edit them. Deck changes ride the normal document save and arrive for other people on their next load, like the document's name does.

**No live `deck` room op in v1.** It was specced and dropped once presenting went local: a deck is small, rarely touched, and in practice authored by one person for one meeting, so the realtime path would be carrying a message almost nobody sends. The cost is last-write-wins at whole-deck granularity if two people edit slides in the same session without reloading, which is the same exposure the document name already has and is proportionate to how often it will happen. Speaker note cards are the exception: the server merges them card by card on each deck write ([Speaker note cards](speaker-note-cards.md) "Two people writing at once"). If it turns out to bite, a `deck` op carrying the whole (small) deck is a small addition, deliberately unlike the granular per-element merge in [Realtime conflict resolution](realtime-conflict-resolution.md).

## Implementation shape

Per the no-god-files rule: `useSlideDeck.ts` (deck state, current index, keyboard, camera targets), `page-row-slides.tsx` (a page's deck verbs on its Contents menu), and `PresentationOverlay.tsx` (the full-screen surface Start puts you into: the slide surface and its transitions, the auto-hiding HUD, the notes, the end state). The element popover reuses the existing read surfaces rather than growing a third rendering of a comment thread: the same components the canvas popover and the Collaborate panel already draw, with their composers and action buttons not passed. `CommentThreadList` (`comment-thread-parts.tsx`) takes its handlers optionally for exactly this reason (a surface with no comment session renders the thread readable but inert), so presenting is a caller that omits them. Deck helpers stay pure and live in `packages/document` beside the element helpers: resolving a slide to its elements, pulling in implied arrows, and computing a slide's bounds are all `(Deck, Tab[]) -> ...` functions with no React in them, so they are testable and reusable by the api and MCP worker.

The additions above land on that same shape rather than growing the overlay. The jump popover and the pacing readout are HUD components fed by `useSlideDeck`; the wake lock and the elapsed clock are effects it owns, both released on exit beside the viewport restore that already happens there. The presenter settings gain two booleans in `lib/presentation-config.ts`, which keeps them in the person's preferences. Laser and Spotlight need nothing new at all: they are canvas tools the overlay stops suppressing. The deck export is a third value on the existing `exportScope` union plus a loop over slides in the export path, and the per-slide bounds it needs is the pure helper above, which is the reason it costs so little.

## Telemetry

Per [Telemetry + public transparency dashboard](../017-telemetry/telemetry.md), enough to answer "is this used, and which parts" without a flood.

**Building a deck**: `UI·Added·PageSlide` (Add to Slides),
`UI·Toggled·SlideHidden` / `UI·Toggled·SlideShown` (which way it went matters:
"people hide slides" and "people unhide them" are different findings), and
`UI·Changed·SlideNotes` once per editing session, fired on the first keystroke
(per-keystroke would be a flood and per-open would count looking without
typing).

**Running one**: `UI·Used·PresentFromHere` (the Contents menu's, before the start), `UI·Started·Presentation`, `UI·Closed·Presentation`,
`UI·Opened·PresenterNotes`, `UI·Opened·PresentationSettings`, and
`UI·Opened·SlideElementDetail`, which is the whole question "read anything,
change nothing" was written to answer.

**Settings**: `UI·Changed·Presentation-<field>`. The FIELD, not the value:
what is worth learning is which settings people reach for at all, and values
would multiply the vocabulary for no extra signal.

**Still no per-slide-advance event.** A fifty-slide deck would emit fifty
events per run to tell us something the start / close pair already implies.

## Out of scope (v1)

- Follow-the-presenter sync. **Not planned**, see Realtime above: it inverts what presenting is for.
- Dual-screen presenter console (notes on your laptop, slide on the projector). Per-slide notes ship; a second-window console does not.
- Export the deck to PDF or PPT. (The framing rule above makes it tractable later: every slide already has bounds, and the export renderer already draws a bounded element set.)
- Per-element build animation WITHIN a slide (clicking to reveal one box at a time). Slide-to-slide transitions ship, see Motion; building up a single slide does not.
- Auto-generating a deck from a document (see the empty-deck rule above: deliberate, not deferred).
- A slide that mixes tabs. Ruled out by the model, not postponed.
- CHANGING anything from a presentation. Ruled out, not postponed. Reading is in (see Presenting): clicking an element shows its note, comments and actions.

## Settled

The three questions this draft opened with are answered, and the answers are in the body above rather than left hanging here:

- **Empty deck**: it stays empty. No seeding.
- **Interaction while presenting**: read anything, change nothing. Clicking an element opens a read-only popover of its note, comments and actions; no session verb and no edit is reachable. Live data still displays.
- **Slide backdrop**: the slide's tab's, which is well-defined because a slide belongs to one tab.
- **Presenter notes on screen**: behind a notes button in the HUD, opened in a popover on demand.

## Open questions

1. **A deleted tab's slides.** They are skipped at read time (above), so a deck can carry invisible slides that come back if the tab is restored by undo. With no deck list there is nowhere to show them; silent-skip stands.
