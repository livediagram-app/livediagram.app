# @liveworkspace/explorer

The One Explorer UI, built once. Each app renders it at its own `/explorer`. It lists that app's items or
every app's, and its New button makes that app's kind (Canvas, Plan, Document or Design). It looks and
behaves like livediagram's Explorer, in the host's accent and words; its components were ported from
liveplanner's. Its data comes from the index
through `@liveworkspace/index-client`.

The plan is [one-explorer.md](../../liveworkspace/docs/one-explorer.md). The calls it makes are in
[one-explorer-contracts.md](../../liveworkspace/docs/one-explorer-contracts.md).

## Use

```tsx
import { Explorer, viewFromLocation, explorerPath } from '@liveworkspace/explorer';
import { createIndexClient } from '@liveworkspace/index-client';
import Link from 'next/link';

const client = createIndexClient({ getToken });

export function ExplorerPage() {
  const router = useRouter();
  const view = viewFromLocation(usePathname(), useSearchParams());
  return (
    <Explorer
      app="liveplanner"
      client={client}
      view={view}
      onNavigate={(_view, href) => router.push(href)}
      itemHref={(item, at) => hrefInItsApp(item, at)}
      onCreate={(placement) => createAndOpen(placement)}
      Link={Link}
      teams={tokenTeams}
      viewerId={userId}
      renderThumbnail={(item, size) => <Thumbnail item={item} size={size} />}
    />
  );
}
```

The package never imports `next/*`. The host owns routing, and the Explorer reaches it in three ways:

- `onNavigate(view, href)`: go to another view.
- `itemHref(item, at?)`: an item's address.
- `Link`: the host's link component. Without one, links are plain `<a>` tags.

### Styling

The components use Tailwind utilities over `slate-*` and the host's `brand-*` ramp (`--color-brand-50…950`).
Each app's accent and chrome apply without the package knowing them. To let Tailwind see the package's
classes, add one line next to the host's Tailwind entry:

```css
@import '@liveworkspace/explorer/explorer.css'; /* @source './src' */
```

Dark mode follows the host's `.dark` variant. The empty-state art animates only if the host theme defines
`animate-empty-ring` and `animate-empty-float`; liveplanner's theme does. Without them it stands still.

## API

### `<Explorer>`

| Prop                       | Type                                   | What                                                                                         |
| -------------------------- | -------------------------------------- | -------------------------------------------------------------------------------------------- |
| `app`                      | `App`                                  | The host app. Its kind is what New makes and what the "this app" filter shows.               |
| `client`                   | `IndexClient`                          | From `createIndexClient`.                                                                    |
| `view`                     | `ExplorerView`                         | What to show, usually `viewFromLocation(pathname, search)`.                                  |
| `onNavigate`               | `(view, href) => void`                 | Go to another view. `href` is `explorerPath(view, basePath)`.                                |
| `itemHref`                 | `(item, at?) => string`                | An item's address in its own app. `at` holds the tab and element when opened from the Inbox. |
| `onCreate`                 | `(placement) => void`                  | New: make this app's kind at `{ folderId, teamId }`, then open it.                           |
| `renderThumbnail?`         | `(item, 'row' \| 'card') => ReactNode` | A preview. Without it, rows show the kind's icon.                                            |
| `Link?`                    | `ComponentType<LinkProps>`             | The host's link. Defaults to `<a>`.                                                          |
| `onOpenItem?`              | `(href, item) => void`                 | Open an item from a menu. Defaults to a page load.                                           |
| `basePath?`                | `string`                               | Where the Explorer lives. Defaults to `/explorer`.                                           |
| `teams?`                   | `{ id, name }[]`                       | The person's joined teams, from the token's `teams` claim. The index keeps no teams.         |
| `viewerId?`                | `string`                               | The person's id, for the Inbox's "Assigned to You".                                          |
| `shareUrl?`                | `(link, item) => string`               | A share link's address. Defaults to `${origin}/s/<code>`.                                    |
| `manageTeamsUrl?`          | `string`                               | Shows a Manage Teams row that links here.                                                    |
| `filter?`/`onFilterChange` | `'app' \| 'all'`                       | Controls the filter from outside. Without them the Explorer keeps it, remembered per app.    |
| `toolbar?`                 | `ReactNode`                            | The host's own controls, beside the search field.                                            |
| `header?`                  | `({ search }) => ReactNode`            | The host's header, drawn above the hero and given the search field to place (null on Home with the hero). Without it the Explorer draws a plain bar. |
| `heroArt?`                 | `ReactNode`                            | A picture for the right of Home's hero, from `lg` up (liveplanner's fanned previews).          |
| `heroWords?`               | `{ question, lead }`                   | The hero's words after the greeting. Defaults to the app kind's.                              |
| `heroHidden?`/`onHideHero` | `boolean` / `() => void`               | Controls the hero from the host's setting. Without them the close is remembered per app in this browser. |
| `helpHref?`                | `(view) => string \| undefined`        | A Help article for a view. Shows a Help button in that view's header and the hero's corner.   |

