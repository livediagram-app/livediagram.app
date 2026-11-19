# Tab Style on pages blueprint

Derived from [Tab Style dialog](../canvas-and-theme-dialog.md) "Looks", "New Page Background", "Element colours",
"Previews", "One dialog, this editor's profile", and [Pages](../../007-editor/pages-mode.md) "The tab's own New Page
Background".

## Domain and naming

| Term                | Identifier                                                                                     | Where                                                                                               |
| ------------------- | ---------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| New Page Background | `Tab.newPageBackground: PageBackground` (`{}` the chosen paper)                                | `packages/design/src/tab-type.ts`                                                                   |
| Read and set it     | `newPageBackgroundOf(tab)`, `withNewPageBackground(tab, patch\|null)`                          | `packages/design/src/tab-new-page-background.ts`                                                    |
| Apply to Every Page | `pagesGivenNewPageBackground(tab, memory?)`                                                    | `packages/design/src/pages-background-copy.ts`                                                      |
| Element Colours     | `Tab.keepElementColours?: boolean` (`true` stored), `ThemeApplyOptions { keepElementColours }` | `packages/design/src/tab-type.ts`, `apps/live/lib/tab-theme-apply.ts`                               |
| Finished-art filter | `HAND_DRAWN_FINISHES`, `suitsFinishedArt`                                                      | `apps/live/lib/tab-looks.ts`                                                                        |
| The dialog's pages  | `TabStylePages`, `TabStylePagesContext`                                                        | `apps/live/components/dialogs/tab-style-pages.ts`                                                   |
| The panel, the row  | `NewPageBackgroundPanel`, `ElementColoursRow`                                                  | `apps/live/components/dialogs/`                                                                     |
| The sample frame    | `framePreviewSvg`, `FRAME_PREVIEW_SIDES` (560 x 320)                                           | `apps/live/lib/frame-preview.ts`                                                                    |
| The row's value     | `newPageBackgroundLabel` over the shared one                                                   | `apps/live/lib/new-page-background.ts`, `packages/page-background/src/new-page-background-label.ts` |

## Behaviour and state

- `pageAppended` (`pageAdded`, `pageAddedLike`) and the wireframe add start on `startingBackground`: the tab's own,
  else the page before's, then `carriedBackground` narrows it for the kind (a logo page's fill alone).
- `withPageKindChosen` gives the first page the tab's own when the page has none and the tab's has a part.
- `pagesGivenNewPageBackground` walks `pageUnits`, passes a photo page, patches with `backgroundPatchFor`, counts a
  refused (locked) page as skipped, inks once.
- `withPageBackgroundsFollowingTheme` follows the field's fill first (`followedFill`).
- `withThemeApplied(source, id, appearance?, options?)`: arrows follow `switchThemeElements`' preserve-customs rule
  (no `resetArrowsToTheme`); with `keepElementColours` the elements stay, the backdrop switches as ever (a theme that
  no longer resolves takes the new theme's backdrop outright) and the pages follow the theme.
- `withLookApplied(tab, look, options?)` picks between two `createTabLooks` instances, the second applying the theme
  with `keepElementColours`.
- `CanvasThemeDialog` reads `keepElementColours` from `pages` (the active tab's field, `EditorModals`) and wraps
  `onSetTheme` and `onApplyLook` with it; `ElementColoursRow` sets it through `pages.onSetKeepElementColours`
  (`useTabCanvas.setKeepElementColours`: one `commitTabs` step, `true` stored, Follow the Theme clears the key,
  refused while `editsBlocked`). `useTabTheme.setTheme` and `useTabCanvas.applyTabLook` take the options, and
  without them follow the tab's own field.
- `withStyleOfTab(target, source)` applies `source`'s theme under `source.keepElementColours`, then copies
  `TAB_STYLE_KEYS` (which name `keepElementColours`). `import-merge.ts` keeps an imported tab's field.
- `useTabCanvas`: `setNewPageBackground`, `applyNewPageBackgroundToEveryPage` (notice by `everyPageMessage`).

## Interfaces and contracts

- `EditorModals` passes `pages` (memoised over the active tab, the page kind and the setters) and
  `surface={pageKind ?? 'canvas'}`.
- The OpenAPI `Tab` schema carries `newPageBackground` and `keepElementColours` (regenerated, `gen:openapi`).

## Data and persistence

- Tab keys (`newPageBackground`, `keepElementColours`); no D1 change. `TAB_STYLE_KEYS` copies both on Apply to All
  Tabs. `keepElementColours` rides the generic `tab-meta` patch, the save and the rebase as every tab key does.

## Performance and limits

- The frame is one page export per change of background, theme, finish, font or size (`useMemo`), the cost of the
  old sample. Apply to Every Page is one walk and one ink pass, on a press.

## Testing

- `packages/design/src/tab-new-page-background.test.ts`; `apps/live/lib/tab-looks.test.ts`, `frame-preview.test.ts`,
  `tab-theme-apply.test.ts`, `page-theme-follow.test.ts`; `hooks/canvas/useTabCanvas.test.ts`;
  `components/dialogs/CanvasThemeDialog.test.tsx` (looks, the finished-art filter, Element Colours, the panel, the
  photo page, the frame).
