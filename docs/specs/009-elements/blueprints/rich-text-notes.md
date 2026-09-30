# Rich-text notes: blueprint

Derived from [Rich-text notes](../rich-text-notes.md), with the toolbar's block control from
[The block-type picker](../block-type-picker.md). The spec decides; this file only adds engineering
precision. Defaults applied where the spec is silent are ledgered in [DEFAULTS.md](DEFAULTS.md) and
cited as `DDn`.

Scope, by file:

| File                                                         | Role                                                                             |
| ------------------------------------------------------------ | -------------------------------------------------------------------------------- |
| `packages/diagram/src/rich-text.ts`                          | `TextRun`, `RunHeading`, list / heading / trim algebra, `ATTR_KEYS`              |
| `packages/diagram/src/element-types.ts`                      | `note?` + `noteRich?` on every boxed element                                     |
| `apps/live/lib/note-value.ts`                                | `canonicalNote`, `noteFieldsEqual`: the one stored form of a note                |
| `apps/live/hooks/canvas/useEditorNotes.ts`                   | `noteOpenId`, `openNote`, `closeNote`, `setNote` through history                 |
| `apps/live/components/panels/EditorAnchoredPopovers.tsx`     | Mounts `NotePopover`; lifecycle telemetry on commit                              |
| `apps/live/components/notes/NotePopover.tsx`                 | The anchored shell: position, flip, outside-click commit, Delete note            |
| `apps/live/components/notes/NoteRichTextEditor.tsx`          | The contentEditable surface and its keys                                         |
| `apps/live/components/notes/useNoteRichTextSession.ts`       | Note session over the shared document hook (`collapsedScope: 'word'`)            |
| `apps/live/components/notes/NoteFormatToolbar.tsx`           | Docked toolbar and the inline link field                                         |
| `apps/live/components/notes/NoteRichText.tsx`                | The one read-only renderer; `runsToLines`, `noteRuns`                            |
| `apps/live/components/notes/note-run-style.ts`               | Note typography; `noteRunHref`, `noteRunStyle`                                   |
| `apps/live/components/rich-text/useRichTextDocument.ts`      | Runs ⇄ DOM machine shared with the label editor                                  |
| `apps/live/components/rich-text/useRichTextFormatActions.ts` | Command dispatch and the collapsed-caret scope rule                              |
| `apps/live/components/rich-text/rich-text-format.ts`         | `ActiveFormat`, `computeActiveFormat`, `wordRangeAt`, `PLAIN_RUN_DEFAULTS`       |
| `apps/live/components/rich-text/rich-text-dom.ts`            | DOM read-back, selection offsets, `insertTextAtCaret`                            |
| `apps/live/components/rich-text/block-type.ts`               | `BlockType`, `BLOCK_TYPES`, `blockTypeOf`, `blockTypeApplies`, `listStyleOfText` |
| `apps/live/components/rich-text/BlockTypePicker.tsx`         | The block control, rendered by both toolbars                                     |
| `apps/live/components/rich-text/ToolbarDropdown.tsx`         | Shared inline menu; `noFocusSteal`                                               |
| `apps/live/components/rich-text/toolbar-chrome.tsx`          | `toolbarButtonClass`, `TOOLBAR_DIVIDER`, `RUN_TOGGLES`, `runToggles`             |
| `apps/live/components/canvas/RichTextToolbar.tsx`            | The label toolbar hosting the same picker                                        |
| `apps/live/components/canvas/useRichTextSession.ts`          | Label session (`collapsedScope: 'all'`)                                          |
| `apps/live/components/canvas/label-style.ts`                 | `effectiveRunStyle`: label headings in `em`                                      |
| `apps/live/components/canvas/PresentationElementPopover.tsx` | Third read-only surface for a note, in presentation mode [Q7]                    |
| `apps/live/lib/url-safety.ts`                                | `normaliseUrl` (store) and `isSafeFollowUrl` (follow)                            |

## Domain and naming

