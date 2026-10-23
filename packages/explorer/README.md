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

| Prop                       | Type                                   | What                                                                                                                                                   |
| -------------------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `app`                      | `App`                                  | The host app. Its kind is what New makes and what the "this app" filter shows.                                                                         |
| `client`                   | `IndexClient`                          | From `createIndexClient`.                                                                                                                              |
| `view`                     | `ExplorerView`                         | What to show, usually `viewFromLocation(pathname, search)`.                                                                                            |
| `onNavigate`               | `(view, href, options?) => void`       | Go to another view. `href` is `explorerPath(view, basePath)`. `options.replace` asks for the current history entry to be replaced (the lens's writes). |
| `itemHref`                 | `(item, at?) => string`                | An item's address in its own app. `at` holds the tab and element when opened from the Inbox.                                                           |
| `onCreate`                 | `(placement) => void`                  | New: make this app's kind at `{ folderId, teamId }`, then open it.                                                                                     |
| `renderThumbnail?`         | `(item, 'row' \| 'card') => ReactNode` | A preview. Without it, rows show the kind's icon.                                                                                                      |
| `Link?`                    | `ComponentType<LinkProps>`             | The host's link. Defaults to `<a>`.                                                                                                                    |
| `onOpenItem?`              | `(href, item) => void`                 | Open an item from a menu. Defaults to a page load.                                                                                                     |
| `basePath?`                | `string`                               | Where the Explorer lives. Defaults to `/explorer`.                                                                                                     |
| `teams?`                   | `{ id, name }[]`                       | The person's joined teams, from the token's `teams` claim. The index keeps no teams.                                                                   |
| `viewerId?`                | `string`                               | The person's id, for the Inbox's "Assigned to You".                                                                                                    |
| `shareUrl?`                | `(link, item) => string`               | A share link's address. Defaults to `${origin}/s/<code>`.                                                                                              |
| `manageTeamsUrl?`          | `string`                               | Shows a Manage Teams row that links here.                                                                                                              |
| `filter?`/`onFilterChange` | `'app' \| 'all'`                       | Controls the filter from outside. Without them the Explorer keeps it, remembered per app.                                                              |
| `toolbar?`                 | `ReactNode`                            | The host's own controls, beside the search field.                                                                                                      |
| `header?`                  | `({ search }) => ReactNode`            | The host's header, drawn above the hero and given the search field to place (null on Home with the hero). Without it the Explorer draws a plain bar.   |
| `heroArt?`                 | `ReactNode`                            | A picture for the right of Home's hero, from `lg` up (liveplanner's fanned previews).                                                                  |
| `heroWords?`               | `{ question, lead }`                   | The hero's words after the greeting. Defaults to the app kind's.                                                                                       |
| `heroHidden?`/`onHideHero` | `boolean` / `() => void`               | Controls the hero from the host's setting. Without them the close is remembered per app in this browser.                                               |
| `helpHref?`                | `(view) => string \| undefined`        | A Help article for a view. Shows a Help button in that view's header and the hero's corner.                                                            |
| `onTimeline?`              | `(action, type) => void`               | The Timeline's reports for telemetry: `Changed`, `Selected`, `Loaded`, `Opened` or `Removed`, by a fixed token.                                        |
| `onHome?`                  | `(action, type) => void`               | Home's What Happened reports for telemetry: `Selected` (`WhatHappened`, `SeeTimeline`) or `Opened` (`Group`).                                          |
| `lensTemplates?`           | `{ value, label }[]`                   | The template families the lens's Template chip offers, matched to the last word of an item's intent. Without them there is no Template chip.           |
| `onLensSelected?`          | `(type) => void`                       | The lens's report for telemetry: a facet (`Text`, `Template`, `MadeBy`, `Edited`, `People`, `Space`) gained a value.                                   |

Views (`ExplorerView`) and their addresses under `basePath`. A list view's `q` is its filter lens, written as `?q=`:

