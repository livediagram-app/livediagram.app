// Where the Explorer's address lands the person (ExplorerShell): a retired address gives way to its successor, and
// otherwise where they came from, the last app this browser used and what the address hands over (a notice, an item
// just sent to the Trash). Read once per visit, as a stable snapshot, and forgotten when the Explorer unmounts.
import { withoutTrailingSlashes } from '@liveworkspace/api-schema/url-slashes';
import type { AppName } from '@liveworkspace/sites';
import { pageApp, workspaceHref } from '@/lib/explorer/page-app';
import {
  arrival,
  arrivalNotice,
  ENDED_PARAM,
  offlineHref,
  readLastApp,
  RETIRED_TARGETS,
  retiredTarget,
  SETTINGS_PARAM,
  settingsOpening,
  type Arrival,
} from '@/lib/explorer/host';

// The kind New makes, and "this app", for a person who came from no app and has used none here.
export const FALLBACK_APP: AppName = 'liveplanner';
// The handoffs an address may carry, taken once and then dropped from it.
export const TRASHED_PARAM = 'trashed';
export const TITLE_PARAM = 'title';

/** The retired view an address names (`/explorer/profile`, …), if any. */
function retiredView(pathname: string): keyof typeof RETIRED_TARGETS | 'offline' | null {
  const section = withoutTrailingSlashes(pathname).split('/')[2] ?? '';
  if (section === 'offline') return 'offline';
  return section in RETIRED_TARGETS ? (section as keyof typeof RETIRED_TARGETS) : null;
}

type Trashed = { id: string; title: string | null };

/** What the address says on arrival: somewhere else to go, or where the person came from and what it hands over. */
export type Landing =
  | { leave: string }
  | {
      leave: null;
      arrived: Arrival;
      // The last app this browser came from: what New makes in no app (it never filters the lists).
      lastApp: AppName | null;
      notice: string | null;
      trashed: Trashed | null;
      strip: boolean;
    };

// A successor on liveworkspace.app, in full from an app's address; the Explorer's own stay where they are.
const onWorkspace = (target: string) =>
  target.startsWith('/explorer') ? target : workspaceHref(target);

function readLanding(): Landing {
  const search = window.location.search;
  // On an app's address the page is that app's, whatever the address says.
  const host = pageApp();
  const found: Arrival = host ? { app: host, via: 'host' } : arrival(search, document.referrer);
  const lastApp = readLastApp();
  // A retired address gives way to its successor. This Browser is a view of its own on the app's address.
  const retired = retiredView(window.location.pathname);
  if (retired === 'offline' && !host)
    return { leave: offlineHref(found.app ?? lastApp ?? FALLBACK_APP) ?? '/explorer' };
  if (retired && retired !== 'offline')
    return { leave: onWorkspace(retiredTarget(retired, search)) };
  const params = new URLSearchParams(search);
  // `?settings=teams`: teams are run in the Explorer, the Invites beside them. Every other `?settings=` opens the
  // Settings panel in place, once the page knows who is here (ExplorerShell).
  if (settingsOpening(params.get(SETTINGS_PARAM), found.app) === 'teams')
    return { leave: '/explorer/invites' };
  const trashedId = params.get(TRASHED_PARAM);
  return {
    leave: null,
    arrived: found,
    lastApp,
    notice: arrivalNotice(search, found.app),
    trashed: trashedId ? { id: trashedId, title: params.get(TITLE_PARAM) } : null,
    strip: params.has(ENDED_PARAM) || trashedId !== null,
  };
}

// Read once per visit (a stable snapshot), and forgotten when the Explorer unmounts, so a later visit reads afresh.
let landing: Landing | null = null;
export const landingNow = () => (landing ??= readLanding());
export const forgetLanding = () => {
  landing = null;
};
export const noSubscribe = () => () => {};
