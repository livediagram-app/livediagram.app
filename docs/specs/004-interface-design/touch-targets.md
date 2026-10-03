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
  its own `absolute`).
- **`touch-target-y` for packed rows.** Where neighbours sit closer than 44px apart (the palette
  strip's tiles, 2px apart) the pad reaches vertically only, so two pads never compete for one tap.
  The toolbar cards apply it to their 36px items (`PHONE_TOOLBAR_ITEMS`).
- **Shared controls carry it**, so every caller does: the chrome buttons (`CHROME_BTN`), the
  `⋯` triggers (`EllipsisTriggerButton`, the tab menu), the help `?` (`HelpArticleLink`), panel
  header buttons (`MovablePanelHeader`, `SettingsPopover`), search clear and dismiss buttons, and
  Add tab. Resize handles have their own 16px pad on a coarse pointer (canvas element parts).
- **Toolbars keep their drawn sizes on a phone:** 36px items, the bottom-right cluster's 44px.
  Fitting more tiles is the strip's swipe's job ([Toolbar layout](../007-editor/toolbar-layout.md)),
  not smaller targets.

## Non-goals

- Growing controls visually on touch. A bigger drawn button is a layout change per surface; the
  pad gets the tap area without one.
