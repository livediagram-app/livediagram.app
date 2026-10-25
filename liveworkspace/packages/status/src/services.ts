// What the status page checks (liveworkspace/docs/site.md "Status") and the status Worker checks every hour
// (liveworkspace/docs/status.md): liveworkspace's shared services, then each app's own, each with an endpoint it
// already answers that says it is up. The one list both use, so the page and the stored history never drift. Every
// check is a route the service serves anyway, picked to be cheap (no database read where one can be avoided, or one
// the edge caches).

import {
  APP_SITES,
  LOCAL_PORTS,
  PLATFORM_SITE,
  STAND_INS,
  type Site,
  type SiteId,
} from '@liveworkspace/sites';

// How a check is made and what counts as up.
//  - `read`: the page can read the answer (this origin, or a CORS `*` route), so its status code must be one of
//    `ok`, and JSON when `json` says so (which tells a Worker's own answer from the site's HTML 404 page).
//  - `reach`: another site that sends no CORS headers. The browser only learns that it answered (an opaque
//    `no-cors` response), never what it said, so the page calls that Reached rather than claiming more. The status
//    Worker can read it, and counts any 2xx or 3xx as up.
// A `read` URL that starts with `/` is on liveworkspace.app itself (`resolveProbeUrl`).
export type Probe =
  | {
      kind: 'read';
      url: string;
      method: 'GET' | 'HEAD' | 'OPTIONS';
      ok: readonly number[];
      json?: boolean;
      // What an expected answer means, in words, where its bare status code would mislead (a 404 that is the
      // Worker's sign of life). Otherwise the row shows "HTTP <status>".
      says?: string;
    }
  | { kind: 'reach'; url: string; method: 'HEAD' | 'GET' };

// How a service's state is found: its own check; another's, for a service with no check of its own (the realtime
// rooms are the API Worker's, and the router answers every request to the app, so it is up when any check through
// it answered); or none here, with the reason.
export type Check =
  | { mode: 'probe'; probe: Probe }
  | { mode: 'derived'; from: readonly string[]; rule: 'same' | 'any'; note: string }
  | { mode: 'skipped'; reason: string };

export type IconName =
  | 'globe'
  | 'key'
  | 'folder'
  | 'users'
  | 'chart'
  | 'image'
  | 'cpu'
  | 'radio'
  | 'route'
  | 'pen'
  | 'megaphone'
  | 'book'
  | 'sparkles';

export type Service = {
  // Unique across the page: `<group>:<service>`.
  id: string;
  name: string;
  // One line: what it does for people.
  description: string;
  icon: IconName;
  // What the check is, in a few words, for the row's detail line.
  label: string;
  check: Check;
};

export type ServiceGroup = {
  // The group's anchor (`#livediagram`), which an app's old /status redirects to.
  id: string;
  site: Site;
  title: string;
  blurb: string;
  services: Service[];
};

// Where the page is running, which decides each app's address.
export type StatusEnvironment = 'production' | 'staging' | 'development';

export function environmentOf(host: string): StatusEnvironment {
  if (/^staging\./i.test(host)) return 'staging';
  if (/^(localhost|127\.0\.0\.1)(:\d+)?$/i.test(host)) return 'development';
  return 'production';
}

type AppSiteId = Exclude<SiteId, 'liveworkspace.app'>;

// Each app's MCP Worker's local port (its wrangler.toml `[dev] port`).
const MCP_DEV_PORTS: Record<AppSiteId, number> = {
  'livediagram.app': 8788,
  'liveplanner.app': 8888,
  'livedocuments.app': 8988,
  'livedesign.app': 8990,
};

/** An app's address in `env`: its router's port on a dev server, its `staging.` host, else its live site. */
export function appOrigin(site: Site, env: StatusEnvironment): string {
  if (env === 'development') return `http://localhost:${LOCAL_PORTS[site.id]}`;
  const standIn = STAND_INS[site.id as AppSiteId];
  if (env === 'staging') return standIn?.staging ?? `https://staging.${site.id}`;
  return standIn?.production ?? `https://www.${site.id}`;
}

/** An app's MCP server in `env`, or null where the page doesn't check it (staging has no public MCP host). */
export function mcpOrigin(site: Site, env: StatusEnvironment): string | null {
  if (site.id === 'liveworkspace.app') return null;
  if (env === 'development') return `http://localhost:${MCP_DEV_PORTS[site.id]}`;
  if (env === 'staging') return null;
  return STAND_INS[site.id as AppSiteId]?.mcp ?? `https://mcp.${site.id}`;
}

const read = (
  url: string,
  method: 'GET' | 'HEAD' | 'OPTIONS',
  ok: readonly number[],
  json = false,
  says?: string,
): Check => ({ mode: 'probe', probe: { kind: 'read', url, method, ok, json, says } });

const reach = (url: string): Check => ({
  mode: 'probe',
  probe: { kind: 'reach', url, method: 'HEAD' },
});

