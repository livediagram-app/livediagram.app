// A suggested edit's way to its owner's Inbox (docs/specs/030-knowledgebase/ai-knowledge.md "In the owner's Inbox";
// liveworkspace/docs/specs/004-index/one-explorer-contracts.md "What an item pushes"): the page's suggestions ride
// its tab's collab push, so a suggestion made, accepted, dismissed or pruned writes the page's `tab` outbox key, by a
// trigger in the write's own transaction, as every other change the Inbox reads does (document-schema.ts). The drain
// reads them with the tab (document-outbox.ts `pageSuggestionsOf`).
type Exec = (query: string) => unknown;

// The key written again, with a new id, as the outbox's other triggers write theirs: a key already waiting stays one.
const oweTab = (row: 'NEW' | 'OLD') => `
  DELETE FROM outbox WHERE (document_id, kind, key) IN
    (SELECT document_id, 'tab', ${row}.tab FROM document_tabs WHERE tab_id = ${row}.tab);
  INSERT INTO outbox (document_id, kind, key)
    SELECT document_id, 'tab', ${row}.tab FROM document_tabs WHERE tab_id = ${row}.tab;`;

/** Schema step 40: the two triggers, and a push owed for every page that already has a suggestion waiting. */
export function suggestionsOutboxStep(exec: Exec): void {
  exec(`CREATE TRIGGER IF NOT EXISTS outbox_suggestion_insert AFTER INSERT ON suggestions
    BEGIN ${oweTab('NEW')} END`);
  exec(`CREATE TRIGGER IF NOT EXISTS outbox_suggestion_delete AFTER DELETE ON suggestions
    BEGIN ${oweTab('OLD')} END`);
  exec(`INSERT INTO outbox (document_id, kind, key)
    SELECT DISTINCT dt.document_id, 'tab', s.tab FROM suggestions s JOIN document_tabs dt ON dt.tab_id = s.tab
     WHERE NOT EXISTS (SELECT 1 FROM outbox o
                        WHERE o.document_id = dt.document_id AND o.kind = 'tab' AND o.key = s.tab)`);
}