| View                                  | Address                         | Shows                                                                    |
| ------------------------------------- | ------------------------------- | ------------------------------------------------------------------------ |
| `{ kind: 'home' }`                    | `/explorer` or `/explorer/home` | The hero, Jump Back In, Shared With You Recently and What Happened       |
| `{ kind: 'all', q? }`                 | `/explorer/all`                 | My Work: your root folders and your items that are in no folder          |
| `{ kind: 'unsorted', q? }`            | `/explorer/unsorted`            | Every item in no folder, yours and your teams'                           |
| `{ kind: 'recent', q? }`              | `/explorer/recent`              | By last opened                                                           |
| `{ kind: 'favourites', q? }`          | `/explorer/favourites`          | Starred                                                                  |
| `{ kind: 'shared', q? }`              | `/explorer/shared`              | Shared With Me: items reached through a link                             |
| `{ kind: 'trash' }`                   | `/explorer/trash`               | The Trash, grouped by owner: Restore, Delete permanently, Empty Trash    |
| `{ kind: 'inbox' }`                   | `/explorer/inbox`               | `GET /inbox`: actions and threads, each linking to its app               |
| `{ kind: 'timeline' }`                | `/explorer/timeline`            | `GET /timeline`: what happened, by day, as cards; filters and a calendar |
| `{ kind: 'search', q }`               | `/explorer/search?q=`           | Everything you can open, narrowed by the lens (`view=search`)            |
| `{ kind: 'folder', id, q? }`          | `/explorer/folder?id=`          | A folder                                                                 |
| `{ kind: 'team', id, folderId?, q? }` | `/explorer/team?id=[&folder=]`  | A team's library, or one of its folders                                  |

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

Props: `app`, `client`, `itemHref`, `onCreate`, `current?`, `onOpenExplorer?(view)`, `onTrashCurrent?(item)` (the
host trashes the item open in its editor itself, from any of the panel's menus or a drop on its Trash),
`onRenameCurrent?(title)` (the open item was renamed, from its pencil or any menu's Rename, so the editor's title
follows), and the same optional props as `<Explorer>`.

Rename works in place wherever an item shows: list rows, cards, Details rows, Home's Jump Back In and the panel.

Lists that span places (Recent, Favourites, Search, Shared With Me) carry a location chip on each row and card: its
folder, its team for a team item in no folder, or My Work for one of yours in none; an item reached through a link
lives in someone else's library and has none. Recent and Search add an Owner column (and a line on each card): You,
the team's name, or Shared with you (the index keeps no names, so a sharer is not named).

## Drag and drop

On the page and in the panel, an item the person manages (their own or a team's; never one reached through a
link, nor one being renamed) drags from its row, card or Details row.

- **Onto a place.** It drops on a folder (in the sidebar, as a row or card in the pane, or a card in the panel),
  on My Work (the root) or on a team, in the sidebar or the panel's rail. The drop takes Change Folder's path (the
  same optimistic move, rollback and toast: "Moved “X” to Y." with an Undo). Dropping where it already is does
  nothing. The place wears a brand ring while the drag is over it, and a closed sidebar row (or a rail entry) opens
  once a drag rests on it for 800 ms.
- **Onto the Trash.** While anything drags, the Trash wakes as a target: dashed, reading "Drop to Trash"; filled
  with the brand colour, its bin's lid tipped and reading "Let go to trash it" while the drag is over it; one short
  bounce as it swallows an item. An item goes through its own Delete (with the Trash's Undo); one of the person's
  own folders, which also drags, goes through Delete Folder and its confirmation. Never red: the Trash is undoable.
  A live region reads the Trash's words as they change.
- **From the keyboard.** Every drop has a menu twin: Change Folder and Delete on the row's menu (`⋯`,
  right-click or Shift+F10).

Drags carry their own types (`application/x-liveworkspace-item`, `-folder`), so a drop outside any target does
nothing and a drag from another tab is never taken. Rows and cards do not re-render as a drag starts or ends;
only the targets do (`drag.test.tsx` holds a 2,000-row page to two commits).

Also exported: `explorerPath`, `viewFromLocation`, `kindWords`, and the types above.

## How it loads

Every list is one request per page of at most 200 (`LIST_LIMIT_MAX`). The next page loads as the end of
the list scrolls near.

| Data                  | When it loads                                                                                                                                                                              |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Folders               | Once, paging if needed. The sidebar, breadcrumbs, folder rows and Move all read this copy.                                                                                                 |
| Inbox                 | Once per filter. The sidebar's counts (Inbox, and the Timeline's new events) and the Inbox view share it.                                                                                  |
| Home                  | Three small requests: Recent (8, carrying Most Used via `used`), Shared (4) and one Timeline page (30) for What Happened.                                                                  |
| Folder cards and rows | One `GET /folders/previews` per batch of up to 60 cards (or list rows on screen) not yet answered, for their mosaics and counts ("1 folder · 5 plans"); again after an item changes place. |
| Timeline              | One `GET /timeline` page of 30 on arrival and per filter, then one per Show More (5 at most for an `#event=` link). One `POST /timeline/seen` a visit. Removing: 100 ids a call.           |
| Home's hero           | One count request while it shows (My Work, one page of up to 200; "200+" past that). The Inbox pill reuses the sidebar's Inbox. None when the hero is hidden.                              |

