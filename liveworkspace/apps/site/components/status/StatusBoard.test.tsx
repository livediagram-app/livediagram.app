// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
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