| Term            | Identifier                                       | Meaning                                                         |
| --------------- | ------------------------------------------------ | --------------------------------------------------------------- |
| Note            | `note?: string`                                  | The plain-text mirror, trimmed; `'' ` never stored              |
| Note runs       | `noteRich?: TextRun[]`                           | The formatting; absent when the note carries none               |
| Run             | `TextRun`                                        | `{ text, …deltas }`, one flat slice                             |
| Heading level   | `RunHeading` (`1 \| 2 \| 3`)                     | Line-level emphasis written across whole lines                  |
| Link            | `TextRun.link`                                   | An address that passed `normaliseUrl`                           |
| List style      | `ListStyle` (`'bullet' \| 'numbered' \| 'none'`) | Literal line prefix `• ` / `N. `, not a node                    |
| Block type      | `BlockType`                                      | `'paragraph' \| 'h1' \| 'h2' \| 'h3' \| 'bullet' \| 'numbered'` |
| Collapsed scope | `collapsedScope: 'all' \| 'word'`                | What a command with no selection acts on                        |
| Active format   | `ActiveFormat`                                   | Toolbar state for the current selection                         |
| Canonical note  | `NoteFields` from `canonicalNote`                | The pair as stored                                              |
| Open note       | `noteOpenId: string \| null`                     | Which element's popover is open                                 |

Banned synonyms: "rich note" as a type, "description", "memo" in code (the command palette keyword
list is exempt), "block node" for a heading or list (both are run attributes / prefix text),
"HTML" for anything stored.

## Behaviour and state

### States

`noteOpenId === null` (closed) or an element id (open). The popover is `readOnly` (render only) or
editable. There is no other state: the editor is uncontrolled and the live value sits in
`NotePopover`'s `valueRef`.

### Open

1. `openNote(id)` toggles: the same id closes, any other id opens. `track('Note', 'Opened')` fires
   only on an open transition.
2. Entry points: the element menu's Resources band (`Add Note` / `Edit Note` in
   `ElementContentSections.tsx`), the badge (`BadgeStrip`, suppressed for annotations), an
   annotation double-click ([Annotations blueprint](annotations.md)), and the command palette's
   `note` command.
3. `NotePopover` anchors to `[data-element-id]`'s live rect, bottom-centre plus `GAP`, clamps
   horizontally by `WIDTH / 2 + VIEWPORT_EDGE_MARGIN`, and flips above when the popover would pass
   the viewport bottom. The flip uses the rendered height of the popover [Q3]. It re-anchors on
   `resize` and on capture-phase `scroll`.
4. The editor mounts, paints the runs, focuses, and parks the caret at the end (DD4).

### Edit

- Typing, Enter (a literal `'\n'` via `insertTextAtCaret`), paste (`text/plain` only, DD3) and IME
  composition end all call `syncFromDom` and report `(plain, runs)` up.
- A format command mutates `runsRef` synchronously, reports up in the same tick, then repaints and
  restores the selection on the next layout effect.
- `Cmd/Ctrl+B/I/U` call `onToggle`, never the native command.
- `Cmd/Ctrl+Enter` commits and closes. `Escape` closes without committing.
- An outside `mousedown` commits (editable) or just closes (read-only) (DD2).
- Delete note commits `('', [])` and closes. It is disabled while there is neither a stored note
  nor typed text (DD8).

### Collapsed-caret scope

| Command               | Selection | `'all'` (label)      | `'word'` (note)                          |
| --------------------- | --------- | -------------------- | ---------------------------------------- |
| Inline (toggle, link) | range     | the range            | the range                                |
| Inline                | collapsed | whole text           | `wordRangeAt(text, caret)`; null → no-op |
| Block (list, heading) | range     | `expandRangeToLines` | `expandRangeToLines`                     |
| Block                 | collapsed | whole text           | the caret's line                         |

### Block type

