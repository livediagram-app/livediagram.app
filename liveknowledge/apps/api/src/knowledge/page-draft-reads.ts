// Who reads a page's draft (docs/specs/030-knowledgebase/editing.md "What reads the saved page only"; blueprint
// blueprints/editing.md "Security and trust"): the editor of a person who may edit the page, and nobody else. A
// Viewer, a Participant, a link visitor, a Community visitor, an agent's token and every document view read the
// saved page; the stored tab keeps the draft for its writes.
import type { DocumentAccess, DocumentRouteContext } from '../routes/context';

/** Whether this read is handed the draft: an Editor's own editor, with no token, reading the plain tab. */
export function readsDraft(
  ctx: Pick<DocumentRouteContext, 'token'>,
  grant: Pick<DocumentAccess, 'role' | 'community'>,
  documentView: boolean,
): boolean {
  return !documentView && !ctx.token && grant.role === 'edit' && !grant.community;
}
