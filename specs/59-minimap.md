# 59 — Minimap

A bottom-left minimap that gives a zoomed-out overview of the whole tab and
lets you jump the viewport anywhere with a tap or drag.

## Behaviour

- **Where / when.** Bottom-left corner, labelled **"Minimap"**. Shown only
  when it's enabled (`showMinimap` preference, **on by default**, toggled in
  Settings and dismissable via the card's **×**), the tab has **at least 4
  elements**, the **Activity panel is minimised** (it owns the same corner),
  and **on desktop** (hidden on mobile, where the canvas is already
  edge-to-edge and the corner is used by the mobile dock).
- **What it shows.** A true-to-shape overview: every boxed element painted as
  its **real silhouette** (a circle reads as a circle, a cylinder as a
  cylinder — reusing `ShapeGlyph` stretched to the element's footprint) and
  every arrow as a **connecting line** between its resolved endpoints. The area
  **outside the current view is dimmed**, leaving a brand-outlined lit window
  that reads at a glance as where you are.
- **Navigation.** Tap a point to re-centre the canvas there; press-and-drag to
  pan continuously; **scroll** on the minimap to zoom the canvas in/out centred
  on that spot. The viewport rectangle tracks live as you move.

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

- `components/canvas/Minimap.tsx` — the SVG overview + the tap/drag handler.
  The element wireframe is memoised on `elements` so panning only re-renders
  the viewport rectangle.
- `hooks/ui/useIsMobileViewport.ts` — a reactive (`useSyncExternalStore`)
  version of `isMobileViewportSync` so the minimap mounts / unmounts when the
  viewport crosses the `sm` breakpoint.
- `Canvas` renders it gated on `activityMinimized && !isMobile`.

Boxed elements only for now (arrows are usually within their endpoints'
boxes); extending the bounds to arrow geometry is a possible follow-up.
