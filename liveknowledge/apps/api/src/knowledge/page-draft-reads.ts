// Who reads a page's draft (docs/specs/030-knowledgebase/editing.md "What reads the saved page only"; blueprint
// blueprints/editing.md "Security and trust"): the editor of a person who may edit the page (an Editor or a
// Participant), and nobody else. A Viewer, a link visitor, a Community visitor, an agent's token and every document
// view read the saved page; the stored tab keeps the draft for its writes.
import { writesPages, type DocumentAccess, type DocumentRouteContext } from '../routes/context';

/** Whether this read is handed the draft: a page writer's own editor, with no token, reading the plain tab. */
export function readsDraft(
  ctx: Pick<DocumentRouteContext, 'token'>,
  grant: Pick<DocumentAccess, 'role' | 'scopes' | 'community'>,
  documentView: boolean,
): boolean {
  return !documentView && !ctx.token && writesPages(grant) && !grant.community;
}
