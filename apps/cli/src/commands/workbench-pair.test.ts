import { describe, expect, it } from 'vitest';
import {
  DEVICE_SLOW_DOWN_S,
  type PairingRequestStatus,
  type WorkbenchPairingRequestCreated,
} from '@livediagram/api-schema';
import { run } from '../main';
import { capabilities, fakeIo, NOW, TOKEN, type FakeIo } from '../testing/fake-io';

// `workbench pair` (docs/specs/013-workspace/blueprints/workbench-embeds.md "The CLI", WB24, WB25, WB45): the
// approval link first on stdout, the browser only on a terminal, then the wait, as `auth login --device` waits.

const ORIGIN = 'https://127.0.0.1:5175';
const CODE = 'c'.repeat(22);
const PAIRING_URL = `https://livediagram.app/workbench/pair?code=${CODE}`;
const EXPIRES = NOW + 600_000;
const STATUS_PATH = `/api/workbench/pairing-requests/${CODE}/status`;

const pending: WorkbenchPairingRequestCreated = {
  status: 'pending',
  pairingUrl: PAIRING_URL,
  code: CODE,
  expiresAt: EXPIRES,
  interval: 5,
};

// One answer of the status poll: a status, an http refusal, or a network failure.
type Poll = PairingRequestStatus | { http: number } | 'network';

type Host = {
  created?: WorkbenchPairingRequestCreated | { http: number };
  polls?: Poll[];
  env?: Record<string, string>;
  stdoutIsTTY?: boolean;
};

function host(script: Host = {}) {
  const sent: unknown[] = [];
  const events: unknown[] = [];
  // What stdout held when each poll was asked: the link must be out before the first.
  const stdoutAtPoll: string[] = [];
  const polls = [...(script.polls ?? [])];
  const io: FakeIo = fakeIo({
    env: { LIVEDIAGRAM_TOKEN: TOKEN, ...script.env },
    stdoutIsTTY: script.stdoutIsTTY ?? false,
    routes: [
      capabilities,
      async (request, url) => {
        if (url.pathname === '/api/events') {
          events.push(...((await request.json()) as { events: unknown[] }).events);
          return new Response(null, { status: 204 });
        }
        if (url.pathname === '/api/workbench/pairing-requests' && request.method === 'POST') {
          sent.push(await request.json());
          const created = script.created ?? pending;
          return 'http' in created
            ? Response.json({ error: 'rate_limited' }, { status: created.http })
            : Response.json(created);
        }
        if (url.pathname === STATUS_PATH) {
          stdoutAtPoll.push(io.out());
          const poll = polls.shift() ?? 'pending';
          if (poll === 'network') throw new TypeError('fetch failed');
          if (typeof poll === 'object')
            return Response.json({ error: 'refused' }, { status: poll.http });
          return Response.json({ status: poll, expiresAt: EXPIRES, interval: 5 });
        }
        return undefined;
      },
    ],
  });
  return { io, sent, events, stdoutAtPoll };
}

const pair = (io: FakeIo, ...more: string[]) =>
  run(['workbench', 'pair', '--origin', ORIGIN, ...more], io);

