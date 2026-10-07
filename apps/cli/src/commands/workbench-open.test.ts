import { describe, expect, it } from 'vitest';
import { run } from '../main';
import { capabilities, fakeIo, NOW, TOKEN, type FakeIo } from '../testing/fake-io';

// `workbench open` as the CLI runs it (docs/specs/013-workspace/blueprints/workbench-embeds.md "The CLI", WB23):
// the link on stdout, the pairing refusal as exit 4 naming the pair command, the usage and origin refusals.

const DOC = 'aaaa1111-0000-4000-8000-000000000001';
const ORIGIN = 'https://127.0.0.1:5175';
const URL_OUT = `https://livediagram.app/embed/workbench?d=${DOC}#ticket=${'t'.repeat(22)}`;

function host(mint: Response, env: Record<string, string> = {}) {
  const events: unknown[] = [];
  const io: FakeIo = fakeIo({
    env: { LIVEDIAGRAM_TOKEN: TOKEN, ...env },
    routes: [
      capabilities,
      async (request, url) => {
        if (url.pathname === '/api/events') {
          events.push(...((await request.json()) as { events: unknown[] }).events);
          return new Response(null, { status: 204 });
        }
        if (url.pathname === '/api/documents')
          return Response.json({
            documents: [{ id: DOC, name: 'Home screen', savedAt: NOW, ownerId: 'u' }],
          });
        if (url.pathname === '/api/teams') return Response.json({ teams: [] });
        if (url.pathname === '/api/workbench/tickets') return mint.clone();
        return undefined;
      },
    ],
  });
  return { io, events };
}

const minted = Response.json(
  { url: URL_OUT, documentId: DOC, tabId: null, expiresAt: NOW + 60_000 },
  { status: 201 },
);

const open = (io: FakeIo, ...more: string[]) =>
  run(['workbench', 'open', 'Home screen', '--origin', ORIGIN, ...more], io);

describe('workbench open', () => {
  it('prints the link, or the whole answer with --json, and counts the command', async () => {
    const text = host(minted, { LIVEDIAGRAM_TELEMETRY: '1' });
    expect(await open(text.io)).toBe(0);
    expect(text.io.out()).toBe(`${URL_OUT}\n`);
    expect(text.events).toEqual([{ category: 'Cli', action: 'Used', type: 'WorkbenchOpen' }]);
    const json = host(minted);
    expect(await open(json.io, '--json')).toBe(0);
    expect(JSON.parse(json.io.out())).toEqual({
      url: URL_OUT,
      documentId: DOC,
      tabId: null,
      expiresAt: NOW + 60_000,
    });
  });

  it('exits 4 for a workbench the token is not paired with, naming the pair command', async () => {
    const { io, events } = host(
      Response.json(
        { error: 'pairing_required', pairingUrl: 'https://x/p', expiresAt: NOW },
        { status: 428 },
      ),
      { LIVEDIAGRAM_TELEMETRY: '1' },
    );
    expect(await open(io)).toBe(4);
    expect(io.out()).toBe('');
    expect(io.err()).toBe(
      `error: this workbench is not paired with your token\nhint: livediagram workbench pair --origin ${ORIGIN}\n`,
    );
    expect(events).toEqual([]);
  });

  it('exits 2 for a share link and 1 for an origin that is not one', async () => {
    const shared = host(minted);
    expect(
      await run(
        ['workbench', 'open', 'https://livediagram.app/document/shared?s=x', '--origin', ORIGIN],
        shared.io,
      ),
    ).toBe(2);
    const origin = host(minted);
    expect(
      await run(['workbench', 'open', 'Home screen', '--origin', 'https://x.dev/a'], origin.io),
    ).toBe(1);
    expect(origin.io.err()).toContain('error: "https://x.dev/a" is not a workbench origin');
  });

  it('exits 2 without --origin', async () => {
    const { io } = host(minted);
    expect(await run(['workbench', 'open', 'Home screen'], io)).toBe(2);
  });
});
