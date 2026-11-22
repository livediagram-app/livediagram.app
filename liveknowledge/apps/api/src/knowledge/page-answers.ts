// The questions Ask answered from each page (docs/specs/030-knowledgebase/ai-knowledge.md "AI Context on a page"):
// the package's table (`PAGE_ANSWERS_SCHEMA`) and a trigger that drops a deleted page's rows. Counted by the Ask
// route, read by Page Health, pruned by the daily upkeep (room-knowledge.ts). Also an index of a page's reads by
// day, so Page Health's reads and its agents are a range of one page's rows, not of every page's for the week.
import { PAGE_ANSWERS_SCHEMA } from '@liveknowledge/knowledge';

type Exec = (query: string) => unknown;

/** The schema step (document-schema.ts V19). Additive, IF NOT EXISTS. */
export function pageAnswersSchemaStep(exec: Exec): void {
  for (const statement of PAGE_ANSWERS_SCHEMA) exec(statement);
  exec(`CREATE TRIGGER IF NOT EXISTS page_answers_tab_removed AFTER DELETE ON tabs
    BEGIN DELETE FROM page_answers WHERE tab = OLD.id; END`);
  exec('CREATE INDEX IF NOT EXISTS page_reads_tab ON page_reads (tab, day)');
}
