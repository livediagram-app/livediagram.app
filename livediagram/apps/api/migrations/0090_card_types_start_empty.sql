-- Card types start empty (Plan, now in liveplanner "The type catalogue"): a document whose card types were
-- never chosen (`item_types` NULL) now reads as none, and the five default types arrive only through Add Default
-- Types. A document made before that with cards kept the five default types its cards were made with, so it is given
-- them here, stored, exactly as the code defines them (defaultCatalogue, validated). The revision is raised so an
-- editor still holding the unchosen catalogue re-reads before its next change lands. Documents with no cards stay
-- NULL and so start empty.
UPDATE documents
SET
  item_types = '{"version":1,"types":[{"id":"project","label":"Project","newTitle":"New project","glyph":"project","color":"#18181b","fields":["title","status","description","assignee","priority","color","start","due","labels","comments"]},{"id":"task","label":"Task","newTitle":"New task","glyph":"task","color":"#71717a","fields":["title","status","description","assignee","parent","priority","estimate","due","checklist","labels","comments"],"custom":[{"id":"parent","label":"Parent","kind":"card","linkType":"project"}]},{"id":"note","label":"Note","newTitle":"New note","glyph":"note","color":"#2563eb","fields":["title","status","description","votes","comments"]},{"id":"idea","label":"Idea","newTitle":"New idea","glyph":"idea","color":"#eab308","fields":["title","status","description","votes","labels","comments"]},{"id":"action","label":"Action","newTitle":"New action","glyph":"action","color":"#dc2626","fields":["title","status","description","assignee","due","checklist","comments"]}]}',
  item_types_rev = item_types_rev + 1
WHERE item_types IS NULL
  AND EXISTS (SELECT 1 FROM items WHERE items.document_id = documents.id);
