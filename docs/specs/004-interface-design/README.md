# Interface design

Follow the references below only as needed; never upfront.

- ./color-scheme.md - when working on Theme: Brand color and visual design tokens
- ./fonts.md - when working on Fonts: Eleven Google Fonts, pickable per element + as a per-tab default
- ./canvas-accessibility.md - when working on Canvas accessibility baseline: Baseline canvas a11y: Tab/Shift+Tab element traversal (selection as focus), aria-labels on element views, SR-only polite live region for selection/delete/undo
- ./flyout-height-stability.md - when working on Menu flyouts must not resize under the pointer: Context-menu side flyouts must not change height in response to hovering inside them: a growing panel slides its own edge past a stationary pointer, fires pointer-leave dismissal, reverts the preview, shrinks back and reopens. The Markers Size row now always renders (inert until a marker is set), backed by MenuFlyoutSection's settle window
- ./motion.md - when adding or changing any chrome transition or animation: the 250ms ceiling, 150ms hovers, cascades, motion tokens, and which motion is canvas, content, ambient or a timer
- ./blueprints/README.md - when implementing a 004-interface-design spec: engineering detail derived from the specs
- ./tooltips-hover-cards-popovers.md - when adding a hover or focus hint, a `title`, or a click-opened panel: Tooltip (name, 1 s), Hover card (title + description, instant), Popover (click, interactive), and their WCAG 1.4.13 behaviour
- ./blueprints/README.md - when implementing a 004-interface-design spec: engineering detail derived from the specs
- ./dropdown-tile-grid.md - when working on Tile grids for the palette dropdowns: The canvas-tool and palette-category pickers lay their options out as an icon-over-label tile grid instead of a long column, matching the context menus' MenuTileGrid
- ./scrollbars.md - when anything scrolls: the themed scrollbar is the default everywhere, one slim variant, and the thumb contrast rule
