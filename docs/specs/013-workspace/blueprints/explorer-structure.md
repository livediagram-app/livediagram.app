# Explorer structure blueprint

Derived from [Explorer structure](../explorer-structure.md). The sidebar is one pure layout function (which groups and
rows show, from a handful of facts) and a set of small components that render it as ARIA trees, with one keyboard hook
on the `nav`.

## Files

| File                                                                     | Holds                                                                                                                                                                                                                                                                                |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `apps/live/app/explorer/sidebar/sidebar-structure.ts`                    | Group titles, row labels, expand keys, `sidebarGroups`, `sidebarDivider`, `isLibraryView`, `initialExpanded`                                                                                                                                                                         |
| `apps/live/app/explorer/sidebar/sidebar-telemetry.ts`                    | `SidebarTelemetryRow`, `trackSidebar`                                                                                                                                                                                                                                                |
| `apps/live/app/explorer/sidebar/useTreeNavigation.ts`                    | `useTreeNavigation`: roving tab stop and the tree keys, over the DOM                                                                                                                                                                                                                 |
| `apps/live/app/explorer/sidebar/ExplorerSidebar.tsx`                     | The `nav`: reads the context, computes the layout, renders the three groups in order                                                                                                                                                                                                 |
| `apps/live/app/explorer/sidebar/SidebarGroup.tsx`                        | One group: its title (visible or visually hidden) or the hairline, and its `tree`                                                                                                                                                                                                    |
| `apps/live/app/explorer/sidebar/SidebarRow.tsx`                          | `SidebarRow`: one `treeitem` with the chevron gutter (the row's end on a touch screen), icon, label, badge, trailing slot and child `group`                                                                                                                                          |
| `apps/live/app/explorer/sidebar/OverviewGroup.tsx`                       | Home, Inbox, Timeline, Shared With Me                                                                                                                                                                                                                                                |
| `apps/live/app/explorer/sidebar/inbox-badge.ts`                          | `inboxBadge(feed)`: the Inbox pill, 0 included, nothing while loading or failed                                                                                                                                                                                                      |
| `apps/live/app/explorer/sidebar/SpacesGroup.tsx`                         | My Documents (its root folders), teams, Invites, New team, the sign-in nudge                                                                                                                                                                                                         |
| `apps/live/app/explorer/sidebar/TeamRows.tsx`                            | `TeamRows`, one `TeamRow` per team: a drop target opening its folders on a resting drag                                                                                                                                                                                              |
| `apps/live/app/explorer/sidebar/MoreGroup.tsx`                           | This browser, Tags (one row per tag, `TagRows.tsx`), Library (Image gallery, Themes, Shape libraries), Trash                                                                                                                                                                         |
| `apps/live/app/explorer/sidebar/SidebarFolderSubtree.tsx`                | A personal folder row, its menu, and its subfolders                                                                                                                                                                                                                                  |
| `apps/live/app/explorer/sidebar/TeamFolderSubtree.tsx`                   | A team folder row and its subfolders                                                                                                                                                                                                                                                 |
| `apps/live/app/explorer/sidebar/SidebarSignInNudge.tsx`                  | The guest's "Sign in to access Teams" card                                                                                                                                                                                                                                           |
| `apps/live/app/explorer/sidebar/sidebar-tones.ts`                        | `SIDEBAR_TONES`, the tile, the current row's pill and the resting row (Look)                                                                                                                                                                                                         |
| `apps/live/app/explorer/useMidnightPalette.ts`                           | Sets `data-palette="midnight"` on the root while the Explorer is mounted                                                                                                                                                                                                             |
| `apps/live/app/explorer/sidebar/useSidebarExpansion.ts`                  | `useSidebarExpansion(selected)`: the `expanded` set, `expand`, `toggleExpand`; Library opens with a Library view                                                                                                                                                                     |
| `apps/live/app/explorer/useExplorerState.ts`                             | Composes `useSidebarExpansion`; renders in the browser only (`use(browser())`), so `prefs` and the URL are read from the first render                                                                                                                                                |
| `apps/live/app/explorer/lens/LensField.tsx`                              | The Explorer header's search, the lens field ([Explorer filters blueprint](explorer-filters.md#the-explorer-page)); mounted by `ExplorerShell.tsx`                                                                                                                                   |
| `apps/live/components/chrome/header-action.tsx`                          | `HEADER_ACTION_TONE`, shared by Sign in and the account                                                                                                                                                                                                                              |
| `apps/telemetry/app/catalogue/features.ts`                               | `EXPLORER_SIDEBAR_PICKS`, in the Organisation stack                                                                                                                                                                                                                                  |
| `apps/telemetry/app/computed-emitters.ts`                                | The sidebar's computed `UI·Selected` values, read from `SidebarTelemetryRow`                                                                                                                                                                                                         |
| `apps/telemetry/app/event-explanation.ts`                                | The `UI·Selected·Sidebar.<Row>` sentence                                                                                                                                                                                                                                             |
| `apps/live/components/panels/explorer-tree/PanelExplorerTree.tsx`        | A tree section's rows: the open folder's folders then documents (`folderId` from the host, `paneFolderParent`), the "Folder path" breadcrumb, `EmptyPane compact`; This browser's and Shared With Me's documents                                                                     |
| `apps/live/components/panels/explorer-tree/PanelTreeContext.ts`          | `PanelTree`, `PanelTreeProvider`, `usePanelTree`: expansion, the open document and the host's verbs                                                                                                                                                                                  |
| `apps/live/components/panels/explorer-panel/panel-sections.ts`           | `PanelSection`, `panelSectionGroups`, `sectionKey` / `sectionFromKey`, `sectionLabel`, `sectionPage`, `sectionTelemetryRow`, `resolveSection`                                                                                                                                        |
| `apps/live/components/panels/explorer-panel/useExplorerPanelSection.ts`  | `useExplorerPanelSection(groups)`: the shown section, remembered under `PANEL_SECTION_STORAGE_KEY` (try/catch), else Home                                                                                                                                                            |
| `apps/live/components/panels/explorer-panel/ExplorerRail.tsx`            | The rail `nav` "Explorer sections": grouped entries (desktop) or a chip row (phone), `aria-current`, arrow keys, My Documents as a drop target                                                                                                                                       |
| `apps/live/components/panels/explorer-panel/ExplorerPanelPane.tsx`       | The pane: title, New Folder (New Subfolder with `inFolder`), Open Page, then the tree or a lazily loaded view (`PanelViews`)                                                                                                                                                         |
| `apps/live/components/panels/explorer-panel/PanelViews.tsx`              | `HomeSection` (Jump back in rows, What happened only when non-empty), `InboxSection` (`ActivityPane compact`), `TimelineSection` (day-grouped rows via `pickRenderer`), `TrashSection` (rows, Restore, Delete with `ConfirmPopover`), `LibrarySection` (tabs over the compact panes) |
| `apps/live/components/panels/explorer-panel/ExplorerCurrentDocument.tsx` | The Current Document card: thumbnail, the name as a fitted rename button (dotted underline and pencil on hover), `SharedBadge portal` from `useDocumentVisibility`, the document menu                                                                                                |
| `apps/live/hooks/editor/document-visibility-store.ts`                    | `usePublishDocumentVisibility` (EditorView), `useDocumentVisibility` (the card)                                                                                                                                                                                                      |
| `packages/ui/src/ProductNav.tsx`                                         | `ProductNavLinks`: the product's surfaces as the Explorer footer's links (`nav` "Go to")                                                                                                                                                                                             |
| `apps/live/components/panels/explorer-tree/PanelFolderItem.tsx`          | A pane folder row (`PaneRow`): counts, opens the folder (`tree.onOpenFolder`), folder menu with Show in Explorer, drop target opening on a resting drag, pending rename                                                                                                              |
| `apps/live/components/panels/explorer-tree/PanelDocumentItem.tsx`        | A pane document row (`PaneRow`): thumbnail, "Updated <time>", opens the document, the document menu, star, Local only pill, drag source                                                                                                                                              |
| `apps/live/components/panels/Explorer.tsx`                               | Composes the card, rail, pane and `ProductNavLinks`; `w-[38rem]` popover (`POPOVER_WIDTHS.explorer` 608); sets `body[data-explorer-open]` while shown so the palette trays hide                                                                                                      |
| `apps/live/app/explorer/sidebar/library-pages.ts`                        | `LIBRARY_PAGES`, shared by the sidebar and the panel                                                                                                                                                                                                                                 |
| `apps/live/app/explorer/view-titles.ts`                                  | `VIEW_TITLES`, `viewDocumentTitle`: every view named by its row                                                                                                                                                                                                                      |
| `apps/live/lib/document-space.ts`                                        | `isLocalOnly`, `documentSpace` (`mine` / `team` / `shared`)                                                                                                                                                                                                                          |
| `apps/live/components/primitives/LocalOnlyPill.tsx`                      | `LocalOnlyPill`, `LOCAL_ONLY_LABEL`, `LOCAL_ONLY_DESCRIPTION`, `LOCAL_ONLY_TONE`                                                                                                                                                                                                     |
| `apps/live/lib/search.ts`                                                | A document result carries `localOnly`; `SearchPanel.tsx` shows the pill as a label                                                                                                                                                                                                   |
| `apps/live/components/panels/TrashPane.tsx`                              | This browser's Trash rows carry the pill                                                                                                                                                                                                                                             |
| `apps/live/components/chrome/SharedBadge.tsx`                            | The editor header's Local only state: the pill's label, sentence (`aria-describedby`), tone and glyph                                                                                                                                                                                |
| `apps/live/components/primitives/explorer-icons.tsx`                     | `HomeIcon` (lucide `house`), `InboxIcon` (a tray with a tick), `TimelineIcon` (a spine with entries), `LibraryIcon` (lucide `library`), `ThisBrowserIcon` (lucide `app-window`), `MyDocumentsIcon` (lucide `folder-root`)                                                            |
| `apps/live/components/primitives/EllipsisTriggerButton.tsx`              | `tabIndex` prop: -1 for the folder rows, whose tree owns the tab stop; `reveal` hides it under a fine pointer until hover or row focus                                                                                                                                               |
| `apps/live/components/panels/useDocumentDropTarget.ts`                   | `useDocumentDropTarget`, `DRAG_HOVER_TOGGLE_MS`, `DROP_TARGET_RING`: a place taking a dragged document, its long-hover toggle                                                                                                                                                        |
| `apps/live/components/panels/explorer-drag-mime.ts`                      | `DOCUMENT_DRAG_MIME`, `DOCUMENT_LOCAL_ONLY_DRAG_MIME`, `startDocumentDrag`                                                                                                                                                                                                           |
| `apps/live/app/explorer/useExplorerDropTarget.ts`                        | A page place (sidebar row, folder row or card) filing a dropped document through `moveDocumentTo`; logs `[explorer-drop]`                                                                                                                                                            |
| `apps/live/app/explorer/document-drop.ts`                                | `planDocumentDrop`: `move`, `already-there` or `refused-local-only`                                                                                                                                                                                                                  |

## Domain and naming

| Term        | Identifier                                      | Meaning                                                                         |
| ----------- | ----------------------------------------------- | ------------------------------------------------------------------------------- |
| group       | `SidebarGroupId`                                | `'overview' \| 'spaces' \| 'more'`                                              |
| group title | `SIDEBAR_GROUP_TITLES[id]`                      | "Overview", "Spaces", "More"                                                    |
| row         | `SidebarRowKind`                                | The top-level rows a group may hold (below)                                     |
| row label   | `SIDEBAR_LABELS[key]`                           | Title Case copy for every fixed row                                             |
| divider     | `SidebarDivider`                                | `'titles' \| 'separators'`                                                      |
| expand key  | `MY_DOCUMENTS_EXPAND_KEY`, `LIBRARY_EXPAND_KEY` | Entries of the shared `expanded` set, prefixed so no folder or team id collides |

`SidebarRowKind`: `home`, `inbox`, `timeline`, `shared`, `myDocuments`, `teams` (zero or more team rows), `invites`, `newTeam`,
`signInNudge`, `thisBrowser`, `library`, `trash`. "Space" in code means My Documents or a team; "Offline" stays the
name of the view (`kind: 'offline'`), whose row reads "This Browser".

## Behaviour and state

1. **Layout** (`sidebarGroups(input)`), input `{ signedIn, signInAvailable, pendingInvites, offlineDocuments, selected, surface? }`
   (`selected` null in the panel; `surface` `'page'` by default):
   - `overview`: `home`, `inbox`, `timeline`, `shared`.
   - `spaces`: `myDocuments`; then `teams` when `signedIn`; `invites` when `signedIn` and (`pendingInvites > 0` or
     `selected === 'invites'`); `newTeam` when `signedIn`; `signInNudge` when `!signedIn && signInAvailable`.
   - `more`: `thisBrowser` when `offlineDocuments > 0` or `selected === 'offline'`; `library`; `trash`.
   - `surface: 'panel'`: no `invites`, `newTeam` or `signInNudge`.
2. **Divider** (`sidebarDivider(minimalChrome)`): `'separators'` when `isMinimalChrome(prefs)`, else `'titles'`.
   The shell renders in the browser only (`useExplorerState` calls `use(browser())`), so the sidebar first draws with
   the device's preferences already read.
3. **Expansion** (`useSidebarExpansion`): `expanded` starts as `initialExpanded(selected)`: always
   `MY_DOCUMENTS_EXPAND_KEY`, plus `LIBRARY_EXPAND_KEY` when `isLibraryView(selected.kind)` (`gallery`, `themes`,
   `shape-libraries`). When `selected.kind` changes to a Library view, `LIBRARY_EXPAND_KEY` is added during that render
   (state adjusted in render, not an effect). Toggling is `toggleExpand(key)`; `expand(key)` opens idempotently, used to
   reveal a new folder's parent (My Documents for a root folder).
4. **Row activation** (click on the label area, or Enter / Space): `go(node)` for a view row, `toggleExpand` for
   Library, `setTeamModalOpen(true)` and `setMobileNavOpen(false)` for New team, `window.location.assign` for a team
   folder. Home also clears the Timeline unread count. Each activation calls `trackSidebar(row)` first.
5. **Chevron**: a click on the gutter toggles that row; it never activates it. My Documents is expandable only while it
   has a root folder (the page) or a root folder or document (the panel).
6. **Roving tab stop** (`useTreeNavigation`): after every render exactly one `treeitem` in the `nav` has
   `tabIndex = 0`: the focused one while focus is inside the `nav`, else the `aria-selected` one, else the first.
7. **Keys** on a focused `treeitem` (ignored when the event comes from an `input`, `textarea` or a descendant control):
   Down / Up next / previous item in document order; Home / End first / last; Right on `aria-expanded="false"` clicks
   its toggle, on `"true"` focuses its first child item; Left on `"true"` clicks its toggle, otherwise focuses the
   closest ancestor `treeitem`; Enter / Space click its activate element; a single printable character focuses the next
   item (wrapping) whose `data-tree-label` starts with it, case-insensitively. Handled keys `preventDefault`.
8. **Page titles** (`VIEW_TITLES`): the pane title is `VIEW_TITLES[kind]` (a folder or team by its name); the
   breadcrumb is `[My Documents, …ancestors, folder]` for a folder, `[Home, leaf]` for Recent (`leadsBackHome`), and
   the single leaf otherwise (the Timeline included: it has a row); each static page's `metadata.title` is
   `viewDocumentTitle(kind)`. The Inbox is `VIEW_TITLES.inbox = SIDEBAR_LABELS.inbox` ("Inbox"), the Timeline
   `VIEW_TITLES.timeline = SIDEBAR_LABELS.timeline` ("Timeline").
   **Retired Activity route.** `selectedFromRoute` reads `/explorer/activity` as `{ kind: 'inbox' }`, so the Inbox row
   highlights at once, and `app/explorer/activity/page.tsx` renders `RetiredViewRedirect from="activity"`, which
   `router.replace`s to `RETIRED_VIEW_TARGETS.activity` (`/explorer/inbox`).
9. **Panel**: `panelSectionGroups({ teams, hasBrowserDocuments })` lists the rail's sections (overview: home, inbox,
   timeline, shared; spaces: mine and `team:<id>`; more: browser while it holds documents, library, trash).
   `resolveSection` shows the remembered key while it is still listed, else home. A pick calls
   `trackSidebar(sectionTelemetryRow(s), 'panel')` (`ExplorerPanel.<Row>`) and stores the key. Tree sections render
   `PanelExplorerTree` (a folder opens in the pane under its breadcrumb); the others render their `PanelViews`
   component, each hook fetching only while mounted. A folder's Show in Explorer loads `teamFolderPath` (a team folder) or
   `explorerPathFor` (a folder of mine) from `app/explorer/routes.ts`; Open Page is an `<a href={explorerPathFor(sectionPage(s))}>`.
   The folder open in the pane is `Explorer`'s `openFolder` (`{ section, id }`), read as `paneFolderId` only for
   the section it was opened in and only while `paneFolderParent` finds it among that space's folders (else the
   root). The header's New Folder creates in `paneFolderId` (reading **New Subfolder** there) or at the space's root;
   a folder card's New Subfolder opens its folder in the pane, so the new folder shows with its name field.
