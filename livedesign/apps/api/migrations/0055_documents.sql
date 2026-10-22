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

-- Stored values that name the container.

-- Timeline: source, scope and event types, the titles written with each event, and the
-- snapshot keys the cards read.
UPDATE timeline_events SET source_type = 'document' WHERE source_type = 'diagram';
UPDATE timeline_events SET event_type = 'document' || substr(event_type, 8)
  WHERE event_type LIKE 'diagram\_%' ESCAPE '\';
UPDATE timeline_events SET event_type = 'team_document' || substr(event_type, 13)
  WHERE event_type LIKE 'team\_diagram\_%' ESCAPE '\';
UPDATE timeline_events SET title = 'Document Created' WHERE title = 'Diagram Created';
UPDATE timeline_events SET title = 'Document Duplicated' WHERE title = 'Diagram Duplicated';
UPDATE timeline_events SET title = 'Document Updated' WHERE title = 'Diagram Updated';
UPDATE timeline_events
  SET snapshot = replace(replace(snapshot, '"diagramId":', '"documentId":'), '"diagramName":', '"documentName":')
  WHERE snapshot LIKE '%"diagramId":%' OR snapshot LIKE '%"diagramName":%';
UPDATE timeline_event_scopes SET scope_type = 'document' WHERE scope_type = 'diagram';
UPDATE timeline_scope_state SET scope_type = 'document' WHERE scope_type = 'diagram';

-- Element links to another document, inside tab bodies and change-log states. A link is
-- written as {"kind":"diagram","diagramId":…}; the tab's own "kind":"diagram" is the tab kind
-- and never has a diagramId beside it, so it is left alone.
UPDATE tabs SET data = replace(data, '"kind":"diagram","diagramId":', '"kind":"document","documentId":')
  WHERE data LIKE '%"diagramId":%';
UPDATE change_log
  SET before_state = replace(before_state, '"kind":"diagram","diagramId":', '"kind":"document","documentId":'),
      after_state = replace(after_state, '"kind":"diagram","diagramId":', '"kind":"document","documentId":')
  WHERE before_state LIKE '%"diagramId":%' OR after_state LIKE '%"diagramId":%';

-- The notification opt-out: a lost `false` would start sending emails someone turned off.
UPDATE user_preferences
  SET prefs = replace(prefs, '"notifyDiagramJoin":', '"notifyDocumentJoin":')
  WHERE prefs LIKE '%"notifyDiagramJoin":%' AND prefs NOT LIKE '%"notifyDocumentJoin":%';

-- Telemetry history, so the public dashboard's lines continue under the new names.
UPDATE events SET category = 'Document' WHERE category = 'Diagram';
UPDATE events SET type = 'Document'
  WHERE type = 'Diagram' AND ((category = 'Team' AND action IN ('Added', 'Moved', 'Removed'))
    OR (category = 'Element' AND action = 'Linked'));
UPDATE events SET type = 'DocumentToTeam' WHERE category = 'Action' AND action = 'Moved' AND type = 'DiagramToTeam';
UPDATE events SET type = 'DocumentJoined' WHERE category = 'Email' AND action = 'Sent' AND type = 'DiagramJoined';
UPDATE events SET type = 'NotifyDocumentJoinOn' WHERE category = 'UI' AND type = 'NotifyDiagramJoinOn';
UPDATE events SET type = 'NotifyDocumentJoinOff' WHERE category = 'UI' AND type = 'NotifyDiagramJoinOff';
UPDATE events SET type = '/document' WHERE category = 'Page' AND action = 'View' AND type = '/diagram';
UPDATE events SET type = replace(replace(type, 'Diagrams', 'Documents'), 'Diagram', 'Document')
  WHERE category = 'Mcp' AND action = 'Used' AND type LIKE '%Diagram%';
UPDATE events
  SET type = replace(replace(replace(replace(type, '.Diagrams.', '.Documents.'), '.Diagram.', '.Document.'), 'DiagramMeta', 'DocumentMeta'), 'Diagram', 'Document')
  WHERE category = 'Error' AND type LIKE '%Diagram%';

-- Help articles about the container moved with it (docs/specs/018-help/help-app.md, "Renamed
-- articles"): their views, votes and page views continue under the new slug.
UPDATE events SET type = CASE type
    WHEN 'add-to-diagram' THEN 'add-to-document'
    WHEN 'diagram-not-loading' THEN 'document-not-loading'
    WHEN 'team-shared-diagrams' THEN 'team-shared-documents'
    WHEN 'search-diagrams' THEN 'search-documents'
    WHEN 'sharing-your-diagram' THEN 'sharing-your-document'
    WHEN 'working-with-diagrams' THEN 'working-with-documents'
  END
  WHERE category = 'Help' AND type IN ('add-to-diagram', 'diagram-not-loading', 'team-shared-diagrams',
    'search-diagrams', 'sharing-your-diagram', 'working-with-diagrams');
UPDATE events
  SET type = replace(replace(replace(replace(replace(replace(type,
    '/add-to-diagram', '/add-to-document'),
    '/diagram-not-loading', '/document-not-loading'),
    '/team-shared-diagrams', '/team-shared-documents'),
    '/search-diagrams', '/search-documents'),
    '/sharing-your-diagram', '/sharing-your-document'),
    '/working-with-diagrams', '/working-with-documents')
  WHERE category = 'Page' AND action = 'View' AND (type LIKE '%/add-to-diagram%' OR type LIKE '%/diagram-not-loading%'
    OR type LIKE '%/team-shared-diagrams%' OR type LIKE '%/search-diagrams%' OR type LIKE '%/sharing-your-diagram%'
    OR type LIKE '%/working-with-diagrams%');
