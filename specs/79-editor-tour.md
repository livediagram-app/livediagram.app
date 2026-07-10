# 79 — Interactive editor tour ("Show me around")

A bootstrap-style guided tour of the editor: a sequence of anchored popover
steps that spotlight one piece of chrome at a time, opening the real panels
and menus as it goes. Distinct from the guided-tour **sample diagram**
([spec/69](69-guided-tour-sample.md)), which teaches through annotation
markers on the canvas. The two coexist, and the "Show me around" name now
belongs to this interactive tour (the spec/69 card's CTA reads "Take the
guided tour").

## Where it appears

- **The welcome wizard's Settings step only** ([spec/76](76-offline-mode.md)),
  as a toggle row directly above "Save Offline, This Browser Only", and only
  for a **brand-new user: zero owned diagrams** (the `/new` page already
  learns the count from the Jump-back-in fetch; `null` = unknown = hidden).
  Note this is stricter than the spec/69 card's `< 3` gate: the toggle is a
  first-run affordance, gone the moment the account holds anything.
- **One-shot.** No re-launch surface (no Help-menu entry). The sample
  diagram + help centre cover later learning.
- Toggling it on does not change what Create does: the diagram is created
  exactly as configured (template, theme, name, placement, offline), and the
  tour starts once the editor has loaded.

## Handoff

Create hard-navigates to `/diagram/<id>`, so the intent crosses pages via a
**one-shot sessionStorage flag** (`livediagram:v2:tour-pending`), set just
before `window.location.assign` and consumed (read + removed) by the editor.
sessionStorage keeps it per-tab and self-cleaning; a URL param would survive
into copy-pasted links. The editor starts the tour only when it's actually
usable: hydrated, no welcome overlay, not read-only, not an embed.

## The steps

Eight steps, in palette → explorer → canvas → tabs order. Copy is one or two
short sentences per step ("concise" is the spec constraint; the exact strings
live in `apps/live/components/tour/tour-steps.ts`):

1. **The Palette**: the floating panel where every element comes from.
2. **Selection modes**: opens the canvas-tool dropdown (Select / Hand /
   Eraser / ...) and explains mode switching.
3. **Shape categories**: opens the palette-category dropdown (Shapes /
   Tools / Components / Devices / Icons / Technology).
4. **The Tools category**: switches the palette to Tools and explains what
   lives there (text, sticky, pencil, arrows, tables, images, charts).
5. **The Explorer**: the in-editor diagram/folder browser.
6. **Element context menu**: selects an element (adding a theme-coloured
   square at the viewport centre first if the tab is empty) and opens its
   right-click menu programmatically.
7. **Tabs**: highlights the tab bar's "+" add button.
8. **Tab menu**: opens the active tab's ⋯ menu and explains it.

Each step popover shows the step count, a title, the copy, and
Back / Next (Done on the last step) plus a Skip control. A dimming highlight
ring surrounds the current target; it never blocks pointer input, so the
user can poke at whatever is highlighted mid-tour.

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

Existing enums only: `track('UI', 'Started', 'Tour')` when the tour begins,
`track('UI', 'Ended', 'TourCompleted' | 'TourSkipped')` when it finishes or
is dismissed early.
