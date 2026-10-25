// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { StatusHistory } from '@liveworkspace/status';
import { StatusBoard } from './StatusBoard';

// liveworkspace/docs/site.md "Status": the board shows every group, and each service's state from its check, as an
// icon and a word.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
let host: HTMLElement | null = null;

beforeEach(() => {
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
});

// Every check answers as it should, but those whose address matches `down`, which fail.
const fetchWhere =
  (down: RegExp): typeof fetch =>
  async (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (down.test(url)) throw new TypeError('Failed to fetch');
    const status = init?.method === 'OPTIONS' ? 204 : url.endsWith('/api/previews') ? 404 : 200;
    return new Response(status === 204 ? null : '{}', {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  };

async function render(fetchImpl: typeof fetch) {
  await act(async () => {
    root!.render(<StatusBoard fetchImpl={fetchImpl} environment="production" />);
  });
  // Let the round's checks settle.
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
}

const row = (id: string) => host!.querySelector(`[data-service="${id}"]`);

describe('StatusBoard', () => {
  it('lists every service group, each under its own name', async () => {
    await render(fetchWhere(/$^/));
    const ids = [...host!.querySelectorAll('section[id]')].map((s) => s.id);
    expect(ids).toEqual([
      'liveworkspace',
      'livediagram',
      'liveplanner',
      'livedocuments',
      'livedesign',
    ]);
    for (const id of ids) expect(host!.querySelector(`#${id}-title`)?.textContent).toContain(id);
  });

  it('shows every service operational, with its answer, when every check answers', async () => {
    await render(fetchWhere(/$^/));
    expect(host!.querySelector('h1')?.textContent).toBe('All systems operational');
    expect(row('liveworkspace:accounts')?.getAttribute('data-state')).toBe('up');
    expect(row('liveworkspace:accounts')?.textContent).toContain('Operational');
    expect(row('liveworkspace:accounts')?.textContent).toContain('HTTP 200');
    expect(row('livediagram:editor')?.getAttribute('data-state')).toBe('reached');
    expect(row('livediagram:editor')?.textContent).toContain('Reached');
  });

  it('marks a failing service down, in words, and what stands on it', async () => {
    await render(fetchWhere(/liveplanner\.app\/api\/capabilities/));
    expect(host!.querySelector('h1')?.textContent).toBe('Some services are down');
    expect(row('liveplanner:api')?.getAttribute('data-state')).toBe('down');
    expect(row('liveplanner:api')?.textContent).toContain('Down');
    expect(row('liveplanner:api')?.textContent).toContain('No answer');
    expect(row('liveplanner:realtime')?.getAttribute('data-state')).toBe('down');
    expect(row('liveplanner:router')?.getAttribute('data-state')).toBe('up');
    expect(host!.querySelector('#liveplanner')?.textContent).toContain('2 of 7 down');
    expect(host!.querySelector('[role="status"]')?.textContent).toBe('Some services are down');
  });

  it('never prints a bare error code under Operational: Media’s 404 says what it means', async () => {
    await render(fetchWhere(/$^/));
    const media = row('liveworkspace:media')!;
    expect(media.getAttribute('data-state')).toBe('up');
    expect(media.textContent).toContain('Answers; storage not checked');
    expect(media.textContent).not.toContain('HTTP 404');
    for (const r of host!.querySelectorAll('[data-state="up"]'))
      expect(r.textContent, r.getAttribute('data-service') ?? '').not.toMatch(/HTTP [45]\d\d/);
  });

  it('gives each group’s jump link its state in words, never a dot alone', async () => {
    await render(fetchWhere(/livedesign\.app\/api\/capabilities/));
    const links = [...host!.querySelectorAll('nav[aria-label="Groups"] a')].map(
      (a) => a.textContent,
    );
    expect(links).toEqual([
      'liveworkspaceAll up',
      'livediagramAll up',
      'liveplannerAll up',
      'livedocumentsAll up',
      'livedesign2 down',
    ]);
  });

  it('explains every state in the legend', async () => {
    await render(fetchWhere(/$^/));
    const legend = host!.querySelector('[aria-labelledby="status-legend"]')!.textContent;
    for (const word of ['Operational', 'Reached', 'Slow', 'Down', 'Checking', 'Not checked'])
      expect(legend).toContain(word);
  });
});

// The stored history (liveworkspace/docs/status.md), served at /api/status/history; every other address as fetchWhere.
const AT = Date.now() - 23 * 60_000;
const DAYS = 90;
const bars = (last: number, worst: string) => ({
  p: 99.5,
  w: `${'u'.repeat(DAYS - 1)}${worst}`,
  u: last < 1000 ? [[DAYS - 1, last] as [number, number]] : [],
});
const HISTORY: StatusHistory = {
  v: 1,
  at: AT,
  from: new Date(AT - (DAYS - 1) * 86_400_000).toISOString().slice(0, 10),
  days: DAYS,
  latest: {
    'livediagram:api': ['u', 200, 120],
    'livediagram:editor': ['u', 200, 40],
    'liveplanner:api': ['d', null, 10_000, 'timeout'],
  },
  services: {
    'livediagram:api': bars(1000, 'u'),
    'livediagram:editor': bars(1000, 'u'),
    'liveplanner:api': bars(500, 'd'),
  },
  incidents: [['liveplanner:api', AT - 3_600_000, null, 'd', 2, 'timeout']],
};

function withHistory(history: unknown, seen: string[] = []): typeof fetch {
  const rest = fetchWhere(/$^/);
  return async (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    seen.push(url);
    if (url === '/api/status/history')
      return new Response(JSON.stringify(history), {
        headers: { 'Content-Type': 'application/json' },
      });
    return rest(input, init);
  };
}

describe('StatusBoard with the hourly history', () => {
  it('reads it once on load, and shows each service’s last hourly check beside this visit’s', async () => {
    const seen: string[] = [];
    await render(withHistory(HISTORY, seen));
    expect(seen.filter((u) => u.includes('/api/status'))).toEqual(['/api/status/history']);
    expect(host!.querySelector('[data-history="unavailable"]')).toBeNull();
    const api = row('livediagram:api')!;
    // The cards' clock moves once a minute, so 23 minutes reads as 22 to 24.
    expect(api.textContent).toMatch(/Checked by liveworkspace 2[2-4] min ago/);
    expect(api.querySelector('[data-hourly]')?.getAttribute('data-hourly')).toBe('up');
    // A page the browser can only reach gets a true state from the hourly check.
    expect(row('livediagram:editor')!.getAttribute('data-state')).toBe('reached');
    expect(row('livediagram:editor')!.querySelector('[data-hourly]')?.textContent).toContain(
      'Operational',
    );
    // Down in words, with why.
    const planner = row('liveplanner:api')!.querySelector('[data-hourly]')!;
    expect(planner.getAttribute('data-hourly')).toBe('down');
    expect(planner.textContent).toContain('Timed out');
    expect(planner.textContent).toContain('Down');
  });

  it('draws 90 days as one image with a summary in words, never colour alone', async () => {
    await render(withHistory(HISTORY));
    const strip = row('liveplanner:api')!.querySelector('[role="img"]')!;
    expect(strip.getAttribute('aria-label')).toMatch(
      /^Last 90 days: 99\.5% up over 90 days; 1 day with incidents/,
    );
    expect(strip.querySelectorAll('[data-day]')).toHaveLength(90);
    // The worst day is told by its height as well as its colour.
    expect(strip.lastElementChild!.className).toContain('h-2/5');
    expect(row('liveplanner:api')!.textContent).toContain('99.5% over 90 days');
    // A service with no stored days says so.
    expect(row('livedesign:api')!.textContent).toContain('No data yet');
  });

  it('shows a day on focus, and moves through the days with the arrow keys', async () => {
    await render(withHistory(HISTORY));
    const strip = row('liveplanner:api')!.querySelector<HTMLElement>('[role="img"]')!;
    await act(async () => strip.focus());
    const tip = () => row('liveplanner:api')!.querySelector('[role="tooltip"]');
    expect(tip()?.textContent).toContain('Worst: Down');
    expect(tip()?.textContent).toContain('50% up');
    expect(tip()?.textContent).toContain('ongoing');
    await act(async () => {
      strip.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    });
    expect(tip()?.textContent).toContain('Up all day');
    expect(tip()?.textContent).toContain('No incidents.');
  });

  it('lists recent incidents under the app’s name, with the state in words', async () => {
    await render(withHistory(HISTORY));
    const section = host!.querySelector('[aria-labelledby="status-incidents"]')!;
    const item = section.querySelector('[data-incident="liveplanner:api"]')!;
    expect(item.textContent).toContain('API · liveplanner');
    expect(item.textContent).toContain('Down');
    expect(item.textContent).toContain('Ongoing');
    expect(item.textContent).toContain('No answer in 10 s');
  });

  it('leaves out the realtime rooms’ copies of the API’s incidents, and shows the latest ten at first', async () => {
    const many = Array.from({ length: 12 }, (_, i) => [
      'livediagram:api',
      AT - (i + 2) * 86_400_000,
      AT - (i + 2) * 86_400_000 + 3_600_000,
      'd',
      1,
      'timeout',
    ]) as StatusHistory['incidents'];
    const copies = many.map((i) => [
      'livediagram:realtime',
      ...i.slice(1),
    ]) as StatusHistory['incidents'];
    await render(withHistory({ ...HISTORY, incidents: [...many, ...copies] }));
    const section = host!.querySelector('[aria-labelledby="status-incidents"]')!;
    expect(section.querySelectorAll('[data-incident="livediagram:realtime"]')).toHaveLength(0);
    expect(section.querySelectorAll('[data-incident]')).toHaveLength(10);
    const more = section.querySelector('button')!;
    expect(more.textContent).toBe('Show all 12');
    await act(async () => more.click());
    expect(section.querySelectorAll('[data-incident]')).toHaveLength(12);
  });

  it('says when there are no incidents', async () => {
    await render(withHistory({ ...HISTORY, incidents: [] }));
    expect(host!.querySelector('[aria-labelledby="status-incidents"]')?.textContent).toContain(
      'No incidents in the last 90 days.',
    );
  });

  it('falls back to the live checks alone, quietly, without the Worker or before its first run', async () => {
    await render(fetchWhere(/$^/));
    expect(host!.querySelector('[data-history="unavailable"]')?.textContent).toContain(
      'shows your browser’s live checks alone',
    );
    expect(host!.querySelector('[role="img"]')).toBeNull();
    expect(host!.querySelector('[aria-labelledby="status-incidents"]')).toBeNull();
    expect(row('livediagram:api')?.getAttribute('data-state')).toBe('up');

    act(() => root!.unmount());
    root = createRoot(host!);
    await render(withHistory({ ...HISTORY, at: null, latest: {}, services: {}, incidents: [] }));
    expect(host!.querySelector('[data-history="unavailable"]')).not.toBeNull();
  });
});

describe('Check now', () => {
  // The clock and the board's tick are faked; the checks' own timeouts stay real.
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('checks once on load, never again on its own, and rests 30 s after each round', async () => {
    const answer = fetchWhere(/$^/);
    let checks = 0;
    await render(async (input, init) => {
      if (!String(input instanceof Request ? input.url : input).includes('/history')) checks++;
      return answer(input, init);
    });
    const first = checks;
    expect(first).toBeGreaterThan(0);
    const button = [...host!.querySelectorAll('button')].find((b) =>
      b.textContent?.includes('Check now'),
    )!;
    expect(button.disabled).toBe(true);
    expect(host!.textContent).toContain('in 30 s');

    // Ten minutes open: no round of its own, and Check now is ready.
    await act(async () => {
      vi.advanceTimersByTime(10 * 60_000);
    });
    expect(checks).toBe(first);
    expect(button.disabled).toBe(false);
    expect(host!.textContent).toContain('Ready');

    // One press, one round, then the rest again; a second press inside it does nothing.
    await act(async () => {
      button.click();
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(checks).toBe(first * 2);
    expect(button.disabled).toBe(true);
    await act(async () => {
      button.click();
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(checks).toBe(first * 2);
  });
});
