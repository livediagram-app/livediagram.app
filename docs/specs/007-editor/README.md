# Editor

Follow the references below only as needed; never upfront.

- ./live-app.md - when working on Live app: The diagram editor app (clean routes, no `/live` prefix)
- ./new-document-route.md - when working on Dedicated route for new-document creation: The welcome / create-new flow at `/new`, split from the editor
- ./user-preferences.md - when working on User preferences: Per-user editor preference flags (footer settings dialog)
- ./ai-assistance.md - when working on AI Assistance: Optional AI assistant (Build / Clean / Ask / Review) on the canvas
- ./zen-mode.md - when working on Zen mode: Distraction-free focus mode: hide all chrome, keep canvas + zoom
- ./panel-docking.md - when working on Panel corner docking: Choose which corner each floating panel sits in: desktop drag with snap-to-corner guides, free drop kept where released, stacking + reflow within a corner, device-local localStorage layout
- ./guided-tour-sample.md - when working on Guided tour sample ("Take the guided tour") — RETIRED: RETIRED (superseded by [Interactive editor tour ("Show me around")](editor-tour.md)): the annotated sample diagram, its hidden template, and the /new card are gone; only the generic `hidden` template flag remains
- ./command-palette.md - when working on Command palette (⌘K): Cmd/Ctrl+K opens the Search panel; the Actions command registry widens to app-level verbs (undo/zen/layout/dialogs) + a view-safe read-only subset
- ./editor-tour.md - when working on Interactive editor tour ("Show me around"): "Show me around": a zero-document user's first document opens with a centred welcome offer (subtle backdrop, declining is one equal-weight click, once-ever per browser), then an animated welcome-to-outro tour (7 anchored steps; search is desktop-only) spotlights the palette, selection modes, shape categories, the Explorer, the element context menu, and the tab bar (active pill + add button, menu covered in copy), driving the real panels/menus, Toolbar-layout aware (desktop and phone). Replayable via the Settings "Welcome Tour Completed" row; superseded [Guided tour sample ("Take the guided tour") — RETIRED](guided-tour-sample.md), whose sample diagram + /new card were removed
- ./toolbar-layout.md - when working on Toolbar layout: The panel layout beside Floating, and the only one on a phone: the Palette as one Excalidraw-style strip at the top of the canvas (selection mode, category picker, the category's first 12 tiles, and a More button whose popover, hung from the button, holds the full category). The top-left menu button opens the Explorer as a popover; Layers and Collaborate are popovers over their bottom-row buttons; every other panel behaves as in Floating. `panelLayout` preference (`'floating' | 'toolbar'`)
- ./ui-scale.md - when working on UI scale: the Appearance sliders (80% to 120%, 100% in the middle, desktop only) that scale the panels, the toolbar and the bottom-right corner buttons with CSS `zoom`, together or each on its own, and nothing else
- ./power-user-mode.md - when working on Power user mode: a preset of recommended settings that restores untouched ones when switched off, power-user-only settings such as Minimal chrome (hide captions, titles and hints, keep controls), and the once-ever offer
- ./editor-modes.md - when working on editor modes: Diagram and Draw on a general tab, the mode switch beside the page switcher, kinds versus modes
- ./blueprints/README.md - when implementing an editor spec from its blueprint (appearance, power user mode, UI scale)
