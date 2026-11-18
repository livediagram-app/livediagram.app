# Template example content

A template a person picks lands with example values that show how its board is used: the Eisenhower Matrix's notes
in each quadrant, a retro's notes and its Action items checklist. **Clear Example Content** empties them in one step and
keeps the board: every element, where it is and how it looks, ready to fill in fresh. It is liveplanner's Clear
Example Cards for a canvas (Work Tracker 1181). The engineering detail, shared by livediagram, livedocuments and
livedesign, is in [liveworkspace's blueprint](../../../../liveworkspace/docs/specs/002-architecture/blueprints/template-examples.md).

## What is example content

- **Example content** (cleared): a sticky note's text; a checklist's rows and ticks (the rows stay, empty and
  unticked); a table's body cells (its header row and header column stay); a chart's numbers (its slice and series
  names stay).
- **Sample copy** (cleared): the free text a template writes as a worked example, where the template names it: the
  Fishbone's causes, the Timeline's milestone lines, the Roadmap's outcomes and the Venn's tested ideas. An emptied text
  shows a faint "Text" prompt to an Editor ([Text element](../008-canvas/canvas-and-palette.md#text-element)).
- **Structure** (kept): everything else. Headings, a quadrant's or column's title and prompt, a key or legend, the
  guide line under the title, lanes, panels, shapes and their labels, other text boxes, arrows, icons and the
  template's note. A board's free text is mostly how to read it, so a template opts its sample copy in rather than
  every text counting.

## Marked as it lands

Where a person makes the template, its example values are marked as they land: a template start on an empty tab, and
the /new wizard's create. An agent's template (the MCP's `template`, a changeset's `replace`) is not marked: an agent
fills a template with real content.

The mark remembers the values, so **text a person has typed or changed is never cleared**: a note rewritten, a row
ticked, a cell edited is the person's, whoever changed it (an Editor, a Participant, an agent) and however. Moving,
resizing and restyling an example does not make it the person's.

## Clearing it

While the open tab still holds an untouched example, an **Editor** sees a tray under the palette strip: a sparkles
glyph, **"Example content shows how this works."**, and two buttons.

- **Clear Example Content** empties every untouched example on the tab, keeping each element, its place, size, look
  and its structure (a checklist keeps its rows, a table its headers). A locked element is left as it is. It is one
  change and one undo step, and announces "Example content cleared".
- **Keep It** keeps every value as the person's own. One change, one undo step; announces "Example content kept as
  your own".
- Either way no example is left, so the tray goes, for everyone on the tab. Undo brings it back with the values.

The tray appears as soon as the template lands, and stays while any untouched example is on the tab, so it can be
used later in the session or on another day. It belongs to the tab: each tab of a document answers for its own.

It is a standing message: it steps aside while a mode's message (an armed tool's Cancel) takes its place, and without
the strip (the floating palette, Draw's dock) it stands at the top centre, just clear of Draw's dock. On a phone the buttons alone show.

It sends `Template · Changed · ExampleCleared` or `Template · Changed · ExampleKept`, charted as Template Examples in
the telemetry site's Features › Look & Feel stack. The help centre's Templates article explains both buttons
("Clearing the Example Content").

## Who sees it

Only an **Editor**: it changes the board's content, which a Participant may only add to. A **Participant** and a
**Viewer** never see it. Not in zen, an embed, on a locked tab or over Watch It Built's demo.
