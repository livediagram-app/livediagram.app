# 79 — Interactive editor tour ("Show me around")

A bootstrap-style guided tour of the editor: a sequence of anchored popover
steps that spotlight one piece of chrome at a time, opening the real panels
and menus as it goes. It superseded the guided-tour **sample diagram**
([spec/69](69-guided-tour-sample.md), now retired), which taught through
annotation markers on the canvas; the sample's template, builder, and /new
card were removed once this tour proved the better introduction.

## Where it appears

- **Automatically, on a brand-new user's first diagram.** When a
  **zero-owned-diagrams** user (the `/new` page already learns the count
  from the Jump-back-in fetch; `null` = unknown = no offer) creates a
  diagram through the wizard (any path: Create or Skip), the editor opens
  with a centred **welcome offer card**: "Show me around" starts the tour,
  "No thanks" dismisses it. There is no wizard toggle; the offer IS the
  opt-in, and declining must be one obvious, equal-weight click.
- **Once ever per user.** However the offer ends (declined, skipped
  mid-tour, or completed), the synced `tourSeen` user preference
  ([spec/20](20-user-preferences.md)) stops it ever reappearing — the
  offer must never read as nagging, and answering it once covers every
  device the user signs in from (guests get the same via their
  owner-keyed preference row + the localStorage warm cache).
- **Replayable from Settings.** The Settings dialog's Editor group has a
  "Welcome Tour Completed" row surfacing `tourSeen`. Unchecking a
  previously-checked row and closing Settings relaunches the tour from
  the top — the welcome card is always step 1, on a rerun too. Finishing
  the rerun re-checks it.

## Handoff

Create hard-navigates to `/diagram/<id>`, so the intent crosses pages via a
**sessionStorage flag** (`livediagram:v2:tour-pending`), set just before
`window.location.assign`. The editor PEEKS at the flag and clears it only
when the offer is **resolved** (completed, skipped, or declined) — never on
mere page load — so reloading mid-offer or mid-tour brings the offer back
instead of silently swallowing an unanswered tour. sessionStorage keeps it
per-tab; a URL param would survive into copy-pasted links. The editor shows
the offer only when it's actually usable: hydrated, no welcome overlay, not
read-only, not an embed. The Settings relaunch crosses no navigation, so
it's a window event (`livediagram:tour-relaunch`) — which also re-marks the
flag, so a mid-rerun reload re-offers the same way.

## The steps

A welcome offer card, then eight steps in palette → explorer → canvas →
tabs → theme → search order (six on mobile, where the theme-canvas and
search steps are skipped), and a closing "you're ready" card. The bookend
cards sit outside the step count. Copy is one or two
short sentences per step ("concise" is the spec constraint; the exact strings
live in `apps/live/components/tour/tour-steps.ts`):

0. **Welcome** (the offer): centred card, "Show me around" / "No thanks".
1. **The Palette**: the floating panel where every element comes from.
2. **Selection modes**: opens the canvas-tool dropdown (Select / Hand /
   Eraser / ...) and explains mode switching. No "default" claim in the
   copy — desktop defaults to Select but mobile to Hand.
3. **Shape categories**: opens the palette-category dropdown (Favourites /
   Shapes / Tools / Components / Devices / Icons / Technology). A
   dedicated "Tools category" step existed briefly and was cut — the
   category dropdown already tells that story.
4. **The Explorer**: the in-editor diagram/folder browser.
5. **Element context menu**: selects an element (adding a theme-coloured
   square at the viewport centre first if the tab is empty) and opens its
   right-click menu programmatically.
6. **Tabs**: highlights the active tab pill and the "+" add button as one
   region (an `alsoHighlight` union, like the dropdown steps), with the
   tab menu covered in the copy. A separate open-the-⋯-menu step existed
   briefly and was folded in here.
7. **Theme & Canvas** (desktop only): highlights the paintbrush dock
   button (spec/42) that opens the tab's theme + canvas background
   dialog. No prepare needed: the button is always in the desktop chrome
   for an editable session. Mobile reaches the same dialog through the
   canvas menu, so the step is skipped there.
8. **Search** (desktop only): opens the Cmd/Ctrl+K search panel — find
   diagrams, elements, help articles, and run actions. The panel brings
   its own modal backdrop, so this step's ring lifts above the modal
   layer.
9. **Outro** (card): "You're ready to go" — a help-article illustration,
   a help-centre link (new tab), and a "Start creating" button that
   completes the tour.

Each step popover shows the step count, a title, the copy, and
Back / Next (Done on the last step) plus a Skip control. A dimming highlight
ring surrounds the current target; it never blocks pointer input, so the
user can poke at whatever is highlighted mid-tour. Phase changes are
animated: the ring keeps the previous rect and **glides** to the next
target, the popover transitions its position, and the card content slides
directionally (the New Diagram wizard's tip-next / tip-prev motion). The
dropdown steps highlight the **union** of the trigger button and its
portalled menu, so the ring wraps the whole control, not the floating menu
alone.

## Mechanics

- The engine drives the **real UI**, not screenshots: steps have a `prepare`
  phase that opens the actual panel / dropdown / menu (clicking the same
  triggers a user would, or calling editor-context handlers like
  `setContextMenu`), then anchors the popover to the resulting DOM node
  found via `data-tour-id` attributes (plus the existing
  `data-palette-dropdown-menu` / `data-element-id` hooks).
- Targets are awaited (poll with timeout) because several menus are
  lazy-loaded chunks. A step whose target never appears is skipped rather
  than wedging the tour; if an open menu is dismissed mid-step (outside
  click), the step re-prepares itself.
- **Mobile + minimal panel layout**: panels there live behind the dock
  button row (spec/07 / spec/09), so palette/explorer steps first tap the
  matching dock button (`data-tour-id="dock-*"`), and the popover clamps to
  the viewport with the shared edge margins. Collapsed desktop panels are
  expanded via their header toggle the same way.
- Advancing closes whatever the previous step opened (dropdowns, context
  menu, dock popovers); finishing or skipping restores a quiet editor.

## Telemetry (spec/22)

Existing enums only, covering the whole funnel:

- **Offer**: `'UI'/'Opened'/'TourOffer'` when the welcome card shows
  (first run and Settings relaunch alike); `'UI'/'Closed'/'TourOffer'` on
  "No thanks".
- **Start**: `'UI'/'Started'/'Tour'` on accept.
- **Stage views**: `'UI'/'View'/'TourStep<Id>'` once per step entry
  (`TourStepPalette`, `TourStepSelectionModes`, `TourStepCategories`,
  `TourStepExplorer`, `TourStepContextMenu`, `TourStepTabs`,
  `TourStepThemeCanvas`, `TourStepSearch`, `TourStepOutro` — derived from
  the fixed step ids,
  never content; a Back re-entry counts as a view). The last View before
  an `Ended/TourSkipped` marks the drop-off stage.
- **End**: `'UI'/'Ended'/'TourCompleted' | 'TourSkipped'`.
- **Settings row**: `'UI'/'Toggled'/'TourSeenOn' | 'TourSeenOff'`.
