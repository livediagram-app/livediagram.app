# Import and export

Follow the references below only as needed; never upfront.

- ./mermaid.md - when working on Mermaid text an agent hands over (MCP, CLI, API) or the CLI's Mermaid export: the connection graph parsed in packages/document and laid out with graphToElements. Flowcharts read and written (edge styles, full shape brackets + @{shape}, & fans, click links, subgraphs-as-frames with cluster layout); state, ER and sequence diagrams read only
- ./import-image-pipeline.md - when working on images inside an imported board: the shared browser-side resize (2048 px, WebP) + gallery upload every importer uses, Offline Mode embedding, named failures (gallery full, unsupported, too large, no image storage) and the import report
- ./export-fidelity.md - when working on Export fidelity: An exported image is a picture of the document: whatever the canvas draws, every export draws. Three renderers for the same content (canvas, SVG emitters, PNG canvas-2D drawers) had each drifted, so labels exported two thirds of their size and twenty-two kinds exported as an empty labelled box. Held by one definition per decision in @liveplanner/document, imported by both sides, plus the list of kinds the PNG path must rasterise
- ./animated-gif-export.md - when working on the animated GIF export of a Pages tab's pages: the options (pages, one hold, size, estimate), the timeline (15 fps, the deck's transition, still pages, the 3 minute cap), what a frame shows and the errors
- ./blueprints/README.md - when implementing from a blueprint: the import image pipeline and the animated GIF export