10. **Local only**: `isLocalOnly(doc)` (`ownerId === OFFLINE_OWNER_ID`) shows `LocalOnlyPill` beside a list row's
    name, first in a card's meta row, in the panel rows (link out of the tab order; the row's `aria-describedby` is
    `LOCAL_ONLY_DESCRIPTION`), in the panel's Current Document row and search results (`asLabel`), and in the Trash's
    local group; `VisibilityBadge` renders nothing for such a document. `ownerLabelFor` reads `documentSpace`.
11. **Folder menu by keyboard**: the `treeitem` carries the row's `onContextMenu`; Shift+F10 and the Menu key fire
    `contextmenu` on the focused element, which opens the menu. The handler stops propagation so an ancestor folder's
    menu never opens too.

## Interfaces and contracts

```ts
export const SIDEBAR_GROUP_TITLES = {
  overview: 'Overview',
  spaces: 'Spaces',
  more: 'More',
} as const;
export type SidebarGroupId = keyof typeof SIDEBAR_GROUP_TITLES;
export type SidebarRowKind =
  | 'home'
  | 'inbox'
  | 'timeline'
  | 'shared'
  | 'myDocuments'
  | 'teams'
  | 'invites'
  | 'newTeam'
  | 'signInNudge'
  | 'thisBrowser'
  | 'library'
  | 'trash';
export type SidebarLayoutInput = {
  signedIn: boolean; // teamsEnabled: a Clerk session
  signInAvailable: boolean; // clerkEnabled: the deployment offers sign-in
  pendingInvites: number;
  offlineDocuments: number;
  selected: SelectedNode['kind'];
};
export type SidebarGroupLayout = { id: SidebarGroupId; rows: SidebarRowKind[] };
export function sidebarGroups(input: SidebarLayoutInput): SidebarGroupLayout[];
export type SidebarDivider = 'titles' | 'separators';
export function sidebarDivider(minimalChrome: boolean): SidebarDivider;
export function isLibraryView(kind: SelectedNode['kind']): boolean;
export function initialExpanded(selected: SelectedNode): Set<string>;
```

