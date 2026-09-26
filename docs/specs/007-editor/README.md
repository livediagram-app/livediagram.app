# Editor

Follow the references below only as needed; never upfront.

- ./live-app.md - when working on Live app: The diagram editor app (clean routes, no `/live` prefix)
- ./new-diagram-route.md - when working on Dedicated route for new-diagram creation: The welcome / create-new flow at `/new`, split from the editor
- ./user-preferences.md - when working on User preferences: Per-user editor preference flags (footer settings dialog)
- ./ai-assistance.md - when working on AI Assistance: Optional AI assistant (Build / Clean / Ask / Review) on the canvas
- ./zen-mode.md - when working on Zen mode: Distraction-free focus mode: hide all chrome, keep canvas + zoom
- ./panel-docking.md - when working on Panel corner docking: Choose which corner each floating panel sits in: desktop drag with snap-to-corner guides, free drop kept where released, stacking + reflow within a corner, device-local localStorage layout
- ./guided-tour-sample.md - when working on Guided tour sample ("Take the guided tour") — RETIRED: RETIRED (superseded by [Interactive editor tour ("Show me around")](editor-tour.md)): the annotated sample diagram, its hidden template, and the /new card are gone; only the generic `hidden` template flag remains
- ./command-palette.md - when working on Command palette (⌘K): Cmd/Ctrl+K opens the Search panel; the Actions command registry widens to app-level verbs (undo/zen/layout/dialogs) + a view-safe read-only subset
- ./editor-tour.md - when working on Interactive editor tour ("Show me around"): "Show me around": a zero-diagram user's first diagram opens with a centred welcome offer (subtle backdrop, declining is one equal-weight click, once-ever per browser), then an animated welcome-to-outro tour (7 anchored steps; search is desktop-only) spotlights the palette, selection modes, shape categories, the Explorer, the element context menu, and the tab bar (active pill + add button, menu covered in copy), driving the real panels/menus, dock-button aware on mobile/minimal. Replayable via the Settings "Welcome Tour Completed" row; superseded [Guided tour sample ("Take the guided tour") — RETIRED](guided-tour-sample.md), whose sample diagram + /new card were removed
- ./toolbar-layout.md - when working on Toolbar layout: A third desktop panel layout beside Floating and Minimal: the Palette as one Excalidraw-style strip at the top of the canvas (selection mode, category picker, the category's first 10 tiles, and a More button whose popover, hung from the button, holds the full category). The top-left menu button opens the Explorer as a popover; every other panel behaves as in Floating. `panelLayout` preference, desktop only
