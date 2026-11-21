# Reading and Editing a Page

Owner, 2026-11-21: "I want pages to not always be in edit mode, like you can click edit to edit it and then you save or
cancel. Anybody else on the page in edit mode changes alongside you."

A knowledgebase is read far more than it is written, and what people and agents read should be what someone meant to
publish, not a sentence half typed. So a page opens to **read**, and changes are made in a **draft** that the people
editing share live and that nobody else sees until it is saved.

## Read mode (the default)

- Every page opens to read, for every role: the writing, the meta row, the right rail, links and embeds all work, and
  nothing in the writing is editable (no caret, no toolbar, no slash menu, no drag handles).
- An Editor and a Participant see **Edit** (pencil icon, primary, at the top right of the page next to Share; also
  the `E` key while reading). A Viewer, a link visitor and an agent never see it.
- **Double-click to edit** (owner, 2026-11-21): while an Editor reads, a small quiet label rides just under the
  pointer over the writing, "Double-click to Edit" (a dark pill, 11 px, shown after the pointer rests a moment, never
  over a link or a control, never for touch). It stays with the pointer anywhere over the page being read, margins and
  gaps included, and through a scroll, but never over the sidebars, the top row or the footer (owner 2026-11-21); a
  double-click there opens edit mode.
- **An empty page** (owner, 2026-11-21), read: a page with nothing under its title shows a drawing of a blank page,
  "Nothing Written Yet", and for whoever may edit **Start Writing** (opens edit mode, the caret in the Title on a
  desktop); a reader is told it has no
  writing yet. Never while editing.
- **The buttons** (owner, 2026-11-21: "look rubbish"): Edit is a solid accent button with a pencil and its key, E.
  While editing, one capsule holds the draft's status only when there is one (an amber dot and "Unsaved changes
  since ...", or an agent's change; no "Editing" label, owner 2026-11-21), then Cancel and Save, floating 24 px inside the bottom right corner of the document's white area (left of the rail, above the footer;
  owner 2026-11-21), where Edit floats too while reading. Edit, Cancel (with an X) and Save are one size, each standing
  on its own, no capsule round them. Save carries the accent, a tick and its keys. The key hints are hidden from assistive technology so
  the buttons are named Edit and Save.
- A page made here (New Page, Add Subpage) opens straight into edit mode with the caret in its Title: it was made
  to be written.
- While anyone is editing, readers see a quiet "Being edited by Priya" note (their discs) in the meta row. Readers keep
  seeing the saved page: the draft never reaches them.

## Edit mode: one shared draft

- **Edit** opens the page's draft: the saved writing if nobody is editing, or the draft already open if someone is.
  Everyone in edit mode on that page edits the same draft together, live, with each other's carets and selections, as
  pages are edited today. There is one draft a page, never one each.
- The page title is part of the draft: a renamed title reaches the page tree when the draft is saved.
- The top of the page shows the draft bar: who is editing (discs), "Unsaved changes" once the draft differs from the
  saved page, then **Cancel** and **Save** (primary). `Mod-S` saves; `Escape` with the caret not in a menu asks to
  Cancel.
- **The Title and the writing** (owner, 2026-11-21): select all (`Mod-A`) takes the box the caret is in, the Title's
  words or all the writing under it, never both; Tab in the Title puts the caret at the start of the writing (a body
  line is made there on a page with none).
- **The page's name while editing** (owner, 2026-11-21): the sidebar shows the draft's Title as it is typed, before
  Save, for the one editing; Save makes it the stored name, and Cancel (or discarding) puts the saved name back.
- **Save** makes the draft the saved page for everyone: readers see it at once, search and agents read it, the
  Updated stamp (verification.md "Created and Updated") moves to the person who pressed Save, "Changed since
  verified" is worked out against it, and the draft is gone. Everyone else still in edit mode stays in edit mode on
  the new saved page, with a toast "Priya saved the page".
- **Cancel** leaves edit mode. If others are still editing, the draft stays theirs and nothing is lost. If you are the
  last one editing and the draft has unsaved changes, Cancel asks first: "Discard your changes to this page?" with
  **Discard Changes** (destructive) and **Keep Editing**. Discarding throws the draft away.
- Leaving the page, closing the tab or losing the connection is not Cancel: the draft is kept (stored in the
  knowledgebase), and the next Edit opens it with "Unsaved changes from Priya, 2 hours ago" and Save / Discard. A draft
  untouched for 30 days is thrown away by the room's daily upkeep.
- Undo and redo work within the draft: Edit starts the undo history and Save or Discard ends it, so undo never
  undoes a save. Version history records saves only, never draft keystrokes.

## What reads the saved page only

Search and its index, Ask and its sources, every agent read (MCP, CLI, the API), page links' hover cards, backlinks,
reading time, On This Page, exports, the Explorer preview, emails and Page Health's checks: always the saved page.
A draft is visible only to the people in edit mode on it.

## Agents

An agent's write (where it is allowed one, knowledgebase-for-agents.md) goes to the saved page as today, never into a
draft. If a draft is open, the people editing see "An agent changed the saved page" in the draft bar, with what
changed, and their Save then lands on top (their draft wins for the blocks they changed; the agent's other changes
stay).

## Share roles

- **Editor, Participant:** Edit, co-edit the draft, Save, Cancel, Discard. A Participant is an Editor minus the
  Knowledgebase Settings, the Knowledgebase Style and automations
  ([Knowledgebases and pages](knowledgebases-and-pages.md#share-roles)), none of which is in the draft.
- **Viewer, link visitor:** read mode only; never sees the draft or who is editing beyond the "Being edited" note.
  A view link's visitor reads the saved page.

## Offline

A knowledgebase kept Offline has no shared draft: Edit opens a local draft, Save writes it, Cancel discards it.

## How it is built (summary; [blueprint](blueprints/editing.md))

The draft is a second article flow on the page's tab (`articles.draft`), synced by the same room ops as the page's
writing today, so live co-editing comes from the engine that exists. The saved writing stays in the page's own flow.
Save is one room op that replaces the saved flow's blocks with the draft's (and the title), stamps the page, and drops
the draft; Discard drops it. The index, agents and every read listed above skip the draft flow. Who is in edit mode is
presence (each session's `editing: <tab>`), not stored.
