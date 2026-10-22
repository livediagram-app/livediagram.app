// Leaf module, no imports: document-visibility.ts and image-grants.ts read it while shared.ts sits in an
// import cycle with them (shared -> tabs -> collab-index -> document-visibility), so a SQL builder kept in
// shared.ts could be read before it was defined, depending on which of them a bundle loads first.

/** SQL for the live link a visit (`s`, a shared_with row, on document `d`) opens its document through, or
 *  NULL when it has none (docs/specs/013-workspace/share-roles.md "Share links"): the link it came in
 *  through while that is live and still matches its role and scope; for a visit recorded before links were
 *  recorded (`share_code` NULL), the oldest live link of its role and scope. `now` is the bound parameter
 *  holding the current time. One definition, so Shared with you, Home and every access leg agree. */
export function visitLinkSql(now: string, s = 's', d = 'd'): string {
  const live = `sl.document_id = ${d}.id AND sl.purpose = 'share'
                AND COALESCE(sl.level, sl.role) = COALESCE(${s}.level, ${s}.role)
                AND sl.tab_id IS ${s}.tab_id AND (sl.expires_at IS NULL OR sl.expires_at > ${now})`;
  return `CASE WHEN ${s}.share_code IS NOT NULL
            THEN (SELECT sl.code FROM share_links sl WHERE sl.code = ${s}.share_code AND ${live})
            ELSE (SELECT sl.code FROM share_links sl WHERE ${live} ORDER BY sl.created_at ASC LIMIT 1)
          END`;
}
