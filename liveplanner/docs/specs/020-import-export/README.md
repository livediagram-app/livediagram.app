# Import and export

Follow the references below only as needed; never upfront.

liveplanner imports no other drawing format (draw.io, Excalidraw, Microsoft Whiteboard, Mermaid, Markdown;
[Scope](../002-project-scope/product-scope.md)). It exports a tab as PNG, SVG, PDF, Markdown, CSV or JSON, and imports
its own JSON export back, and a Board or Sheet tab a CSV. A board from Trello, Asana, Jira or Linear comes in once.
Every import goes through the one [Import dialog](../026-plan/plan-tabs.md#the-import-dialog) ([Importing from another
tool](../026-plan/tracker-import.md)).

- ./mermaid.md - when working on the sequence model (`mermaid-sequence.ts`), the sequence text the layout tests read, or the sequence look and limits
- ./export-fidelity.md - when working on Export fidelity: An exported image is a picture of the project: whatever the canvas draws, every export draws. Three renderers for the same content (canvas, SVG emitters, PNG canvas-2D drawers) had each drifted, so labels exported two thirds of their size and twenty-two kinds exported as an empty labelled box. Held by one definition per decision in @liveplanner/project, imported by both sides, plus the list of kinds the PNG path must rasterise

## The dialogs' header

The Export and Import dialogs wear the [dialog hero
header](../../../../liveworkspace/docs/specs/004-index/dialog-hero-header.md), their title (**Export Tab** or **Export
Selection**, **Import to Tab**) and its one line in the band, then **Help** and the close. Export draws the tab
leaving as files: a page in the bottom left, a dashed line along the foot to format tiles fanned in the bottom right,
the file going out in front in the accent; an arrow rising out of a tray is its mark. Import draws files coming in:
two files in the bottom left, a dashed line along the foot to a dashed frame in the bottom right, a file dropping
in over its edge; an arrow into a tray is its mark. Both arts are shared
(`@liveworkspace/ui/dialog-hero-art/export`, `/import`), so every product's pair reads alike. The steps that bring a
board in from another tool keep the header, its title naming the tool ("Import from Trello").
