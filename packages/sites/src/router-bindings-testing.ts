// For each app's router tests (Work Tracker 1069): one request per liveworkspace Worker the router forwards to, the
// binding it must reach and the path that Worker sees, so all five routers are held to the same table
// (liveworkspace/docs/specs/002-architecture/blueprints/architecture.md "Which Worker a forward reaches").

import type { ServiceBinding, WorkspaceBindings } from './workspace-proxy';

export type BindingName = keyof WorkspaceBindings;

export type RouterBindingCase = {
  binding: BindingName;
  // The path on the app's address.
  path: string;
  // The path the Worker sees, on liveworkspace.app (production's, with no WORKSPACE_ORIGIN).
  target: string;
};

export const ROUTER_BINDING_CASES: readonly RouterBindingCase[] = [
  { binding: 'WORKSPACE_SITE', path: '/explorer/recent', target: '/explorer/recent' },
  { binding: 'WORKSPACE_SITE', path: '/_liveworkspace/a.js', target: '/_liveworkspace/a.js' },
  { binding: 'WORKSPACE_ACCOUNTS', path: '/api/workspace/auth/token', target: '/api/auth/token' },
  {
    binding: 'WORKSPACE_ACCOUNTS',
    path: '/api/workspace/account/settings',
    target: '/api/account/settings',
  },
  { binding: 'WORKSPACE_INDEX', path: '/api/index/items', target: '/api/index/items' },
  { binding: 'WORKSPACE_DRIVE', path: '/api/drive/config', target: '/api/drive/config' },
  { binding: 'WORKSPACE_MEDIA', path: '/api/previews/items/x', target: '/api/previews/items/x' },
  {
    binding: 'WORKSPACE_COMMUNITY',
    path: '/community/sitemap.xml',
    target: '/api/community/sitemap',
  },
];

const BINDING_NAMES: readonly BindingName[] = [
  'WORKSPACE_SITE',
  'WORKSPACE_ACCOUNTS',
  'WORKSPACE_INDEX',
  'WORKSPACE_DRIVE',
  'WORKSPACE_MEDIA',
  'WORKSPACE_COMMUNITY',
];

/** All six bindings, each recording the URL of every request it is handed, as `https://<host><path>`. */
export function recordingBindings(): {
  bindings: Required<WorkspaceBindings>;
  calls: Record<BindingName, URL[]>;
} {
  const calls = {} as Record<BindingName, URL[]>;
  const bindings = {} as Required<WorkspaceBindings>;
  for (const name of BINDING_NAMES) {
    const seen: URL[] = (calls[name] = []);
    const binding: ServiceBinding = {
      fetch: (input, init) => {
        seen.push(new URL(input instanceof Request ? input.url : new Request(input, init).url));
        return Promise.resolve(
          new Response('{"posts":[]}', { headers: { 'content-type': 'application/json' } }),
        );
      },
    };
    bindings[name] = binding;
  }
  return { bindings, calls };
}
