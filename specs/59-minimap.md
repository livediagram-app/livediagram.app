# 59 — Minimap

A bottom-left minimap that gives a zoomed-out overview of the whole tab and
lets you jump the viewport anywhere with a tap or drag.

## Behaviour

- **A movable panel.** The Map is a first-class floating panel (`MovablePanel`,
  like the Palette), labelled **"Map"**: drag its header to move it, minimise it
  to a banner, and reset it to its default corner — all the panel chrome the
  others have. Its default corner is **bottom-left**; its position lives in
  `usePanelLayout` (`mapPosition`) alongside the other panels'.
- **When.** Shown when it's **enabled** (`showMinimap` preference, **on by
  default**), the tab has **at least 4 elements**, and **on desktop** (hidden on
  mobile, where the canvas is already edge-to-edge and the corner is the mobile
  dock's). At its **default** corner it defers to the Activity panel (they share
  bottom-left), so it appears only while Activity is minimised; **once dragged
  elsewhere it stays put** regardless.
- **Enable / disable.** A **settings gear** in the panel header opens a small
  popover (mirroring the Palette's) with an **Enable Map** toggle. Turning it
  off sets `showMinimap = false` and hides the panel; the master **Settings**
  dialog's "Show minimap" toggle switches it back on. (Replaces the earlier
  one-shot **×**.)
- **What it shows.** A true-to-shape overview: every boxed element painted as
  its **real silhouette** (a circle reads as a circle, a cylinder as a
  cylinder — reusing `ShapeGlyph` stretched to the element's footprint) and
  every arrow as a **connecting line** between its resolved endpoints. The area
  **outside the current view is dimmed**, leaving a lit window (outlined in the
  tab theme's accent, matching the on-canvas selection) that reads at a glance
  as where you are.
- **Navigation.** Tap a point to re-centre the canvas there; press-and-drag
  inside the map to pan continuously; **scroll** on it to zoom the canvas in/out
  centred on that spot. The viewport rectangle tracks live as you move. (Drags
  on the header move the panel; drags inside the map navigate the canvas.)

## Geometry

The canvas transform is `scale(z) translate(o)` about the `<main>` centre
(`origin-center`), so:

- viewport centre, in world coords, is `(W/2 − oₓ, H/2 − o_y)`, and the visible
  world rect is `W/z × H/z` around it (`W`,`H` = the `<main>` size);
- re-centring on a world point `P` is therefore `offset = (W/2 − Pₓ, H/2 − P_y)`.

The minimap is an SVG whose `viewBox` **is** world space (the union bounding box
of the elements, padded), so element rects are drawn at their literal world
coords and `getScreenCTM().inverse()` maps a click back to world coords —
letterboxing handled for free.

## Implementation

- `components/canvas/Minimap.tsx` — the SVG overview inside a `MovablePanel`
  (move / minimise / reset come from the shared panel). The element wireframe is
  memoised on `elements` so panning only re-renders the viewport rectangle.
- `components/canvas/MapSettingsPopover.tsx` — the header gear + popover holding
  the Enable Map toggle, mirroring `PaletteSettingsPopover`.
- `hooks/ui/useIsMobileViewport.ts` — a reactive (`useSyncExternalStore`)
  version of `isMobileViewportSync` so the panel mounts / unmounts when the
  viewport crosses the `sm` breakpoint.
- `Canvas` renders it gated on
  `mapEnabled && !isMobile && elements.length >= 4 && (mapPosition !== null || activityMinimized)`.

Boxed elements only for now (arrows are usually within their endpoints'
boxes); extending the bounds to arrow geometry is a possible follow-up.
