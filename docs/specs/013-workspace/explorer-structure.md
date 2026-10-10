# Explorer structure

Status: shipped

## What

The Explorer's sidebar is one navigation tree in three **groups**. It answers two questions at once: where a
document **lives**, and which **views** compute lists of documents from wherever they live.

- **Places.** A document lives in exactly one place: **My documents**, a **team**, or **this browser**
  ([Offline Mode](../006-document/offline-mode.md)). Moving a document changes its place.
- **Views.** Everything else (Home, Activity, Shared with me, Recent, Favourites, Search results, the Library pages,
  Trash) is a computed view. A view never owns a document; it lists documents that live somewhere else.
- **A space's root holds documents.** A document filed in no folder sits at the root of its space, listed beside the
  root folders: there is no Unsorted bucket and no Generated bucket. What an AI made is found with the **Made by AI**
  filter ([Explorer filters](explorer-filters.md)), wherever it is filed.
- **Spaces are root folders.** My documents and each team are root-level folder rows in one tree, with their folders
  beneath them. My documents maps one to one onto the [Google Drive mirror](../022-drive-mirror/drive-mirror.md)'s root
  folder.

The sidebar holds navigation only. It carries no greeting, no search field, no New button and no pins:

- **Search** lives in the top bar: the lens field of [Explorer filters](explorer-filters.md#the-field), left of the
  account control, searches and filters the documents of the current view. The bottom bar's Search opens the
  app-wide search panel.
- **New folder** and **New document** live in the page header of the view they create in.
- The account is reached from the header's account menu.

## Groups and rows

Top to bottom. "Opens" names the view a row selects; every view keeps its own route
([Folders: Explorer routes](folders.md#explorer-routes)). Row labels are sentence case.

### Overview

| Row            | Opens                                                    | Badge                                                     |
| -------------- | -------------------------------------------------------- | --------------------------------------------------------- |
| Home           | `/explorer/home` ([Explorer Home](explorer-home.md))     | Other people's events since the reader last looked (§2.5) |
| Activity       | `/explorer/activity` ([Activity page](activity-page.md)) | Open actions assigned to the reader                       |
| Shared with me | `/explorer/shared`                                       | Documents shared with the reader                          |

Home is the Explorer's landing view. Recent, Favourites and All activity (the [Timeline](timeline.md) feed) have no
sidebar row; their routes (`/explorer/recent`, `/explorer/favourites`, `/explorer/timeline`) keep working. Recent is
reached from Home's Jump back in (**See more**) and All activity from its What happened (**See all activity**).

### Spaces

| Row          | Opens                                  | Children                | Badge                      |
| ------------ | -------------------------------------- | ----------------------- | -------------------------- |
| My documents | `/explorer/all`, the My documents root | The root folders        | None                       |
| Each team    | `/explorer/team?id=<id>`               | The team's root folders | Member count, when above 1 |
| Invites      | `/explorer/invites`                    | None                    | Pending invites            |
| New team     | The New team form (a dialog)           | None                    | None                       |

- **The My documents root** lists its root folders, then its root documents, newest first. A team's root does the
  same for the team. The old Unsorted, Generated and Dynamic addresses still answer: `/explorer/unsorted` and
  `/explorer/dynamic` open the My documents root, `/explorer/generated` opens Search results filtered by
  `made-by:ai`.
- A folder row opens its folder, expands to its subfolders, and carries the folder menu (Rename, New subfolder,
  Change folder, Use as default for, Delete). A team folder row opens the team page at that folder and carries no menu.
- **My documents** carries a menu of its own (its `⋯` button, a right-click, Shift+F10) holding only **Use as
  default for** ([Default folders](default-folders.md#use-as-default-for)).
- A folder that is one of the reader's default folders shows the **default marker** after its name
  ([Default folders](default-folders.md#the-default-marker)), personal and team folder rows alike.
- **Invites** shows only while the reader has a pending invite (or is on the Invites view). An invite also reaches the
  reader through Home and email.
- **New team** is the group's last row, for signed-in readers only.
- A **guest**, on a deployment with sign-in configured, sees the sign-in nudge ("Sign in to access Teams") as the
  group's last item instead of New team. A deployment without sign-in shows neither.

### More

| Row          | Opens                                  | Children                               | Badge                     |
| ------------ | -------------------------------------- | -------------------------------------- | ------------------------- |
| This browser | `/explorer/offline`                    | None                                   | Documents in this browser |
| Library      | Nothing: the row expands and collapses | Image gallery, Themes, Shape libraries | None                      |
| Trash        | `/explorer/trash` ([Trash](trash.md))  | None                                   | None                      |

- **This browser** shows only while this browser holds at least one offline document, or while its view is the current
  one (so the highlighted row never vanishes under the reader). Its documents are the reader's own
  ([Local only documents](#local-only-documents)).
- **Library** has no view of its own: activating it expands or collapses it.

The group's title is **More**.

## Page titles follow the rows

A view is named by its row, everywhere it is named: the page heading, the document title (`<label> | livediagram`),
the breadcrumb and the help centre's copy. Routes stay as they are.

| Row             | Route                       | Page title      |
| --------------- | --------------------------- | --------------- |
| Home            | `/explorer/home`            | Home            |
| Shared with me  | `/explorer/shared`          | Shared with me  |
| My documents    | `/explorer/all`             | My documents    |
| This browser    | `/explorer/offline`         | This browser    |
| Image gallery   | `/explorer/images`          | Image gallery   |
| Shape libraries | `/explorer/shape-libraries` | Shape libraries |

Every other row's view already carries its row's label (Activity, a folder or team by its name, Invites, Themes,
Trash). Views without a row keep their own names (Recent, Favourites, Search results, and All activity at
`/explorer/timeline`). Recent and All activity are reached from Home, and their breadcrumbs lead back to it
(**Home › Recent**, **Home › All activity**).

## Visibility at a glance

| Row           | Guest (sign-in configured) | Guest (no sign-in deployment) | Signed in                |
| ------------- | -------------------------- | ----------------------------- | ------------------------ |
| Overview      | All three                  | All three                     | All three                |
| My documents  | Yes                        | Yes                           | Yes                      |
| Teams         | None                       | None                          | One row per team         |
| Invites       | No                         | No                            | While one is pending     |
| New team      | No                         | No                            | Yes                      |
| Sign-in nudge | Yes                        | No                            | No                       |
| This browser  | While it holds documents   | While it holds documents      | While it holds documents |
| Library       | Yes                        | Yes                           | Yes                      |
| Trash         | Yes                        | Yes                           | Yes                      |

## Expansion

- **My documents** starts expanded, so its root folders stay one click away.
- **Library** starts collapsed, and expands by itself when one of its pages is the current view (on arrival and on
  navigating to one), so the highlighted row is always visible.
- **Teams and folders** start collapsed. My documents, a team or a folder with no subfolders shows no chevron.
- Expansion is session-local (a reload starts afresh) and shared between the desktop sidebar and the mobile drawer.

## Group titles and separators

The groups are told apart in one of two ways, following **Minimal chrome**
([Power user mode](../007-editor/power-user-mode.md#minimal-chrome)), the spec's one flag for "words that teach go":

- **Minimal chrome off** (the default, and always when power user mode is off): each group opens with its **title**, a
  small uppercase section heading: **Overview**, **Spaces**, **More**.
- **Minimal chrome on**: the titles are replaced by thin **hairline separators** between the groups. There is no
  separator above the first group, and no space kept for one: Home sits at the top. Each title stays in the document as
  visually hidden text and still names its group for assistive technology.

Below the first group, a title and its hairline occupy the same box, so switching moves nothing below Home's group;
only the first title's own height comes or goes. Switching happens at render, from the preference, read once the page
has hydrated (a deployment without sign-in prerenders the sidebar, and the render that hydrates it matches that HTML);
nothing moves on its own.

## Alignment

Every row reserves a fixed **chevron gutter** before its icon, whether or not it can expand. So every top-level row's
icon sits on one column, and an expandable row (My documents, a team, Library) lines up with a plain one (Home, Trash,
New team). Each level of nesting indents the whole row (gutter, icon and label) by one step.

## Keyboard and ARIA

The sidebar follows the WAI-ARIA tree pattern, one tree per group:

- The sidebar is a `nav` named "Explorer". Each group is a `tree` labelled by its title (visible or visually hidden).
  Each row is a `treeitem` carrying `aria-level`; an expandable row carries `aria-expanded`; the current view's row
  carries `aria-selected="true"`. A row's children sit in a `group` inside it.
- **One tab stop.** Tab enters the sidebar on the current view's row (or the first row when the current view has no
  visible row), and the next Tab leaves it. The sign-in nudge is a link with its own tab stop.
- **Down / Up** move to the next / previous visible row, across groups, in visual order.
- **Right** expands a collapsed row; on an expanded row it moves to the first child.
- **Left** collapses an expanded row; on a collapsed or plain row it moves to the parent row.
- **Home / End** move to the first / last visible row.
- **Enter** and **Space** activate the row: open its view, toggle Library, or open the New team form.
- **Typing a character** moves to the next row whose label starts with it.
- **Shift+F10** or the **Menu** key opens a folder row's (or My documents') menu, the same menu as its `⋯` button and a
  right-click.
- Keys typed into a folder's inline rename field are the field's, never the tree's.
- Focus is shown with a visible ring on the row (WCAG 2.2 AA focus appearance); mouse clicks show none.

## Mobile drawer

Below the `sm` breakpoint the sidebar is hidden and the pane header's menu button opens it as a drawer from the left:
the same groups, rows, rules and keyboard model. Picking a view, or New team, closes the drawer; so do its Close button
and the backdrop.

## The editor's Explorer

The editor's Explorer, the popover under the menu button ([Folders: the editor's Explorer](folders.md#the-editors-explorer-editor--new)), shows
the same three groups, built from the same rows, layout rules and keyboard model, at the panel's width. Under its
Current Document card it holds one `nav` named "Explorer" with Overview, Spaces and More, in place of the tabs it had.

What differs is what a row does in an editor, where leaving the document is a bigger step:

- **Rows with documents open in place.** Shared with me, My documents, each folder, each team and This browser
  expand to show their documents as rows beneath them; My documents and a team show their root folders, then their
  root documents. My documents with nothing in it goes to its Explorer page, as an empty team does. Shared with me with nothing shared, and a team
  with nothing in it, go to their Explorer page instead. Activating such a row expands or collapses it; it
  never leaves the editor. A document row opens the document, carries the document menu (`⋯`, right-click,
  Shift+F10), its favourite star and, for an offline document, the Local only pill. The open document's row is the
  selected one.
- **Rows without documents go to the Explorer.** Home, Activity, the Library pages and Trash open their Explorer page.
- **No team management.** The panel shows no Invites row, no New team row and no sign-in nudge: answering invites and
  creating teams happen in the Explorer, and the panel keeps its own sign-in notice under the tree.
- **Compact on open.** Every expandable row starts collapsed (My documents included), so the panel opens at its
  smallest; expansion lasts as long as the editor is open.
- **Filing.** One of the reader's own document rows drags onto a personal folder row, or onto My documents to file
  it at the root. A personal folder row carries the folder menu plus Show in Explorer; a team folder row carries the team folder verbs
  the session may use; My documents carries its Use as default for menu.
- Group titles and separators follow Minimal chrome exactly as in the sidebar.
- The tree scrolls inside the panel when it is taller than the space it has.

## Local only documents

A document saved only in this browser ([Offline Mode](../006-document/offline-mode.md)) is the reader's own: it counts
wherever the reader's own documents count (Space `mine`, owner "You"), the same as a document in My documents. Every
row and card of one, wherever it is listed (folders, This browser, Recent and Favourites, Search results, the
editor's Explorer, the Trash), carries the **Local only** pill
([Offline Mode: Local only pill](../006-document/offline-mode.md#local-only-pill)).

The editor header names such a document with the matching **Local only** badge. Home's "Jump back in" carries the
same pill (`LocalOnlyPill`) on the document's thumbnail ([Explorer Home](explorer-home.md)).

## Telemetry

Each sidebar activation emits `UI / Selected / Sidebar.<Row>`, where `<Row>` is the row kind from a closed set (Home,
Activity, SharedWithMe, MyDocuments, Folder, Team, TeamFolder, Invites, NewTeam, ThisBrowser, Library, ImageGallery,
Themes, ShapeLibraries, Trash), never a name or id
([Telemetry](../017-telemetry/telemetry.md)). Creating the team is still `Team / Created`.

## Help

The help centre's [Explorer page](../../../apps/help/app/explorer/explorer-page/page.mdx) article describes the groups;
[My Documents and Folders](../../../apps/help/app/explorer/personal-space/page.mdx) and
[Team Spaces](../../../apps/help/app/explorer/team-spaces/page.mdx) describe the two kinds of space.
