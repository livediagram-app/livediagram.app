# Explorer structure

Status: shipped

## What

The Explorer's sidebar is one navigation tree in three **groups**. It answers two questions at once: where a
document **lives**, and which **views** compute lists of documents from wherever they live.

- **Places.** A document lives in exactly one place: **My documents**, a **team**, or **this browser**
  ([Offline Mode](../006-document/offline-mode.md)). Moving a document changes its place.
- **Views.** Everything else (Home, Inbox, Timeline, Shared with me, Recent, Favourites, Search results, the Library pages,
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

| Row            | Opens                                                | Badge                                                                             |
| -------------- | ---------------------------------------------------- | --------------------------------------------------------------------------------- |
| Home           | `/explorer/home` ([Explorer Home](explorer-home.md)) | Other people's events since the reader last looked ([Timeline](timeline.md) §2.5) |
| Inbox          | `/explorer/inbox` ([Inbox](inbox.md))                | Open actions and Plan cards assigned to the reader, always shown, 0 included      |
| Timeline       | `/explorer/timeline` ([Timeline](timeline.md))       | None: the unread count sits on Home                                               |
| Shared with me | `/explorer/shared`                                   | Documents shared with the reader                                                  |

Home is the Explorer's landing view. The **Inbox** is what is outstanding for the reader now; the **Timeline** is the
record of what happened. Recent and Favourites have no sidebar row; their routes (`/explorer/recent`,
`/explorer/favourites`) keep working. Recent is reached from Home's Jump back in (**See more**); the Timeline is also
reached from Home's What happened (**See timeline**). The retired `/explorer/activity` opens the Inbox
([Folders: Explorer routes](folders.md#explorer-routes)).

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
- **The `⋯` shows on hover.** A folder row's and My documents' `⋯` stays hidden until the row is hovered or has
  keyboard focus, and stays while its menu is open. On a touch screen (a coarse pointer), where nothing hovers, it
  always shows. The editor's Explorer rows behave the same.
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

Every other row's view already carries its row's label (Inbox, Timeline, a folder or team by its name, Invites,
Themes, Trash). Views without a row keep their own names (Recent, Favourites, Search results). Recent is reached from
Home, and its breadcrumb leads back to it (**Home › Recent**). The Timeline has a row of its own, so its breadcrumb is
its own (**Timeline**).

## Visibility at a glance

| Row           | Guest (sign-in configured) | Guest (no sign-in deployment) | Signed in                |
| ------------- | -------------------------- | ----------------------------- | ------------------------ |
| Overview      | All four                   | All four                      | All four                 |
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

On a touch screen the chevron moves to the row's far end instead, after any trailing action, as a disclosure the full
row's height and 44 px wide, and no row reserves a gutter. Every icon at a level then sits on the column of its
group's title, as in a phone's settings list, rather than behind an empty gutter the size of a thumb; nesting still
indents one step a level.

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

The editor's Explorer, the panel under the menu button ([Folders: the editor's Explorer](folders.md#the-editors-explorer-editor--new)),
is a small Explorer page beside the canvas: the same groups, rows and views, without leaving the document. It replaced
a single stacked tree, which was cramped and sent half its rows off to the Explorer page.

### Layout

Top to bottom:

1. **The panel header**: "Explorer", the `⋯` menu ([Folders](folders.md#the-editors-explorer-editor--new)) and Help.
2. **The Current Document card**, when a document is open: its thumbnail, the label "Current Document", the
   document's **name**, "Updated <relative time>", and at the card's right the document's **visibility badge** (the
   editor header's badge: Private, Shared, Team, Public or Local only, with its legend, [Offline Mode](../006-document/offline-mode.md))
   above its `⋯` (the document menu).
   - **Click the name to rename it**, for someone who may rename the document (an Editor of their own or a shared
     document); the name becomes a text field in place: Enter or leaving it saves, Escape keeps the old name, an empty
     name keeps the old one. For anyone else it is plain text.
3. **The rail and the pane**, side by side on a desktop: the rail on the left lists the sections, the pane on the right
   shows the picked one.
4. **The footer**: the product's surfaces as links, one row: **Welcome**, **Explorer** (the Explorer page),
   **Community** (while the Community is on), **Help**, **Telemetry**. They are the product menu's entries; the editor
   header carries no product menu ([Live app: header](../007-editor/live-app.md)).
5. **The sign-in notice** for a signed-out guest, at the foot of the pane (Minimal chrome drops it).

### The rail

The rail is the sidebar's three groups, Overview, Spaces and More, as one column of entries: Home, Inbox, Timeline,
Shared with me; My documents and each team; This browser, Library and Trash. Entries carry the sidebar's badges. No
Invites, New team or sign-in nudge: those are the Explorer page's.

- **Every entry is a mode of the pane.** Picking one shows it in the pane; none leaves the editor. The picked entry is
  marked (`aria-current`) and is remembered for this viewer in this browser, so the panel reopens on it.
- **First open** shows the space holding the open document: This browser for a Local only document, the team for a
  team document, else My documents.
- Group titles and separators follow Minimal chrome as in the sidebar.

### The pane

A header (the section's name, **Open Page** to its Explorer page, and the section's own action) over its content,
which scrolls inside the pane:

| Section        | The pane shows                                                                        | Action     |
| -------------- | ------------------------------------------------------------------------------------- | ---------- |
| Home           | Home's own view ([Explorer Home](explorer-home.md)): Jump back in, What happened      | None       |
| Inbox          | The Inbox ([Inbox](inbox.md))                                                         | None       |
| Timeline       | The Timeline ([Timeline](timeline.md))                                                | None       |
| Shared with me | The documents shared with the reader, as document rows                                | None       |
| My documents   | The root folders, then the root documents, as the tree's rows: folders open in place  | New Folder |
| A team         | The team's root folders, then its root documents, the same way                        | New Folder |
| This browser   | The documents saved only in this browser                                              | None       |
| Library        | Three tabs: Image Gallery, Themes, Shape Libraries, each the Explorer page's own view | None       |
| Trash          | The Trash ([Trash](trash.md)): restore or delete forever                              | None       |

- **Rows with documents** keep the tree's behaviour: a document row opens the document, carries the document menu
  (`⋯`, right-click, Shift+F10), its favourite star and, for an offline document, the Local only pill; the open
  document's row is the selected one. A folder row opens in place.
- **Filing.** One of the reader's own document rows drags onto a personal folder row, or onto the My documents rail
  entry to file it at the root; a drag resting on a folder row opens or closes it
  ([Folders: drag-and-drop](folders.md#the-editors-explorer-editor--new)). A personal folder row carries the folder menu
  plus Show in Explorer; a team folder row carries the team folder verbs the session may use; My documents carries its
  Use as default for menu.
- **An empty section** says so in a line ("Nothing shared with you yet", "No documents in this browser") with Open Page.
- **Loading** shows the section's skeleton rows; a failed read shows the section's error line with Try Again.
- The views load only when their section is first shown, so opening the editor costs nothing more.

### On a phone

The panel is the full-width banner at the top of the canvas. The rail becomes a **row of section chips** under the
Current Document card, scrolling sideways, the picked chip filled; the pane fills the rest of the panel's height and
the footer links scroll sideways. Every chip, row and link is at least 44 px tall.

### Keyboard and ARIA

The rail is a `nav` named "Explorer sections" of buttons; Up and Down move between entries (Left and Right on a phone's
chip row), Enter or Space picks one. The pane's tree is a `nav` named "Explorer" with the sidebar's tree keyboard
model ([Keyboard and ARIA](#keyboard-and-aria)). The footer is a `nav` named "Go to".

### Who may do what

The panel is the reader's own: it lists their documents and views whatever the open document's share role. Renaming
from the card follows the editor's rename (an Editor only); a Participant or Viewer sees the name as text.

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
Inbox, Timeline, SharedWithMe, MyDocuments, Folder, Team, TeamFolder, Invites, NewTeam, ThisBrowser, Library, ImageGallery,
Themes, ShapeLibraries, Trash), never a name or id
([Telemetry](../017-telemetry/telemetry.md)). Creating the team is still `Team / Created`. The Inbox row was the Activity row, and
`Sidebar.Activity` (and `ExplorerPanel.Activity`) stay readable on the dashboard as its history.

## Help

The help centre's [Explorer page](../../../apps/help/app/explorer/explorer-page/page.mdx) article describes the groups;
[My Documents and Folders](../../../apps/help/app/explorer/personal-space/page.mdx) and
[Team Spaces](../../../apps/help/app/explorer/team-spaces/page.mdx) describe the two kinds of space.
