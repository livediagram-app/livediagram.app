# Import and export

Follow the references below only as needed; never upfront.

- ./markdown-import.md - when working on Markdown import: import a Markdown document onto the current tab as an article (one undo step), the Import dialog's JSON restore, and the Markdown summary export
- ./office-import.md - when working on Word and PowerPoint import: a .docx (Word, Google Docs) as an article, a .pptx (PowerPoint, Google Slides) as slide pages with their speaker notes, the file panel, the bounds on untrusted files, the named errors and the report
- ./import-image-pipeline.md - when working on storing outside pictures (a picked image search result, an import's images): the shared browser-side resize (2048 px, WebP) + gallery upload, Offline Mode embedding, named failures (gallery full, unsupported, too large, no image storage) and the import report
- ./export-fidelity.md - when working on Export fidelity: An exported image is a picture of the document: whatever the canvas draws, every export draws. Three renderers for the same content (canvas, SVG emitters, PNG canvas-2D drawers) had each drifted, so labels exported two thirds of their size and twenty-two kinds exported as an empty labelled box. Held by one definition per decision in @livedocuments/document, imported by both sides, plus the list of kinds the PNG path must rasterise
- ./animated-gif-export.md - when working on the animated GIF export of a Pages tab's pages: the options (pages, one hold, size, estimate), the timeline (15 fps, the deck's transition, still pages, the 3 minute cap), what a frame shows and the errors
- ./blueprints/README.md - when implementing from a blueprint: Word and PowerPoint import, the import image pipeline and the animated GIF export