Nothing is fetched per row, or per folder.

Changes are optimistic: rename, favourite, move, Trash, restore and dismiss.

- A change is laid over every loaded list at once, through a shared overlay.
- If the index refuses, the change is taken back and a toast says why.
- Toasts name what they acted on: a move ("Moved “X” to Y.") and a delete ("Moved “X” to the Trash.") each carry an
  Undo, a restore says "“X” restored.". A toast with an Undo stays 10 s (`TOAST_ANSWER_MS`), its clock stopped while
  it is hovered or focused; others go after 5 s. Delete Forever is always confirmed. Deleting the folder on screen,
  or one holding it, goes to My Work or the team's library.
- A copy or an emptied Trash cannot be guessed, so those reload the lists instead.
- Rows are memoised and keep their identity unless their own item changed, so one change re-renders one row.

Long lists stay small in the DOM:

- **List and Details** use 48 px rows, windowed against whichever element scrolls.
- **Cards** are revealed 60 at a time.

The filter lens (`q` on a list view; liveplanner/docs/specs/013-workspace/explorer-filters.md) is parsed on the
reader's side (`src/lens/`) and sent to the index as filters (`q`, `source`, `since`, `owner`, `intent`, `space`;
`deep=1` on a folder), so the index narrows each page. The address follows the field at most every 250 ms, replacing
the history entry, and a newer list read cancels the older one.

## Tests

`corepack pnpm --filter @liveworkspace/explorer test` (vitest with jsdom).

- The hooks' optimistic paths are tested against an in-memory fake index (`src/test/fakeClient.ts`).
- `HomeHero.test.tsx` covers the hero: greeting, pills, New, art, Help and close, and its one count request.
- `what-happened.test.tsx` covers What Happened: others' doings only from one page, groups and summaries, New,
  no seen mark, the section left out when empty or failed, All with app marks, and See Timeline. Its rules, and
  10,000 events grouped under a budget, are in `timeline/whatHappened.test.ts`.
- `perf.test.tsx` renders 2,000 items in each layout under a time budget.
- `timeline.test.tsx` covers the Timeline view: this app's events by default, All with each app's mark, New and
  the seen mark, Show More and stacks, the failed read, the filters, one page however long the history, the card
  and stack menus with Remove from Timeline (and its refusal), rename on a card, `#event=` links and their bounded
  paging, the Upcoming band, and the sidebar's count clearing without a new request.
  `timeline/model.test.ts` holds its rules, and works out 10,000 events' days and stacks under a budget.
