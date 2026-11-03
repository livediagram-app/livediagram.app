// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EXPORT_POLL_MS, type DataExportState, type ExportView } from '@liveworkspace/data-export';
import { DataExportPanel } from './DataExportPanel';
import {
  leftOutLine,
  phaseLine,
  readableSize,
  readyLine,
  rowStateOf,
  startError,
} from './data-export-copy';

// Settings › Your Data (liveworkspace/docs/specs/010-site/site.md "Settings", Your Data): the card's head, my row and
// each team's I run in every state, starting one, asking again only while one is being made, and a refused link's
// note.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const NOW = Date.UTC(2026, 10, 1, 12);
const DAY = 24 * 60 * 60 * 1000;

function view(overrides: Partial<ExportView> = {}): ExportView {
  return {
    id: 'ex_1',
    status: 'ready',
    phase: null,
    requestedBy: 'user_ada',
    startedAt: NOW - 1000,
    finishedAt: NOW - 500,
    expiresAt: NOW + 3 * DAY,
    itemsTotal: 48,
    itemsDone: 48,
    imagesTotal: 3,
    imagesDone: 3,
    bytes: 12_400_000,
    leftOut: 0,
    problems: 0,
    downloadUrl: '/api/account/data-export/download?key=personal%3Auser_ada&id=ex_1&exp=1&sig=a',
    ...overrides,
  };
}

type Call = { url: string; method: string; body: unknown };
let calls: Call[];
let state: DataExportState;
let answer: (call: Call) => Response | null;

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  calls = [];
  state = { personal: null, teams: [] };
  answer = () => null;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string, init?: RequestInit) => {
      const call: Call = {
        url: input,
        method: init?.method ?? 'GET',
        body: init?.body ? JSON.parse(init.body as string) : null,
      };
      calls.push(call);
      const special = answer(call);
      if (special) return special;
      if (call.method === 'POST') {
        const made = view({
          status: 'running',
          phase: 'listing',
          expiresAt: null,
          downloadUrl: undefined,
        });
        return json(202, { export: made });
      }
      return json(200, state);
    }),
  );
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  window.history.replaceState(null, '', '/');
});

const settle = () =>
  act(async () =>
    vi.isFakeTimers()
      ? void (await vi.advanceTimersByTimeAsync(0))
      : new Promise((r) => setTimeout(r, 0)),
  );
const button = (name: string) =>
  [...container.querySelectorAll('button')].find((b) => b.textContent?.trim() === name);
const press = async (name: string) => {
  await act(async () => button(name)!.click());
  await settle();
};
const row = (kind: string) => container.querySelector(`[data-export-row="${kind}"]`)!;
const render = async () => {
  await act(async () => root.render(<DataExportPanel />));
  await settle();
};

