# Importing from another tool

A team moving to liveplanner brings its board with it: a **Trello** board's JSON export, an **Asana** project's CSV
export, a **Jira** issues CSV export or a **Linear** issues CSV export becomes a new Board tab of the plan, or a new
plan, in one step.

It is a **one-off import**, never a sync: nothing links back to the other tool, nothing refreshes, and a second
import makes a second board. liveplanner still has no connectors to other trackers
([Scope](../002-project-scope/product-scope.md#non-goals)).

## Domain language

- **Another tool**: Trello, Asana, Jira or Linear, by name; never "connector" or "integration".
- **Source**: the tool a file came from, read from the file itself (its shape or its header row).
- **Import**: the one write that makes the board, its card type and its cards. **Preview**: what the import will
  make, shown before it is made.
- **Imported comments**: the one comment thread each card with comments is given.

## Where it lives

- **The plan's one Import dialog**, the same one every import goes through
  ([Import dialog](plan-tabs.md#the-import-dialog)). It opens on its list of what can come in, and the four tools are
  rows of its **A Board from Another Tool** section, each with the tool's mark, its name, the file to bring and where
  the tool keeps it. There is no separate menu row, palette command or switch for them: the tab menu's **Import…** and
  the command palette's **Import…** open the dialog, as for every other import.
- A row opens the file picker. **The file says which tool it came from**, so the row is a starting point, not a
  promise: a Jira CSV picked from the Trello row is read as Jira's. A file **dropped** on the dialog's list is read the
  same way.
- A locked tab does not dim the section: the import makes a new tab and leaves the locked one as it is.
- **Agents**: the MCP's `import_board` tool and the CLI's `liveplanner board import` read the same files the same way
  ([Agents](#agents)).

## Who may

| Role            | May                                                                                                                         |
| --------------- | --------------------------------------------------------------------------------------------------------------------------- |
| **Editor**      | Import into a new Board tab of the plan, or into a new plan.                                                                |
| **Participant** | Nothing here: an import makes a tab, columns and a card type, which are an Editor's. The dialog shows them no tool section. |
| **Viewer**      | Nothing here; the dialog shows them no tool section.                                                                        |

A new plan is the importer's own, so anyone signed in or a guest may make one from the editor's New; the editor offers
it from inside a plan only to an Editor, as the dialog is an Editor's. The api refuses a Participant's or a Viewer's
writes (`403 forbidden`) whatever sends them.

## Reading the file

- A tool's row opens the picker (`.json`, `.csv`, `.tsv`), or a file is dropped on the dialog. While it is read the row
  says **Reading the File…** and the list waits. A file over **20 MB** is refused before it is read:
  "That file is too big to import. Imports read files up to 20 MB." (a Trello export carries every action on the
  board, so it is the largest of the four).
- The source comes from the file: a JSON object with `lists` and `cards` is a Trello board; a CSV whose header names
  `Issue key` and `Summary` is Jira's, `Task ID` and `Section/Column` Asana's, `ID`, `Title`, `Status` and `Team`
  Linear's (case and spacing aside). Anything else: "This file isn't a Trello, Asana, Jira or Linear export." JSON
  that is not JSON: "That file isn't valid JSON."
- CSV is read by the Sheet's CSV reader ([CSV](../029-sheets/sheet.md#csv)): RFC 4180 quoting, a comma, tab or
  semicolon, up to its 10,000 rows.
- **Every value is untrusted text.** Nothing is run or parsed as markup: HTML, Markdown and wiki markup stay as the
  characters they are, control characters other than line breaks and tabs are dropped, and every value is cut to its
  field's limit. A link is kept only when it is an `http` or `https` address.

## What it makes

### The board

- A **new Board tab** named after the board (Trello's board name, else the file's name without its extension; "Imported
  Board" with neither), its board filling the tab with its cards Detailed, as Start Planning makes one
  ([Board tab and Sheet tab](plan-tabs.md#board-tab-and-sheet-tab)). The tab opens once it is made.
- **Columns** are the source's lists or statuses, in its order (Trello's lists by position; the order statuses and
  sections first appear in a CSV), each named as the source names it (cut to 40 characters). A card with no status
  goes to a **No Status** column. A board holds at most 12 columns: past that, the first 11 keep theirs and the rest
  share a last column, **Other**, and the preview counts them. A column named like a state the plan already names
  shares that state ([One name, one state](plan-board.md#the-board-set-up)).
- Trello's archived lists and archived cards are left out, as are a CSV's rows with no title at all; the preview counts
  each.

### The card type

- The cards are one new **card type** per source: **Trello Card**, **Asana Task**, **Jira Issue** or **Linear Issue**
  (id `trello-card`, `asana-task`, `jira-issue`, `linear-issue`), with the built-in fields the file fills and a custom
  field for each extra the source has (below), and the board's columns as its statuses. The board takes that type
  alone.
- A plan that already has the type (an earlier import) keeps it, adding any field and status it lacks, so a second
  import reuses the same type.
- A plan whose card types are full (32) cannot take a new one: the preview says so and offers a new plan.

### Fields

Each card keeps, where the source has them:

| Card field  | Trello                                  | Asana                                 | Jira                                                                                       | Linear                                               |
| ----------- | --------------------------------------- | ------------------------------------- | ------------------------------------------------------------------------------------------ | ---------------------------------------------------- |
| Title       | name                                    | Name                                  | Summary                                                                                    | Title                                                |
| Column      | its list                                | Section/Column (completed: Completed) | Status                                                                                     | Status                                               |
| Description | desc                                    | Notes                                 | Description                                                                                | Description                                          |
| Assignee    | its first member                        | Assignee Email, else Assignee         | Assignee                                                                                   | Assignee                                             |
| Priority    | a label named like a priority           | a Priority column                     | Priority (Highest, High, Medium, Low, Lowest)                                              | Priority (Urgent ... Low)                            |
| Estimate    |                                         |                                       | Story Points (any column named so)                                                         | Estimate                                             |
| Start       | start                                   | Start Date                            | Start date (any column named so)                                                           | Started                                              |
| Due         | due                                     | Due Date                              | Due date                                                                                   | Due Date                                             |
| Labels      | its labels' names (or colours, unnamed) | Tags                                  | Labels (every Labels column)                                                               | Labels                                               |
| Checklist   | every checklist's items, in order       |                                       |                                                                                            |                                                      |
| Comments    | its comment actions                     |                                       | every Comment column                                                                       |                                                      |
| New fields  | Members (Person, holds several)         | Projects (Text)                       | Issue Key (Text), Issue Type (Choice), Reporter (Person), Sprint (Text), Components (Text) | ID (Text), Project (Text), Cycle (Text), Team (Text) |

- **Priority**: Jira's Highest is Urgent and Lowest is Low; Linear's "No priority" and anything else leave it empty;
  a Trello label named Urgent, High, Medium or Low (case aside) is the priority rather than a label.
- **Dates** are kept as days (YYYY-MM-DD) from ISO 8601, Jira's `31/Oct/26` (`dd/MMM/yy`, with or without a time)
  and the day-first dates Import CSV reads; a date that is no real day is left empty.
- **Estimate**: a number from 0 to 999, else empty.
- **Labels**: as many as a card holds (12), each cut to 32 characters.
- **Checklist**: Trello's checklists, one after another; a card with several names each item after its checklist
  ("QA: Test on Safari"). At most 50 items, each cut to 200 characters.
- **Issue Type** is a Choice of the types the file names, when there are 20 or fewer; more, and it is a Text field.
- A field the source leaves empty on every card adds nothing to the type.
- **A card's fields fit the card's size** (16 KB): when they would not, the description is shortened first ("…"
  marks the cut), then checklist items go from the end; the preview counts the cards shortened.

### People

- A person with an **email** that matches a joined member of the plan's team is that member (a plan in a team, for
  someone signed in to it; Asana and Jira's CSVs and Linear's may carry emails, Trello's never do).
- Anyone else is matched by **name** to a person already on the plan, else becomes a **named person** (`n-<slug>`, as a
  CSV import or an agent names someone new: [Who may do what](items.md#who-may-do-what)), the same name the same
  person on every card.

### Comments

- A card's comments go into **one thread titled "Imported comments"** on the card's built-in Comments, oldest first.
  Each comment starts with its original author and date on its own line ("Ana Lopez · 12 Mar 2025"), then its text,
  and is dated as it was written.
- They are posted as the import ("Trello import", "Jira import"): no one's own comment, so they **mention no one**
  (an `@name` stays text), make **no Inbox row**, send **no email** and raise no notice. An Editor may delete them as
  any comment.
- A thread holds at most 200 comments within its size budget: past that the newest are kept, and an import holds at
  most 20,000 comments in all; the rest are left out and counted. A comment cut to 2,000 characters is marked "…".
- Asana's and Linear's CSV exports carry no comments.

### Attachments

liveplanner takes no uploads from an import (agents and CSV can't set Attachments). Each attachment's name and link
are added to the end of the card's description under an **Attachments** line ("- design.png: https://…"), so the file
is a click away; one without an `http` or `https` link is left out and counted.

## The preview

Choosing a file shows what the import will make, before anything is written:

- **The source and the board**: "Trello board · Website Relaunch", with the card count.
- **Columns**: each column with its card count, in board order.
- **Fields**: a row per source field the file fills: its name, the card field it becomes ("Due", or "Issue Type"
  with a **New Field** mark when the import adds it to the card type) and how many cards have it.
- **People**: how many are matched to team members, how many are already on the plan and how many become named
  people.
- **Comments**: how many, on how many cards.
- **Left out**: a row per reason with its count (archived cards, archived lists, rows with no title, comments past the
  cap, attachments kept as links, statuses folded into Other, cards shortened to fit). None: "Nothing left out."
- **Where to**: **New Board Tab in This Plan** (the default) or **New Plan**. The import is **never made in part**:
  when the plan has no room for every card (a plan holds 2,000; "This plan has room for 120 more cards and this file
  has 340"), or no room for the card type, the tab choice is dimmed with that reason and New Plan is chosen. A file
  of more than 2,000 cards is refused outright: "That file has 2,345 cards. A plan holds up to 2,000."
- The preview is headed by the dialog's **All Imports** back bar, the tool's name at its right. **Import** makes it;
  **Choose Another File** opens the picker again for the same tool, and the back bar returns to the list. The
  dialog's footer says what will happen in one line:
  "Makes a Board tab with 4 columns and 120 cards."

## The import

- **Into a new Board tab**: the card type is saved (one undo step), the tab is added and opened (one undo step), then
  every card is made in **one write** with its comments (one undo step); undo takes them back newest first, as a
  JSON import's. The import waits for the plan's cards to load first, as a JSON import does.
- **Into a new plan**: one create carries the tab, the card type and as many cards with their comments as one
  request holds (the rest follow in further writes before the plan opens), so the plan opens whole. It is named after
  the board, filed where a new plan from New would be, and opens in this window once made. A guest's plan is made in
  This Browser, as a guest's New makes one.
- **Large imports** are written in several requests of at most 200 cards and 6 MB each, under the api's request cap;
  into a tab they are still one undo step. A failure part way leaves the cards already written, for undo.
- **Done**: the dialog closes and the plan says "Imported 120 cards from Trello" (and ", 3 left out" when some were).
- **Failed**: nothing the import had not yet written is written, and the dialog stays open with the reason ("Couldn't
  import those cards. Try again."). A failure after the card type or the tab was made leaves them, empty, for undo.

## Agents

- **`import_board`** (MCP, a write) takes the file's text (`content`), an optional `source` (read from the file when
  left out), `projectId` (a new plan when left out), an optional `name` and `preview`. With `preview: true` it answers
  the preview and writes nothing; otherwise it imports and answers what it made: the plan, the tab, the board's
  columns, the cards made and what was left out, with the link.
- **`liveplanner board import <file>`** (`-` for stdin) does the same, with `--project`, `--from`, `--name` and
  `--preview`, printing `+ board "<title>" from <Source>: <n> cards, <n> columns` and the link.
- An agent's import matches people **by name only**: an API token cannot read a team's members, so emails are not
  matched. It is refused as the editor's is: a file past the caps (`file_too_large`, `too_many_cards`), a plan without
  room (`items_full`, naming the room left), a `source` that is not the file's (`source_mismatch`), or a Participant's
  or Viewer's token (`forbidden`).

## Telemetry

`Plan` · `Imported` · `Trello`, `Asana`, `Jira` or `Linear` when an import is made from the editor.
