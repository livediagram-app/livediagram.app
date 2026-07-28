# 92 — Rich-text notes

The per-element **note** (`note?` on every boxed element, opened from the
element menu's Resources band, the on-element note badge, or an annotation
marker — see [spec/38](38-annotations.md), [spec/68](68-assigned-actions.md))
was a plain-text paragraph in a 288px popover. That is too cramped for
anything longer than a line, and a note is often the place a reviewer writes
several points, a checklist of caveats, or a link to the source material.

This spec makes the note a **small rich-text document**: a bigger popover, an
**always-visible formatting toolbar**, and bold / italic / underline /
headings / bullet + numbered lists / links.

## It reuses the label runs model, it does not invent a second one

Element labels already carry per-range formatting as **runs**
([spec/09](09-canvas-and-palette.md), `rich-text.ts` in
`@livediagram/diagram`): an array of `{ text, …deltas }` slices plus a
plain-text mirror on the element. Notes use exactly that model, so there is
one formatting algebra, one contentEditable ↔ runs bridge, and **no HTML is
ever stored or rendered** — the runs are painted as React spans, which closes
the stored-XSS door a "just keep the innerHTML" design would open.

Two run attributes are added for this feature (unset on every existing run,
so nothing re-renders):

```ts
type TextRun = {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  size?: 'sm' | 'md' | 'lg';
  color?: string;
  // New (spec/92):
  link?: string; // http/https/mailto only, validated by normaliseUrl
  heading?: 1 | 2; // line-level emphasis, applied across whole lines
};
```

`heading` is an inline attribute applied to **every character of the lines the
selection touches**, the same trick lists already use (a list is literal `• `
/ `1. ` prefix text, not a block node). Keeping the model flat is what lets
the note reuse the label editor's offset mapping unchanged. The label toolbar
does not expose either attribute today; nothing stops a future label from
carrying them.

## Data model

`noteRich?: TextRun[]` sits beside `note?: string` on every boxed element that
already had a note (shape, text, sticky, image, table, link-card,
annotation), mirroring how `richText` sits beside `label`:

- **`note` stays the plain-text mirror**, always `=== runsPlainText(noteRich)`.
  Everything that already reads a note — the badge's "has a note" test, the
  menu's Add / Edit Note label, search, the JSON / Excalidraw round-trip, the
  MCP and API payloads — keeps working with zero changes.
- **`noteRich` is absent when the note carries no formatting** (no runs, or a
  single delta-free run). A plain note written before this spec, or typed
  without touching the toolbar, stores exactly what it always did.
- Committing an empty note strips **both** fields, as before.

Note edits keep running through the editor's history `commit`, so undo /
redo and the change log behave exactly as they did.

## The popover

`NotePopover` grows from `w-72` (288px) to **`w-[26rem]` (416px)** with an
editing surface of **11rem minimum, vertically resizable to 24rem**, and the
viewport flip / clamp maths tracks the new height. The chrome is otherwise
unchanged: the "Note" caption, the `Cmd-Enter saves, Esc cancels` hint, and
the Delete note action all stay.

**The toolbar is always visible** (the issue's open question, answered): a
note is usually read as often as it is written, and a toolbar that appears on
focus makes the popover jump the moment you click into it. **Read-only
viewers** get no toolbar at all — they see the formatted note rendered and
nothing that suggests they could change it, the same gate as every other note
edit.

Controls, left to right, in one row of the shared toolbar-button styling
(`h-8 w-8` icon buttons with the standard tooltip, dividers between groups):

| Group  | Controls                                |
| ------ | --------------------------------------- |
| Inline | Bold, Italic, Underline                 |
| Block  | Heading, Subheading                     |
| Lists  | Bullet list, Numbered list, Remove list |
| Link   | Link (opens an inline address field)    |

`Cmd/Ctrl+B` / `I` / `U` drive the same run toggles as the buttons, so the
native contentEditable commands (which would inject `<b>`/`<i>` tags the run
model never sees) never fire.

**Scope of a command with no selection.** The label editor formats the whole
label when the caret is collapsed; that is wrong for a multi-paragraph note.
In a note a collapsed caret scopes an inline command to the **word** it sits
in, and a block command (heading, list) to the **line** — a per-caller option
on the shared format-actions hook, so label behaviour is untouched.

**Links.** The Link button opens a one-line address field under the toolbar,
pre-filled when the selection already sits on a link, with Apply / Remove.
The address goes through the same `normaliseUrl` guard the element link
picker uses (bare hosts get `https://`, only `http` / `https` / `mailto`
survive), and rendering re-checks with `isSafeFollowUrl`, so a payload that
arrived by some other path still cannot execute. Links open in a new tab with
`rel="noopener noreferrer"`.

## Rendering

One renderer, `NoteRichText`, draws a note wherever a note is shown:

- the **read-only popover** body (view-role share participants),
- the **annotation hover preview** (spec/38), which floats above the canvas.

It splits the runs on `\n` into lines, and paints each run as a `<span>` — or
an `<a>` when the run carries a safe `link`. Base size is 13px; a run `size`
maps to 11 / 13 / 16px, `heading: 1` to 17px/700 and `heading: 2` to
14.5px/600. When `noteRich` is absent it renders `note` as a single plain
run, so old notes look exactly as they did.

Notes are **still not drawn in visual exports** (PNG / SVG) — they are an
on-demand affordance, not page content, per spec/38.

## Telemetry (spec/22)

Unchanged for the note lifecycle (`Note` / `Opened` / `Added` / `Changed` /
`Deleted`). A formatting command inside the note editor fires
`track('Note', 'Used', <Bold | Italic | Underline | Heading | List | Link>)`
— an existing category / action pair, and a fixed preset token, never note
content.
