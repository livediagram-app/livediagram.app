# From new to first edit: blueprint

Derived from [first-edit.md](../first-edit.md). The spec decides; this file only adds engineering precision. Paths are
relative to the repository root; `<editor>` is `apps/editor` in every product but livedesign (`apps/live`).

## Files

| File                                                           | Role                                                                                                                         |
| -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `packages/workbench/src/lib/name-card.ts`                      | The name card's one flag (`askNameCard`, `closeNameCard`, `useNameCardAsked`) and the pure `nameChoiceViews(offered, asked)` |
| `packages/workbench/src/components/chrome/NameTray.tsx`        | The name tray: `PaletteTray` under the strip, else a top-centre `PaletteTrayCard` (`data-name-tray`)                         |
| `packages/workbench/src/components/chrome/PaletteTray.tsx`     | `PaletteTrayCard` exported; the `first` prop marks a tray `data-standing-first`                                              |
| `packages/workbench/src/components/canvas/EmptyCanvasCard.tsx` | `EmptyCanvasCard`, `EmptyCanvasArtFrame`, `EMPTY_CARD_VIEWER_LINE`                                                           |
| `<product>/<editor>/components/canvas/EmptyCanvasBanner.tsx`   | Each product's card: its picture and line over `EmptyCanvasCard`                                                             |
| `<product>/<editor>/app/globals.css`                           | `body:has([data-standing-first]) [data-yields-to-mode]:not([data-standing-first])` hides the other standing trays            |

## Behaviour and state

- **The offer.** Each editor already computes `joinScreenOpen` (livediagram: `nameOffered`): not an embed or a
  workbench, hydrated, an existing item loaded, the name not confirmed and the arrival's `identityPromptOpen` set
  (`editor-arrival.ts`, `useIdentityBootstrapCore.ts`). That gate is unchanged; it now feeds
  `nameChoiceViews(offered, useNameCardAsked())`, which returns `{ card, tray }`.
- **Where it is computed.** livediagram and livehuddle: `useEditorDialogs.ts`; livedocuments, livedesign, liveplanner,
  liveknowledge: `useEditorComments.ts` (with `identityTrayOpen` on `editor-view.ts`). `card` is the old
  `identityOnlyScreenOpen` (it hides the chrome, as the Join card did); `tray` is the new `identityTrayOpen`.
- **The props.** `EditorCanvasHost` passes `showIdentityTray` to `CanvasChrome` (on `Canvas.types.ts`; in
  livedocuments and liveknowledge also on `canvas-chrome-props.ts`'s pick list). `CanvasChrome` renders
  `<NameTray>` while `showIdentityTray && !identityLockedName` (a signed-in visitor's name is locked), wiring Change
  Name to `askNameCard` and Keep It to the existing `onCancelIdentity` (confirms the name as it is).
- **The card.** `IdentityPrompt` is unchanged; its `onJoin` and `onCancel` call `closeNameCard()` before the
  product's handler, so the flag never outlives the card.
- **The empty-canvas card.** livediagram and livehuddle keep their gate (`EmptyCanvasBanner` in their canvas). The
  others render it from their start panels where the start would show for an Editor:
  livedocuments and liveknowledge `emptyCardShownOf(editor)` (`useTemplateStartShown.ts`), livedesign
  `useEmptyCardShown()`, liveplanner `showEmptyCard` (`EditorStartPanels.tsx`). A Participant's line is chosen by
  `ctx.can.level === 'participate'` where the product has one.

## Performance and limits

- The flag is one module boolean with a listener set: a press notifies only the mounted readers, and a repeat press or
  a close with nothing open notifies none.
- `NameTray` and the per-product banners are `next/dynamic` (`ssr: false`) in `CanvasChrome` or the start panels: no
  bytes for an owner's first load beyond the import stub.

## Accessibility

- The tray is `role="status"`; on a phone its sentence is `sr-only`, the two actions stay. Its actions are buttons
  with their visible names.
- The empty card is `role="region"` named "<Tab> is empty"; its × is "Close" with a 44 px tap area (`touch-target`).

## Testing

- `name-card.test.ts`, `NameTray.test.tsx`, `EmptyCanvasCard.test.tsx` (held at 100% in `vitest.config.ts`).
- Each product's `e2e/contrast-audit.spec.ts` and `e2e/optical-audit.spec.ts` press Change Name before the card's
  Join; livehuddle's `spaces-walk.spec.ts` presses the tray's Keep It.
