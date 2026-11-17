# Template example content

A template a person picks lands with example values that show how its pages are used: a Live Card's notes, a
Quarterly Review's or a Data Story's chart figures. **Clear Example Content** empties them in one step and keeps the
pages: every element, where it is and how it looks, ready to fill in fresh. It is liveplanner's Clear Example Cards
for a canvas (Work Tracker 1181). The engineering detail, shared by livediagram, livedocuments and livedesign, is in
[liveworkspace's blueprint](../../../../liveworkspace/docs/specs/002-architecture/blueprints/template-examples.md).

## What is example content

- **Example content** (cleared): a sticky note's text; a checklist's rows and ticks (the rows stay, empty and
  unticked); a table's body cells (its header row and header column stay); a chart's numbers (its slice and series
  names stay).
- **Structure** (kept): everything else. A page's headings, text and copy, shapes and their labels, images, icons,
  arrows and the template's note. An infographic's or a slide's words are its design, and a text box emptied would
  draw nothing, so they stay.

## Marked as it lands

Where a person makes the template, its example values are marked as they land: a template start on an empty tab
(every tab a template makes), and the /new wizard's create. An agent's template (the MCP's `template`, a changeset's
`replace`) is not marked: an agent fills a template with real content.

The mark remembers the values, so **text a person has typed or changed is never cleared**: a note rewritten, a row
ticked, a cell or a figure edited is the person's, whoever changed it and however. Moving, resizing and restyling an
example does not make it the person's.

## Clearing it

While the open tab still holds an untouched example, an **Editor** sees a tray under the palette strip: a sparkles
glyph, **"Example content shows how this works."**, and two buttons.

- **Clear Example Content** empties every untouched example on the tab, keeping each element, its place, size, look
  and its structure (a checklist keeps its rows, a table its headers, a chart its names). A locked element is left as
  it is. It is one change and one undo step, and announces "Example content cleared".
- **Keep It** keeps every value as the person's own. One change, one undo step; announces "Example content kept as
  your own".
- Either way no example is left, so the tray goes, for everyone on the tab. Undo brings it back with the values.

The tray appears as soon as the template lands, and stays while any untouched example is on the tab. It belongs to
the tab: each tab of a document answers for its own. It is a standing message: it steps aside while a mode's message
takes its place, and without the strip it stands at the top centre. On a phone the buttons alone show. A page
framed while it shows (landing, Fit, a page's label) centres below the tray too, so the tray never covers the page's
name or its bar.

It sends `Template · Changed · ExampleCleared` or `Template · Changed · ExampleKept`, charted as Template Examples in
the telemetry site's Features › Look & Feel stack. The help centre's Templates article explains both buttons
("Clearing the Example Content").

## Who sees it

Only an **Editor**: it changes the pages' content. A **Participant** and a **Viewer** never see it. Not in zen, an
embed or on a locked tab.
