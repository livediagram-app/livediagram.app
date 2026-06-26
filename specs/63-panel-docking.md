# 63 — Panel corner docking

The editor's floating panels (Palette, Explorer, Activity, Comments, AI, Minimap) each
ship pinned to a fixed corner (see [spec/09](09-canvas-and-palette.md)). This spec lets
the user **choose which corner each panel sits in**, drag a panel between corners with a
**snap-to-corner** affordance, **stack** more than one panel in the same corner, and have
that layout **persist in the browser** so a reload restores their arrangement.

## Why

Corners are fixed today: the Palette is always top-right, the Explorer always top-left.
A left-handed user, or one whose content lives on the right, can drag a panel away but it
snaps back on reload and there is no guidance toward a tidy resting spot. Letting people
park each panel where it suits them — and remembering it — makes the chrome feel like
theirs without adding a settings screen.

## Scope

- **Desktop only.** The snap + dock behaviour applies to the standard floating-panel
  layout (`sm:` and up). Mobile (the top-right dock, spec/07) and the desktop **Minimal
  panel layout** opt-in (`minimalPanels`, spec/09) render panels as dock popovers and are
  **unchanged** — they have no corners to dock into. **Zen mode** (spec/26) still hides
  all chrome. When any of those modes is active the docking system is inert and panels
  fall back to their existing behaviour.
- **Participating panels:** Palette, Explorer, Activity, Comments, AI, Minimap — every
  panel built on the shared `MovablePanel`.
- **Zoom controls stay fixed** bottom-right (they are not a `MovablePanel`; zen mode and
  the body-height measurement both rely on that pin). They are not dockable.

## The four corners

A panel rests in one of four **corner zones** — `top-left`, `top-right`, `bottom-left`,
`bottom-right` — or sits **free** at an explicit `{x, y}`.

Each corner is a **stack**: zero or more panels in a fixed order. Top corners stack
**downward** (first panel flush to the corner, the next below it, a 16 px gap between);
bottom corners stack **upward** (first panel flush to the bottom corner, the next above
it). The stack is a flex column anchored to its corner, so removing or hiding a panel
**reflows** the rest automatically: take the top panel away and the next one slides up to
the corner. No manual re-measuring — the layout falls out of the flexbox.

### Default layout

When the user has never arranged panels, the corners match today's defaults:

| Corner         | Panels (top → bottom)        |
| -------------- | ---------------------------- |
| `top-left`     | Explorer                     |
| `top-right`    | Palette, Comments, AI        |
| `bottom-left`  | Activity, Minimap            |
| `bottom-right` | _(empty; zoom controls pin)_ |

This preserves the existing arrangement, including Comments / AI stacking beneath the
Palette — that bespoke `stackBelowY` stacking (spec/09) is now just the general top-right
stack with three members.

## Dragging, snapping, and free placement

The panel header is the drag handle, as today. While a panel is being dragged on desktop:

- **Snap guides appear** — a faint target marker in each of the four corners, drawn on a
  pointer-inert overlay above the canvas. They only show during an active panel drag.
- As the dragged panel's nearest corner comes within a **snap radius** (~96 px from the
  corner), that corner's marker **highlights** to signal where the panel will land. The
  panel itself keeps following the pointer freely — the guide is a hint, not a magnet that
  yanks it.
- **On release near a highlighted corner**, the panel **docks** to that corner, appended
  to the bottom of that corner's stack (it joins below whatever is already there).
- **On release away from every corner**, the panel **stays exactly where it was dropped**
  as a free-floating panel at that `{x, y}`. Free panels do not stack and are not part of
  any corner zone; they are remembered at their pixel position.

A panel's header keeps its existing **"Reset position"** button (the snap-back glyph),
which returns the panel to its **default corner** for that panel (per the table above),
clearing any free position or non-default corner.

Dragging is still pointer-driven and uses no DnD library, consistent with the rest of the
editor (element drag, palette-to-canvas drag).

## Persistence — device-local

The layout is stored in **`localStorage` only**, under `livediagram:panel-layout:v1`, on
the browser that set it. It is **not** synced to the account and **not** part of the
D1-backed user-preferences blob (spec/20): panel placement is a per-device ergonomic
choice (screen size, handedness, external monitor) rather than a portable account setting,
and guests get it too. This is deliberately a different store from spec/20.

