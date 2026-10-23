// The workbench page's address (docs/specs/013-workspace/workbench-embeds.md "The handoff", blueprint
// "The workbench page" step 1, "The workspace frame"): `/embed/workbench?d=<designId>#ticket=<ticket>` for the
// design scope, `/embed/workbench/explorer[/folder/<id>]#ticket=<ticket>` for the workspace scope. The ticket is
// read from the fragment and the fragment cleared before any request, so it never outlives the page load in the
// address bar, the history or a reload. The page the address names is the scope its session must carry.
import { WORKBENCH_HANDLE_PATTERN, type WorkbenchScope } from '@livedesign/api-schema';

type Address = Pick<Location, 'hash' | 'pathname' | 'search'>;
type AddressHistory = Pick<History, 'replaceState'>;

// What the address asks for: its scope, and the design scope's design (`?d=`).
export type WorkbenchAddress = { scope: WorkbenchScope; designId: string | null };

const DESIGN_PAGE = '/embed/workbench';

export function addressOf(location: Pick<Location, 'pathname' | 'search'>): WorkbenchAddress {
  const designPage = location.pathname.replace(/\/+$/, '') === DESIGN_PAGE;
  return designPage
    ? { scope: 'design', designId: new URLSearchParams(location.search).get('d') }
    : { scope: 'workspace', designId: null };
}

export function takeTicketFromAddress(
  location: Address,
  history: AddressHistory,
): { ticket: string | null } & WorkbenchAddress {
  const address = addressOf(location);
  if (!location.hash) return { ticket: null, ...address };
  const raw = new URLSearchParams(location.hash.slice(1)).get('ticket');
  history.replaceState(null, '', `${location.pathname}${location.search}`);
  const ticket = raw !== null && WORKBENCH_HANDLE_PATTERN.test(raw) ? raw : null;
  return { ticket, ...address };
}