`SidebarRow` props: `icon`, `label` (node), `textLabel` (string, for typeahead), `selected`, `onActivate`, `depth`
(0-based; `aria-level = depth + 1`), `badge?`, `expandable?`, `expanded?`, `onToggleExpand?`, `trailing?`,
`renaming?`, `onContextMenu?`, `children?` (child rows, rendered in a `group` only while expanded).

## Errors and edge cases

| Case                                                  | Handling                                                                           |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------- |
| On `/explorer/offline` with no offline documents left | This browser stays while selected                                                  |
| On `/explorer/invites` with none pending              | Invites stays while selected                                                       |
| Current view has no row (Recent, Favourites, Search)  | No row is `aria-selected`; the tab stop falls back to the first row                |
| Selected folder hidden inside a collapsed parent      | Same fallback; expansion is the reader's                                           |
| A team without folders                                | No chevron; gutter still reserved                                                  |
| Focus on a row whose parent collapses by mouse        | The element unmounts; focus returns to `body`; the next Tab enters on the tab stop |
| Keys while renaming a folder                          | The input's; the hook ignores them                                                 |
| Two instances (desktop + drawer)                      | Ids from `useId`; each `nav` roves independently                                   |
| Guest on a deployment without sign-in                 | No teams, no New team, no nudge                                                    |

