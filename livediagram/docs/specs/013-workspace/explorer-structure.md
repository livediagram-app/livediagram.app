# Explorer structure

Status: shipped

## What

The Explorer's sidebar is one navigation tree in three **groups**. It answers two questions at once: where a
document **lives**, and which **views** compute lists of documents from wherever they live.

- **Places.** A document lives in exactly one place: **My Work**, a **team**, or **this browser**
  ([Offline Mode](../006-document/offline-mode.md)). Moving a document changes its place.
- **Views.** Everything else (Home, Inbox, Timeline, Shared With Me, Recent, Favourites, Search results, the Library pages,
  Trash) is a computed view. A view never owns a document; it lists documents that live somewhere else.
- **A space's root holds documents.** A document filed in no folder sits at the root of its space, listed beside the
  root folders: there is no Unsorted bucket and no Generated bucket. What an AI made is found with the **Made by AI**
  filter ([Explorer filters](explorer-filters.md)), wherever it is filed.
- **Spaces are root folders.** My Work and each team are root-level folder rows in one tree, with their folders
  beneath them. My Work maps one to one onto the [Google Drive mirror](../022-drive-mirror/drive-mirror.md)'s root
  folder.

The sidebar holds navigation only. It carries no greeting, no search field, no New button and no pins:

- **Search** lives in the top bar: the lens field of [Explorer filters](explorer-filters.md#the-field), left of the
  account control, searches and filters the documents of the current view. On Home it sits in the
  [hero](explorer-home.md#the-hero) instead. The bottom bar's Search opens the app-wide search panel.
- **New folder** and **New Document** live in the page header of the view they create in (Home's hero on Home).
- The account is reached from the header's account menu.

## Look

The sidebar shares Home's front-page language ([Explorer Home](explorer-home.md#layout)).

- **No box.** The tree sits directly on the page, beside the content: no card, border or shadow round it.
- **Rows** are about 36 px high (44 px on a touch screen), their labels 14 px, rounded 12 px. A row hovers to a soft
  slate wash.
- **Tiles.** Every top-level row of Overview and Spaces carries its icon on a small rounded **tile** (24 px, radius
  8 px) tinted in the row's **tone**: Home and My Work sky, Inbox violet, Timeline amber, Shared With Me emerald,
  a team indigo, Invites rose. Manage Teams and the rows of More (This Browser, Tags, Library, Trash) keep a bare slate
  icon, so the places and views people go to most read first. Nested rows (folders, a team's folders, the Library
  pages, tags) keep a bare icon too.
- **The current row** is a raised pill: white, a hairline sky edge and a soft sky shadow, its label in semibold deep
  sky, and its tile filled solid sky with a white icon (a bare icon turns sky). In dark mode it is a glass pill: a
  faint sky wash fading to the right with a sky hairline inside its edge, its label white.
- **Group titles** are 11 px, semibold, uppercase, widely tracked, slate-500 (4.5:1 on the page; slate-400 in dark).
- **The sign-in nudge** is a deep navy card in both appearances, the brand prism and a soft sky glow in its corner,
  its title white and its line a pale slate.

The editor's Explorer panel ([below](#the-editors-explorer)) keeps its own look.

## Groups and rows

Top to bottom. "Opens" names the view a row selects; every view keeps its own route
([Folders: Explorer routes](folders.md#explorer-routes)). Row labels are Title Case (My Work, Shared With Me, Manage Teams), and every place a row's name appears (page titles, breadcrumbs, folder chips, help articles) uses the same casing. The command-line tool keeps "My Work" in the folder paths it writes to disk, so existing synced folders keep their names.

### Overview

| Row            | Opens                                                | Badge                                                                             |
| -------------- | ---------------------------------------------------- | --------------------------------------------------------------------------------- |
| Home           | `/explorer/home` ([Explorer Home](explorer-home.md)) | Other people's events since the reader last looked ([Timeline](timeline.md) §2.5) |
| Inbox          | `/explorer/inbox` ([Inbox](inbox.md))                | Open actions assigned to the reader, always shown, 0 included                     |
| Timeline       | `/explorer/timeline` ([Timeline](timeline.md))       | None: the unread count sits on Home                                               |
| Shared With Me | `/explorer/shared`                                   | Documents shared with the reader                                                  |

Home is the Explorer's landing view. The **Inbox** is what is outstanding for the reader now; the **Timeline** is the
record of what happened. Recent and Favourites have no sidebar row; their routes (`/explorer/recent`,
`/explorer/favourites`) keep working. Recent is reached from Home's Jump Back In (**See More**); the Timeline is also
reached from Home's What Happened (**See Timeline**). The retired `/explorer/activity` opens the Inbox
([Folders: Explorer routes](folders.md#explorer-routes)).

### Spaces

| Row          | Opens                             | Children                | Badge                      |
| ------------ | --------------------------------- | ----------------------- | -------------------------- |
| My Work      | `/explorer/all`, the My Work root | The root folders        | None                       |
| Each team    | `/explorer/team?id=<id>`          | The team's root folders | Member count, when above 1 |
| Invites      | `/explorer/invites`               | None                    | Pending invites            |
| Manage Teams | liveworkspace.app's teams page    | None                    | None                       |

- **The My Work root** lists its root folders, then its root documents, newest first. A team's root does the
  same for the team. The old Unsorted, Generated and Dynamic addresses still answer: `/explorer/unsorted` and
  `/explorer/dynamic` open the My Work root, `/explorer/generated` opens Search results filtered by
  `made-by:ai`.
- A folder row opens its folder, expands to its subfolders, and carries the folder menu (Rename, New subfolder,
  Change folder, Use as Default for, Delete). A team folder row opens the team page at that folder and carries no menu.
- **My Work** carries a menu of its own (its `⋯` button, a right-click, Shift+F10) holding only **Use as
  Default for** ([Default folders](default-folders.md#use-as-default-for)).
- **The `⋯` shows on hover.** A folder row's and My Work' `⋯` stays hidden until the row is hovered or has
  keyboard focus, and stays while its menu is open. On a touch screen (a coarse pointer), where nothing hovers, it
  always shows. The editor's Explorer rows behave the same.
- A folder that is one of the reader's default folders shows the **default marker** after its name
  ([Default folders](default-folders.md#the-default-marker)), personal and team folder rows alike.
- **Invites** shows only while the reader has a pending invite (or is on the Invites view). An invite also reaches the
  reader through Home and email.
- **Manage Teams** is the group's last row, for signed-in readers only. Teams are made and run on liveworkspace.app
  ([Teams](teams.md)), so it opens liveworkspace.app's teams page. Invites shows only while invites are pending, which
  the mirror never has now (invitations are answered on liveworkspace.app).
- A **guest**, on a deployment with sign-in configured, sees the sign-in nudge ("Sign in to access Teams") as the
  group's last item instead of Manage Teams. A deployment without sign-in shows neither.

### More

| Row          | Opens                                  | Children                                     | Badge                     |
| ------------ | -------------------------------------- | -------------------------------------------- | ------------------------- |
| This Browser | `/explorer/offline`                    | None                                         | Documents in this browser |
| Library      | Nothing: the row expands and collapses | Tags, Image Gallery, Themes, Shape Libraries | None                      |
| Trash        | `/explorer/trash` ([Trash](trash.md))  | None                                         | None                      |

- **This Browser** shows only while this browser holds at least one offline document, or while its view is the current
  one (so the highlighted row never vanishes under the reader). Its documents are the reader's own
  ([documents in This Browser](#documents-in-this-browser)).
- **Library** has no view of its own: activating it expands or collapses it. It opens by itself when one of its
  pages is the current view, the Tags pages included.
- **Tags** is Library's first row, always shown (so it can be found before the first tag). It opens the Tags page and
  expands to one row per tag, each carrying its colour, its document count as its badge and its menu
  ([Tags: The sidebar](tags.md#the-sidebar)). The editor's Explorer panel keeps Tags as its own rail entry.

The group's title is **More**.

## Dragging to the Trash

The sidebar's **Trash** row takes a document or a folder dragged onto it.

- **What drags.** Every document that drags to a folder today (its own, a team's, one in this browser; never one shared
  with the reader, nor one being renamed), and the reader's own folders: a folder card or folder row in the pane, and
  a folder row in the sidebar. A folder carries its own drag type, so a folder dropped on a folder is no drop: folders
  are not moved by dragging.
- **The Trash wakes while anything drags.** As soon as a document or folder is picked up, the Trash row becomes a
  target: a dashed sky edge round the row and its label reads **Drop to Trash**, so it can be found mid-drag.
- **Over it, it opens up.** With the drag over it, the row fills with the solid brand colour, its label turns white
  and reads **Let go to trash it**, and its bin tips its lid (a small turn and grow). Never red: putting something in
  the Trash is undoable, not a warning.
- **Let go, it swallows.** The drop goes through the same action as the item's own Delete, and the bin gives one short
  bounce once the item is gone: a document moves to the Trash at once, with the **Document deleted** toast and its
  **Undo** ([Trash](trash.md)); a folder goes through **Delete Folder**, with its confirmation, and its contents move up
  to its parent ([Folders](folders.md)). Cancelling that confirmation keeps the folder, and the bin does not bounce.
- **Leaving it, or letting go elsewhere**, puts the row back as it was. A drag of anything else (text, a file from the
  desktop) never wakes it.
- **Motion** stays inside the budget: each change settles within 250 ms; under reduced motion the colours and words
  change but nothing turns, grows or bounces.
- **Assistive technology** hears the target's words through a polite status line as they change; the row keeps its
  name, **Trash**, and its keyboard behaviour (dragging is a pointer gesture; the menus' Delete stays the keyboard
  path).
- **Phone**: the drawer's Trash row takes no drops (touch has no HTML drag).
- The editor's Explorer panel is unchanged.
- **Telemetry**: `UI·Selected·Sidebar.TrashDropDocument` / `Sidebar.TrashDropFolder` on a drop, beside the delete's own
  `Document·Deleted` / `Folder·Deleted`.

## Page titles follow the rows

A view is named by its row, everywhere it is named: the page heading, the document title (`<label> | livediagram`),
the breadcrumb and the help centre's copy. Routes stay as they are.

| Row             | Route                       | Page title      |
| --------------- | --------------------------- | --------------- |
| Home            | `/explorer/home`            | Home            |
| Shared With Me  | `/explorer/shared`          | Shared With Me  |
| My Work         | `/explorer/all`             | My Work         |
| This Browser    | `/explorer/offline`         | This Browser    |
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
| My Work       | Yes                        | Yes                           | Yes                      |
| Teams         | None                       | None                          | One row per team         |
| Invites       | No                         | No                            | While one is pending     |
| Manage Teams  | No                         | No                            | Yes                      |
| Sign-in nudge | Yes                        | No                            | No                       |
| This Browser  | While it holds documents   | While it holds documents      | While it holds documents |
| Library       | Yes                        | Yes                           | Yes                      |
| Trash         | Yes                        | Yes                           | Yes                      |

## Expansion

- **My Work** starts expanded, so its root folders stay one click away.
- **Library** starts collapsed, and expands by itself when one of its pages is the current view (on arrival and on
  navigating to one), so the highlighted row is always visible.
- **Teams and folders** start collapsed. My Work, a team or a folder with no subfolders shows no chevron.
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
icon sits on one column, and an expandable row (My Work, a team, Library) lines up with a plain one (Home, Trash,
Manage Teams). Each level of nesting indents the whole row (gutter, icon and label) by one step.

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
- **Enter** and **Space** activate the row: open its view, toggle Library, or open Manage Teams.
- **Typing a character** moves to the next row whose label starts with it.
- **Shift+F10** or the **Menu** key opens a folder row's (or My Work') menu, the same menu as its `⋯` button and a
  right-click.
- Keys typed into a folder's inline rename field are the field's, never the tree's.
- Every inline rename field (a folder's, a document's, New Folder's) is named "Rename <name>" for a screen reader
  (`InlineRenameInput`'s required `ariaLabel`): it replaces the row's label while open, and was announced only as
  "edit text" with the old name.
- Focus is shown with a visible ring on the row (WCAG 2.2 AA focus appearance); mouse clicks show none.

## Mobile drawer

Below the `sm` breakpoint the sidebar is hidden and the pane header's menu button opens it as a drawer from the left:
the same groups, rows, rules and keyboard model. Picking a view, or Manage Teams, closes the drawer; so do its Close button,
the backdrop and Escape. It is a modal dialog named Sections: focus moves into it, Tab stays inside, and closing it
hands focus back to the button that opened it.

## The editor's Explorer

The editor's Explorer, the panel under the menu button ([Folders: the editor's Explorer](folders.md#the-editors-explorer-editor--new)),
is a small Explorer page beside the canvas: the same groups, rows and views, without leaving the document. It replaced
a single stacked tree, which was cramped and sent half its rows off to the Explorer page.

### Layout

Top to bottom:

1. **The panel header**: "Explorer", the `⋯` menu ([Folders](folders.md#the-editors-explorer-editor--new)) and Help;
   a phone's sheet drops the `⋯` menu, every entry of it a tap away there already.
2. **The Current Document card**, when a document is open: its thumbnail, the label "Current Document", the
   document's **name**, "Updated <relative time>". The document's **visibility badge** (the editor header's badge:
   Private, Shared, Team, Public or This Browser, with its legend, [Offline Mode](../006-document/offline-mode.md)) sits
   at the right of the label's row and its `⋯` (the document menu) at the right of the date's, so the name has the
   card's whole width. The badge's legend opens over everything, right-aligned under it, never clipped
   by the panel.
   - **Click the name to rename it**, for someone who may rename the document (an Editor of their own or a shared
     document); hovering the name underlines it (dotted) and shows a pencil, the name's own width, never a block of
     fill. The name becomes a text field in place: Enter or leaving it saves, Escape keeps the old name, an empty name
     keeps the old one. For anyone else it is plain text.
3. **The rail and the pane**, side by side on a desktop: the rail on the left lists the sections, the pane on the right
   shows the picked one.
4. **The footer**: the product's surfaces as links, one row: **Home** (the landing page), **Explorer** (the Explorer
   page), **Community** (while the Community is on), **Help**. They are the product menu's entries but Telemetry; the editor
   header carries no product menu ([Editor app: header](../007-editor/editor-app.md)).
5. **The sign-in note** for a signed-out guest: one quiet line under the Current Document card ("Keep your work. A free
   account saves it across devices." with **Sign in**, on a phone "Keep your work." with **Sign in** alone so it stays one
   line; on a deployment without sign-in, "No sign-in here. Only this browser can open your documents.": they are saved, but belong to this browser's guest id, so "Browser only" would contradict the card's Private), dismissible as the sign-in
   notice is. Minimal chrome drops it.

While the panel is open, the trays that hang from the palette strip (a tab's "is empty" tray, the mode banners) step
aside: the panel reaches under the strip and they would cover its header.

### The rail

The rail opens with **New Document** (one click to a new document; a "New" chip first in the row on a phone), then the
sidebar's three groups, Overview, Spaces and More, as one column of entries: Home, Inbox, Timeline,
Shared With Me; My Work and each team; This Browser, Tags, Library and Trash. Shared With Me and This Browser carry
their counts (the panel reads no other feed until its section is shown). No
Invites, Manage Teams or sign-in nudge: those are the Explorer page's.

- **Every entry is a mode of the pane.** Picking one shows it in the pane; none leaves the editor. The picked entry is
  marked (`aria-current`) and is remembered for this viewer in this browser, so the panel reopens on it.
- **First open** shows **Home**.
- Group titles and separators follow Minimal chrome as in the sidebar.

### The pane

A header (the section's name, then quiet actions: the section's own, and **Open Page** to its Explorer page) over its
content, which scrolls inside the pane with room round it. Every section is drawn for the pane from the same parts:
**cards**: rows (a 60 × 44 thumbnail or tile, the name over one quiet line, a trailing slot for pills and the `⋯`
menu) and two-column preview cards (a picture across the top, the name and a line under it), each a raised surface that
lifts on hover, the open document's ringed in brand. Tiles take a tone by what they show (made: emerald, talked about:
sky, shared: violet, moved: amber, removed: rose, changed: brand);
**section headings** (small capitals with an action at the end), the Explorer's **illustrated empty state** at a
compact size, skeleton rows while loading, and one line with **Try Again** when a read fails.

| Section        | The pane shows                                                                                                                                                                                                                                                                                                                                                                                                     | Action     |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------- |
| Home           | **Jump Back In**: up to six documents (most used, then most recent), never the one already open, as preview cards, with **See all** (Recent); when the open one is the only one, the empty state says "Nothing else yet" rather than "No documents yet". **What Happened**, only when someone else did something: each document's summary sentence under its day, with **See Timeline** (the Timeline in the pane) | None       |
| Inbox          | The Inbox ([Inbox](inbox.md)): assigned to you, you assigned, open comment threads                                                                                                                                                                                                                                                                                                                                 | None       |
| Timeline       | The Timeline ([Timeline](timeline.md)) as a list: each event a row (its glyph, its subject, its reason and time) under its day, **Show Earlier** to page back                                                                                                                                                                                                                                                      | None       |
| Shared With Me | The documents shared with the reader, as rows                                                                                                                                                                                                                                                                                                                                                                      | None       |
| My Work        | The root folders as preview cards (their counts on the picture), then the root documents as rows; a folder opens **in the pane** under the import and export screens' back bar (back to the folder above, the folder as its chip). New Folder makes the folder in the one open here; a folder's New Subfolder opens it                                                                                             | New Folder |
| A team         | The team's folders, then its documents, the same way                                                                                                                                                                                                                                                                                                                                                               | New Folder |
| Tags           | Each tag as a heading (its chip and count) over its documents as rows ([Tags](tags.md#the-editors-explorer-panel))                                                                                                                                                                                                                                                                                                 | None       |
| This Browser   | The documents saved only in this browser                                                                                                                                                                                                                                                                                                                                                                           | None       |
| Library        | Three tabs: Image gallery, Themes, Shape libraries, each the Explorer page's own view at the pane's width; Open Page goes to the tab shown                                                                                                                                                                                                                                                                         | None       |
| Trash          | A line on the 30 days, then each deleted document as a row with **Restore** and **Delete** as icon buttons named by their tooltips (Delete asked first)                                                                                                                                                                                                                                                            | None       |

- **Every document the pane shows** (a place's rows, Home's cards and What Happened, the Timeline's document events)
  carries the Explorer page's document menu (`⋯`, right-click, Shift+F10), the same verbs as on the Explorer page. The
  `⋯` shows on hover or focus under a mouse, always on a touch screen.
- **Rows with documents**: a document row shows its thumbnail and "Updated <relative time>"; activating it opens the
  document; it carries the document menu, its favourite star and, for an offline
  document, the This Browser pill; the open document's row is the current one. A folder row shows its counts ("2
  folders · 5 documents") and opens the folder in the pane; Up and Down move between rows.
- **Filing.** One of the reader's own document rows drags onto a personal folder row (resting on it opens it), or onto
  the My Work rail entry to file it at the root ([Folders: drag-and-drop](folders.md#the-editors-explorer-editor--new)).
  A personal folder row carries the folder menu plus Show in Explorer; a team folder row carries the team folder verbs
  the session may use; My Work carries its Use as Default for menu.
- **An empty place** says so in the Explorer's empty state: "Nothing shared with you yet", "Nothing in this browser",
  "No documents yet", "This folder is empty", "Nothing waiting on you", "No activity yet", "Nothing in the Trash right
  now".
- **Motion**: picking a section slides its content in, opening a folder slides its contents in, and rows and cards
  cascade in as they arrive (the dialogs' view and row motions, a fade alone under reduced motion).
- The views load only when their section is first shown, so opening the editor costs nothing more. The Timeline's
  card menus and calendar are the Explorer page's (Open Page).

### On a phone

The panel is a **sheet** under the menu button: the canvas's full width, edge to edge, reaching down to the tab bar,
and it **opens on Home every time** (a pick lasts while it is open and is not remembered). The rail becomes a **row of
section chips** under the Current Document card, scrolling sideways, the picked chip filled and scrolled into view;
the chips are squared (rounded corners, not pills), 36 px to the eye with a 44 px tap. The pane fills the rest of the
sheet's height above its footer, its header tight under the chips, its header actions their glyph alone, and the
footer links spread across its width (scrolling sideways should they not fit; below 360 px they drop their icons, so all
four fit an iPhone SE). Every row and link is at least 44 px tall. The chips and pane are never shorter than **18rem**:
on a phone too short for that under the card and the sign-in note, the card, note, chips and pane scroll as one over the
pinned footer, rather than leaving the pane a sliver.

### Keyboard and ARIA

The rail is a `nav` named "Explorer sections" of buttons; Up and Down move between entries (Left and Right on a phone's
chip row), Enter or Space picks one. The pane's rows are lists of buttons named by the document or folder (the open
document's `aria-current`); Up and Down move between them, Enter opens one, and the `⋯` menu, right-click or Shift+F10
opens its menu. A folder's breadcrumb is a `nav` named "Folder path". The footer is a `nav` named "Go to".

### Who may do what

The panel is the reader's own: it lists their documents and views whatever the open document's share role. Renaming
from the card follows the editor's rename (an Editor only); a Participant or Viewer sees the name as text.

## documents in This Browser

A document saved only in this browser ([Offline Mode](../006-document/offline-mode.md)) is the reader's own: it counts
wherever the reader's own documents count (Space `mine`, owner "You"), the same as a document in My Work. Every
row and card of one, wherever it is listed (folders, This Browser, Recent and Favourites, Search results, the
editor's Explorer, the Trash), carries the **This Browser** pill
([Offline Mode: This Browser pill](../006-document/offline-mode.md#this-browser-pill)).

The editor header names such a document with the matching **This Browser** badge. Home's "Jump Back In" carries the
same pill (`ThisBrowserPill`) on the document's thumbnail ([Explorer Home](explorer-home.md)).

## Telemetry

Each sidebar activation emits `UI / Selected / Sidebar.<Row>`, where `<Row>` is the row kind from a closed set (Home,
Inbox, Timeline, SharedWithMe, MyDocuments, Folder, Team, TeamFolder, Invites, NewTeam, ThisBrowser, Library, ImageGallery,
Themes, ShapeLibraries, Trash), never a name or id
([Telemetry](../017-telemetry/telemetry.md)). Creating the team is still `Team / Created`. The Inbox row was the Activity row, and
`Sidebar.Activity` (and `ExplorerPanel.Activity`) stay readable on the dashboard as its history.

## Help

The help centre's [Explorer page](../../../apps/help/app/explorer/explorer-page/page.mdx) article describes the groups;
[My Work and Folders](../../../apps/help/app/explorer/personal-space/page.mdx) and
[Team Spaces](../../../apps/help/app/explorer/team-spaces/page.mdx) describe the two kinds of space.
