# Editor

Follow the references below only as needed; never upfront.

- ./editor-app.md - when working on the editor app: the planner's routes (clean, no `/live` prefix), layout, role pill, selection lock, share dialog, mobile chrome
- ./editor-modes.md - when working on the editor mode: Plan as the one mode, where the mode is still named, retired modes and their stored ids, the one look, text box sizing
- ./start-panel.md - when working on the start panel an empty tab shows (StartPanel, drawing Start Planning): the panel, Best Match, its keyboard, when it shows, search handed over from /new, its look
- ./new-project-route.md - when working on `/new`: creating a project and landing on Start Planning
- ./templates-by-mode.md - when working on which templates are Plan's (isPlanTemplate), the blanks, hidden templates, Popular, and the names a template gives its tab and project
- ./load-recovery.md - when working on a project that will not load: the load's watchdog and time limits, the opening screen's self-healing reload, the load-error screen's recovery card (Copy Diagnostics, Repair This Browser), what a repair clears and keeps, and the help centre's Repair page
- ./user-preferences.md - when working on user preferences: per-user editor preference flags and the Settings dialog
- ./power-user-mode.md - when working on power user mode: a preset of recommended settings that restores untouched ones when switched off, power-user-only settings such as Minimal chrome, and the once-ever offer
- ./ui-scale.md - when working on UI scale: the Appearance sliders (80% to 120%, desktop only) that scale the panels, the toolbar and the bottom-right corner buttons with CSS `zoom`
- ./command-palette.md - when working on the command palette (⌘K): the Search panel and the Actions command registry
- ./split-view.md - when working on side by side tabs: dragging a tab to the right edge to open it beside the active tab, following a click between panes, resizing, persistence
- ./zen-mode.md - when working on zen mode: hide all chrome, keep the tab and zoom
- ./panel-docking.md - when working on panel corner docking: which corner each corner panel (Minimap, tool panels) sits in, drag with snap-to-corner guides, stacking, device-local layout
- ./toolbar-layout.md - when working on the editor's one layout: the menu-button Explorer, the bottom-right cluster, popovers, phones; also the unmounted Palette strip whose code remains
- ./editor-tour.md - when working on the editor's tours: the shared engine (steps that open what they explain, the spotlight, motion, mechanics, look, share roles) and the retired Diagram tour
- ./show-me.md - when working on Show Me: the on-demand guided tour of one surface (card type editor, Share dialog, Dashboard Settings), its button, telemetry tokens, and how to add one
- ./element-tours.md - when a code comment cites element tours: removed with the diagram elements; what is left of the Sankey Show Me
- ./blueprints/README.md - when implementing an editor spec from its blueprint (appearance, power user mode, UI scale, load recovery)
