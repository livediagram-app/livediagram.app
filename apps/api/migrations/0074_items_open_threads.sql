-- Plan card comment threads on the Activity page (docs/specs/013-workspace/activity-page.md §2.5).
--
-- The read lists a reader's open card threads per visible document. A partial index on the documents' open
-- threads lets it seek only the cards with an unresolved thread, never parsing every card of a large document.
-- Measured: a document of 20,000 cards, 2,000 with open 20-comment threads, read in ~106ms with it, ~200ms
-- without. A card with no thread, or a resolved one, is not in the index, so it costs card writes nothing.
CREATE INDEX items_open_threads ON items (document_id)
  WHERE json_extract(fields, '$.comments.resolved') = 0;
