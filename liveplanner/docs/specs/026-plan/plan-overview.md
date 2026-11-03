# Plan Overview

Every plan has an **Overview**: one page that says what the plan is, what is in it and what has happened in it
lately. It is the first entry in the tab bar, with a home glyph, before a divider and the plan's own tabs. It shows the
plan's name, description, who made it and who works on it; a tile for each tab with a small picture of what the tab
holds; a tile for each card type and where it is used; and the plan's recent activity.

## Domain language

| Term                   | Meaning                                                                                         | Not                    |
| ---------------------- | ----------------------------------------------------------------------------------------------- | ---------------------- |
| **Overview**           | The plan's built-in page, reached from the tab bar's first entry                                | home tab, summary tab  |
| **description**        | The plan's short text saying what it is for, set in **Edit Details**                            | notes, about, subtitle |
| **tab tile**           | One tab on the Overview: its picture, name and a line naming its kind and size                  | card, thumbnail        |
| **card type tile**     | One card type on the Overview: glyph, name, fields and cards, and the tabs whose boards take it | type card              |
| **activity**           | What people did to the plan's cards, newest first, as the item store records it                 | history, log, timeline |
| **people on the plan** | The plan's owner, everyone who made or last changed one of its cards, and anyone here right now | members, collaborators |

## A built-in page, not a tab

The Overview is part of every plan, not a tab stored in it.

- **Why**: a tab kind would have to be written into every existing plan (a migration over every stored plan, every
  offline copy and every exported file), and a tab can be deleted, renamed, duplicated, locked, moved into a folder,
  exported, copied into another plan, opened by a tab-scoped share link and changed by agents. None of that fits a
  page that describes the whole plan. As a page the editor draws from what it already holds, every plan, old and new,
  has it at once, and nothing about it is saved, synced or exported.
- It has no element, no theme, no undo of its own, and never appears in the tab list agents, exports or Search read.
- It cannot be deleted, renamed, duplicated, locked, reordered or moved into a folder: its entry in the tab bar has
  no menu and cannot be dragged, and no tab can be dropped before it.
- **Opening**: pressing **Overview** in the tab bar opens it in the canvas's place; its entry is then the open one
  (the strip's sliding card moves to it) and no tab is. Pressing any tab (in the bar, on a tab tile, from Search, a
  link, a new tab) opens that tab and closes the Overview. The tab that was open stays the plan's open tab underneath:
  pressing it again opens it as it was.
- A plan opens on the tab it opened on before (the address's tab, else the first). The Overview is not remembered
  across a reload and has no address of its own.
- **Where it is not**: an embed and a session confined to one tab (a tab-scoped share link) have no Overview, as
  they see one tab; the bar there is as before.
- While the Overview is open the canvas under it is not drawn, and nothing on it changes from the keyboard (as when
  a board covers the canvas): undo, redo, Search and Escape still work.

## The tab bar

- **Overview** stands first in the strip, its home glyph before its name, then a thin divider, then the tabs and
  folders as before, then Add tab. It is a tab in the strip's toolbar (one Tab stop, reached by the arrow keys like
  every tab), drawn by the same tab shape, never dimmed, with no avatars and no menu button.
- Its hover card (only when its name is cut short, as for any tab) is not needed: the name is never cut. It is named
  "Overview" for a screen reader, `aria-current="page"` while open.

## The page

One column of three bands on a phone, and on a wider screen the header across the top over two columns: the Tabs and
Card Types sections on the left, Recent Activity on the right (340 px wide). The page scrolls as a whole; it uses
the app's own light or dark colours (the chrome's, not a tab theme's).

### Header

