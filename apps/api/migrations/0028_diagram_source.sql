-- Diagram provenance (docs/specs/013-workspace/folders.md "Generated" dynamic folder, docs/specs/015-api/mcp-server.md): a
-- nullable source tag recording how a diagram came to exist. NULL = made
-- by a person in the editor (every pre-existing row); 'mcp' = created by
-- an external AI tool through the MCP server; 'ai' = created by the
-- in-editor AI assistant (reserved — no producer today). The Explorer
-- surfaces a synthetic "Generated" folder over the rows where source IS
-- NOT NULL, and keeps them out of Unsorted. Set once on create and never
-- rewritten by the metadata upsert, so an autosave can't clear it.
ALTER TABLE diagrams ADD COLUMN source TEXT NULL;
CREATE INDEX diagrams_source_idx ON diagrams(source);