1. The picker shows `blockTypeOf(heading, listStyle)`, where both are read from the **first line of
   the selection** (the caret's line when collapsed) [Q6].
2. Picking a type runs `blockTypeApplies(type)`: always both `onApplyList(list)` then
   `onApplyHeading(heading)`, so heading and list are never set together through the picker.
3. `blockTypeOf` reports a list over a heading when both are present (DD10); only legacy runs reach
   that pairing.

### Links

1. The Link button toggles the field; it is pre-filled with `active.link` when the target is
   uniformly linked.
2. Apply: `normaliseUrl(value)`. `null` marks the field invalid and stores nothing (DD7).
   Otherwise `applyLink(url)` patches `{ link: url }` over the inline target range.
3. Remove (shown only when pre-filled) patches `{ link: undefined }`.
4. Enter / Escape inside the field are stopped so they never save or cancel the note.

### Commit

1. `EditorAnchoredPopovers` computes `prev = canonicalNote(target.note ?? '', target.noteRich)` and
   `now = canonicalNote(next, runs)`.
2. `setNote` commits through history: it drops both fields, then writes `note` and, only when
   `hasRichFormatting`, `noteRich`.
3. When `noteFieldsEqual(prev, now)` nothing is tracked; otherwise `Added` (no previous note),
   `Deleted` (no new note) or `Changed`.
4. On a tab where edits are blocked the popover opens `readOnly` and never commits [Q4].

Invariants:

- **I1:** stored `note === runsPlainText(noteRich)` whenever `noteRich` is present.
- **I2:** `noteRich` present ⇒ `hasRichFormatting(noteRich)`.
- **I3:** stored `note` is trimmed and non-empty; an empty note stores neither field (DD1).
- **I4:** no stored value ever reaches the DOM as markup; runs render as React text.
- **I5:** an `href` is emitted only when `isSafeFollowUrl(run.link)`.

## Interfaces and contracts

```ts
// packages/diagram/src/rich-text.ts
export type RunHeading = 1 | 2 | 3;
export type TextRun = {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  size?: RunSize;
  color?: string;
  link?: string;
  heading?: RunHeading;
};
export function applyListStyle(runs: TextRun[], style: ListStyle, range?: Range): TextRun[];
export function applyHeadingToLines(
  runs: TextRun[],
  level: RunHeading | null,
  range?: Range,
): TextRun[];
export function expandRangeToLines(text: string, range: Range): Range;
export function trimRuns(runs: TextRun[]): TextRun[];
export function hasRichFormatting(runs: TextRun[] | undefined): boolean;

// apps/live/lib/note-value.ts
export type NoteFields = { note: string; noteRich?: TextRun[] };
export function canonicalNote(plain: string, runs?: TextRun[]): NoteFields;
export function noteFieldsEqual(a: NoteFields, b: NoteFields): boolean;

// apps/live/components/rich-text/block-type.ts
export type BlockType = 'paragraph' | 'h1' | 'h2' | 'h3' | 'bullet' | 'numbered';
export function blockTypeOf(heading: RunHeading | null, list: ListStyle): BlockType;
export function blockTypeApplies(type: BlockType): { heading: RunHeading | null; list: ListStyle };
export function listStyleOfText(text: string): ListStyle;

// apps/live/components/notes/NotePopover.tsx
type NotePopoverProps = {
  elementId: string;
  initial: string;
  initialRuns?: TextRun[];
  onCommit: (next: string, runs: TextRun[]) => void;
  onClose: () => void;
  readOnly?: boolean;
};
```

(`Range` above abbreviates `{ start: number; end: number }`.)

Wire contract: the api's OpenAPI schema (`apps/api/src/openapi/schemas.generated.ts`) types `note`
as `string` and `noteRich` as `TextRun[]`. `isValidElement` (via `isValidTab`) checks that
`noteRich` is an array of runs with a string `text` and optional attributes of the right primitive
type, and that `runsPlainText(noteRich) === note` [Q2]. A rejection is the existing invalid-tab
response.

## Data and persistence

- **Persisted:** `note`, `noteRich` on the element, in the tab JSON (D1 or IndexedDB), through the
  normal tab sync and change log.
- **Never persisted:** `noteOpenId`, the popover position, the link field's draft, `ActiveFormat`.
- **Snapshot / restore:** history snapshots carry both fields; undo restores the pair together.
- **Migration:** none. A note without `noteRich` renders as one plain run through `noteRuns`.

## Errors and edge cases

| #   | Case                                             | Handling                                                    |
| --- | ------------------------------------------------ | ----------------------------------------------------------- |
| E1  | Whitespace-only note committed                   | `canonicalNote` → `''`; both fields dropped                 |
| E2  | Formatting-only edit                             | `noteFieldsEqual` false → `Changed`                         |
| E3  | Reopen and click away                            | Canonical forms equal → no event, but one history commit    |
| E4  | Unsafe or unparsable address typed               | `normaliseUrl` null; field invalid; nothing stored          |
| E5  | Unsafe `link` arriving by API or import          | `noteRunHref` null; rendered as a plain span                |
| E6  | Collapsed caret on whitespace, inline command    | `wordRangeAt` null; no-op                                   |
| E7  | Heading on an empty line                         | `applyHeadingToLines` returns the runs unchanged            |
| E8  | Commit straight after a format click             | Report runs in the same tick, so the new value commits      |
| E9  | Anchor element missing from the DOM              | Position not updated; popover stays hidden until it appears |
| E10 | Edits blocked (locked tab, loading)              | Popover `readOnly` [Q4]                                     |
| E11 | Malformed `noteRich` in a tab                    | Rejected by `isValidElement` [Q2]                           |
| E12 | `note` and `noteRich` disagree                   | Rejected by `isValidElement` [Q2]                           |
| E13 | Editor resized to 24rem near the viewport bottom | Popover re-flips from its measured height [Q3]              |

## Security and trust

- **Trust boundary.** A note arrives from the local editor, a collaborator, the api (guest, signed
  in, token) or an import. Only the local editor applies `normaliseUrl`; every renderer applies
  `isSafeFollowUrl` (I5).
- **Markup.** There is no `dangerouslySetInnerHTML` on the note path; the editor paints spans with
  `textContent`; paste reads `text/plain` only.
- **Links.** `target="_blank"` with `rel="noopener noreferrer"`; a click stops propagation so it
  never doubles as a canvas gesture.
- **Size.** A note is bounded only by `MAX_TAB_BYTES` (4 MiB) at the api.

## Performance and limits

- `computeActiveFormat` walks the runs once per `selectionchange`: `O(runs)`.
- A format apply rebuilds the runs (`O(chars)` for list / heading via per-char `mapLines`) and
  repaints the editor once.
- Worst case is a note near `MAX_TAB_BYTES`; the per-char list walk stays linear.

## Presentation and UX

- Popover: `w-[26rem]`, caption "Note" (10px uppercase), toolbar, editor, footer with
  `Cmd-Enter saves, Esc cancels.` and `Delete note` (rose, disabled slate).
- Toolbar (always visible, editable only): Bold, Italic, Underline | Block type | Link, `h-8 w-8`
  buttons via `toolbarButtonClass(active, 'shrink-0')`, `TOOLBAR_DIVIDER` between groups, wrapping
  row on `bg-slate-50`.
- Block-type trigger shows `blockTypeLabel(blockType)` and a chevron; the menu lists
  `BLOCK_TYPES` in order, the current one tinted brand.
- Editor: `min-h-44 max-h-96 resize-y overflow-y-auto`, 13px, placeholder
  `Add a note for this element…`.
- Link field: placeholder `example.com`, Apply (brand), Remove (only when pre-filled).
- Read-only: `NoteRichText` in a `max-h-96` scroll box; no toolbar, no footer.
- Rendering: base 13px; `size` 11 / 13 / 16px; heading 1 17px/700, 2 14.5px/600, 3 13.5px/600
  (DD5); heading line-height 1.45; links underlined in `var(--note-link-color)` (DD6).
- Labels render headings at `1.7em`/700, `1.35em`/700, `1.15em`/600, line-height 1.25 (DD9).
- No loading state: the note is on the element already. No error state beyond E4's invalid field.

## Accessibility

- Editor: `role="textbox"`, `aria-multiline`, `aria-label="Note"`.
- Toggles: `aria-label` and `aria-pressed`; Link adds `aria-expanded`.
- Picker trigger: `aria-haspopup="listbox"`, `aria-expanded`, `aria-label="Block type"`; options
  `role="option"` with `aria-selected`. Escape does not close the menu and arrow keys do not move
  between options (G12).
- Link field: `aria-label="Link address"`, `aria-invalid` on refusal; the refusal has no text
  message, only the rose border (G12).
- Focus: toolbar controls `preventDefault` on `mousedown` (`noFocusSteal`) so the editor keeps its
  selection; the link field takes focus when opened.
- Contrast: link colour brand-700 on white and brand-200 on slate-800 meet 4.5:1.
- Motion: none.

## Web experience

- **INP.** A format apply is one synchronous runs rewrite plus one repaint of a small DOM.
- **CLS.** The toolbar is always mounted, so focusing the editor never moves the popover; the
  popover is `position: fixed` in a portal, outside document flow.
- **LCP.** Unaffected: the popover mounts only on demand.

## Observability

The code emits no log on this path (G1). Target fingerprints:

| #   | Where                                    | Level          | Fingerprint                                          |
| --- | ---------------------------------------- | -------------- | ---------------------------------------------------- |
| O1  | `NoteLinkField` apply refused            | `console.info` | `[note] link refused reason=unsafe-or-invalid`       |
| O2  | `noteRunHref` drops a stored link        | `console.warn` | `[note] unsafe link dropped at render`               |
| O3  | `NotePopover` commit while edits blocked | `console.warn` | `[note] commit skipped id=<id> reason=edits-blocked` |

Telemetry (not logs): `Note` / `Opened` / `Added` / `Changed` / `Deleted`; `Note` / `Used` /
`Bold | Italic | Underline | Heading | List | Link`, once per command [Q5].

## Testing

| Rule                                                   | Test                                                 | File                                                |
| ------------------------------------------------------ | ---------------------------------------------------- | --------------------------------------------------- |
| `note` mirrors `noteRich` (I1), trimmed (I3)           | `canonicalNote` keeps runs / trims on the runs       | `apps/live/lib/note-value.test.ts`                  |
| `noteRich` absent without formatting (I2)              | stores a plain note as text only                     | `apps/live/lib/note-value.test.ts`                  |
| Empty note strips both fields                          | whitespace-only reads as empty                       | `apps/live/lib/note-value.test.ts`                  |
| Formatting-only edit reports `Changed`                 | `noteFieldsEqual` spots a formatting-only change     | `apps/live/lib/note-value.test.ts`                  |
| `link` / `heading` split, merge, count as rich         | link + heading run attributes                        | `packages/diagram/src/rich-text.test.ts`            |
| Heading spans whole lines                              | `expandRangeToLines`, `applyHeadingToLines`          | `packages/diagram/src/rich-text.test.ts`            |
| Lists are prefix text, scoped to touched lines         | `applyListStyle / stripListPrefixes`                 | `packages/diagram/src/rich-text.test.ts`            |
| Only safe links render as anchors (I5)                 | `noteRunHref`, `noteRunStyle` link underline         | `apps/live/components/notes/note-run-style.test.ts` |
| Note sizes 13 / 11-13-16 / headings                    | `noteRunStyle` body and heading                      | `apps/live/components/notes/note-run-style.test.ts` |
| Renderer splits on `\n`; plain fallback                | `runsToLines`, `noteRuns`                            | `apps/live/components/notes/note-run-style.test.ts` |
| Closed vocabulary; both attributes applied             | `blockTypeApplies` round-trips through `blockTypeOf` | `apps/live/components/rich-text/block-type.test.ts` |
| List detection reads the prefix                        | `listStyleOfText`                                    | `apps/live/components/rich-text/block-type.test.ts` |
| Detection reads the selection's first line [Q6]        | none                                                 | (G7)                                                |
| Collapsed caret: word / line in a note, all in a label | none                                                 | (G7)                                                |
| `Cmd/Ctrl+B/I/U` drive run toggles                     | none                                                 | (G7)                                                |
| Link field: normalise, refuse, Remove                  | none                                                 | (G7)                                                |
| Read-only viewer gets no toolbar                       | none                                                 | (G7)                                                |
| Popover 416px, editor 11rem to 24rem, flip [Q3]        | none                                                 | (G7)                                                |
| One `Note` / `Used` per command [Q5]                   | none                                                 | (G7)                                                |
| Note edits go through history (undo restores)          | none                                                 | (G7)                                                |
| Label headings in `em`                                 | none                                                 | (G7)                                                |

## Constants and configuration

| Name                    | Value                                        | Provenance / safe range                                 | Home                       |
| ----------------------- | -------------------------------------------- | ------------------------------------------------------- | -------------------------- |
| `WIDTH`                 | `416`                                        | Spec, matches `w-[26rem]`; change both together         | `NotePopover.tsx`          |
| `APPROX_HEIGHT`         | `320`                                        | Estimate at the 11rem minimum; replaced by measure [Q3] | `NotePopover.tsx`          |
| `GAP`                   | `12`                                         | Element to popover, px; 8 to 16                         | `NotePopover.tsx`          |
| `VIEWPORT_EDGE_MARGIN`  | `POPOVER_VIEWPORT_MARGIN` = `8`              | Shared popover margin                                   | `lib/clamp-to-viewport.ts` |
| Editor min / max height | `min-h-44` (11rem) / `max-h-96` (24rem)      | Spec                                                    | `NoteRichTextEditor.tsx`   |
| `NOTE_BASE_PX`          | `13`                                         | Spec; 12 to 15                                          | `note-run-style.ts`        |
| `NOTE_RUN_PX`           | `{ sm: 11, md: 13, lg: 16 }`                 | Spec                                                    | `note-run-style.ts`        |
| `NOTE_HEADING`          | `1: 17/700, 2: 14.5/600, 3: 13.5/600`        | Spec for 1 and 2; DD5 for 3                             | `note-run-style.ts`        |
| `HEADING_SCALE`         | `1: 1.7em/700, 2: 1.35em/700, 3: 1.15em/600` | DD9; each level above the next, all above 1em           | `label-style.ts`           |
| `SAFE_SCHEMES`          | `http:`, `https:`, `mailto:`                 | Spec; never widen to `javascript:` / `data:`            | `lib/url-safety.ts`        |
| `BLOCK_TYPES`           | six entries, Paragraph first                 | Spec order                                              | `block-type.ts`            |
