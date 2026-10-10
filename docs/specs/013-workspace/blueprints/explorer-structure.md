# Explorer structure blueprint

Derived from [Explorer structure](../explorer-structure.md). The sidebar is one pure layout function (which groups and
rows show, from a handful of facts) and a set of small components that render it as ARIA trees, with one keyboard hook
on the `nav`.

## Files

| File                                                               | Holds                                                                                                                                                                                                                     |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/live/app/explorer/sidebar/sidebar-structure.ts`              | Group titles, row labels, expand keys, `sidebarGroups`, `sidebarDivider`, `isLibraryView`, `initialExpanded`                                                                                                              |
| `apps/live/app/explorer/sidebar/sidebar-telemetry.ts`              | `SidebarTelemetryRow`, `trackSidebar`                                                                                                                                                                                     |
| `apps/live/app/explorer/sidebar/useTreeNavigation.ts`              | `useTreeNavigation`: roving tab stop and the tree keys, over the DOM                                                                                                                                                      |
| `apps/live/app/explorer/sidebar/ExplorerSidebar.tsx`               | The `nav`: reads the context, computes the layout, renders the three groups in order                                                                                                                                      |
| `apps/live/app/explorer/sidebar/SidebarGroup.tsx`                  | One group: its title (visible or visually hidden) or the hairline, and its `tree`                                                                                                                                         |
| `apps/live/app/explorer/sidebar/SidebarRow.tsx`                    | `SidebarRow`: one `treeitem` with the chevron gutter, icon, label, badge, trailing slot and child `group`                                                                                                                 |
| `apps/live/app/explorer/sidebar/OverviewGroup.tsx`                 | Home, Inbox, Timeline, Shared with me                                                                                                                                                                                     |
| `apps/live/app/explorer/sidebar/inbox-badge.ts`                    | `inboxBadge(feed)`: the Inbox pill, 0 included, nothing while loading or failed                                                                                                                                           |
| `apps/live/app/explorer/sidebar/SpacesGroup.tsx`                   | My documents (its root folders), teams, Invites, New team, the sign-in nudge                                                                                                                                              |
| `apps/live/app/explorer/sidebar/TeamRows.tsx`                      | `TeamRows`, one `TeamRow` per team: a drop target opening its folders on a resting drag                                                                                                                                   |
| `apps/live/app/explorer/sidebar/MoreGroup.tsx`                     | This browser, Library (Image gallery, Themes, Shape libraries), Trash                                                                                                                                                     |
| `apps/live/app/explorer/sidebar/SidebarFolderSubtree.tsx`          | A personal folder row, its menu, and its subfolders                                                                                                                                                                       |
| `apps/live/app/explorer/sidebar/TeamFolderSubtree.tsx`             | A team folder row and its subfolders                                                                                                                                                                                      |
| `apps/live/app/explorer/sidebar/SidebarSignInNudge.tsx`            | The guest's "Sign in to access Teams" card                                                                                                                                                                                |
| `apps/live/app/explorer/sidebar/useSidebarExpansion.ts`            | `useSidebarExpansion(selected)`: the `expanded` set, `expand`, `toggleExpand`; Library opens with a Library view                                                                                                          |
| `apps/live/app/explorer/useExplorerState.ts`                       | Composes `useSidebarExpansion`; exposes `prefs` only once hydrated (`useHydrated`)                                                                                                                                        |
| `apps/live/hooks/ui/useHydrated.ts`                                | `useHydrated()`: false while React hydrates the static HTML, true after                                                                                                                                                   |
| `apps/live/app/explorer/lens/LensField.tsx`                        | The Explorer header's search, the lens field ([Explorer filters blueprint](explorer-filters.md#the-explorer-page)); mounted by `ExplorerShell.tsx`                                                                        |
| `apps/live/components/chrome/header-action.tsx`                    | `HEADER_ACTION_TONE`, shared by Sign in and the account                                                                                                                                                                   |
| `apps/telemetry/app/catalogue/features.ts`                         | `EXPLORER_SIDEBAR_PICKS`, in the Organisation stack                                                                                                                                                                       |
| `apps/telemetry/app/computed-emitters.ts`                          | The sidebar's computed `UI·Selected` values, read from `SidebarTelemetryRow`                                                                                                                                              |
| `apps/telemetry/app/event-explanation.ts`                          | The `UI·Selected·Sidebar.<Row>` sentence                                                                                                                                                                                  |
| `apps/live/components/panels/explorer-tree/PanelExplorerTree.tsx`  | The panel's `nav`: `sidebarGroups` with `surface: 'panel'`, the three panel groups, `useTreeNavigation`, a scrolling box                                                                                                  |
| `apps/live/components/panels/explorer-tree/PanelTreeContext.ts`    | `PanelTree`, `PanelTreeProvider`, `usePanelTree`: expansion, the open document and the host's verbs                                                                                                                       |
| `apps/live/components/panels/explorer-tree/PanelOverviewGroup.tsx` | Home, Inbox and Timeline to the Explorer; Shared with me opening in place                                                                                                                                                 |
| `apps/live/components/panels/explorer-tree/PanelSpacesGroup.tsx`   | My documents and each team, opening in place to root folders then root documents; My documents takes a dropped document                                                                                                   |
| `apps/live/components/panels/explorer-tree/PanelMoreGroup.tsx`     | This browser opening in place; Library pages and Trash to the Explorer                                                                                                                                                    |
| `apps/live/components/panels/explorer-tree/PanelFolderItem.tsx`    | A panel folder row: subfolders then documents, folder menu with Show in Explorer, drop target, pending rename                                                                                                             |
| `apps/live/components/panels/explorer-tree/PanelDocumentItem.tsx`  | A panel document row: opens the document, the document menu, star, Local only pill, drag source                                                                                                                           |
| `apps/live/components/panels/explorer-tree/panel-tree-model.ts`    | `openExplorerPage`                                                                                                                                                                                                        |
| `apps/live/components/panels/Explorer.tsx`                         | Mounts `PanelExplorerTree` under the Current Document card; its expansion record starts empty (all closed)                                                                                                                |
| `apps/live/app/explorer/sidebar/library-pages.ts`                  | `LIBRARY_PAGES`, shared by the sidebar and the panel                                                                                                                                                                      |
| `apps/live/app/explorer/view-titles.ts`                            | `VIEW_TITLES`, `viewDocumentTitle`: every view named by its row                                                                                                                                                           |
| `apps/live/lib/document-space.ts`                                  | `isLocalOnly`, `documentSpace` (`mine` / `team` / `shared`)                                                                                                                                                               |
| `apps/live/components/primitives/LocalOnlyPill.tsx`                | `LocalOnlyPill`, `LOCAL_ONLY_LABEL`, `LOCAL_ONLY_DESCRIPTION`, `LOCAL_ONLY_TONE`                                                                                                                                          |
| `apps/live/lib/search.ts`                                          | A document result carries `localOnly`; `SearchPanel.tsx` shows the pill as a label                                                                                                                                        |
| `apps/live/components/panels/TrashPane.tsx`                        | This browser's Trash rows carry the pill                                                                                                                                                                                  |
| `apps/live/components/chrome/SharedBadge.tsx`                      | The editor header's Local only state: the pill's label, sentence (`aria-describedby`), tone and glyph                                                                                                                     |
| `apps/live/components/primitives/explorer-icons.tsx`               | `HomeIcon` (lucide `house`), `InboxIcon` (a tray with a tick), `TimelineIcon` (a spine with entries), `LibraryIcon` (lucide `library`), `ThisBrowserIcon` (lucide `app-window`), `MyDocumentsIcon` (lucide `folder-root`) |
| `apps/live/components/primitives/EllipsisTriggerButton.tsx`        | `tabIndex` prop: -1 for the folder rows, whose tree owns the tab stop; `reveal` hides it under a fine pointer until hover or row focus                                                                                    |
| `apps/live/components/panels/useDocumentDropTarget.ts`             | `useDocumentDropTarget`, `DRAG_HOVER_TOGGLE_MS`, `DROP_TARGET_RING`: a place taking a dragged document, its long-hover toggle                                                                                             |
| `apps/live/components/panels/explorer-drag-mime.ts`                | `DOCUMENT_DRAG_MIME`, `DOCUMENT_LOCAL_ONLY_DRAG_MIME`, `startDocumentDrag`                                                                                                                                                |
| `apps/live/app/explorer/useExplorerDropTarget.ts`                  | A page place (sidebar row, folder row or card) filing a dropped document through `moveDocumentTo`; logs `[explorer-drop]`                                                                                                 |
| `apps/live/app/explorer/document-drop.ts`                          | `planDocumentDrop`: `move`, `already-there` or `refused-local-only`                                                                                                                                                       |

## Domain and naming

| Term        | Identifier                                      | Meaning                                                                         |
| ----------- | ----------------------------------------------- | ------------------------------------------------------------------------------- |
| group       | `SidebarGroupId`                                | `'overview' \| 'spaces' \| 'more'`                                              |
| group title | `SIDEBAR_GROUP_TITLES[id]`                      | "Overview", "Spaces", "More"                                                    |
| row         | `SidebarRowKind`                                | The top-level rows a group may hold (below)                                     |
| row label   | `SIDEBAR_LABELS[key]`                           | Sentence-case copy for every fixed row                                          |
| divider     | `SidebarDivider`                                | `'titles' \| 'separators'`                                                      |
| expand key  | `MY_DOCUMENTS_EXPAND_KEY`, `LIBRARY_EXPAND_KEY` | Entries of the shared `expanded` set, prefixed so no folder or team id collides |

`SidebarRowKind`: `home`, `inbox`, `timeline`, `shared`, `myDocuments`, `teams` (zero or more team rows), `invites`, `newTeam`,
`signInNudge`, `thisBrowser`, `library`, `trash`. "Space" in code means My documents or a team; "Offline" stays the
name of the view (`kind: 'offline'`), whose row reads "This browser".

## Behaviour and state

1. **Layout** (`sidebarGroups(input)`), input `{ signedIn, signInAvailable, pendingInvites, offlineDocuments, selected, surface? }`
   (`selected` null in the panel; `surface` `'page'` by default):
   - `overview`: `home`, `inbox`, `timeline`, `shared`.
   - `spaces`: `myDocuments`; then `teams` when `signedIn`; `invites` when `signedIn` and (`pendingInvites > 0` or
     `selected === 'invites'`); `newTeam` when `signedIn`; `signInNudge` when `!signedIn && signInAvailable`.
   - `more`: `thisBrowser` when `offlineDocuments > 0` or `selected === 'offline'`; `library`; `trash`.
   - `surface: 'panel'`: no `invites`, `newTeam` or `signInNudge`.
2. **Divider** (`sidebarDivider(minimalChrome)`): `'separators'` when `isMinimalChrome(prefs)`, else `'titles'`.
   `prefs` is empty during hydration (`useExplorerState`), so a prerendered sidebar hydrates on titles and switches in
   the next render.
3. **Expansion** (`useSidebarExpansion`): `expanded` starts as `initialExpanded(selected)`: always
   `MY_DOCUMENTS_EXPAND_KEY`, plus `LIBRARY_EXPAND_KEY` when `isLibraryView(selected.kind)` (`gallery`, `themes`,
   `shape-libraries`). When `selected.kind` changes to a Library view, `LIBRARY_EXPAND_KEY` is added during that render
   (state adjusted in render, not an effect). Toggling is `toggleExpand(key)`; `expand(key)` opens idempotently, used to
   reveal a new folder's parent (My documents for a root folder).
4. **Row activation** (click on the label area, or Enter / Space): `go(node)` for a view row, `toggleExpand` for
   Library, `setTeamModalOpen(true)` and `setMobileNavOpen(false)` for New team, `window.location.assign` for a team
   folder. Home also clears the Timeline unread count. Each activation calls `trackSidebar(row)` first.
5. **Chevron**: a click on the gutter toggles that row; it never activates it. My documents is expandable only while it
   has a root folder (the page) or a root folder or document (the panel).
6. **Roving tab stop** (`useTreeNavigation`): after every render exactly one `treeitem` in the `nav` has
   `tabIndex = 0`: the focused one while focus is inside the `nav`, else the `aria-selected` one, else the first.
7. **Keys** on a focused `treeitem` (ignored when the event comes from an `input`, `textarea` or a descendant control):
   Down / Up next / previous item in document order; Home / End first / last; Right on `aria-expanded="false"` clicks
   its toggle, on `"true"` focuses its first child item; Left on `"true"` clicks its toggle, otherwise focuses the
   closest ancestor `treeitem`; Enter / Space click its activate element; a single printable character focuses the next
   item (wrapping) whose `data-tree-label` starts with it, case-insensitively. Handled keys `preventDefault`.
8. **Page titles** (`VIEW_TITLES`): the pane title is `VIEW_TITLES[kind]` (a folder or team by its name); the
   breadcrumb is `[My documents, …ancestors, folder]` for a folder, `[Home, leaf]` for Recent (`leadsBackHome`), and
   the single leaf otherwise (the Timeline included: it has a row); each static page's `metadata.title` is
   `viewDocumentTitle(kind)`. The Inbox is `VIEW_TITLES.inbox = SIDEBAR_LABELS.inbox` ("Inbox"), the Timeline
   `VIEW_TITLES.timeline = SIDEBAR_LABELS.timeline` ("Timeline").
   **Retired Activity route.** `selectedFromRoute` reads `/explorer/activity` as `{ kind: 'inbox' }`, so the Inbox row
   highlights at once, and `app/explorer/activity/page.tsx` renders `RetiredViewRedirect from="activity"`, which
   `router.replace`s to `RETIRED_VIEW_TARGETS.activity` (`/explorer/inbox`).
9. **Panel** (`PanelExplorerTree`): rows with documents toggle on activation (Shared with me, My documents, folders,
   teams, This browser; a team or Shared with me with nothing in it goes to its page); Home,
   Inbox, Timeline, Library pages and Trash, and Shared with me, My documents or a team with nothing in it, call `openExplorerPage` (`window.location.assign(explorerPathFor(node))`). The open
   document's row is `aria-selected`. Keys `space:my-documents`, `overview:shared`, `more:this-browser`, `more:library`, folder and team ids, all false at first. Activations
   call `trackSidebar(row, 'panel')` (`ExplorerPanel.<Row>`).
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

- Row: `[indent 16px × depth][gutter 20px][icon][label][badge][trailing]`, text 12px, padding as today.
- Group title: 10px semibold uppercase, `tracking-wider`, `text-slate-400`; first group without top margin.
- Separator: inside the title's own box (same classes, so the same height): the title as `sr-only` text and an
  absolutely placed `h-px` line, `bg-slate-200` / `dark:bg-slate-700`, at its vertical middle. The first group's
  title, under separators, is an `sr-only` heading with no box.
- Local only pill: `optical-edges`, rounded-full, `px-1.5`, 10px semibold, `text-amber-800` on `bg-amber-50` with an
  `amber-600` ring (dark: `text-amber-200` on `amber-500/15`, `amber-400` ring), the app-window glyph at 10px.
- Panel: the tree sits in `max-h-[60vh] overflow-y-auto` under the Current Document card, at the panel's `w-64`.
- Sign-in nudge: the existing card, last in Spaces.
- New team: a row with `PlusIcon`, label "New team".
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

| Rule                                                 | Test                                                                                                                                                                                                           |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Group order and row order                            | `sidebar-structure.test.ts`                                                                                                                                                                                    |
| Guest vs signed in (teams, New team, nudge, Invites) | `sidebar-structure.test.ts`                                                                                                                                                                                    |
| This browser hidden when empty, kept while selected  | `sidebar-structure.test.ts`                                                                                                                                                                                    |
| Titles vs separators per mode                        | `sidebar-structure.test.ts`, `SidebarGroup.test.tsx`                                                                                                                                                           |
| Initial expansion and Library views                  | `sidebar-structure.test.ts`, `useSidebarExpansion.test.tsx`                                                                                                                                                    |
| Preferences unread while hydrating                   | `useHydrated.test.tsx`, `e2e/explorer-sidebar.spec.ts` (no hydration error under Minimal chrome)                                                                                                               |
| Telemetry values charted and explained               | `apps/telemetry` `metric-emitters.test.ts`, `event-explanation.test.ts`                                                                                                                                        |
| Gutter on every row; ARIA attributes                 | `SidebarRow.test.tsx`                                                                                                                                                                                          |
| Keyboard model and roving tab stop                   | `useTreeNavigation.test.tsx`                                                                                                                                                                                   |
| Panel rows, in-place opening, navigation, separators | `PanelExplorerTree.test.tsx`, `PanelFolderItem.test.tsx`, `panel-tree-model.test.ts`                                                                                                                           |
| Retired `/explorer/activity` reads as the Inbox      | `routes.test.ts`, `RetiredViewRedirect.test.tsx`                                                                                                                                                               |
| Page titles follow the rows                          | `view-titles.test.ts`                                                                                                                                                                                          |
| Local only: space, pill, rows, search, Trash         | `document-space.test.ts`, `LocalOnlyPill.test.tsx`, `explorer-route-document-row.test.tsx`, `document-badges.test.tsx`, `search.test.ts`, `SearchPanel.test.tsx`, `TrashPane.test.tsx`, `SharedBadge.test.tsx` |
| Real browser: groups, keyboard, drawer               | `e2e/explorer-sidebar.spec.ts` (page and editor panel), `e2e/clerk-stub/explorer-sidebar.spec.ts`                                                                                                              |

## Constants and configuration

| Constant                  | Value                  | Provenance                       |
| ------------------------- | ---------------------- | -------------------------------- |
| `INDENT_STEP`             | 16 px                  | Unchanged from the previous tree |
| Chevron gutter            | 20 px (`h-5 w-5`)      | Unchanged; now always reserved   |
| `MY_DOCUMENTS_EXPAND_KEY` | `'space:my-documents'` | Prefix keeps it apart from UUIDs |
| `LIBRARY_EXPAND_KEY`      | `'more:library'`       | Same                             |

## Assets and external resources

`house`, `library` and `folder-root` vendored from `lucide-static` (ISC) through `packages/icons/lucide-manifest.json`
and `pnpm icons:vendor`; `app-window` is already vendored. `InboxIcon` and `TimelineIcon` are drawn in house on the
16-unit grid (`G16`); the Timeline's spine matches the help centre's `timeline` card glyph.

## Defaults ledger

See [DEFAULTS.md](DEFAULTS.md) rows D59 to D64.
