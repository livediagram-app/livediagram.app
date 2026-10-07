import { describe, expect, it } from 'vitest';
import { withTelemetry } from './config/config-file';
import { run } from './main';
import { telemetryNotice, telemetryOffReason } from './telemetry';
import { capabilities, fakeIo, NOW, TOKEN, type Route } from './testing/fake-io';

const CONFIG = '/home/agent/.config/livediagram/config.toml';
const STATE = '/home/agent/.cache/livediagram/state.json';

// A host with one document; `/api/events` records what is counted.
function host(answer: (url: URL) => Response | undefined = () => undefined) {
  const events: unknown[] = [];
  const route: Route = async (request, url) => {
    if (url.pathname === '/api/events') {
      events.push(...((await request.json()) as { events: unknown[] }).events);
      expect(request.headers.get('Authorization')).toBeNull();
      return new Response(null, { status: 204 });
    }
    const custom = answer(url);
    if (custom) return custom;
    if (url.pathname === '/api/documents')
      return Response.json({ documents: [{ id: 'd1', name: 'A', savedAt: NOW, ownerId: 'u' }] });
    if (url.pathname === '/api/teams') return Response.json({ teams: [] });
    return undefined;
  };
  return { events, route };
}

const on = (more: Record<string, string> = {}) => ({
  LIVEDIAGRAM_TOKEN: TOKEN,
  LIVEDIAGRAM_TELEMETRY: '1',
  ...more,
});

describe('the usage count', () => {
  it('counts a command that succeeded, by its verb, and says once what is counted', async () => {
    const { events, route } = host();
    const io = fakeIo({ env: on(), routes: [capabilities, route] });
    expect(await run(['document', 'ls'], io)).toBe(0);
    expect(await run(['doc', 'ls', '-q'], io)).toBe(0);
    expect(events).toEqual([
      { category: 'Cli', action: 'Used', type: 'DocumentLs' },
      { category: 'Cli', action: 'Used', type: 'DocumentLs' },
    ]);
    expect(io.err()).toBe(`${telemetryNotice('https://livediagram.app')}\n`);
    expect(io.fileMap.get(STATE)?.mode).toBe(0o600);
  });

  it('counts nothing for help, a usage error, a refusal or a command with no host', async () => {
    const { events, route } = host((url) =>
      url.pathname === '/api/documents/x'
        ? Response.json({ error: 'forbidden' }, { status: 403 })
        : undefined,
    );
    const io = fakeIo({ env: on(), routes: [capabilities, route] });
    await run(['--help'], io);
    await run(['tab', 'vew'], io);
    await run(['guide'], io);
    await run(['api', 'GET', '/documents/x'], io);
    expect(events).toEqual([]);
  });

  it('reports a failing api by status, a network failure as Internal, and a 4xx never', async () => {
    const { events, route } = host((url) =>
      url.pathname === '/api/documents' ? new Response('', { status: 503 }) : undefined,
    );
    const io = fakeIo({ env: on(), routes: [capabilities, route] });
    expect(await run(['document', 'ls'], io)).toBe(7);
    const down: Route = (request, url) => {
      if (url.pathname === '/api/documents') throw new TypeError('fetch failed');
      return route(request, url);
    };
    expect(await run(['document', 'ls'], fakeIo({ env: on(), routes: [capabilities, down] }))).toBe(
      7,
    );
    const missing = host((url) =>
      url.pathname === '/api/documents'
        ? Response.json({ error: 'x' }, { status: 404 })
        : undefined,
    );
    await run(['document', 'ls'], fakeIo({ env: on(), routes: [capabilities, missing.route] }));
    const refused = new Error('no');
    const odd: Route = (request, url) => {
      if (url.pathname === '/api/documents') throw refused;
      return route(request, url);
    };
    await run(['document', 'ls'], fakeIo({ env: on(), routes: [capabilities, odd] }));
    expect(events).toEqual([
      { category: 'Error', action: 'Api', type: 'Http503.DocumentLs' },
      { category: 'Error', action: 'Api', type: 'Internal.DocumentLs' },
    ]);
    expect(missing.events).toEqual([]);
  });

  it('is off by LIVEDIAGRAM_TELEMETRY=0, DO_NOT_TRACK, or the config', async () => {
    const io = (env: Record<string, string>) =>
      fakeIo({ env: { LIVEDIAGRAM_TELEMETRY: '', ...env } });
    expect(telemetryOffReason(io({ LIVEDIAGRAM_TELEMETRY: '0' }), { profiles: {} })).toBe('env');
    expect(telemetryOffReason(io({ DO_NOT_TRACK: '1' }), { profiles: {} })).toBe('do-not-track');
    expect(telemetryOffReason(io({ DO_NOT_TRACK: '0' }), { profiles: {} })).toBeNull();
    expect(telemetryOffReason(io({ DO_NOT_TRACK: '' }), { profiles: {} })).toBeNull();
    expect(telemetryOffReason(io({}), { profiles: {}, telemetry: false })).toBe('config');
    const { events, route } = host((url) =>
      url.pathname === '/api/documents' ? new Response('', { status: 500 }) : undefined,
    );
    const quiet = fakeIo({
      env: { LIVEDIAGRAM_TOKEN: TOKEN, DO_NOT_TRACK: '1' },
      routes: [capabilities, route],
    });
    await run(['document', 'ls'], quiet);
    expect(events).toEqual([]);
  });

  it('turns off after telling the host, and on before telling it, neither counted as a command', async () => {
    const { events, route } = host();
    const io = fakeIo({
      env: { LIVEDIAGRAM_TELEMETRY: '' },
      routes: [capabilities, route],
      files: { [CONFIG]: '# mine\n[profiles.work]\nhost = "https://w.example"' },
    });
    expect(await run(['telemetry', 'off'], io)).toBe(0);
    expect(io.out()).toBe('telemetry off\n');
    expect(io.fileMap.get(CONFIG)?.data).toBe(
      'telemetry = false\n# mine\n[profiles.work]\nhost = "https://w.example"\n',
    );
    await run(['document', 'ls'], io);
    expect(await run(['telemetry', 'on'], io)).toBe(0);
    expect(io.fileMap.get(CONFIG)?.data).toContain('telemetry = true\n');
    expect(events).toEqual([
      { category: 'UI', action: 'Toggled', type: 'TelemetryOff' },
      { category: 'UI', action: 'Toggled', type: 'TelemetryOn' },
    ]);
    const fresh = fakeIo({ env: { LIVEDIAGRAM_TELEMETRY: '' }, routes: [capabilities, route] });
    await run(['telemetry', 'off'], fresh);
    expect(fresh.fileMap.get(CONFIG)?.data).toBe('telemetry = false\n');
  });
});

