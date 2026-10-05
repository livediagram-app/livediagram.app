// An in-memory CliIo for the suites (docs/specs/015-api/blueprints/cli.md "Testing"): captured streams, a map
// of files with their modes, a scripted fetch and a fixed clock.

import type { CliIo } from '../io';

export type Route = (
  request: Request,
  url: URL,
) => Response | undefined | Promise<Response | undefined>;

export type FakeIo = CliIo & {
  out: () => string;
  err: () => string;
  fileMap: Map<string, { data: string; mode: number }>;
  requests: Request[];
};

export const NOW = Date.UTC(2026, 9, 5, 8, 0, 0);

export function fakeIo(
  options: {
    env?: Record<string, string>;
    routes?: Route[];
    stdin?: string;
    stdinIsTTY?: boolean;
    files?: Record<string, string>;
  } = {},
): FakeIo {
  let out = '';
  let err = '';
  const fileMap = new Map(
    Object.entries(options.files ?? {}).map(([k, v]) => [k, { data: v, mode: 0o600 }]),
  );
  const requests: Request[] = [];
  return {
    env: options.env ?? {},
    stdout: (text) => void (out += text),
    stderr: (text) => void (err += text),
    readStdin: async () => options.stdin ?? '',
    stdinIsTTY: options.stdinIsTTY ?? false,
    now: () => NOW,
    homedir: '/home/agent',
    cwd: '/work',
    runtime: 'node/24.0.0 linux',
    fetch: async (request) => {
      requests.push(request);
      const url = new URL(request.url);
      for (const r of options.routes ?? []) {
        const answer = await r(request, url);
        if (answer) return answer;
      }
      return Response.json({ error: 'not_found' }, { status: 404 });
    },
    files: {
      read: async (path) => fileMap.get(path)?.data ?? null,
      write: async (path, data, mode) => void fileMap.set(path, { data, mode: mode ?? 0o644 }),
      mkdir: async () => {},
      mode: async (path) => fileMap.get(path)?.mode ?? null,
      chmod: async (path, mode) => {
        const file = fileMap.get(path);
        if (file) file.mode = mode;
      },
      remove: async (path) => void fileMap.delete(path),
    },
    out: () => out,
    err: () => err,
    fileMap,
    requests,
  };
}

// A host that has sign-in, at livediagram.app.
export const capabilities: Route = (_, url) =>
  url.pathname === '/api/capabilities'
    ? Response.json({
        aiEnabled: false,
        apiBase: 'https://livediagram.app/api',
        authEnabled: true,
        documentFormat: 2,
      })
    : undefined;

export const TOKEN = `lvd_${'a'.repeat(43)}`;
