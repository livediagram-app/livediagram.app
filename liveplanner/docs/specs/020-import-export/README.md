# Import and export

Follow the references below only as needed; never upfront.

liveplanner imports no other drawing format (draw.io, Excalidraw, Microsoft Whiteboard, Mermaid, Markdown;
[Scope](../002-project-scope/product-scope.md)). It exports a tab as PNG, SVG, PDF, Markdown, CSV or JSON, and imports
its own JSON export back. A board from Trello, Asana, Jira or Linear comes in once through the Import dialog's From
Another Tool view ([Importing from another tool](../026-plan/tracker-import.md)).

- ./mermaid.md - when working on the sequence model (`mermaid-sequence.ts`), the sequence text the layout tests read, or the sequence look and limits
- ./export-fidelity.md - when working on Export fidelity: An exported image is a picture of the project: whatever the canvas draws, every export draws. Three renderers for the same content (canvas, SVG emitters, PNG canvas-2D drawers) had each drifted, so labels exported two thirds of their size and twenty-two kinds exported as an empty labelled box. Held by one definition per decision in @liveplanner/project, imported by both sides, plus the list of kinds the PNG path must rasterise
