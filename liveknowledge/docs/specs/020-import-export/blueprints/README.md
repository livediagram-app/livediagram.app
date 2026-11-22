# Import and export blueprints

Follow the references below only as needed; never upfront.

- ./office-import.md - when implementing or changing Word and PowerPoint import: the zip and XML readers and their bounds, the Word and PowerPoint mappings, parked zones, deck notes, the file panel
- ./office-export.md - when implementing or changing PowerPoint and Word export: the slide and document writers, native shapes vs pictures, the page drawer, the panel
- ./import-image-pipeline.md - when implementing or changing how outside images (image search, an import) are resized, encoded, stored, embedded offline, or reported
- ./print.md - when implementing or changing Print: the sheets for a scope, the print document's named @page rules, the print frame, the panel
- ./knowledgebase-import.md - when implementing or changing Knowledgebase import: the engine (`@liveknowledge/knowledge-import`: the archive and the plan, the Markdown Folder, Notion and Confluence readers, the tree, link and picture resolving, the bounds and where each is enforced), and the editor's half (a picked folder or `.zip` as an archive, the zip reader's modes, the Import dialog's steps, writing the plan in batches, the save layers)
- ./DEFAULTS.md - when an import/export blueprint applies a default the spec leaves open
- ./COMPLETENESS.md - when checking which completeness categories an import/export blueprint covers