describe('workbench pair', () => {
  it('prints the link first, waits at the answered interval, and exits 0 once approved', async () => {
    const { io, sent, stdoutAtPoll } = host({ polls: ['pending', 'approved'] });
    expect(await pair(io, '--name', ' Spinner ')).toBe(0);
    expect(sent).toEqual([{ origin: ORIGIN, name: 'Spinner' }]);
    expect(stdoutAtPoll[0]).toBe(`${PAIRING_URL}\n`);
    expect(io.out()).toBe(`${PAIRING_URL}\npaired ${ORIGIN} as Spinner\n`);
    expect(io.slept).toEqual([5000, 5000]);
    expect(io.err()).toBe('Waiting for approval…\n');
  });

  it('opens no browser when piped, as a workbench runs it (WB25)', async () => {
    const { io } = host({ polls: ['approved'] });
    expect(await pair(io)).toBe(0);
    expect(io.opened).toEqual([]);
    expect(io.out()).toBe(`${PAIRING_URL}\npaired ${ORIGIN}\n`);
  });

  it('opens the browser when a person reads stdout', async () => {
    const { io } = host({ polls: ['approved'], stdoutIsTTY: true });
    expect(await pair(io)).toBe(0);
    expect(io.opened).toEqual([PAIRING_URL]);
    expect(io.err()).toBe(
      `Opening ${PAIRING_URL} in your browser. If it does not open, open it yourself.\nWaiting for approval…\n`,
    );
  });

  it('answers at once when the token and origin are already paired', async () => {
    const { io } = host({
      created: {
        status: 'paired',
        pairing: { id: 'p', tokenId: 't', origin: ORIGIN, name: 'Spinner', pairedAt: NOW },
      },
    });
    expect(await pair(io)).toBe(0);
    expect(io.out()).toBe(`paired ${ORIGIN} as Spinner\n`);
    expect(io.slept).toEqual([]);
  });

  it('prints one JSON line for the link and one for the result with --json (WB24)', async () => {
    const { io } = host({ polls: ['approved'] });
    expect(await pair(io, '--json')).toBe(0);
    expect(io.out().split('\n')).toEqual([
      JSON.stringify({ status: 'pending', pairingUrl: PAIRING_URL, expiresAt: EXPIRES }),
      JSON.stringify({ status: 'paired', origin: ORIGIN, name: null }),
      '',
    ]);
  });

  it('exits 4 when declined, and 4 naming the command again when expired', async () => {
    const declined = host({ polls: ['declined'] });
    expect(await pair(declined.io)).toBe(4);
    expect(declined.io.err()).toContain('error: the pairing was declined in the browser\n');
    const expired = host({ polls: ['pending', 'expired'] });
    expect(await pair(expired.io)).toBe(4);
    expect(expired.io.err()).toContain(
      `error: the pairing request expired before it was answered\nhint: livediagram workbench pair --origin ${ORIGIN}\n`,
    );
  });

  it('names each ending in --json, so a workbench can tell them apart', async () => {
    const codes: unknown[] = [];
    for (const polls of [['declined'], ['expired'], [{ http: 404 }]] as Poll[][]) {
      const { io } = host({ polls });
      expect(await pair(io, '--json')).toBe(4);
      codes.push((JSON.parse(io.err().trim().split('\n').at(-1)!) as { error: string }).error);
    }
    expect(codes).toEqual(['pairing_declined', 'pairing_expired', 'pairing_gone']);
  });

  it('reads a request still pending past its expiry and one interval as expired', async () => {
    const { io } = host({ polls: Array<Poll>(200).fill('pending') });
    expect(await pair(io)).toBe(4);
    expect(io.err()).toContain('the pairing request expired before it was answered');
    expect(io.now()).toBeGreaterThan(EXPIRES + 5000);
    expect(io.now()).toBeLessThanOrEqual(EXPIRES + 10_000);
  });

  it('slows down by DEVICE_SLOW_DOWN_S on a 429, and keeps the slower pace', async () => {
    const { io } = host({ polls: [{ http: 429 }, 'pending', 'approved'] });
    expect(await pair(io)).toBe(0);
    const slower = (5 + DEVICE_SLOW_DOWN_S) * 1000;
    expect(io.slept).toEqual([5000, slower, slower]);
  });

  it('exits 4 when the request is gone', async () => {
    const { io } = host({ polls: [{ http: 404 }] });
    expect(await pair(io)).toBe(4);
    expect(io.err()).toContain('error: the pairing request is gone (was the token revoked?)\n');
  });

  it('retries a network failure, and exits 7 on the third in a row', async () => {
    const recovers = host({ polls: ['network', 'network', 'pending', 'network', 'approved'] });
    expect(await pair(recovers.io)).toBe(0);
    const fails = host({ polls: ['network', 'network', 'network'] });
    expect(await pair(fails.io)).toBe(7);
    expect(fails.io.err()).toContain('could not reach https://livediagram.app (fetch failed)');
  });

  it('reports any other failure of the poll as the CLI reports the api', async () => {
    const { io } = host({ polls: [{ http: 503 }] });
    expect(await pair(io)).toBe(7);
    expect(io.err()).toContain('https://livediagram.app failed (HTTP 503)');
  });

  it('refuses a bad origin or name with exit 1, before asking', async () => {
    const origin = host();
    expect(await run(['workbench', 'pair', '--origin', `${ORIGIN}/`], origin.io)).toBe(1);
    expect(origin.io.err()).toContain(`error: "${ORIGIN}/" is not a workbench origin`);
    const name = host();
    expect(await pair(name.io, '--name', ' ')).toBe(1);
    expect(name.io.err()).toContain('error: --name takes 1 to 40 characters');
    expect([...origin.sent, ...name.sent]).toEqual([]);
  });

  it('exits 6 when the host rate limits the ask', async () => {
    const { io } = host({ created: { http: 429 } });
    expect(await pair(io)).toBe(6);
  });

  it('counts a pairing that ended paired, and nothing else', async () => {
    const paired = host({ polls: ['approved'], env: { LIVEDIAGRAM_TELEMETRY: '1' } });
    expect(await pair(paired.io)).toBe(0);
    expect(paired.events).toEqual([{ category: 'Cli', action: 'Used', type: 'WorkbenchPair' }]);
    const declined = host({ polls: ['declined'], env: { LIVEDIAGRAM_TELEMETRY: '1' } });
    expect(await pair(declined.io)).toBe(4);
    expect(declined.events).toEqual([]);
  });

  it('logs each decision under LIVEDIAGRAM_DEBUG=1', async () => {
    const { io } = host({
      polls: ['network', { http: 429 }, 'pending', 'approved'],
      env: { LIVEDIAGRAM_DEBUG: '1' },
    });
    expect(await pair(io)).toBe(0);
    const lines = io
      .err()
      .split('\n')
      .filter((l) => l.startsWith('[cli] workbench pair'));
    expect(lines).toEqual([
      '[cli] workbench pair pending',
      '[cli] workbench pair browser skipped',
      '[cli] workbench pair network-retry 1',
      '[cli] workbench pair slow-down 10',
      '[cli] workbench pair pending',
      '[cli] workbench pair approved',
    ]);
    const opener = host({
      polls: ['approved'],
      env: { LIVEDIAGRAM_DEBUG: '1' },
      stdoutIsTTY: true,
    });
    opener.io.openUrl = async () => false;
    expect(await pair(opener.io)).toBe(0);
    expect(opener.io.err()).toContain('[cli] workbench pair browser not-opened\n');
    const already = host({
      created: {
        status: 'paired',
        pairing: { id: 'p', tokenId: 't', origin: ORIGIN, name: null, pairedAt: NOW },
      },
      env: { LIVEDIAGRAM_DEBUG: '1' },
    });
    expect(await pair(already.io)).toBe(0);
    expect(already.io.err()).toContain('[cli] workbench pair paired\n');
  });
});
