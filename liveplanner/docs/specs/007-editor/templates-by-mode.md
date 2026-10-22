# Templates

Plan is the one editor mode ([Editor mode](editor-modes.md)), so the templates people start from are **Plan's**:
`isPlanTemplate(kind)` in `packages/templates/src/template-modes.ts` is the one place they are declared: Blank Plan,
Blank Spreadsheet, Blank Form, the [Plan templates](../026-plan/plan-templates.md) (Kanban Board, Project Planner, Bug
Tracker and the rest, each setting up a way of working across tabs), the twelve
[spreadsheet templates](../026-plan/plan-templates.md#spreadsheet-templates) and the
[form templates](../030-forms/forms.md) ("As templates"). Start Planning offers them
([Plan mode](../026-plan/plan-mode.md#starting-a-board)) and its search finds only them; `/new?template=<kind>` makes
one directly ([New project route](new-project-route.md)).

Until 2026-10-22 every template opened in one of five editor modes (`templateEditorMode`), each mode's templates on
its own start, with a mode filter on the template picker and a glyph on every card saying which mode a template
opened in. Those went with the other modes ([Editor mode](editor-modes.md#retired-modes)). The rest of the catalogue
(the diagram, whiteboard, session and page templates) is still built by name, as an agent's `add_tab` or a
`/new?template=` link asks, opening in Plan like any tab; no start offers it.

## The blanks

`BLANK_TEMPLATES` lists the blanks, in the order the landing page's Blank Slate shows them: **Blank Plan**
(`blank-plan`, an empty tab that opens on Start Planning), **Blank Spreadsheet** (`blank-spreadsheet`, one tab holding
an empty Sheet that fills it, [Sheet store](../029-sheets/sheet-store.md#template-starts)) and **Blank Form**
(`blank-form`), then the catalogue's other blanks. A blank (`isBlankTemplate`) is in no category and on no category
shelf, and leaves the tab's name as it was.

## Hidden templates

A template may be **hidden** (`hidden: true` on its definition in `packages/templates/src/templates.ts`): it never
appears in a listing (Start Planning's grids and search, the template picker, the MCP's `list_templates`) but stays
buildable by name through `buildTemplate`, for an entry point that names the kind directly. No template sets it
today; its last user was the retired guided-tour sample. The flag stays because the listing paths already filter on
it, and `templates.test.ts` asserts the set is empty. A hidden template ships no preview.

## Popular

`POPULAR_TEMPLATE_KINDS` (`packages/templates/src/popular.ts`) is a short curated list of Plan's templates, Blank Plan
first: what the Explorer's welcome and the marketing gallery lead with.

## Testing

- Popular leads with Blank Plan and holds only Plan's templates (`popular.test.ts`).
- Every form template is Plan's (`form-templates.test.ts`).
- The blanks are in no category, and every other template in exactly one (`template-categories.test.ts`).

## The tab's name

- A template picked on Start Planning or on /new names the tab it fills after itself (a Kanban Board's tab is
  "Kanban Board"): the template's own name for the tab where it gives one
  (a Plan template's tabs), else for a Board or Sheet template the board's title, else the template's title. It does
  so whatever the tab was called before. A blank template leaves the name as it was (`templateTabName`).

## The project's name

- A template picked on Start Planning names the **project** after itself too, as /new names a project after the
  template it is made from: "Untitled Kanban Board", a blank naming what it makes, no template "Untitled project"
  (`untitledNameForTemplate`).
- Only while the project still has a default name: one of those untitled names (`isDefaultProjectName`, any
  template's, or the legacy "Untitled diagram"). A name someone gave it, or the first element's label the editor
  named it after ([Name length](../006-project/name-length.md)), is kept.
- Only for the project's **first** tab: a template filling a later tab names that tab, not the project.
- **Start Planning's own picks name it too**: a board preset, a sheet start, a form, a dashboard layout or a
  visualisation picked for the first tab names a still-untitled project after the title that tab takes ("Untitled
  Bug Tracker", "Untitled Gantt Chart"), read once the tab has changed (`usePlanStartProjectName`). Only a change seen in the
  session counts (opening a project on a Plan tab is not a start), only for someone who can edit, and a name the
  start gave the project itself (a template's) is kept.
- It is the project's name like any other: saved with it, shown in the header and the Explorer at once, and changed
  by renaming. No telemetry: it is not a person's rename.
