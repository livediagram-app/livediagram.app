# Tab and diagram name length

Status: shipped

## What

Tab and diagram names are capped at **`NAME_MAX_LENGTH` = 60 characters**, and
whitespace inside a name is collapsed to single spaces.

## Why 60, and why a cap at all

Names had no limit. That is mostly invisible when you type one by hand — but
the editor also **auto-names** a tab and the diagram from the first element's
label ([Diagram structure](document-structure.md)). Paste a paragraph into the welcome rectangle and the entire
paragraph became the diagram's name, newlines included, and then had to be
rendered in the header, the browser tab title, the Explorer list, the tab pill
and every share surface.

60 is the top of the 40–60 range that reads comfortably in tab/title UI: long
enough for a real title ("Q3 platform migration — phase 2 rollout") and short
enough that a tab pill and a browser tab title can still show something useful.

## Truncation rules (`packages/document/src/names.ts`)

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
import, or an API-driven change.

### The server is the enforcement point

The api worker applies `truncateName` to every diagram and tab name it is asked
to store, so the cap holds for every caller: the editor, an API-token script
([Public API and API tokens](../015-api/public-api-and-tokens.md)), an AI tool
through the [MCP server](../015-api/mcp-server.md), or an Offline Mode sync.
The worker **shortens, it does not reject**: a name over the cap is stored in
its truncated form and the response carries the stored name, exactly as the
editor would have shortened it. The write points are:

- `POST /api/documents` — the diagram name and the name of every seeded tab.
- `PUT /api/documents/<id>` — a diagram rename.
- `PUT /api/documents/<id>/tabs/<tabId>` — a tab's name (a tab rename rides the
  ordinary tab save).
- `POST /api/documents/<id>/copy` — the copy's name, whether the caller sent one
  or it defaulted to `Copy of <name>`, which can itself run past the cap.

A name that collapses to nothing (only whitespace) is refused on a diagram
create or rename with `400 bad_request` (message `missing id/name` on create,
`missing name` on rename): a diagram always has a name. A tab
name may be empty, as it may in the editor.

A name the caller sends **unchanged** (identical to the one stored) is kept as
it is, so an autosave or a tab reorder that echoes a pre-cap over-long name
never rewrites it (see Out of scope). Only a new or changed name is shortened.

The server logs `[names] capped <diagram|tab> name` with the original and
stored lengths whenever it shortens one, so an over-long writer is visible.

The MCP tool schemas (`create_document`, `add_tab`, `rename_document`) state the
cap in each name field's description and shorten the name with the same
`truncateName` before the call, so the name a tool reports back is the one
stored. The REST reference ([API documentation](../015-api/api-documentation.md))
states the cap on each name field.

### The editor caps too

The editor shortens at its own mutation points, so what the author sees is
already the stored name without waiting on a round trip:

- `useSelectionEditing` — the auto-name path (the case that prompted this).
- `useTabActions.renameTab`.
- `useDocumentListActions.renameDocument` and `useTeamLibrary.renameDocument`.
- `EditorView`'s header rename.
- The `/new` wizard's diagram-name field.

An Offline Mode diagram never reaches the server until it syncs, so for it
these editor points are the enforcement until it does; the sync is a create,
so the server cap applies to it like any other.

The text inputs (`NameEditor`, `InlineRenameInput`, the wizard field) also
carry `maxLength={NAME_MAX_LENGTH}`. That is a **third** line of defence, not
the enforcement: it makes the limit visible while typing instead of silently
eating the end of what someone wrote.

## Out of scope

- **Retro-truncating names already stored.** Existing over-long names render as
  they always did until something renames them; there is no migration, and the
  server leaves a name alone when a write sends it back unchanged. The cap is
  about not creating new ones.
- **Element labels.** They are content, not identifiers, and are free to be as
  long as the shape can hold. (Markdown import has its own separate label cap
  for a different reason — see `markdown-import.ts`.)
- **Folder and team names**, which come from deliberate typing rather than
  auto-naming and have not caused a problem.