## Security and trust

Navigation only: no new data, endpoint or permission. Team and folder names render as text.

## Performance and limits

The layout is O(1); the tree renders O(visible rows) as today. The keyboard hook queries `[role="treeitem"]` per
keystroke and per render (tens to low hundreds of nodes). No new fetch.

## Presentation and UX

- Row: `[indent 16px × depth][gutter 20px][icon][label][badge][trailing]`, text 14 px (`text-sm`), `py-1.5`
  (36 px with a tile; `pointer-coarse` 44 px), `rounded-xl`, gap 10 px; hover `bg-slate-100 dark:bg-slate-800`.
- Tile (`SidebarRow tone`): `size-6 rounded-lg grid place-items-center`, `SIDEBAR_TONES[tone]`: the tone's 100 tint
  under its 700 ink in light (`bg-sky-100 text-sky-700`), its 400 at 15 % under its 300 ink in dark
  (`dark:bg-sky-400/15 dark:text-sky-300`). Tones: `home`, `myDocuments` sky; `inbox` violet; `timeline` amber;
  `shared` emerald; `team` indigo; `invites` rose. A row without a tone keeps the bare `text-slate-400` icon.
- Current row (`SIDEBAR_CURRENT`): `bg-white border border-sky-200 shadow-[0_6px_18px_-8px_rgba(2,132,199,0.35)]`,
  label `font-semibold text-sky-900`; its tile `bg-sky-600 text-white`, a bare icon `text-sky-600`. Dark:
  `bg-gradient-to-r from-sky-400/[0.18] to-sky-400/[0.04] ring-1 ring-inset ring-sky-400/35 border-transparent
shadow-none`, label `text-white`, tile `bg-sky-500 text-white`. Every other row carries a transparent 1 px border
  so selecting moves nothing.
