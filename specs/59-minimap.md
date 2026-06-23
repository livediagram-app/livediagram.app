# 59 — Minimap

A bottom-left minimap that gives a zoomed-out overview of the whole tab and
lets you jump the viewport anywhere with a tap or drag.

## Behaviour

- **Where / when.** Bottom-left corner. Shown only when the **Activity panel
  is minimised** (it owns the same corner — `activityMinimized` is the gate),
  and **only on desktop** (hidden on mobile, where the canvas is already
  edge-to-edge and the corner is used by the mobile dock).
- **What it shows.** A wireframe of every boxed element in the tab (neutral
  rounded rects), plus a brand-outlined rectangle marking the current
  viewport. Hidden entirely on an empty tab (nothing to map).
- **Navigation.** Tap a point to re-centre the canvas there; press-and-drag to
  pan continuously. The viewport rectangle tracks live as you move.

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
