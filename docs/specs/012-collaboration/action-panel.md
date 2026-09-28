# The Action Panel

Status: **implemented**.

A **Collaborate** element: a card on the board carrying ONE assigned action
([Assigned actions](assigned-actions.md)): its name, description, who it is assigned to, and whether it is
done. It is read where it sits rather than opened, and configured from the card.

The shape kind is `action-card`. It is the action sibling of the Comment panel
([The Comment Panel](comment-pin.md)), built the same way for the same reasons.

## Why an element at all

Assigned actions already work. Every boxed element can carry one `action`
([Assigned actions](assigned-actions.md) §1), and the Assign Action dialog, the popover, complete / reopen,
the Collaborate panel's rows, the Activity page ([Activity page](../013-workspace/activity-page.md)), the assignment
email, realtime and persistence all run against that field.

What was missing is the same thing the Comment panel filled for comments:
somewhere to put a piece of work that is about a **place** or about the board
as a whole, rather than hanging it on whichever shape happens to be nearest.
And, once it is there, a way to **read it without clicking**: an action on a
shape is a small badge that opens a popover for one reader, while a follow-up
the room agreed on belongs on the board, in the export, and in everyone's
session.

## It reuses the existing wiring, entirely

The panel introduces **no action machinery of its own**. It is an element whose
only job is to hold an `action`, so:

- **Configuring** it opens the SAME Assign Action dialog the element menu's
  Assign Action tile opens (`openAssignActionDialog`): assignee picker, name,
  description, the email toggle, the team-library nudges: all of [Assigned actions](assigned-actions.md) §2,
  unchanged.
- **Complete / Reopen** call the same `completeAction` / `reopenAction`, so the
  same telemetry fires and the same non-undoable carve-out applies (Cmd+Z must
  never silently unassign someone's work).
- The action is found by the Collaborate panel, the Activity page and the
  assignment email because it is an ordinary `el.action`. Nothing indexes the
  panel specially.

If it ever grows a second way to store an action, that is the bug.

## The card

The card is built from the same parts as the modern Collaborate cards (the Q&A
board, the Idea box, the Decision record; [Idea box](idea-box.md) "The look"):
the tab theme's **accent** (the element's own stroke, `CollabAccentScope`),
and the shared `CollabPanel` frame that scales with the element. It carries
**no `…`**: it has no settings of its own, every act is on the card, and
right-click opens the ordinary element menu.

- **Empty** (dropped fresh, no action yet): the title reads **Action**, and
  the body is an invitation rather than a placeholder: a clipboard-check glyph
  in a soft accent disc, **No Action Yet**, the line "Give someone a clear next
  step, with their name on it.", and one loud accent button, **Set Up
  Action**, which opens the Assign Action dialog for this card. The dialog
  prefills the action name from the element's label as it does for any
  element, so the card ships with **no label**, since a default caption would
  become every new action's name.
- **With an action**: the **name is the title** (up to two lines, set large,
  the Decision record's treatment), with a **status chip** beside it: **Open**
  in the accent, **Done** in green. Under it, the **description** (muted,
  scrolls when long), then the **assignee row**: a soft tinted row with the
  assignee's initials in an accent disc, "Assigned to you" or "Assigned to
  {name}", and "from {assigner} · {when}" beneath.
- **The footer** carries the one act the card is for: **Mark Complete**, a
  full-width accent button with a check. Pressing it strikes the title
  through, turns the chip green, and throws the Done check's confetti burst
  once (a card that loads already done does not celebrate). Once done the
  button turns quiet and reads **Reopen**. **Edit** is a small round pencil
  beside it, which reopens the dialog prefilled.
- A completed action softens (title struck through and muted, the accent
  swapped for green) but stays on the board: finished work is still a record
  of what was agreed.
- **Delete** is not on the face. Deleting the card deletes its action with it
  ([Assigned actions](assigned-actions.md) §3), and the element menu's Collaborate → View Action popover keeps
  its two-step Delete for clearing the action off a card you want to reuse.
- **Read-only** surfaces (a view-role visitor, the embed, a presentation) show
  the card readable but with no buttons, like the popover ([Assigned actions](assigned-actions.md) §7). An
  empty card there says **No Action Yet** with no invitation line.
- **Export** draws the same card (`svg-render-faces.ts`): the status chip, the
  title, the description, and the assignee row with its initials disc, so a
  PNG or SVG of the board reads like the board.

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
- Sized for its content, 260 x 190 by default, and resizable like the Comment
  panel.
- **Export**: the headless renderer draws the action's name, assignee and
  status (or "No action yet"), so a panel reads in an image the way it reads
  on the board.
- Telemetry: placing it is the ordinary element-created event with type
  `ActionPanel`; everything done from the card fires [Assigned actions](assigned-actions.md)'s existing
  `Action` events.

## Not in scope

- More than one action per card. One action per element is [Assigned actions](assigned-actions.md)'s rule,
  and a list of actions is what the Collaborate panel already is.
- A composer on the face. Assigning needs the picker, the team context and the
  email toggle, which is a dialog's worth of decisions, so the card opens the
  dialog rather than growing a second, smaller one.
