# 79 — Interactive editor tour ("Show me around")

A bootstrap-style guided tour of the editor: a sequence of anchored popover
steps that spotlight one piece of chrome at a time, opening the real panels
and menus as it goes. Distinct from the guided-tour **sample diagram**
([spec/69](69-guided-tour-sample.md)), which teaches through annotation
markers on the canvas. The two coexist, and the "Show me around" name now
belongs to this interactive tour (the spec/69 card's CTA reads "Take the
guided tour").

## Where it appears

- **Automatically, on a brand-new user's first diagram.** When a
  **zero-owned-diagrams** user (the `/new` page already learns the count
  from the Jump-back-in fetch; `null` = unknown = no offer) creates a
  diagram through the wizard (any path: Create or Skip, but not the
  spec/69 guided-tour sample, which teaches by itself), the editor opens
  with a centred **welcome offer card**: "Show me around" starts the tour,
  "No thanks" dismisses it. There is no wizard toggle; the offer IS the
  opt-in, and declining must be one obvious, equal-weight click.
- **Once ever per user.** However the offer ends (declined, skipped
  mid-tour, or completed), the synced `tourSeen` user preference
  ([spec/20](20-user-preferences.md)) stops it ever reappearing — the
  offer must never read as nagging, and answering it once covers every
  device the user signs in from (guests get the same via their
  owner-keyed preference row + the localStorage warm cache).
- **Replayable from Settings.** The Settings dialog's Editor group has an
  "I've seen the editor tour" row surfacing `tourSeen`. Unchecking a
  previously-checked row and closing Settings relaunches the tour from
  the top — the welcome card is always step 1, on a rerun too. Finishing
  the rerun re-checks it.

## Handoff

Create hard-navigates to `/diagram/<id>`, so the intent crosses pages via a
**one-shot sessionStorage flag** (`livediagram:v2:tour-pending`), set just
before `window.location.assign` and consumed (read + removed) by the editor.
sessionStorage keeps it per-tab and self-cleaning; a URL param would survive
into copy-pasted links. The editor shows the offer only when it's actually
usable: hydrated, no welcome overlay, not read-only, not an embed. The
Settings relaunch crosses no navigation, so it's a window event
(`livediagram:tour-relaunch`), not a flag.

## The steps

A welcome offer card, then seven steps in palette → explorer → canvas →
tabs order (the offer sits outside the "N of 7" count). Copy is one or two
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
6. **Tabs**: highlights the tab bar's "+" add button.
7. **Tab menu**: opens the active tab's ⋯ menu and explains it.

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

Existing enums only. The offer: `'UI'/'Opened'/'TourOffer'` when the
welcome card shows (first run and Settings relaunch alike),
`'UI'/'Closed'/'TourOffer'` on "No thanks". The tour:
`'UI'/'Started'/'Tour'` on accept,
`'UI'/'Ended'/'TourCompleted' | 'TourSkipped'` at the end. The
Settings row toggles report `'UI'/'Toggled'/'TourSeenOn' | 'TourSeenOff'`.