Shape:

```ts
type PanelCorner = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
type PanelId = 'palette' | 'explorer' | 'activity' | 'comments' | 'ai' | 'minimap';

type PanelLayout = {
  // Ordered stack per corner. Order is top→bottom (top corners) /
  // bottom→top fill order (bottom corners). Reflow = remove from array.
  corners: Record<PanelCorner, PanelId[]>;
  // Panels parked off-corner at an explicit pixel position.
  free: Partial<Record<PanelId, { x: number; y: number }>>;
};
```

A panel id appears in **exactly one** place: one corner's array, or `free`, or neither
(then it uses its default). Writes are best-effort (quota / private-window failures are
swallowed). A same-tab `livediagram:panel-layout-changed` window event fires on write so
the editor picks up its own change without polling; the browser's native `storage` event
covers cross-tab. Mirrors the eventing pattern of `lib/user-preferences.ts` but with no
network step.

Forward-compat: unknown panel ids in a stored layout are ignored on read, and a panel id
missing from the stored layout falls back to its default corner — so adding a new panel
later, or reading a layout written by a newer client, never strands the UI.

## Implementation

- **`apps/live/lib/panel-layout.ts`** — types, `DEFAULT_PANEL_LAYOUT`, and
  `readPanelLayout()` / `writePanelLayout()` against `localStorage`. Pure, unit-tested
  (placement normalisation: a panel can't be in two corners; reflow ordering; default
  fallback).
- **`apps/live/hooks/ui/usePanelDock.ts`** — owns the layout state (hydrated synchronously
  from `localStorage` at mount, re-read on the change event), derives the per-corner
  ordered panel lists, tracks the active drag + nearest-corner snap candidate, and exposes
  handlers: `dockToCorner(panelId, corner)`, `setFree(panelId, x, y)`,
  `resetPanel(panelId)`, plus drag lifecycle (`beginDrag`, `updateDrag`, `endDrag`).
  Composed alongside `usePanelLayout` in the editor view-model.
- **`MovablePanel`** gains an additive **docked** render mode: when the parent places it
  inside a corner stack it renders as a static flex child (no `absolute`, no corner class,
  no inline `left/top`), so the flex column owns its position and reflow. Free / dragging
  panels keep the existing absolute `left/top` path. Optional drag-lifecycle callbacks let
  the panel report drag start / move (with its bounding rect) / end up to the dock hook so
  it can drive the snap guides and the dock-vs-free decision. The mobile dock,
  `forceDockMode`, `collapsible`, and stacking-via-`stackBelowY` paths are untouched.
- **`apps/live/components/canvas/PanelSnapGuides.tsx`** — the four-corner guide overlay,
  rendered by `CanvasChrome` only while a panel drag is active; highlights the snap
  candidate corner from the dock hook.
- **`CanvasChrome`** — in the standard desktop layout, renders four corner **stack
  containers** (absolutely positioned flex columns, `gap-4`; bottom corners
  `flex-col-reverse`) and distributes each visible panel node into the container for its
  docked corner; free / dragging panels render outside the containers at their pixel
  position. The whole corner-container path is gated behind "not mobile, not
  `minimalPanels`, not zen"; otherwise the existing inline rendering runs as before.

## Telemetry

Emit `track('UI', 'Moved', 'PanelDock')` when a panel is docked to a corner by drag (see
[spec/22](22-telemetry.md)); reuse the closed category / action enums, extending only if no
pair fits. Layout reads / reflows are silent.

## Relationship to other specs

- [spec/09](09-canvas-and-palette.md) — the Palette / Explorer "Movable" behaviour: corner
  is now user-choosable and the position **persists across reloads** (was "survives until
  the page reloads"). Comments / AI stacking under the Palette is the general top-right
  stack.
- [spec/20](20-user-preferences.md) — panel layout is intentionally a **separate,
  device-local** store, not part of the synced preferences blob.
- [spec/59](59-minimap.md) — the Minimap's default corner (bottom-left) and its position
  now flow through this docking system like the other panels.
- [spec/26](26-zen-mode.md) — zen mode still hides all panels; docking is inert there.
