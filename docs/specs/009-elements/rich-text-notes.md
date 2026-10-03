# Rich-text notes

The per-element **note** (`note?` on every boxed element, opened from the
element menu's Resources band, the on-element note badge, or an annotation
marker — see [Annotations](annotations.md), [Assigned actions](../012-collaboration/assigned-actions.md))
is a **small rich-text document**: a note is often the place a reviewer writes
several points, a checklist of caveats, or a link to the source material, and
a plain-text paragraph in a small popover is too cramped for that.

The note has a wide popover, an **always-visible formatting toolbar**, and
bold / italic / underline / headings / bullet + numbered lists / links.

## It reuses the label runs model, it does not invent a second one

Element labels already carry per-range formatting as **runs**
([Canvas and palette](../008-canvas/canvas-and-palette.md), `rich-text.ts` in
`@livediagram/document`): an array of `{ text, …deltas }` slices plus a
plain-text mirror on the element. Notes use exactly that model, so there is
one formatting algebra, one contentEditable ↔ runs bridge, and **no HTML is
ever stored or rendered** — the runs are painted as React spans, which closes
the stored-XSS door a "just keep the innerHTML" design would open.

Two run attributes serve notes, `link` and `heading`. Both are optional, so a
run without them renders as plain text:

```ts
type TextRun = {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  size?: 'sm' | 'md' | 'lg';
  color?: string;
  link?: string; // http/https/mailto only, validated by normaliseUrl
  heading?: RunHeading; // 1 | 2 | 3, line-level emphasis across whole lines
};
```

`heading` is an inline attribute applied to **every character of the lines the
selection touches**, the same trick lists already use (a list is literal `• `
/ `1. ` prefix text, not a block node). Keeping the model flat is what lets
the note reuse the label editor's offset mapping unchanged. The label toolbar
exposes `heading` through the block-type picker ([The block-type picker](block-type-picker.md))
and does not expose `link`; nothing stops a label from carrying one.

## Data model

`noteRich?: TextRun[]` sits beside `note?: string` on every boxed element
(`isBoxed`: shape, text, sticky, image, freehand, table, annotation, link-card,
video), mirroring how `richText` sits beside `label`:

- **`note` stays the plain-text mirror**, always `=== runsPlainText(noteRich)`.
  Everything that reads a note — the badge's "has a note" test, the
  menu's Add / Edit Note label, search, the JSON / Excalidraw round-trip, the
  MCP and API payloads — reads the mirror alone.
- **`noteRich` is absent when the note carries no formatting** (no runs, or a
  single delta-free run). A note without formatting stores only `note`.
- Committing an empty note strips **both** fields.

Note edits run through the editor's history `commit`, so undo / redo treat
them like any other element edit.

## The popover

`NotePopover` is **`w-[26rem]` (416px)** wide with an editing surface of
**11rem minimum, vertically resizable to 24rem**, and the viewport flip /
clamp maths tracks its height. The chrome is the "Note" caption, the
`Cmd-Enter saves, Esc cancels` hint, and the Delete note action.

**The toolbar is always visible**: a note is usually read as often as it is written, and a toolbar that appears on
focus makes the popover jump the moment you click into it. **Read-only
viewers** get no toolbar at all — they see the formatted note rendered and
nothing that suggests they could change it, the same gate as every other note
edit.

Controls, left to right, in one row of the shared toolbar-button styling
(`h-8 w-8` icon buttons with the standard hover card, dividers between groups):

| Group  | Controls                                                                 |
| ------ | ------------------------------------------------------------------------ |
| Inline | Bold, Italic, Underline                                                  |
| Block  | Block type (one dropdown, [The block-type picker](block-type-picker.md)) |
| Link   | Link (opens an inline address field)                                     |

`Cmd/Ctrl+B` / `I` / `U` drive the same run toggles as the buttons, so the
native contentEditable commands (which would inject `<b>`/`<i>` tags the run
model never sees) never fire.

**Scope of a command with no selection.** The label editor formats the whole
label when the caret is collapsed; that is wrong for a multi-paragraph note.
In a note a collapsed caret scopes an inline command to the **word** it sits
in, and a block command (whatever the block-type picker applies) to the **line** —
a per-caller option on the shared format-actions hook, so label behaviour is
untouched.

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
- the **annotation hover preview** ([Annotations](annotations.md)), which floats above the canvas.

It splits the runs on `\n` into lines, and paints each run as a `<span>` — or
an `<a>` when the run carries a safe `link`. Base size is 13px; a run `size`
maps to 10 / 11 / 13 / 16px (`xs` / `sm` / `md` / `lg`), `heading: 1` to 17px/700 and `heading: 2` to
14.5px/600. When `noteRich` is absent it renders `note` as a single plain
run.

Notes are **not drawn in visual exports** (PNG / SVG) — they are an
on-demand affordance, not page content, per [Annotations](annotations.md).

## Telemetry ([Telemetry + public transparency dashboard](../017-telemetry/telemetry.md))

The note lifecycle emits `Note` / `Opened` / `Added` / `Changed` /
`Deleted`. A formatting command inside the note editor fires
`track('Note', 'Used', <Bold | Italic | Underline | Heading | List | Link>)`
— an existing category / action pair, and a fixed preset token, never note
content.
