# Interface design

Follow the references below only as needed; never upfront.

- ./design-principles.md - before designing any screen: the principles every interface decision answers to
- ./appearance.md - when touching light / dark / system: one origin-wide setting, the no-flash boot script, the header toggle
- ./color-scheme.md - when working on Theme: Brand color and visual design tokens
- ./fonts.md - when working on Fonts: Eleven Google Fonts, pickable per element + as a per-tab default
- ./canvas-accessibility.md - when working on Canvas accessibility baseline: Baseline canvas a11y: Tab/Shift+Tab element traversal (selection as focus), aria-labels on element views, SR-only polite live region for selection/delete/undo
- ./layout-stability.md - when any chrome changes state (a status label, a button label, a badge, a count, a notice, a loading state): zero layout shift, reserve the longest variant, badges overlay, optimistic states, how to test it
- ./flyout-height-stability.md - when working on Menu flyouts must not resize under the pointer: Context-menu side flyouts must not change height in response to hovering inside them: a growing panel slides its own edge past a stationary pointer, fires pointer-leave dismissal, reverts the preview, shrinks back and reopens. The Markers Size row now always renders (inert until a marker is set), backed by MenuFlyoutSection's settle window
- ./motion.md - when adding or changing any chrome transition or animation: the 250ms ceiling, 150ms hovers, cascades, motion tokens, and which motion is canvas, content, ambient or a timer
- ./tooltips-hover-cards-popovers.md - when adding a hover or focus hint, a `title`, or a click-opened panel: Tooltip (name, 1 s), Hover card (title + description, instant), Popover (click, interactive), and their WCAG 1.4.13 behaviour
- ./menus.md - when building or changing any menu: command menus (role menu, roving keys, typeahead, submenus) vs control menus (non-modal dialog), focus in and back, the inset focus ring
- ./within-reach.md - when a surface offers a short "what you want next" list: N most used plus N recent, none twice (Jump back in, Shape slots)
- ./blueprints/README.md - when implementing a 004-interface-design spec: engineering detail derived from the specs
- ./dropdown-tile-grid.md - when working on Tile grids for the palette dropdowns: The canvas-tool and palette-category pickers lay their options out as an icon-over-label tile grid instead of a long column, matching the context menus' MenuTileGrid
- ./iconography.md - when drawing, adding or changing any icon: Lucide vocabulary, 1.5px on-screen weight, one home, icon weight on canvas
- ./optical-alignment.md - when a letter, numeral, initials, caps label or icon sits in a circle, chip, badge or tile, or icons stack over labels in a row
- ./counts.md - when a label shows how many of something: a count is a badge (CountBadge, or AccentBar's count on the canvas), never a number in brackets
- ./touch-targets.md - when adding a small control: the 44px tap area on touch screens, `touch-target` / `touch-target-y`, and which shared controls carry it
- ./scrollbars.md - when anything scrolls: the themed scrollbar is the default everywhere, one slim variant, and the thumb contrast rule
