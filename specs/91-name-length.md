# 91 — Tab and diagram name length

Status: shipped

## What

Tab and diagram names are capped at **`NAME_MAX_LENGTH` = 60 characters**, and
whitespace inside a name is collapsed to single spaces.

## Why 60, and why a cap at all

Names had no limit. That is mostly invisible when you type one by hand — but
the editor also **auto-names** a tab and the diagram from the first element's
label (spec/05). Paste a paragraph into the welcome rectangle and the entire
paragraph became the diagram's name, newlines included, and then had to be
rendered in the header, the browser tab title, the Explorer list, the tab pill
and every share surface.

60 is the top of the 40–60 range that reads comfortably in tab/title UI: long
enough for a real title ("Q3 platform migration — phase 2 rollout") and short
enough that a tab pill and a browser tab title can still show something useful.

## Truncation rules (`packages/diagram/src/names.ts`)

`truncateName(raw)`:

1. **Collapse whitespace** (`\s+` → one space) and trim. An auto-name derived
   from a pasted block would otherwise carry newlines and runs of spaces into
   what is rendered as a single-line title.
2. Return as-is if it already fits.
3. Otherwise cut at the last **word boundary** inside the budget and append an
   ellipsis. Word-boundary because a mid-word chop reads as corruption
   ("Quarterly platform migra…") where a whole-word cut reads as a summary.
4. **Except** when that would leave almost nothing — a single enormous word (a
   URL, a hash) has no space to break on, so it hard-cuts instead. The guard is
   "the boundary must fall past a third of the budget".

Length is counted in **code points**, not UTF-16 units, so an emoji costs one
character the way a reader counts it rather than two.

## Where it applies

At the **mutation points**, not at each input, so a name can't arrive over-long
from any direction — inline rename, command palette, the `/new` wizard, an
import, or an API-driven change:

- `useSelectionEditing` — the auto-name path (the case that prompted this).
- `useTabActions.renameTab`.
- `useDiagramListActions.renameDiagram` and `useTeamLibrary.renameDiagram`.
- `EditorView`'s header rename.
- The `/new` wizard's diagram-name field.

The text inputs (`NameEditor`, `InlineRenameInput`, the wizard field) also
carry `maxLength={NAME_MAX_LENGTH}`. That is a **second** line of defence, not
the enforcement: it makes the limit visible while typing instead of silently
eating the end of what someone wrote. The mutation-point cap is what actually
guarantees it.

## Out of scope

- **Retro-truncating names already stored.** Existing over-long names render as
  they always did until something renames them; there is no migration. The cap
  is about not creating new ones.
- **Element labels.** They are content, not identifiers, and are free to be as
  long as the shape can hold. (Markdown import has its own separate label cap
  for a different reason — see `markdown-import.ts`.)
- **Folder and team names**, which come from deliberate typing rather than
  auto-naming and have not caused a problem.
