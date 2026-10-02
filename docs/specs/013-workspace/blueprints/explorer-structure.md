# Explorer structure blueprint

Derived from [Explorer structure](../explorer-structure.md). The sidebar is one pure layout function (which groups and
rows show, from a handful of facts) and a set of small components that render it as ARIA trees, with one keyboard hook
on the `nav`.

## Files

| File                                                      | Holds                                                                                                                                            |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `apps/live/app/explorer/sidebar/sidebar-structure.ts`     | Group titles, row labels, expand keys, `sidebarGroups`, `sidebarDivider`, `isLibraryView`, `initialExpanded`                                     |
| `apps/live/app/explorer/sidebar/sidebar-telemetry.ts`     | `SidebarTelemetryRow`, `trackSidebar`                                                                                                            |
| `apps/live/app/explorer/sidebar/useTreeNavigation.ts`     | `useTreeNavigation`: roving tab stop and the tree keys, over the DOM                                                                             |
| `apps/live/app/explorer/sidebar/ExplorerSidebar.tsx`      | The `nav`: reads the context, computes the layout, renders the three groups in order                                                             |
| `apps/live/app/explorer/sidebar/SidebarGroup.tsx`         | One group: its title (visible or visually hidden) or the hairline, and its `tree`                                                                |
| `apps/live/app/explorer/sidebar/SidebarRow.tsx`           | `SidebarRow`: one `treeitem` with the chevron gutter, icon, label, badge, trailing slot and child `group`                                        |
| `apps/live/app/explorer/sidebar/OverviewGroup.tsx`        | Home, Activity, Shared with me                                                                                                                   |
| `apps/live/app/explorer/sidebar/SpacesGroup.tsx`          | My documents (Unsorted, Generated, folders), teams, Invites, New team, the sign-in nudge                                                         |
| `apps/live/app/explorer/sidebar/TeamRows.tsx`             | One row per team with its folder subtree                                                                                                         |
| `apps/live/app/explorer/sidebar/MoreGroup.tsx`            | This browser, Library (Image gallery, Themes, Shape libraries), Trash                                                                            |
| `apps/live/app/explorer/sidebar/SidebarFolderSubtree.tsx` | A personal folder row, its menu, and its subfolders                                                                                              |
| `apps/live/app/explorer/sidebar/TeamFolderSubtree.tsx`    | A team folder row and its subfolders                                                                                                             |
| `apps/live/app/explorer/sidebar/SidebarSignInNudge.tsx`   | The guest's "Sign in to access Teams" card                                                                                                       |
| `apps/live/app/explorer/useExplorerState.ts`              | `expanded` starts from `initialExpanded(selected)`; Library opens when a Library view becomes current                                            |
| `apps/live/app/explorer/ExplorerShell.tsx`                | The header's Search control                                                                                                                      |
| `apps/live/components/panels/ExplorerSections.tsx`        | The floating panel's My documents tab label, from `SIDEBAR_LABELS`                                                                               |
| `apps/live/components/primitives/explorer-icons.tsx`      | `HomeIcon` (lucide `house`), `LibraryIcon` (lucide `library`), `ThisBrowserIcon` (lucide `app-window`), `MyDocumentsIcon` (lucide `folder-root`) |

## Domain and naming

| Term        | Identifier                                      | Meaning                                                                         |
| ----------- | ----------------------------------------------- | ------------------------------------------------------------------------------- |
| group       | `SidebarGroupId`                                | `'overview' \| 'spaces' \| 'more'`                                              |
| group title | `SIDEBAR_GROUP_TITLES[id]`                      | "Overview", "Spaces", "More"                                                    |
| row         | `SidebarRowKind`                                | The top-level rows a group may hold (below)                                     |
| row label   | `SIDEBAR_LABELS[key]`                           | Sentence-case copy for every fixed row                                          |
| divider     | `SidebarDivider`                                | `'titles' \| 'separators'`                                                      |
| expand key  | `MY_DOCUMENTS_EXPAND_KEY`, `LIBRARY_EXPAND_KEY` | Entries of the shared `expanded` set, prefixed so no folder or team id collides |

`SidebarRowKind`: `home`, `activity`, `shared`, `myDocuments`, `teams` (zero or more team rows), `invites`, `newTeam`,
`signInNudge`, `thisBrowser`, `library`, `trash`. "Space" in code means My documents or a team; "Offline" stays the
name of the view (`kind: 'offline'`), whose row reads "This browser".

## Behaviour and state

1. **Layout** (`sidebarGroups(input)`), input `{ signedIn, signInAvailable, pendingInvites, offlineDocuments, selected }`:
   - `overview`: `home`, `activity`, `shared`.
   - `spaces`: `myDocuments`; then `teams` when `signedIn`; `invites` when `signedIn` and (`pendingInvites > 0` or
     `selected === 'invites'`); `newTeam` when `signedIn`; `signInNudge` when `!signedIn && signInAvailable`.
   - `more`: `thisBrowser` when `offlineDocuments > 0` or `selected === 'offline'`; `library`; `trash`.