Views (`ExplorerView`) and their addresses under `basePath`:

| View                              | Address                         | Shows                                                           |
| --------------------------------- | ------------------------------- | --------------------------------------------------------------- |
| `{ kind: 'home' }`                | `/explorer` or `/explorer/home` | The hero, Jump Back In (Recent, Earlier) and Shared With You Recently |
| `{ kind: 'all' }`                 | `/explorer/all`                 | My Work: your root folders and your items that are in no folder |
| `{ kind: 'unsorted' }`            | `/explorer/unsorted`            | Every item in no folder, yours and your teams'                  |
| `{ kind: 'recent' }`              | `/explorer/recent`              | By last opened                                                  |
| `{ kind: 'favourites' }`          | `/explorer/favourites`          | Starred                                                         |
| `{ kind: 'shared' }`              | `/explorer/shared`              | Shared With Me: items reached through a link                    |
| `{ kind: 'trash' }`               | `/explorer/trash`               | The Trash, grouped by owner: Restore, Delete permanently, Empty Trash |
| `{ kind: 'inbox' }`               | `/explorer/inbox`               | `GET /inbox`: actions and threads, each linking to its app      |
| `{ kind: 'search', q }`           | `/explorer/search?q=`           | The index's title and folder search                             |
| `{ kind: 'folder', id }`          | `/explorer/folder?id=`          | A folder                                                        |
| `{ kind: 'team', id, folderId? }` | `/explorer/team?id=[&folder=]`  | A team's library, or one of its folders                         |

### `<MoveToFolderDialog>`

liveplanner's move dialog. It takes plain data, so a host can open it without the Explorer:
`subjectName`, `subjectKind` (`'item' | 'folder'`), `personalFolders?`, `teams?` (each with its folders),
`currentTeamId?`, `currentFolderId?`, `onCreateFolder?`, `onPick({ teamId, folderId })` and `onClose`.

### `<ShareDialog>`

An item's share links: `client`, `item`, `tabs?`, `shareUrl`, `onClose` and `onError?`.

- Each link has a level: Viewer, Participant or Editor.
- A link can open every tab or only one.
- A link lasts forever, a week, a month or six months, and can be extended.
- Each link can be copied or turned off.
- One password can guard every link at once.

### `<ExplorerPanel>`

The content of the editor's floating Explorer panel. The host wraps it in its own movable panel. It shows:

- the current item, which can be renamed and has the item menu;
- a rail with Home, Inbox, Shared With Me, My Work, each team, Favourites and Trash, plus New and Open
  Explorer;
- the chosen section as compact rows, paged.

Props: `app`, `client`, `itemHref`, `onCreate`, `current?`, `onOpenExplorer?(view)`, and the same optional
props as `<Explorer>`.

Also exported: `explorerPath`, `viewFromLocation`, `kindWords`, and the types above.

## How it loads

Every list is one request per page of at most 200 (`LIST_LIMIT_MAX`). The next page loads as the end of
the list scrolls near.

| Data          | When it loads                                                                              |
| ------------- | ------------------------------------------------------------------------------------------ |
| Folders       | Once, paging if needed. The sidebar, breadcrumbs, folder rows and Move all read this copy. |
| Inbox         | Once per filter. The sidebar's count and the Inbox view share it.                          |
| Home          | Two small requests: Recent (8) and Shared (4).                                             |
| Home's hero   | One count request while it shows (My Work, one page of up to 200; "200+" past that). The Inbox pill reuses the sidebar's Inbox. None when the hero is hidden. |

Nothing is fetched per row, or per folder.

Changes are optimistic: rename, favourite, move, Trash, restore and dismiss.

- A change is laid over every loaded list at once, through a shared overlay.
- If the index refuses, the change is taken back and a toast says why.
- A copy or an emptied Trash cannot be guessed, so those reload the lists instead.
- Rows are memoised and keep their identity unless their own item changed, so one change re-renders one row.

Long lists stay small in the DOM:

- **List and Details** use 48 px rows, windowed against whichever element scrolls.
- **Cards** are revealed 60 at a time.

Search waits 250 ms after typing stops, and a newer search cancels the older request.

## Tests

`corepack pnpm --filter @liveworkspace/explorer test` (vitest with jsdom).

- The hooks' optimistic paths are tested against an in-memory fake index (`src/test/fakeClient.ts`).
- `HomeHero.test.tsx` covers the hero: greeting, pills, New, art, Help and close, and its one count request.
- `perf.test.tsx` renders 2,000 items in each layout under a time budget.