describe('withTelemetry', () => {
  it("replaces a top-level setting in place and leaves a table's alone", () => {
    expect(withTelemetry('telemetry = true\ndefault_profile = "w"\n', false)).toBe(
      'telemetry = false\ndefault_profile = "w"\n',
    );
    expect(withTelemetry('[profiles.x]\ntelemetry = true', false)).toBe(
      'telemetry = false\n[profiles.x]\ntelemetry = true\n',
    );
    expect(withTelemetry('', true)).toBe('telemetry = true\n');
  });
});

describe('the usage count of the repository link', () => {
  it('counts link init, link status, link ls and sync, and sync --watch as SyncWatch', async () => {
    const { linkHost, hostDoc } = await import('./testing/link-host');
    const { events, route } = host();
    const library = linkHost(
      [hostDoc('d-home', 'Home', { folderId: 'f1' })],
      [{ id: 'f1', name: 'Games', parentId: null, teamId: null }],
    );
    const io = fakeIo({ env: on(), routes: [route, library.route] });
    expect(await run(['link', 'init', '--folder', 'f1'], io)).toBe(0);
    expect(await run(['link', 'status'], io)).toBe(0);
    expect(await run(['link', 'ls'], io)).toBe(0);
    expect(await run(['sync'], io)).toBe(0);
    const watching = run(['sync', '--watch'], io);
    for (let i = 0; i < 100 && io.sockets.length === 0; i++)
      await new Promise((resolve) => setTimeout(resolve, 0));
    io.interrupt();
    expect(await watching).toBe(0);
    expect(events.map((e) => (e as { type: string }).type)).toEqual([
      'LinkInit',
      'LinkStatus',
      'LinkLs',
      'Sync',
      'SyncWatch',
    ]);
  });
});
