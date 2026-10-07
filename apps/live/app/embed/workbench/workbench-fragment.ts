// The workbench page's address (docs/specs/013-workspace/workbench-embeds.md "The handoff", blueprint
// "The workbench page" step 1): `/embed/workbench?d=<documentId>#ticket=<ticket>`. The ticket is read
// from the fragment and the fragment cleared before any request, so it never outlives the page load in
// the address bar, the history or a reload.
import { WORKBENCH_HANDLE_PATTERN } from '@livediagram/api-schema';

type Address = Pick<Location, 'hash' | 'pathname' | 'search'>;
type AddressHistory = Pick<History, 'replaceState'>;

export function takeTicketFromAddress(
  location: Address,
  history: AddressHistory,
): { ticket: string | null; documentId: string | null } {
  const documentId = new URLSearchParams(location.search).get('d');
  if (!location.hash) return { ticket: null, documentId };
  const raw = new URLSearchParams(location.hash.slice(1)).get('ticket');
  history.replaceState(null, '', `${location.pathname}${location.search}`);
  const ticket = raw !== null && WORKBENCH_HANDLE_PATTERN.test(raw) ? raw : null;
  return { ticket, documentId };
}
