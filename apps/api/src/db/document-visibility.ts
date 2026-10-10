// The documents a person can open, as SQL (docs/specs/013-workspace/activity-page.md §4;
// docs/specs/013-workspace/blueprints/explorer-home.md "Reads"). The three sets the Explorer's
// Recent merges: their own, those in a team they have JOINED (an invite grants nothing), and those
// shared with them through a link that is still live. Never a document in the Trash.
//
// Activity and Home both scope by this FIRST and filter after, which is the security boundary: an
// id inside an event or a blob can never surface a document the reader can no longer open.
//
// `visible_ids` is three indexed lookups (documents by owner, documents by team, shared_with by its
// key), so the set is bounded by the person's library rather than by a scan of every document.
// `visible` then applies the full rule to each and says how the person reaches it:
//   - via: 'own', then 'team', then 'shared';
//   - share_code: for 'shared', the oldest live code at the person's role and tab scope;
//   - scope_tab_id: for 'shared', the one tab their link opens (null = every tab).
// A shared row whose live code is gone (expired or revoked) is dropped: there is nowhere to go.
//
// CTE bodies only, to follow a WITH (or a comma). Binds: ?1 = the person's owner id, ?2 = now
// (share-link expiry).
import { visitLinkSql } from './visit-link';

export const VISIBLE_DOCUMENTS_CTES = `
  my_teams(team_id) AS (
    SELECT team_id FROM team_members WHERE user_id = ?1 AND status = 'joined'
  ),
  visible_ids(id) AS (
    SELECT id FROM documents WHERE owner_id = ?1
    UNION
    SELECT id FROM documents WHERE team_id IN (SELECT team_id FROM my_teams)
    UNION
    SELECT document_id FROM shared_with WHERE owner_id = ?1
  ),
  visible_all AS (
    SELECT d.id, d.name, d.owner_id, d.team_id, d.folder_id, d.saved_at,
           CASE WHEN d.owner_id = ?1 THEN 'own'
                WHEN d.team_id IN (SELECT team_id FROM my_teams) THEN 'team'
                ELSE 'shared' END AS via,
           CASE WHEN d.owner_id = ?1 OR d.team_id IN (SELECT team_id FROM my_teams) THEN NULL
                ELSE ${visitLinkSql('?2')} END AS share_code,
           CASE WHEN d.owner_id = ?1 OR d.team_id IN (SELECT team_id FROM my_teams) THEN NULL
                ELSE s.tab_id END AS scope_tab_id
      FROM visible_ids vi
      JOIN documents d ON d.id = vi.id
      LEFT JOIN shared_with s ON s.document_id = d.id AND s.owner_id = ?1
     WHERE d.trashed_at IS NULL
       AND (d.owner_id = ?1
            OR d.team_id IN (SELECT team_id FROM my_teams)
            OR (s.owner_id IS NOT NULL AND d.shareable = 1))
  ),
  visible AS (
    SELECT * FROM visible_all WHERE via <> 'shared' OR share_code IS NOT NULL
  )`;
