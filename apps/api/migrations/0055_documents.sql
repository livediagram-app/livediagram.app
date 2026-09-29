-- The container is a document (docs/specs/006-document/document.md): rename the schema and
-- every stored value that names it. SQLite's RENAME carries the foreign keys of
-- share_links, shared_with, document_tabs and favourites along; indexes are recreated
-- under their new names.

ALTER TABLE diagrams RENAME TO documents;
ALTER TABLE diagram_tabs RENAME TO document_tabs;
ALTER TABLE document_tabs RENAME COLUMN diagram_id TO document_id;
ALTER TABLE favourites RENAME COLUMN diagram_id TO document_id;
ALTER TABLE share_links RENAME COLUMN diagram_id TO document_id;
ALTER TABLE shared_with RENAME COLUMN diagram_id TO document_id;
ALTER TABLE ws_tickets RENAME COLUMN diagram_id TO document_id;

DROP INDEX idx_diagrams_owner_recent;
CREATE INDEX idx_documents_owner_recent ON documents (owner_id, saved_at DESC);
DROP INDEX diagrams_folder_idx;
CREATE INDEX documents_folder_idx ON documents (folder_id);
DROP INDEX diagrams_team_idx;
CREATE INDEX documents_team_idx ON documents (team_id);
DROP INDEX diagrams_source_idx;
CREATE INDEX documents_source_idx ON documents (source);
DROP INDEX diagrams_trashed_idx;
CREATE INDEX documents_trashed_idx ON documents (trashed_at) WHERE trashed_at IS NOT NULL;
DROP INDEX diagram_tabs_by_diagram;
CREATE INDEX document_tabs_by_document ON document_tabs (document_id, order_index);
DROP INDEX diagram_tabs_by_tab;
CREATE INDEX document_tabs_by_tab ON document_tabs (tab_id);
DROP INDEX idx_share_links_diagram_created;
CREATE INDEX idx_share_links_document_created ON share_links (document_id, created_at);
DROP INDEX idx_share_links_diagram_role_created;
CREATE INDEX idx_share_links_document_role_created ON share_links (document_id, role, created_at);