2. **Divider** (`sidebarDivider(minimalChrome)`): `'separators'` when `isMinimalChrome(prefs)`, else `'titles'`.
3. **Expansion**: `expanded` starts as `initialExpanded(selected)`: always `MY_DOCUMENTS_EXPAND_KEY`, plus
   `LIBRARY_EXPAND_KEY` when `isLibraryView(selected.kind)` (`gallery`, `themes`, `shape-libraries`). An effect on
   `selected.kind` adds `LIBRARY_EXPAND_KEY` when a Library view becomes current. Toggling is `toggleExpand(key)`.
4. **Row activation** (click on the label area, or Enter / Space): `go(node)` for a view row, `toggleExpand` for
   Library, `setTeamModalOpen(true)` and `setMobileNavOpen(false)` for New team, `window.location.assign` for a team
   folder. Home also clears the Timeline unread count. Each activation calls `trackSidebar(row)` first.
5. **Chevron**: a click on the gutter toggles that row; it never activates it.
6. **Roving tab stop** (`useTreeNavigation`): after every render exactly one `treeitem` in the `nav` has
   `tabIndex = 0`: the focused one while focus is inside the `nav`, else the `aria-selected` one, else the first.
7. **Keys** on a focused `treeitem` (ignored when the event comes from an `input`, `textarea` or a descendant control):
   Down / Up next / previous item in document order; Home / End first / last; Right on `aria-expanded="false"` clicks
   its toggle, on `"true"` focuses its first child item; Left on `"true"` clicks its toggle, otherwise focuses the
   closest ancestor `treeitem`; Enter / Space click its activate element; a single printable character focuses the next
   item (wrapping) whose `data-tree-label` starts with it, case-insensitively. Handled keys `preventDefault`.
8. **Folder menu by keyboard**: the `treeitem` carries the row's `onContextMenu`; Shift+F10 and the Menu key fire
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
  | 'activity'
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
| Current view has no row (Recent, Favourites, Dynamic) | No row is `aria-selected`; the tab stop falls back to the first row                |
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
- Separator: `h-px` `bg-slate-200` / `dark:bg-slate-700`, `my-3`, between groups only.
- Sign-in nudge: the existing card, last in Spaces.
- New team: a row with `PlusIcon`, label "New team".
- Header Search: a toolbar-style button left of the account control, magnifier plus "Search" (label hidden below `sm`).

## Accessibility

As the spec's Keyboard and ARIA section. Focus ring: `ring-2 ring-brand-500` on the row when its `treeitem` is
`:focus-visible`. Hidden titles use `sr-only`. Badges keep `CountBadge`'s accessible text.

## Web Experience

No new network or JS on the critical path. CLS: initial expansion is computed before first paint
(`initialExpanded`); the divider follows prefs at render; no element changes size after load.

## Observability

`trackSidebar` is the decision log for activations. Unchanged failure logging elsewhere (folder menu actions, team
creation).

## Testing

| Rule                                                 | Test                                                                      |
| ---------------------------------------------------- | ------------------------------------------------------------------------- |
| Group order and row order                            | `sidebar-structure.test.ts`                                               |
| Guest vs signed in (teams, New team, nudge, Invites) | `sidebar-structure.test.ts`                                               |
| This browser hidden when empty, kept while selected  | `sidebar-structure.test.ts`                                               |
| Titles vs separators per mode                        | `sidebar-structure.test.ts`, `SidebarGroup.test.tsx`                      |
| Initial expansion and Library views                  | `sidebar-structure.test.ts`                                               |
| Gutter on every row; ARIA attributes                 | `SidebarRow.test.tsx`                                                     |
| Keyboard model and roving tab stop                   | `useTreeNavigation.test.tsx`                                              |
| Real browser: groups, keyboard, drawer               | `e2e/explorer-sidebar.spec.ts`, `e2e/clerk-stub/explorer-sidebar.spec.ts` |

## Constants and configuration

| Constant                  | Value                  | Provenance                       |
| ------------------------- | ---------------------- | -------------------------------- |
| `INDENT_STEP`             | 16 px                  | Unchanged from the previous tree |
| Chevron gutter            | 20 px (`h-5 w-5`)      | Unchanged; now always reserved   |
| `MY_DOCUMENTS_EXPAND_KEY` | `'space:my-documents'` | Prefix keeps it apart from UUIDs |
| `LIBRARY_EXPAND_KEY`      | `'more:library'`       | Same                             |

## Assets and external resources

`house`, `library` and `folder-root` vendored from `lucide-static` (ISC) through `packages/icons/lucide-manifest.json`
and `pnpm icons:vendor`; `app-window` is already vendored.

## Defaults ledger

See [DEFAULTS.md](DEFAULTS.md) rows D17 to D22.
