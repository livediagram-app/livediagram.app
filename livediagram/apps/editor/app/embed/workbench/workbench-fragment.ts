// The workbench page's address (docs/specs/013-workspace/workbench-embeds.md "The handoff", blueprint
// "The workbench page" step 1, "The workspace frame"): `/embed/workbench?d=<documentId>#ticket=<ticket>` for the
// document scope, `/embed/workbench/explorer[/folder/<id>]#ticket=<ticket>` for the workspace scope. The ticket is
// read from the fragment and the fragment cleared before any request, so it never outlives the page load in the
// address bar, the history or a reload. The page the address names is the scope its session must carry.
import { WORKBENCH_TICKET_PATTERN, type WorkbenchScope } from '@livediagram/api-schema';

type Address = Pick<Location, 'hash' | 'pathname' | 'search'>;
type AddressHistory = Pick<History, 'replaceState'>;

// What the address asks for: its scope, and the document scope's document (`?d=`).
export type WorkbenchAddress = { scope: WorkbenchScope; documentId: string | null };

const DOCUMENT_PAGE = '/embed/workbench';

export function addressOf(location: Pick<Location, 'pathname' | 'search'>): WorkbenchAddress {
  const documentPage = location.pathname.replace(/\/+$/, '') === DOCUMENT_PAGE;
  return documentPage
    ? { scope: 'document', documentId: new URLSearchParams(location.search).get('d') }
    : { scope: 'workspace', documentId: null };
}

export function takeTicketFromAddress(
  location: Address,
  history: AddressHistory,
): { ticket: string | null } & WorkbenchAddress {
  const address = addressOf(location);
  if (!location.hash) return { ticket: null, ...address };
  const raw = new URLSearchParams(location.hash.slice(1)).get('ticket');
  history.replaceState(null, '', `${location.pathname}${location.search}`);
  const ticket = raw !== null && WORKBENCH_TICKET_PATTERN.test(raw) ? raw : null;
  return { ticket, ...address };
}
