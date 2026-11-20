# Tab Style on pages blueprint

Derived from [Tab Style dialog](../canvas-and-theme-dialog.md) "Looks", "Previews", "New Page Background", "One
dialog, this editor's profile", "Articles", and [Pages mode](../../007-editor/pages-mode.md) "A new page's
background".

## Domain and naming

| Term                | Identifier                                                                   | Where                                                                       |
| ------------------- | ---------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| New Page Background | `Tab.newPageBackground: PageBackground` (`{}` the chosen paper)              | `packages/document/src/tab-type.ts`                                         |
| Read it             | `newPageBackgroundOf(tab)`: undefined, `{}`, or fill and pattern             | `packages/document/src/tab-new-page-background.ts`                          |
| Set it              | `withNewPageBackground(tab, patch \| null)`                                  | same                                                                        |
| Apply to Every Page | `pagesGivenNewPageBackground(tab, memory?, reaches?)`                        | `packages/document/src/pages-background-copy.ts`                            |
| A look's pages      | `withLookPageBackground(tab, background, theme, memory?)`                    | same                                                                        |
| A look's background | `TabLook.page: { fill?: ThemeGradientName; pattern? }`, `lookPageBackground` | `apps/editor/lib/tab-looks.ts`                                              |
| The dialog's pages  | `TabStylePages`, `TabStylePagesContext`                                      | `apps/editor/components/dialogs/tab-style-pages.ts`                         |
| The panel           | `NewPageBackgroundPanel`, `AROUND_THE_PAGES_PATTERNS`                        | `apps/editor/components/dialogs/NewPageBackgroundPanel.tsx`                 |
| The sample page     | `pagePreviewSvg`, `TabStylePreview`, `previewPageBackground`                 | `apps/editor/lib/page-preview.ts`, `components/dialogs/TabStylePreview.tsx` |
| The Article row     | `ArticleStyleRow`                                                            | `apps/editor/components/dialogs/ArticleStyleRow.tsx`                        |
| The row's value     | `newPageBackgroundLabel`                                                     | `apps/editor/lib/new-page-background.ts`                                    |

## Behaviour and state

- `newPageBackgroundOf`: a non-object (or array) is undefined; an object parses through `parsePageBackground`, an
  image fill dropped; an object with neither part is `{}`.
- `withNewPageBackground`: `null` removes the field (the same tab when absent); a patch spreads over the current one
  and re-reads it; the same tab when the result equals the current.
- `pageAppended` (both `pageAdded` and `pageAddedLike` reach it) starts on `startingBackground`: the tab's own (none
  for `{}`), else the page before's. `withDefaultPageBackgrounds` gives the tab's own to every named page of any kind
  without a background (an article and a card included), and nothing for `{}`; without one, its old rule.
- The editor's `page-edits` runs `themed` after every kind choice and add, so a first article or card takes it.
- `withPageBackgroundsFollowingTheme` first follows the field's fill (`followedFill`), then the pages.
- `pagesGivenNewPageBackground` walks `pageUnits`; an article unit takes `{ fill }` only; a refused unit (locked)
  adds its pages to `skipped`; inks gathered and inked once.
- `withLookPageBackground` replaces the field, then reaches the units whose first page's fill equals the old field's
  fill, or, with none, is absent or `isThemeOwnFill(fill, theme)`.
- The editor's `withLookApplied` is the shared apply, then `withLookPageBackground` when `lookPageBackground(look)`.
- `useTabCanvas`: `setNewPageBackground(patch | null)` one `commitTabs` step; `applyNewPageBackgroundToEveryPage()`
  counts units and locked units from the active tab, commits, remembers ink memory, notifies `everyPageMessage`.

## Interfaces and contracts

- `CanvasThemeDialog` takes the shared props and `pages: TabStylePages`, provides `TabStylePagesContext` and passes
  `canvasSummary` from `newPageBackgroundLabel`.
- `EditorModals` builds `pages` in a `useMemo` over the active tab, the page kind and the setters;
  `onOpenArticleStyle` only for `article`: closes the dialog, then `requestStylePanel(currentPageIdNow())`.
- The OpenAPI `Tab` schema carries `newPageBackground` (regenerated, `gen:openapi`).

## Data and persistence

- The field rides the tab body and `tab-meta` patches as any tab key; no D1 change (documents live in Durable
  Objects). An old client ignores it; a tab without it behaves as before. `TAB_STYLE_KEYS` copies it on Apply to All
  Tabs.

## Errors and edge cases

- A stored picture is dropped on read; junk reads as none. `{}` is never confused with none.
- A locked tab takes no edit (`commitTabs` refuses through `editsBlocked`); locked pages are counted and kept.

## Performance and limits

- The dialog's `pages` value is memoised; `pageUnits` is O(pages), at most 100. Apply to Every Page is one walk and
  one ink pass, O(pages + elements), on a press. The sample page is built in a `useMemo` over kind, background,
  theme, finish, font and size: one page export per change, as the old sample was.

## Presentation and UX

- Panel: the `SegmentedToggle` (Like the Page Before | Choose One) and its line, the `BackgroundSection`
  (`only={['solid','gradient','animated']}`, `noPattern` on an article or card), Apply to Every Page with its line,
  then Around the Pages (`ColorSwatch`, and four `PatternButton`s but on an article or card).

## Testing

- `packages/document/src/tab-new-page-background.test.ts`: read, set, a new page, a first page, Apply to Every Page,
  a look's pages, the theme follow.
- `apps/editor/lib/tab-looks.test.ts`, `lib/new-page-background.test.ts`, `lib/page-preview.test.ts`,
  `components/dialogs/CanvasThemeDialog.test.tsx` (surfaces, the panel, the Article row, the summary),
  `hooks/canvas/useTabCanvas.test.ts` (`everyPageMessage`), `lib/view-backdrop.test.ts`.
