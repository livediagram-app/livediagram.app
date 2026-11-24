# Tool panels as phone drawers: blueprint

Derived from [phone-drawers.md](../phone-drawers.md). The spec decides; this file only adds engineering precision.
Paths are relative to the repository root.

| File                                                                | Role                                                                                                     |
| ------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `packages/workbench/src/components/primitives/PhoneDrawer.tsx`      | The drawer: Portal, scrim, `SheetHandle` + `useSheetDrag`, `useFocusTrap`, Escape, `safeInset('bottom')` |
| `packages/workbench/src/components/primitives/PopoverOrSheet.tsx`   | Popover from the phone breakpoint up, `PhoneDrawer` below it (Tools, Get Started, livehuddle's Timer)    |
| `packages/workbench/src/components/primitives/MovablePanel.tsx`     | `asPopover` below the phone breakpoint renders through `PhoneDrawer` (every editor's cluster popovers)    |
| `livehuddle/apps/editor/components/canvas/collab/TimerLengthPopover.tsx` | The Timer's length through `PopoverOrSheet`                                                         |

## PhoneDrawer

- Props: `name` (its accessible name; `labelledBy` names a heading instead), `onClose`, `layer` (`popover`, the
  default, draws at `--z-popover`; `modal` at `--z-modal`, so the menus, confirms and dialogs a panel opens, portalled
  after it at the same layer, draw over it), `hidden` (open but out of sight: `invisible`, the trap off), `onEscape` and
  `passEscape` (a host's drill-in levels), `ref` (the sheet element, for a host's own outside-press and key hooks),
  `attrs` (`data-*` on the sheet), `children` (laid out as a column).
- The scrim comes first, the sheet after it, both portalled. The scrim takes the press (`pointerdown`
  stopped, `mousedown` default prevented) and closes on the `click`, so the press never reaches the canvas.
- The sheet is `role="dialog"` `aria-modal="true"` `tabIndex={-1}`, `fixed inset-x-0 bottom-0 mx-auto max-w-lg`,
  `max-h-[85dvh]`, `rounded-t-2xl`, opaque; `pointerdown` and `contextmenu` stop there.
- Escape: a `keydown` listener on `window` in the capture phase, so it runs before the editors' own (deselect) and
  `useDockPopoverKeys`. It skips an event already handled, one `passEscape` passes, and one whose focus sits outside
  the sheet (in a menu or dialog the panel opened); else it takes it (`preventDefault`, `stopImmediatePropagation`),
  asks `onEscape`, then closes.
- `useFocusTrap(ref, !hidden)` places focus (the container on a coarse pointer) and wraps Tab; on unmount it returns
  focus to the opener.

## MovablePanel

- `drawer = asPopover && !popoverSheet && useIsMobileViewport()`. The header and body are built once and framed by
  either the anchored popover or `PhoneDrawer` (`layer="modal"`, `ref` the panel's ref, `data-floating-panel`, the
  title as its name or the hero's `<h2>` as its label).
- In the drawer: no pointer arrow, no popover width, no UI-scale zoom (the phone's own size), no panel translucency;
  the hero header takes `underHandle`; `useClickOutside` is off (the scrim closes it); the toast floor stays
  (`data-toast-floor`), so a toast stands on the drawer rather than covering it.

## Tests

- `PhoneDrawer.test.tsx`: the dialog's name, scrim click closes (and the press is stopped), Escape closes, Escape with
  focus in a portalled menu does not, `onEscape` and `passEscape`, Tab wraps, `hidden`.
- `MovablePanel.drawer.test.tsx` (workbench): on a phone the popover is a drawer (handle, scrim, no arrow, hero under
  the handle) and the scrim closes it; on a desktop it is the anchored popover with its arrow, no scrim; a
  `popoverSheet` panel stays a sheet.
- livehuddle `TimerLengthPopover.test.tsx`: a drawer on a phone, the anchored popover on a desktop.
