# Element links and notes (retired)

**Retired 2026-11-04.** Any boxed element could carry a **link** (`link`: to a tab, a document, an element or a web
address, followed on a click) and a **note** (`note`, with its rich-text `noteRich`, read in a popover behind a
badge). In livedocuments they no longer earned their place beside comments and assigned actions, and the owner
retired them entirely. livediagram, liveplanner and livedesign keep theirs.

## What is gone

- **Editor.** No Add Link or Add Note in the element menu's quick bar (it is one row: Assign Action, Add Comment, and
  Delete at the right, [element-menu-quick-bar.md](../008-canvas/element-menu-quick-bar.md)), no Add / Edit Note
  command, no link or note badge ([element-indicators.md](../008-canvas/element-indicators.md)), no following an
  element's link on a click, no note popover or its editor ([rich-text-notes.md](./rich-text-notes.md)), and no
  note in the presenting popover. A Participant's or viewer's menu has no View Note, and Open Link only on a link
  card or a video. Linking a tab into an element (Linking Across Tabs) goes with them.
- **Agents, MCP and the API.** Setting `note`, `noteRich`, or `link` on anything but a link card or a video is
  refused: `invalid_value` with the hint "element links and notes are retired"
  (`packages/edit-operations/src/fields.ts`, and the MCP's raw element values in `apps/mcp/src/element-values.ts`).
  The `note` alias is gone, a shape's long label is cut (warning `label_capped`, "the rest was cut") rather than
  moved into a note, and the reads stop reporting them: no `note=` or `link=` attribute in the outline and pages
  views except a link card's or a video's `link=`, no `note` field in `find`, and the outline budget ladder has no
  notes step (`packages/document-views/src/outline.ts`). Diagram lint's long-label fix suggests a shorter label.
- **Help.** The Links, Notes and Linking Across Tabs articles are deleted; their URLs redirect to their sections
  (`apps/help/public/_redirects`).
- **Telemetry.** `Note·Added`, `Note·Changed`, `Note·Deleted`, `Note·Opened` and `Note·Used` are no longer sent, and
  the dashboard treats them as retired (`liveworkspace/apps/site/app/telemetry/livedocuments/retired-events.ts`).

## What stays

- **Link cards and videos** keep their own `link`, the link picker that sets it and the Open Link row.
- **Table cell links**, **article text hyperlinks** and **article margin notes** are separate features and stay.
- **Stored data is untouched.** A stored `link`, `note` or `noteRich` is never migrated or deleted: documents load,
  save, sync, export and import it as before, and the editor simply ignores it. Deleting a tab still drops tab links
  that pointed at it (`useTabActions`), so a stored link never names a missing tab.