- A band across the top, a soft wash of the brand colour: the eyebrow **Plan Overview**, the plan's name as the page
  heading, its description, and a line: **Created by {owner} on {date} · Edited {when}**.
  - No owner name known: **Created on {date}**. No creation date known (a plan never saved to the server): the
    created part is left out. Edited is the latest of the plan's last save, this browser's last save and the latest
    card change; none known: left out.
  - Dates read as "14 Oct" in the current year and "14 Oct 2025" otherwise; Edited reads relatively ("8 minutes
    ago", "Yesterday"), the exact moment on hover.
- **No description**: an Editor sees a quiet **Add a Description** button in its place, which opens Edit Details;
  anyone else sees nothing there.
- On the right: **people on the plan** as overlapping discs (initials on their colour), at most five, then "+N", and
  "{n} People" ("1 Person"). Each disc names its person on hover. People are told apart by their id; the plan's owner
  first, then by their latest change, newest first.
- **Edit Details** (an Editor): opens the Edit Details dialog. **Share** (whoever may share the plan, as the header's
  Share; never for a plan in This Browser): opens the Share dialog.

### Edit Details

A dialog headed **Edit Details**, "The name and description everyone sees on this plan's Overview.":

- **Name** (the plan's name, as the header renames it, capped as names are: [Name length](../006-project/name-length.md)).
- **Description**: a few lines of plain text, at most 500 characters (the field stops there), with a count once
  past 400. Line breaks are kept; leading and trailing space is trimmed.
- **Save** writes what changed and closes; **Cancel** and Escape close without writing. Save is disabled while the
  name is empty.
- A description that cannot be saved (offline, refused) shows "Couldn’t save the description" as a toast, and the
  page keeps the description as it was.

### Tabs

- Headed **Tabs**, with **Add Tab** on its right for an Editor.
- A grid of tab tiles (three across on a wide screen, two from 640 px, one on a phone), one per tab in the plan's
  order, folders flattened. A tile is a button: pressing it opens the tab.
- Each tile: a 104 px picture, then the tab's name (one line, cut short with its full name on hover) and a line
  naming its kind and size:

  | Tab                                           | Picture                                                                                         | Line                    |
  | --------------------------------------------- | ----------------------------------------------------------------------------------------------- | ----------------------- |
  | Board tab                                     | The board's first four columns, each its first three cards as bars edged in their type's colour | Board · {n} Cards       |
  | A plan view filling a tab (Visualisation tab) | Gantt: the cards' Start to Due as bars along the plan's dates; any other view: bars             | {View name} · {n} Cards |
  | Sheet tab                                     | A grid: a header row and a first column                                                         | Sheet                   |
  | Dashboard tab                                 | Its rows and slots as blocks, in their spans                                                    | Dashboard · {n} Slots   |
  | Form tab                                      | Its first questions as fields, then a button                                                    | Form · {n} Questions    |
  | A tab not started                             | An empty dashed frame                                                                           | Not Started             |

  A board's count is the cards it shows (its statuses and the card types it takes; trashed and, except on an Archive
  board, archived cards left out); a view's is the cards it reads. Pictures are drawn from what the editor already
  holds, never fetched for the Overview alone.

- A tab whose content has not arrived yet (tabs load as they are opened) shows its picture as a soft pulse and its
  line as **Loading…**. Opening the Overview asks for every tab not yet loaded, once, as Search does; a tab that
  fails shows **Couldn’t Load** and opens as any tab does.
- **Add Tab** (the section's button and a dashed last tile, "Board, Sheet, Dashboard or Form"): an Editor's, as the
  tab bar's +. It adds a tab and opens it on Start Planning, closing the Overview.
- **One tab**: its tile and the Add Tab tile. There is always at least one tab.

### Card Types

- Headed **Card Types**. A grid of card type tiles (four across on a wide screen, two from 640 px, one on a phone),
  in the catalogue's order.
- Each tile: the type's glyph on a tint of its colour, its name, "{n} Fields · {n} Cards", and where it is used: "On
  {Tab} and {Tab}" (up to two names, then "On {Tab}, {Tab} and {n} More"), or "Not on any board yet" in amber when no
  board on any tab takes it. A board takes a type when it names it among its card types or names none (and is not an
  Archive board).
- For an Editor a tile is a button that opens the type in the card type editor; for anyone else it only shows.
- **Add Card Type**: a dashed last tile, an Editor's, opening the card type editor on a new type (as the Card Types
  panel's Add New Card Type). Left out once the plan holds the most card types it can.
- **No card types**: "No Card Types Yet", with "Add a card type to give cards their own fields." for an Editor (and
  the Add Card Type tile), "This plan has no card types yet." for anyone else.

### Recent Activity

- Headed **Recent Activity**: a vertical rail of entries, newest first, eight shown; **See All** shows up to 30, then
  reads **Show Fewer**. Nothing past 30 is ever listed.
- An entry: "{Person} {did what}" over "{where} · {when}". What can be said honestly from what the plan records:

  | Recorded                                  | Entry                          | Where                                                |
  | ----------------------------------------- | ------------------------------ | ---------------------------------------------------- |
  | A card made (its created time and author) | added {card title}             | The first Board tab whose board shows it, else Cards |
  | A card's last change that was a move      | moved {card title} to {Status} | as above                                             |
  | A card's last change otherwise            | changed {card title}           | as above                                             |
  | A card in the Trash                       | deleted {card title}           | Trash                                                |
  | The plan made                             | created the plan               | Plan                                                 |

  A card shows at most two entries (made, and its last change). A change counts as a move when the card's status
  stamp (`statusSince`) is the moment of its last change and that is later than when it was made.

- The plan's own setup (the plan made) is a **setup** entry: its dot is the brand colour; card entries' dots are a
  quiet slate. Card types, tabs, forms and sharing keep no record of who changed them or when, so the Overview lists
  none of those.
- Pressing an entry about a card opens the card.
- **No activity**: "No Activity Yet", "Changes to cards will show here."
- An agent's change (a card's author marked as an agent) reads as its author's name, as the card's own history does.

## Share roles

[Share roles](../013-workspace/share-roles.md) apply to everything the Overview offers:

| Role        | Sees                                                                             | May                                                                                                      |
| ----------- | -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Editor      | Everything                                                                       | Edit Details; Add Tab; open a card type, Add Card Type; Share (when they may share); open tabs and cards |
| Participant | Everything; no Edit Details, Add Tab or Add Card Type, card type tiles only show | Open tabs and cards; Share only as the header allows                                                     |
| Viewer      | As a Participant                                                                 | Open tabs and cards                                                                                      |

The editor gates on the session's `can` (`can.level === 'edit'`) and, for Add Tab, on the tab structure being
writable (`isStructureReadOnly` false). The server refuses a description write from anyone who may not edit the whole
plan (`gateEdit`, never a tab-scoped grant).

## The description

- A plan's **description** is plain text, at most 500 characters (`PROJECT_DESCRIPTION_MAX`), empty by default. It is
  part of the plan, as its name and card types are: stored with the plan, read with it, and shown to everyone who can
  open it. A plan made before it existed has an empty one.
- **Stored** in the plan's own store (`plan.description`), written by `PUT /api/projects/:id/details` with
  `{ description }` for anyone who may edit the whole plan, which answers `{ description }` as stored (trimmed,
  capped). The project's read carries it (`description`). An offline plan keeps it in its browser record.
- **Live**: a write reaches every open editor of the plan as the room's `project-details` op (sent only by the api),
  so the Overview updates without a reload. A tab-scoped session does not receive it.
- A copy of a plan (Make a Copy, Duplicate) keeps its description. Exports, agents and the Explorer do not show it yet.

## Performance

- The Overview's code loads only when it is first opened: a plan never opened on it pays nothing.
- Everything it shows is derived from what the editor already holds (tabs, cards, card types, presence), once per
  change of those, never per card or per frame. A plan at the item store's limit (2,000 cards) derives in well
  under a frame (budget: 16 ms in tests).
- Activity keeps the 30 newest entries without sorting every card's.
- Tab pictures draw at most four columns of three cards per board and at most a handful of shapes for any other kind.

## Telemetry

- `UI` · `Opened` · `Overview` when the Overview is opened.
- `Project` · `Changed` · `Description` when a description is saved (the closed actions already hold `Changed`).
