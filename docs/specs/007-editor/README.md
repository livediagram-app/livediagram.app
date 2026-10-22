# Editor

Follow the references below only as needed; never upfront.

- ./live-app.md - when working on Live app: The diagram editor app (clean routes, no `/live` prefix)
- ./load-recovery.md - when working on a document that will not load: the load's watchdog and time limits, the opening screen's self-healing reload, the load-error screen's recovery card (Copy Diagnostics, Repair This Browser), what a repair clears and keeps, and the help centre's Repair page
- ./start-diagramming.md - when working on the start panel an empty tab shows (StartPanel, drawing Start Planning): the panel, Best Match, its keyboard, when it shows, search handed over from /new, its look
- ./new-document-route.md - when working on Dedicated route for new-document creation: The welcome / create-new flow at `/new`, split from the editor
- ./templates-by-mode.md - when working on which templates are Plan's (isPlanTemplate), the blanks, Popular, and the names a template gives its tab and document
- ./user-preferences.md - when working on User preferences: Per-user editor preference flags (footer settings dialog)
- ./ai-assistance.md - when working on AI Assistance: Optional AI assistant (Build / Clean / Ask / Review) on the canvas
- ./split-view.md - when working on Side by side tabs: dragging a tab to the right edge to open it beside the active tab, each tab keeping its side under one header, the editor following a click or a resting pointer between panes with no view jump, the live other pane, the drop zone and ghost, resizing, persistence
- ./zen-mode.md - when working on Zen mode: Distraction-free focus mode: hide all chrome, keep canvas + zoom
- ./panel-docking.md - when working on Panel corner docking: Choose which corner each corner panel (AI, Minimap, tool panels) sits in: desktop drag with snap-to-corner guides, free drop kept where released, stacking + reflow within a corner, device-local localStorage layout
- ./guided-tour-sample.md - when working on Guided tour sample ("Take the guided tour"), RETIRED (superseded by the Diagram tour, itself retired: [Editor tours](editor-tour.md)): the annotated sample diagram, its hidden template, and the /new card are gone; only the generic `hidden` template flag remains
- ./command-palette.md - when working on Command palette (⌘K): Cmd/Ctrl+K opens the Search panel; the Actions command registry widens to app-level verbs (undo/zen/layout/dialogs) + a view-safe read-only subset
- ./editor-tour.md - when working on the editor's tours: the shared engine (steps that open what they explain, the spotlight, motion, mechanics, look, share roles) and the retired Diagram tour
- ./element-tours.md - when working on element tours: the tour of one complex element type (first: the Sankey diagram) called Show Me in the interface, offered from a small Show Me toolbar beside the selection toolbar, Play and Cancel, its steps on the real element, its menu steps opening the element's menu, the Show Me closed section in Settings, share roles and telemetry
- ./show-me.md - when working on Show Me: the on-demand guided tour of one surface (card type editor, Share dialog, Dashboard Settings, ), its button beside Help, live controls, Escape, telemetry tokens, and how to add one to a new surface
- ./toolbar-layout.md - when working on Toolbar layout: The editor's one panel layout, on every device: the Palette as one Excalidraw-style strip at the top of the canvas (selection mode, category picker, the category's first 12 tiles, and a More button whose popover, hung from the button, holds the full category; a far-right Search popover finds any element type, other modes' in a closed accordion). The top-left menu button opens the Explorer as a popover; Layers and Collaborate are popovers over their bottom-row buttons; every other panel docks in its corner. The retired Floating layout and `panelLayout` preference
- ./ui-scale.md - when working on UI scale: the Appearance sliders (80% to 120%, 100% in the middle, desktop only) that scale the panels, the toolbar and the bottom-right corner buttons with CSS `zoom`, together or each on its own, and nothing else
- ./power-user-mode.md - when working on Power user mode: a preset of recommended settings that restores untouched ones when switched off, power-user-only settings such as Minimal chrome (hide captions, titles and hints, keep controls), and the once-ever offer
- ./editor-modes.md - when working on the editor mode: Plan as the one mode, where the mode is still named, retired modes and their stored ids, the one look, text box sizing
- ./blueprints/README.md - when implementing an editor spec from its blueprint (appearance, power user mode, UI scale, load recovery)
