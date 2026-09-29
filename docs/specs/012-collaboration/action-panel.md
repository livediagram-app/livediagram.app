# The Action Panel

Status: **implemented**.

A **Collaborate** element: a card on the canvas carrying a **list of assigned
actions** ([Assigned actions](assigned-actions.md)): each with its name, description, who it is assigned to,
and whether it is done. It is read where it sits rather than opened, and every
action on it is added, completed and edited from the card.

The shape kind is `action-card`. It is the action sibling of the Comment panel
([The Comment Panel](comment-pin.md)), built the same way for the same reasons.

## Why an element at all

Assigned actions already work. Every boxed element can carry one `action`
([Assigned actions](assigned-actions.md) §1), and the Assign Action dialog, the popover, complete / reopen,
the Collaborate panel's rows, the Activity page ([Activity page](../013-workspace/activity-page.md)), the assignment
email, realtime and persistence all run against that field.

What was missing is the same thing the Comment panel filled for comments:
somewhere to put a piece of work that is about a **place** or about the canvas
as a whole, rather than hanging it on whichever shape happens to be nearest.
And, once it is there, a way to **read it without clicking**: an action on a
shape is a small badge that opens a popover for one reader, while a follow-up
the room agreed on belongs on the canvas, in the export, and in everyone's
session.

## The data: a list, and one way to read it

An ordinary element carries at most one `action` ([Assigned actions](assigned-actions.md) §1). A card
carries **`actions: ElementAction[]`**, in the order they were added, at most
**50**: the editor stops adding at 50, and the api trims any longer list on
every tab write (`capElementActions`), so neither the stored tab nor the
Activity index can grow without bound. Every reader goes through one helper, **`elementActions(el)`**, which
returns the card's list, or an ordinary element's single `action` as a
one-item list, so nothing downstream branches on the kind. A card saved before
the list existed holds a single `action`; the helper reads it as a one-item
list and the card's first edit writes it back as `actions`. No migration.

Each action keeps its own stable `id`, which is what every mutation, the
Activity index row and the timeline event key on.

## It reuses the existing wiring, entirely

The panel introduces **no action machinery of its own**. It is an element whose
only job is to hold actions, so:

- **Adding or editing** an action opens the SAME Assign Action dialog the element menu's
  Assign Action tile opens (`openAssignActionDialog`): assignee picker, name,
  description, the email toggle, the team-library nudges: all of [Assigned actions](assigned-actions.md) §2,
  unchanged.
- **Complete / Reopen** call the same `completeAction` / `reopenAction`
  (addressed by action id on a card), so the
  same telemetry fires and the same non-undoable carve-out applies (Cmd+Z must
  never silently unassign someone's work).
- Every action is found by the Collaborate panel (one row per action), the
  Activity page (one index row per action) and the assignment email because
  they all read `elementActions(el)`. Nothing indexes the panel specially.

## The card

The card is built from the same parts as the modern Collaborate cards (the Q&A
board, the Idea box, the Decision record; [Idea box](idea-box.md) "The look"):
the tab theme's **accent** (the element's own stroke, `CollabAccentScope`),
and the shared `CollabPanel` frame, which reflows with the element. It carries
**no `…`**: it has no settings of its own, every act is on the card, and
right-click opens the ordinary element menu.

- **Empty** (dropped fresh, no actions yet): the title reads **Actions**, and
  the body is an invitation: a clipboard-check glyph in a soft accent disc,
  **No Actions Yet**, the line "Give someone a clear next step, with their name
  on it.", and one loud accent button, **Add Action**, which opens the Assign
  Action dialog to create the card's first action. The card ships with **no
  label**, since the dialog would prefill every new action's name from it.
- **With actions**: the title is the card's label, or **Actions** when it has
  none, with the open count as a quiet caption ("2 open") or a green **All
  Done** chip once every action is done. Below it, **one row per action**, in
  the order added:
  - a **round check** on the left: pressing it completes the action (it fills
    green with a pop, and the card throws the Done check's confetti when that
    was the last open one), pressing it again reopens it;
  - the action's **name** (up to two lines, struck through and muted once
    done) and under it the **assignee**: their initials in a small accent disc
    and "You" or their name;
  - pressing the rest of the row opens the dialog to **edit** that action.
- **The footer** is a dashed accent bar, **Add Action**, which opens the dialog
  to append another. The list scrolls when it outgrows the card.
- A completed action softens (title struck through and muted, the accent
  swapped for green) but stays on the canvas: finished work is still a record
  of what was agreed.
- **Delete** lives in the dialog: editing a card's action shows a two-step
  **Delete Action** in its footer, the popover's rule ([Assigned actions](assigned-actions.md) §3). Deleting the
  card deletes all its actions with it.
- **Read-only** surfaces (a view-role visitor, the embed, a presentation) show
  the card readable but with no buttons, like the popover ([Assigned actions](assigned-actions.md) §7). An
  empty card there says **No Action Yet** with no invitation line.
- **Export** draws the same card (`svg-render-panel-faces.ts`): the header, then
  as many rows as fit, each with its check (filled once done), name and
  assignee, so a PNG or SVG of the canvas reads like the canvas.

The generic action **badge** is suppressed on this kind: the card IS the badge,
and a badge in its corner repeating what the card says is one too many. It is the
same rule the Comment panel applies to its comment count.

## Joined by an arrow

A panel that is _about_ an element is attached with an ordinary pinned arrow,
exactly as [The Comment Panel](comment-pin.md) does it, and for the same reasons: "about" is what an arrow
already says on this canvas, and a bespoke link would be a second kind of
connection to lay out, export and explain.

## Registration

- In the palette's **Behaviour → Collaborate** group beside the Comment panel,
  placed from there only (the element menu keeps Assign Action for putting an
  action on an existing element).
- Not self-painting: a card that wants the fill, border and rounded corners
  every other card gets. Excluded from `isSvgRenderedShape`, which is
  allow-by-default.
- **Not votable** ([Session tools (timer + voting)](session-tools.md)): it is a task, not a candidate.
- Sized for a few rows, 300 x 300 by default, and resizable. It **reflows**
  like the Comment panel: resizing makes room for more actions, not bigger type.
- Telemetry: placing it is the ordinary element-created event with type
  `ActionPanel`; everything done from the card fires [Assigned actions](assigned-actions.md)'s existing
  `Action` events.

## Not in scope

- More than one action on an ordinary element. [Assigned actions](assigned-actions.md)' one-per-element rule
  stands; the card is the place for a list.
- A composer on the face. Assigning needs the picker, the team context and the
  email toggle, which is a dialog's worth of decisions, so the card opens the
  dialog rather than growing a second, smaller one.