describe('Settings › Your Data', () => {
  it('says what a download holds and offers mine, with no teams section for someone who runs none', async () => {
    await render();
    expect(container.textContent).toContain('Take Everything With You');
    expect(row('personal').getAttribute('data-export-state')).toBe('none');
    expect(button('Download All My Data')).toBeTruthy();
    expect(container.textContent).not.toContain('Your Teams');
  });

  it('starts mine, shows its progress and asks again only while it runs', async () => {
    vi.useFakeTimers();
    await render();
    await press('Download All My Data');
    expect(calls.at(-1)).toMatchObject({
      url: '/api/account/data-export',
      method: 'POST',
      body: {},
    });
    expect(row('personal').getAttribute('data-export-state')).toBe('running');
    expect(container.querySelector('[role="progressbar"]')!.getAttribute('aria-valuenow')).toBe(
      '2',
    );
    expect(container.textContent).toContain('We’ll email you a link when it’s ready');

    state = {
      personal: view({ status: 'running', phase: 'items', itemsDone: 12, expiresAt: null }),
      teams: [],
    };
    await act(async () => void (await vi.advanceTimersByTimeAsync(EXPORT_POLL_MS)));
    expect(container.textContent).toContain('Adding items: 12 of 48');

    state = { personal: view(), teams: [] };
    await act(async () => void (await vi.advanceTimersByTimeAsync(EXPORT_POLL_MS)));
    expect(row('personal').getAttribute('data-export-state')).toBe('ready');
    const reads = calls.filter((c) => c.method === 'GET').length;
    await act(async () => void (await vi.advanceTimersByTimeAsync(EXPORT_POLL_MS * 3)));
    expect(calls.filter((c) => c.method === 'GET').length).toBe(reads);
  });

  it('shows a ready one with Download and Make a New One, and what was left out', async () => {
    state = { personal: view({ leftOut: 2, problems: 1 }), teams: [] };
    await render();
    const link = row('personal').querySelector('a')!;
    expect(link.getAttribute('href')).toContain('/api/account/data-export/download');
    expect(link.textContent).toContain('Download');
    expect(row('personal').textContent).toContain('12.4 MB');
    expect(row('personal').textContent).toContain('2 items were left out');
    expect(button('Make a New One')).toBeTruthy();
  });

  it('offers Try Again for a failed one, and a new one for a lapsed one', async () => {
    state = {
      personal: view({ status: 'failed', downloadUrl: undefined }),
      teams: [
        {
          id: 'team-1',
          name: 'Design',
          export: view({ expiresAt: NOW - 1, downloadUrl: undefined }),
        },
      ],
    };
    await render();
    expect(row('personal').textContent).toContain('didn’t finish');
    expect(button('Try Again')).toBeTruthy();
    expect(container.textContent).toContain('Your Teams');
    expect(row('team').getAttribute('data-export-state')).toBe('expired');
    await press('Download Team Data');
    expect(calls.at(-1)!.body).toEqual({ team: 'team-1' });
    expect(row('team').getAttribute('data-export-state')).toBe('running');
  });

  it('says why starting was refused', async () => {
    answer = (call) => (call.method === 'POST' ? json(409, { error: 'export_running' }) : null);
    await render();
    await press('Download All My Data');
    expect(row('personal').querySelector('[role="alert"]')!.textContent).toContain(
      'still being made',
    );
    answer = (call) => (call.method === 'POST' ? json(400, { error: 'rate_limited' }) : null);
    await press('Download All My Data');
    expect(row('personal').querySelector('[role="alert"]')!.textContent).toContain(
      'Too many tries',
    );
  });

  it('says why a read failed, with Try Again', async () => {
    answer = () => json(503, { error: 'export_unavailable' });
    await render();
    expect(container.textContent).toContain('Downloads aren’t available right now');
    answer = () => null;
    await press('Try Again');
    expect(row('personal')).toBeTruthy();
    answer = () => json(500, { error: 'boom' });
    await act(async () => root.unmount());
    root = createRoot(container);
    await render();
    expect(container.textContent).toContain('Something went wrong');
  });

  it('says why a refused link sent me here', async () => {
    window.history.replaceState(null, '', '/explorer?settings=data&export=other-account');
    await render();
    expect(container.querySelector('[role="status"]')!.textContent).toContain('different account');
  });
});

describe('the words', () => {
  it('reads each state, size and line', () => {
    expect(rowStateOf(null, NOW)).toBe('none');
    expect(rowStateOf(view(), NOW)).toBe('ready');
    expect(rowStateOf(view({ downloadUrl: undefined }), NOW)).toBe('expired');
    expect(rowStateOf(view({ expiresAt: null }), NOW)).toBe('expired');
    expect(rowStateOf(view({ status: 'expired' }), NOW)).toBe('expired');
    expect(readableSize(10)).toBe('1 KB');
    expect(readableSize(1_200_000_000)).toBe('1.2 GB');
    expect(phaseLine(view({ phase: 'images', imagesDone: 1 }))).toBe('Adding images: 1 of 3');
    expect(phaseLine(view({ phase: 'finishing' }))).toBe('Finishing');
    expect(phaseLine(view({ phase: null }))).toBe('Finding everything to add');
    expect(readyLine(view({ finishedAt: null, expiresAt: null }))).toBe('12.4 MB');
    expect(leftOutLine(view())).toBeNull();
    expect(leftOutLine(view({ leftOut: 1, problems: 2 }))).toBe(
      'It reached the size limit, so 1 item was left out. 2 items couldn’t be read; the README inside names them.',
    );
    expect(leftOutLine(view({ problems: 1 }))).toContain('names it');
    expect(startError('not_team_admin')).toContain('admins');
    expect(startError('other')).toBe('');
  });
});