// liveworkspace's own services, all on this origin, so every answer can be read.
function platformGroup(): ServiceGroup {
  const g = 'liveworkspace';
  return {
    id: g,
    site: PLATFORM_SITE,
    title: 'liveworkspace',
    blurb: 'Shared by every app: one account, one Explorer, one home for media and numbers.',
    services: [
      {
        id: `${g}:site`,
        name: 'Website',
        description: 'liveworkspace.app: sign-in, the Explorer, the dashboard and this page.',
        icon: 'globe',
        label: 'HEAD /robots.txt',
        check: read('/robots.txt', 'HEAD', [200]),
      },
      {
        id: `${g}:accounts`,
        name: 'Accounts & sign-in',
        description: 'One account for every app: signing in, signing up and the tokens apps trust.',
        icon: 'key',
        label: 'GET /.well-known/openid-configuration',
        check: read('/.well-known/openid-configuration', 'GET', [200], true),
      },
      {
        id: `${g}:index`,
        name: 'Explorer index',
        description: 'Every app’s items, folders, sharing and Inbox, in one Explorer.',
        icon: 'folder',
        label: 'GET /api/index/jwks',
        check: read('/api/index/jwks', 'GET', [200], true),
      },
      {
        id: `${g}:community`,
        name: 'Community',
        description: 'The public galleries of shared work behind each app’s Community pages.',
        icon: 'users',
        label: 'GET /api/community/facets',
        check: read('/api/community/facets?app=livediagram.app', 'GET', [200], true),
      },
      {
        id: `${g}:telemetry`,
        name: 'Telemetry',
        description: 'Every app’s anonymous events, and the public dashboard they feed.',
        icon: 'chart',
        label: 'OPTIONS /api/telemetry/events',
        check: read(
          '/api/telemetry/events',
          'OPTIONS',
          [204],
          false,
          'Answers; database not checked',
        ),
      },
      {
        id: `${g}:media`,
        name: 'Media & previews',
        description: 'Uploaded images, and the picture of every item, for every app.',
        icon: 'image',
        label: 'GET /api/previews',
        // It serves only the apps' Workers and previews behind access checks, so its sign of life is its own
        // JSON "not found" for a bare request, which the site's HTML 404 page never is.
        check: read('/api/previews', 'GET', [404], true, 'Answers; storage not checked'),
      },
    ],
  };
}

const MCP_DESCRIPTION = 'Lets AI assistants read and make your work, with your permission.';

// What each app adds to the page: the services every app has, and livediagram's Community pages.
function appGroup(site: Site, env: StatusEnvironment): ServiceGroup {
  const g = site.id.replace(/\.app$/, '');
  const origin = appOrigin(site, env);
  const mcp = mcpOrigin(site, env);
  const api = `${g}:api`;
  const throughRouter = [api, `${g}:editor`, `${g}:marketing`, `${g}:help`];
  const services: Service[] = [
    {
      id: api,
      name: 'API',
      description: 'Saves and loads your work, and runs sharing, teams and tokens.',
      icon: 'cpu',
      label: 'GET /api/capabilities',
      check: read(`${origin}/api/capabilities`, 'GET', [200], true),
    },
    {
      id: `${g}:realtime`,
      name: 'Realtime rooms',
      description: 'Live cursors and edits between everyone in the same piece of work.',
      icon: 'radio',
      label: 'Through the API',
      check: {
        mode: 'derived',
        from: [api],
        rule: 'same',
        note: 'The rooms run inside the API Worker, so the API’s check stands for them.',
      },
    },
    {
      id: `${g}:editor`,
      name: 'Editor',
      description: 'The app itself, where the work is made.',
      icon: 'pen',
      label: 'HEAD /icon.svg',
      check: reach(`${origin}/icon.svg`),
    },
    {
      id: `${g}:marketing`,
      name: 'Marketing site',
      description: `${site.name}’s home page, features, comparisons and FAQ.`,
      icon: 'megaphone',
      label: 'HEAD /robots.txt',
      check: reach(`${origin}/robots.txt`),
    },
    {
      id: `${g}:help`,
      name: 'Help centre',
      description: 'Guides, how-tos and the developer docs.',
      icon: 'book',
      label: 'HEAD /help/robots.txt',
      check: reach(`${origin}/help/robots.txt`),
    },
  ];
  if (site.id === 'livediagram.app') {
    services.push({
      id: `${g}:community-pages`,
      name: 'Community pages',
      description: 'The public gallery of shared canvases.',
      icon: 'users',
      label: 'HEAD /community/',
      check: reach(`${origin}/community/`),
    });
    throughRouter.push(`${g}:community-pages`);
  }
  services.push(
    {
      id: `${g}:mcp`,
      name: 'MCP server',
      description: MCP_DESCRIPTION,
      icon: 'sparkles',
      label: mcp ? 'GET /health' : 'Not checked here',
      check: mcp
        ? read(`${mcp}/health`, 'GET', [200], true)
        : {
            mode: 'skipped',
            reason: 'Staging has no public MCP address, so it isn’t checked here.',
          },
    },
    {
      id: `${g}:router`,
      name: 'Router',
      description: `Puts every part of ${site.name} on one address.`,
      icon: 'route',
      label: 'Every check above passes through it',
      check: {
        mode: 'derived',
        from: throughRouter,
        rule: 'any',
        note: 'Every request to the app passes through the router, so it is up when any of them answers.',
      },
    },
  );
  return { id: g, site, title: site.name, blurb: `${site.pitch}.`, services };
}

/** Every group the page shows: liveworkspace first, then each app in the shared order. */
export function statusGroups(env: StatusEnvironment): ServiceGroup[] {
  return [platformGroup(), ...APP_SITES.map((site) => appGroup(site, env))];
}

/** Every service on the page, flattened, in page order. */
export function allServices(groups: readonly ServiceGroup[]): Service[] {
  return groups.flatMap((g) => g.services);
}

/** Every service with a check of its own, in page order: what one round (in a browser or on the server) fetches. */
export function probedServices(
  groups: readonly ServiceGroup[],
): Array<Service & { check: { mode: 'probe'; probe: Probe } }> {
  return allServices(groups).filter(
    (s): s is Service & { check: { mode: 'probe'; probe: Probe } } => s.check.mode === 'probe',
  );
}

/** A probe's absolute address: liveworkspace.app's own paths on `platformOrigin`, anything else as written. */
export function resolveProbeUrl(probe: Probe, platformOrigin: string): string {
  return probe.url.startsWith('/') ? `${platformOrigin.replace(/\/$/, '')}${probe.url}` : probe.url;
}
