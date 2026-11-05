# Editor

Follow the references below only as needed; never upfront.

- ./editor-app.md - when working on Editor app: The diagram editor app (clean routes, no `/live` prefix)
- ./load-recovery.md - when working on a document that will not load: the load's watchdog and time limits, the opening screen's self-healing reload, the load-error screen's recovery card (Copy Diagnostics, Repair This Browser), what a repair clears and keeps, and the help centre's Repair page
- ./start-diagramming.md - when working on an empty tab's template start (Start a Space, on StartPanel): when it shows, Recommended and groups, search, the palette tray's Show Templates, the tours waiting, its look
- ./new-document-route.md - when working on Dedicated route for new-document creation: The welcome / create-new flow at `/new`, split from the editor
- ./templates-by-mode.md - when working on which templates Start a Space holds and how they are grouped, the blank, or the mode every template opens in (Workshop)
- ./user-preferences.md - when working on User preferences: Per-user editor preference flags (footer settings dialog)
- ./split-view.md - when working on Side by side tabs: dragging a tab to the right edge to open it beside the active tab, each tab keeping its side under one header, the editor following a click or a resting pointer between panes with no view jump, the live other pane, the drop zone and ghost, resizing, persistence
- ./panel-docking.md - when working on Panel corner docking: Choose which corner each corner panel (Minimap, Poll, tool panels) sits in: desktop drag with snap-to-corner guides, free drop kept where released, stacking + reflow within a corner, device-local localStorage layout
- ./command-palette.md - when working on Command palette (⌘K): Cmd/Ctrl+K opens the Search panel; the Actions command registry widens to app-level verbs (undo/layout/dialogs) + a view-safe read-only subset
- ./editor-tour.md - when working on the footer's Start Tour button every tour starts from (left of Search, the most specific tour on offer, never offering itself) and what every tour shares: the engine, the stage, the card, the spotlight, how a step reads and moves, dialogs first, the look
- ./element-tours.md - when working on element tours: the tour of one complex element type (the Timeline, charts, stack, lane, boundary, diagram key, portal), on the footer's Start Tour button while such an element is selected, its steps on the real element, its menu steps opening the element's menu, the Show Me closed section in Settings, share roles and telemetry
- ./show-me.md - when working on Show Me: the on-demand guided tour of one surface (Share and Tab Style dialogs), its button beside Help, live controls, Escape, telemetry tokens, and how to add one to a new surface
- ./toolbar-layout.md - when working on Toolbar layout: The editor's one panel layout, on every device: the Palette as one Excalidraw-style strip at the top of the canvas (selection mode, category picker, the category's first 12 tiles, and a More button whose popover, hung from the button, holds the full category; a far-right Search popover finds any element type). The top-left menu button opens the Explorer as a popover; Collaborate is a popover over its bottom-row button; every other panel docks in its corner. The retired Floating layout and `panelLayout` preference
- ./ui-scale.md - when working on UI scale: the Appearance sliders (80% to 120%, 100% in the middle, desktop only) that scale the panels, the toolbar and the bottom-right corner buttons with CSS `zoom`, together or each on its own, and nothing else
- ./power-user-mode.md - retired (Work Tracker #500): what Power user mode and Minimal chrome were, and what happens to their stored keys
- ./editor-modes.md - when working on editor modes: Workshop is the one mode, every tab is in it, there is no switch; how a stored mode from another product reads, kinds versus modes, the one palette layout
- ./blueprints/README.md - when implementing an editor spec from its blueprint (appearance, the role pill, UI scale, load recovery, editor modes)
