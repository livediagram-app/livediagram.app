# The close button: blueprint

Derived from [The close button](../close-button.md). Paths start at the repo root.

## The component

`packages/ui/src/dialog/DialogCloseButton.tsx`, exported as `DialogCloseButton` from `@liveworkspace/ui` (and through
each product's `@<product>/ui` and the Explorer's `ui/Dialog.tsx`, which re-exports it):

- Props: `onClick`, `label` ("Close" unless given), `tone` (`light`, the default, or `dark` over a dark bar).
- `size-11 rounded-full`, the lucide X at 18 px. The light well is `bg-slate-900/[0.055]` (hover `/10`, pressed
  `/15`), dark mode `bg-white/[0.08]` (hover `/[0.14]`, pressed `/20`); text slate-700, dark slate-200. The dark tone
  is `bg-white/10` (hover `/20`, pressed `/25`) in white. `focus-visible:outline-brand-600`, `cursor-pointer`,
  `motion-reduce:transition-none`. `data-dialog-close` marks it.
- Wrapped in the shared `Tooltip` with its label.
- Closes through `useDialogDismiss()` (a phone sheet slides out first); `useDialogInline()` (a dialog drawn in Tools)
  renders nothing.
- The old `compact` shape is gone: every caller draws the one circle.

## Header rows

- `DialogHeader` (`packages/ui/src/dialog/DialogHeader.tsx`): the actions slot is `-my-2` (a 28 px title line) and
  `gap-1`, so the 44 px circle centres on the title without growing the row.
- The Explorer's `DialogHeader` (`packages/explorer/src/ui/Dialog.tsx`): `-my-2.5` (a 24 px title line).
- Hand-built rows (IdentityPrompt in each editor, liveknowledge's AssignActionDialog) wrap it in `-my-2`.
- `HeroDialogHeader` already centres its actions down its 100 px band. Headers that set `--hero-centre-end` grew by
  1.5rem, the circle's extra width: Settings with its switch 18.5rem, Automations with GitHub 19.5rem, Upgrade
  15.5rem, the tile picker 6rem.
- Tools (`ToolsView.tsx`) and Get Started (`GetStartedPopover.tsx`) pin the close in the corner: their hero headers
  keep `max-sm:pr-16` so a phone's title stops short of it.
- The start panel (`packages/workbench/src/components/start/StartPanel.tsx`): Help and the close sit `right-3`,
  centred down the band from `sm` (`sm:top-1/2 sm:-translate-y-1/2`), beside the title's row on a phone; the header
  keeps `pr-28` and the title row `max-sm:pr-24`.
- Version History (livedocuments, liveknowledge): its bar is `h-14` for the circle, which leads it.

## The guard

`packages/ui/src/dialog/close-button-guard.test.ts` reads every `.tsx` under `packages`, `liveworkspace/apps` and each
product's `apps`. A file that draws a modal, a sheet or a drawer (`<Dialog`, `<HeroDialogHeader`, `<DialogHeader`,
`<PhoneDrawer`, `<BottomSheet`, `<SheetHandle`, `aria-modal`, `useModalGuard(`, `useSheet(`) and also names a button
"Close" or "Close <what>" fails, unless it is on the allow list with why (the search panels' Esc key, livehuddle
ReaderShell's backdrop, Page Info's popover card, the widget gallery's popover header). A second test fails an
allowed file that no longer has what it was allowed for. Popovers (`role="dialog"` without `aria-modal`) are not
modals and are not read.

`<product>/packages/ui/src/touch-targets.test.tsx` holds the circle's `size-11 rounded-full`.

## Performance

No new work on a hot path: one `Tooltip` (its hint hook, idle until hovered) per open dialog's close. The glyph is a
module constant. No bundle growth beyond the Tooltip every dialog already loads with `@liveworkspace/ui`.
