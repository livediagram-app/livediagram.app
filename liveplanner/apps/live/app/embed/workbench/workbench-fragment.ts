// The workbench page's address (docs/specs/013-workspace/workbench-embeds.md "The handoff", blueprint
// "The workbench page" step 1, "The workspace frame"): `/embed/workbench?d=<projectId>#ticket=<ticket>` for the
// project scope, `/embed/workbench/explorer[/folder/<id>]#ticket=<ticket>` for the workspace scope. The ticket is
// read from the fragment and the fragment cleared before any request, so it never outlives the page load in the
// address bar, the history or a reload. The page the address names is the scope its session must carry.
import { WORKBENCH_HANDLE_PATTERN, type WorkbenchScope } from '@liveplanner/api-schema';

type Address = Pick<Location, 'hash' | 'pathname' | 'search'>;
type AddressHistory = Pick<History, 'replaceState'>;

// What the address asks for: its scope, and the project scope's project (`?d=`).
export type WorkbenchAddress = { scope: WorkbenchScope; projectId: string | null };

const PROJECT_PAGE = '/embed/workbench';

export function addressOf(location: Pick<Location, 'pathname' | 'search'>): WorkbenchAddress {
  const projectPage = location.pathname.replace(/\/+$/, '') === PROJECT_PAGE;
  return projectPage
    ? { scope: 'project', projectId: new URLSearchParams(location.search).get('d') }
    : { scope: 'workspace', projectId: null };
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