- Group title: 11 px semibold uppercase, `tracking-[0.1em]`, `text-slate-500 dark:text-slate-400`, `px-2.5 pb-2`;
  first group without top margin; `mt-6` between groups.
- Separator: inside the title's own box (same classes, so the same height): the title as `sr-only` text and an
  absolutely placed `h-px` line, `bg-slate-200` / `dark:bg-slate-700`, at its vertical middle. The first group's
  title, under separators, is an `sr-only` heading with no box.
- Local only pill: `optical-edges`, rounded-full, `px-1.5`, 10px semibold, `text-amber-800` on `bg-amber-50` with an
  `amber-600` ring (dark: `text-amber-200` on `amber-500/15`, `amber-400` ring), the app-window glyph at 10px.
- Panel: `w-[38rem]`; the rail `w-44` with a right hairline beside the pane, both `h-[min(30rem,62vh)]`, the pane scrolling.
  On a phone the chips (`h-11`, rounded-full) sit over the pane in `max-h-[max(14rem,calc(100dvh-25rem))]`, the picked
  chip scrolled into view.
- Sign-in nudge: last in Spaces, `relative overflow-hidden rounded-2xl bg-[#0b1230] p-4 mt-3` (dark adds
  `ring-1 ring-sky-400/30`), an `aria-hidden` 120 px radial `rgba(56,189,248,0.45)` glow at the top-right corner, the
  title row (the brand prism mark at 18 px, `text-sm font-semibold text-white`), the line `text-[12.5px] leading-normal
text-[#a9b8d0]`; focus ring `outline-sky-400`.
- Container: the `aside`'s sticky box has no border, background, shadow or padding beyond `px-1 py-1`.
- New team: a row with `PlusIcon`, label "New Team".
- Header search: the lens field left of the account control; below `sm` its own row under the header.

