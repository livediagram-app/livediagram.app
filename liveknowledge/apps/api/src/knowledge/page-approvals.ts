// The pages waiting for approval (docs/specs/030-knowledgebase/approval.md "The field"): one row a page in the
// knowledgebase's own SQLite, `page_approvals`, the page's current approval as its field (`Tab.knowledge.approval`)
// holds it, so Home's Waiting for Your Approval and an agent's listing read the pages waiting without opening every
// page. Written in the same transaction as the field (routes/knowledge-approval-route.ts), only when that write
// lands; a deleted page takes its row with it.
import type { PageApproval } from '@liveknowledge/knowledge';
import type { KnowledgeAwaitingPage } from '@liveknowledge/api-schema';
import type { DocumentEnv } from '../types';

type Exec = (query: string) => unknown;

/** The schema step (document-schema.ts). Additive, IF NOT EXISTS. */
export function pageApprovalsSchemaStep(exec: Exec): void {
  exec(`CREATE TABLE IF NOT EXISTS page_approvals (
    tab TEXT PRIMARY KEY, state TEXT NOT NULL, requested_by TEXT NOT NULL, requested_at INTEGER NOT NULL,
    requested_agent TEXT NULL, decided_by TEXT NULL, decided_at INTEGER NULL
  )`);
  exec(`CREATE INDEX IF NOT EXISTS page_approvals_waiting ON page_approvals (state, requested_at)`);
  exec(`CREATE TRIGGER IF NOT EXISTS page_approvals_tab_removed AFTER DELETE ON tabs
    BEGIN DELETE FROM page_approvals WHERE tab = OLD.id; END`);
}

/** The row's write, run only when the page's own write landed at `rev` (the tab holds that revision): the row
 *  follows the field, never ahead of it. `approval` undefined removes the row (a withdrawn request). */
export function pageApprovalStatement(
  env: DocumentEnv,
  tab: string,
  approval: PageApproval | undefined,
  rev: number,
): D1PreparedStatement {
  const db = env.DOCUMENT_DB;
  if (!approval)
    return db
      .prepare(
        `DELETE FROM page_approvals WHERE tab = ?1 AND EXISTS (SELECT 1 FROM tabs WHERE id = ?1 AND rev = ?2)`,
      )
      .bind(tab, rev);
  return db
    .prepare(
      `INSERT INTO page_approvals (tab, state, requested_by, requested_at, requested_agent, decided_by, decided_at)
         SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7 WHERE EXISTS (SELECT 1 FROM tabs WHERE id = ?1 AND rev = ?8)
       ON CONFLICT (tab) DO UPDATE SET state = excluded.state, requested_by = excluded.requested_by,
         requested_at = excluded.requested_at, requested_agent = excluded.requested_agent,
         decided_by = excluded.decided_by, decided_at = excluded.decided_at`,
    )
    .bind(
      tab,
      approval.state,
      approval.requestedBy,
      approval.requestedAt,
      approval.requestedByAgent ?? null,
      approval.decidedBy ?? null,
      approval.decidedAt ?? null,
      rev,
    );
}

/** At most this many pages a knowledgebase in Waiting for Your Approval. */
export const AWAITING_APPROVAL_MAX = 10;

/** The pages Pending Approval that `account` did not ask for, oldest request first, with their current titles. */
export async function awaitingApproval(
  env: DocumentEnv,
  documentId: string,
  account: string,
  limit = AWAITING_APPROVAL_MAX,
): Promise<KnowledgeAwaitingPage[]> {
  const rows = await env.DOCUMENT_DB.prepare(
    `SELECT a.tab AS tab, t.name AS title, a.requested_by AS requestedBy, a.requested_at AS requestedAt,
            a.requested_agent AS agent
       FROM page_approvals a
       JOIN document_tabs dt ON dt.tab_id = a.tab AND dt.document_id = ?1
       JOIN tabs t ON t.id = a.tab
      WHERE a.state = 'pending' AND a.requested_by <> ?2
      ORDER BY a.requested_at, a.tab LIMIT ?3`,
  )
    .bind(documentId, account, limit)
    .all<{
      tab: string;
      title: string;
      requestedBy: string;
      requestedAt: number;
      agent: string | null;
    }>();
  return (rows.results ?? []).map((r) => ({
    tab: r.tab,
    title: r.title,
    requestedBy: r.requestedBy,
    requestedAt: r.requestedAt,
    ...(r.agent ? { requestedByAgent: r.agent } : {}),
  }));
}
