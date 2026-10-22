# Touch targets

Status: shipped

## What

On a touch screen every control has a tap area of at least **44 × 44px**, the size Apple's Human
Interface Guidelines set (44pt) and WCAG 2.5.5 (Target Size, AAA) asks for. WCAG 2.5.8 (AA) sets the
floor at 24px; the editor aims past it, because a diagram editor is used with a thumb on a phone.

## How

- **The tap area grows, not the control.** `touch-target` (shared theme, `packages/tailwind-config`)
  draws an invisible `::before` that reaches past a smaller box to 44px each way, only under
  `(pointer: coarse)`; a box already 44px or more is left alone. The control keeps its drawn size,
  so a dense desktop layout and a phone share one design. The host is positioned (`relative`, or
  its own `absolute`): a static host's pad fills its nearest positioned ancestor and takes every tap
  there (a Plan column's Remove Column once took every tap in its popover). A static guard
  (`touch-target-guard` in `packages/tailwind-config`, run by each site's `touch-target-guard.test.ts`)
  fails a class list that names either utility without a position.
- **`touch-target-y` for packed rows.** Where neighbours sit closer than 44px apart (the palette
  strip's tiles, 2px apart) the pad reaches vertically only, so two pads never compete for one tap.
  The toolbar cards apply it to their 36px items (`PHONE_TOOLBAR_ITEMS`).
- **Shared controls carry it**, so every caller does: the chrome buttons (`CHROME_BTN`), the
  `⋯` triggers (`EllipsisTriggerButton`, the tab menu), the help `?` (`HelpArticleLink`), panel
  header buttons (`MovablePanelHeader`, `SettingsPopover`), the dialog close in both shapes
  (`DialogCloseButton`), search clear and dismiss buttons, and Add tab. Resize handles have their
  own 16px pad on a coarse pointer (canvas element parts).
- **Every canvas toolbar pads its items.** The Palette strip, the Draw dock's pills (`DockToolbar`)
  and the menu button's own card in Draw (`ToolbarExplorerButton`) all carry `PHONE_TOOLBAR_ITEMS`;
  the selection toolbar's 32px buttons (`SelectionPopover`) get `touch-target-y`, as do the tab pill,
  the role pill (Editing / Viewing), the tour card's buttons and a page's lock and cog.
  The Plan cogs (a column's, Board Settings, a Sheet's) and the empty-tab card's close take the
  full `touch-target`.
- **A phone sheet's grab handle** (BottomSheet, Dialog's `phoneSheet`, the start panels) is one shared strip,
  `SheetHandle`: the sheet's full width and 32px tall (`SHEET_HANDLE_PX`), its pill 48 by 6px, so a thumb finds it
  without aiming for the pill. A pad cannot reach above it, where the sheet's edge clips it.
- **Padding where a pad would be clipped.** A `truncate` box or a horizontal scroller clips its own
  `::before`, so there the control grows by padding instead (`pointer-coarse:py-*`, with a matching
  negative margin where the line must not move): the document title in the editor header, the
  breadcrumb links, and the telemetry view tabs and their arrows.
- **A list's rows abut at 44px.** Where links or rows stack closer than 44px, a pad would overlap the
  next row's, so on a touch screen each row is 44px tall and the list drops its gap: the Explorer tree
  (`SidebarRow`, its chevron moved to the row's end as a 44 px disclosure the row's full height), the site footer's columns, a story beat's
  highlights on the landing page, and the help centre's contents and Learn More lists. The list grows
  taller on a touch screen; under a mouse it keeps its compact rhythm. The Explorer tree's words and icons grow with
  it (15 px words on a 20 px line, 17 px icons, a group keeping 8 px rather than 20 px above its title), so the taller
  rows read as a phone's list rather than small words far apart.
- **Nothing waits for a hover on a touch screen.** A control that appears on hover (a row's delete, a card's edit, a
  theme card's actions, a Dashboard's grip, dividers and row handle) is shown there all the time
  (`[@media(hover:none)]`), quietly where it would crowd. A canvas comment bubble's quick delete stays hover-only:
  shown on every bubble it would invite a mistaken tap, and the open thread offers Delete.
- **Keyboard hints are not drawn on a touch screen.** A tile's always-on shortcut letter (the Palette
  strip, the Draw dock and its flyouts, a picker's corner key) teaches a key there is no keyboard to
  press, so it carries `pointer-coarse:hidden`; `aria-keyshortcuts` stays for a paired keyboard.
- **Text fields are 16px on a touch screen.** iOS zooms the page into any focused field under 16px and
  leaves it zoomed, so a search box drawn at 14 or 15px reads at 16px under `pointer: coarse` (the
  landing page's template search).
- **The public sites follow the same rules** (marketing, help, telemetry): the shared header's
  brand, apps menu and primary CTA pad vertically; the hero's example dots are 44px tall and 24px wide
  and its arrows padded; the template carousel arrows and the telemetry window pills are padded.
- **A scroller holding padded controls scrolls on its own axis only.** The pad is an absolutely
  positioned box, so it counts toward its scroll container's overflow; a container that sets
  `overflow-x: auto` gets `overflow-y: auto` too and scrolls (and draws a scrollbar) by the few
  pixels a pad reaches past it. Such a scroller hides its other axis (`overflow-y-hidden` on the
  tab bar's tab row and the strip's rail, `overflow-x-hidden` on the Explorer tree), which clips
  the pads at that edge by a few pixels.
- **Toolbars keep their drawn sizes on a phone:** 36px items, the bottom-right cluster's 44px.
  Fitting more tiles is the strip's swipe's job ([Toolbar layout](../007-editor/toolbar-layout.md)),
  not smaller targets.

## Non-goals

- Growing a lone control visually on touch. A bigger drawn button is a layout change per surface;
  the pad gets the tap area without one. Only stacked rows grow (above), because there the pad has
  nowhere to reach.