## Accessibility

As the spec's Keyboard and ARIA section. Focus ring: `ring-2 ring-brand-500` on the row when its `treeitem` is
`:focus-visible`. Hidden titles use `sr-only`. Badges keep `CountBadge`'s accessible text.

## Web Experience

No new network or JS on the critical path. CLS: initial expansion is computed before first paint
(`initialExpanded`); the divider switches after hydration inside a box of unchanged height; no element changes size
after load.

## Observability

`trackSidebar` is the decision log for activations. Unchanged failure logging elsewhere (folder menu actions, team
creation).

## Testing

| Rule                                                 | Test                                                                                                                                                                                                                                                                  |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Group order and row order                            | `sidebar-structure.test.ts`                                                                                                                                                                                                                                           |
| Guest vs signed in (teams, New team, nudge, Invites) | `sidebar-structure.test.ts`                                                                                                                                                                                                                                           |
| This browser hidden when empty, kept while selected  | `sidebar-structure.test.ts`                                                                                                                                                                                                                                           |
| Titles vs separators per mode                        | `sidebar-structure.test.ts`, `SidebarGroup.test.tsx`                                                                                                                                                                                                                  |
| Initial expansion and Library views                  | `sidebar-structure.test.ts`, `useSidebarExpansion.test.tsx`                                                                                                                                                                                                           |
| The shell renders in the browser only                | `render-browser-globals.test.ts`, `e2e/explorer-sidebar.spec.ts` (no hydration error under Minimal chrome)                                                                                                                                                            |
| Telemetry values charted and explained               | `apps/telemetry` `metric-emitters.test.ts`, `event-explanation.test.ts`                                                                                                                                                                                               |
| Gutter on every row; ARIA attributes                 | `SidebarRow.test.tsx`                                                                                                                                                                                                                                                 |
| Keyboard model and roving tab stop                   | `useTreeNavigation.test.tsx`                                                                                                                                                                                                                                          |
| Panel sections, rail, pane, card, footer             | `panel-sections.test.ts`, `useExplorerPanelSection.test.tsx`, `ExplorerRail.test.tsx`, `ExplorerCurrentDocument.test.tsx`, `Explorer.test.tsx`, `PanelExplorerTree.test.tsx`, `PanelFolderItem.test.tsx`, `document-visibility-store.test.tsx`, `ProductNav.test.tsx` |
| Retired `/explorer/activity` reads as the Inbox      | `routes.test.ts`, `RetiredViewRedirect.test.tsx`                                                                                                                                                                                                                      |
| Page titles follow the rows                          | `view-titles.test.ts`                                                                                                                                                                                                                                                 |
| Local only: space, pill, rows, search, Trash         | `document-space.test.ts`, `LocalOnlyPill.test.tsx`, `explorer-route-document-row.test.tsx`, `document-badges.test.tsx`, `search.test.ts`, `SearchPanel.test.tsx`, `TrashPane.test.tsx`, `SharedBadge.test.tsx`                                                        |
| Real browser: groups, keyboard, drawer               | `e2e/explorer-sidebar.spec.ts` (page and editor panel), `e2e/clerk-stub/explorer-sidebar.spec.ts`                                                                                                                                                                     |

## Constants and configuration

| Constant                  | Value                                     | Provenance                       |
| ------------------------- | ----------------------------------------- | -------------------------------- |
| `INDENT_STEP`             | 16 px                                     | Unchanged from the previous tree |
| `SIDEBAR_TONES`           | sky, violet, amber, emerald, indigo, rose | Spec (Look); `D170`              |
| Chevron gutter            | 20 px (`h-5 w-5`)                         | Unchanged; now always reserved   |
| `MY_DOCUMENTS_EXPAND_KEY` | `'space:my-documents'`                    | Prefix keeps it apart from UUIDs |
| `LIBRARY_EXPAND_KEY`      | `'more:library'`                          | Same                             |

## Assets and external resources

`house`, `library` and `folder-root` vendored from `lucide-static` (ISC) through `packages/icons/lucide-manifest.json`
and `pnpm icons:vendor`; `app-window` is already vendored. `InboxIcon` and `TimelineIcon` are drawn in house on the
16-unit grid (`G16`); the Timeline's spine matches the help centre's `timeline` card glyph.

## Defaults ledger

See [DEFAULTS.md](DEFAULTS.md) rows D59 to D64.
