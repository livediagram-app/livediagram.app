// A page load an app's router can't get from liveworkspace answers a styled page, not the plain line naming the
// origin (Work Tracker 1082; liveworkspace/docs/specs/003-accounts/accounts.md "An app's router").
import { afterEach, describe, expect, it, vi } from 'vitest';
import { isPageLoad, UNREACHABLE_PAGE_COPY, unreachablePage } from './unreachable-page';
import { FORWARD_DEADLINE_MS, routeToWorkspace } from './workspace-proxy';

const unreachable = (async () => {
  throw new Error('Network connection lost.');
}) as typeof fetch;

const page = (path: string, init: RequestInit = {}) =>
  new Request(`http://localhost:3400${path}`, {
    ...init,
    headers: { Accept: 'text/html,application/xhtml+xml', ...init.headers },
  });

afterEach(() => vi.useRealTimers());

describe('isPageLoad', () => {
  it('is a GET or HEAD asking for HTML, or a document navigation', () => {
    expect(isPageLoad(page('/explorer'))).toBe(true);
    expect(isPageLoad(page('/explorer', { method: 'HEAD' }))).toBe(true);
    expect(
      isPageLoad(new Request('http://x/explorer', { headers: { 'Sec-Fetch-Dest': 'document' } })),
    ).toBe(true);
  });

  it('is not a payload, an asset, an API call or a write', () => {
    expect(isPageLoad(new Request('http://x/explorer.txt', { headers: { Accept: '*/*' } }))).toBe(
      false,
    );
    expect(isPageLoad(new Request('http://x/api/workspace/account/teams'))).toBe(false);
    expect(isPageLoad(page('/api/workspace/auth/sign-in', { method: 'POST' }))).toBe(false);
  });
});

describe('unreachablePage', () => {
  it('says what happened, with Try Again and the status page, keeping the status and no-store', async () => {
    const res = unreachablePage(502, 'https://www.liveworkspace.app/status#livedesign');
    expect(res.status).toBe(502);
    expect(res.headers.get('Content-Type')).toBe('text/html; charset=utf-8');
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    // No script runs on it: its own policy allows its inline styles alone.
    expect(res.headers.get('Content-Security-Policy')).toMatch(/^default-src 'none'; style-src/);
    const html = await res.text();
    expect(html).toContain(`<h1>${UNREACHABLE_PAGE_COPY.title}</h1>`);
    expect(html).toContain(UNREACHABLE_PAGE_COPY.body);
    expect(html).toContain(`<a class="retry" href="">${UNREACHABLE_PAGE_COPY.retry}</a>`);
    expect(html).toContain('href="https://www.liveworkspace.app/status#livedesign"');
    expect(html).not.toContain('<script');
    expect(html).not.toContain('could not be reached');
  });

  it('escapes the status address it is given', async () => {
    const html = await unreachablePage(504, 'https://x/"><b>&').text();
    expect(html).toContain('href="https://x/&quot;&gt;&lt;b&gt;&amp;"');
  });
});

describe('the Explorer on an app’s address, liveworkspace down', () => {
  it('answers a page load with the styled page, on the router’s status', async () => {
    const res = await routeToWorkspace(page('/explorer'), {
      app: 'livedesign',
      origin: 'http://localhost:3000',
      fetch: unreachable,
    });
    expect(res!.status).toBe(502);
    expect(res!.headers.get('Content-Type')).toBe('text/html; charset=utf-8');
    const html = await res!.text();
    expect(html).toContain(UNREACHABLE_PAGE_COPY.title);
    expect(html).toContain('href="http://localhost:3000/status#livedesign"');
  });

  it('answers a stalled page load at the deadline with the page too', async () => {
    vi.useFakeTimers();
    const stalled = ((_input: RequestInfo | URL, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
      })) as typeof fetch;
    const pending = routeToWorkspace(
      new Request('https://www.livedesign.app/explorer', { headers: { Accept: 'text/html' } }),
      { app: 'livedesign', fetch: stalled },
    );
    await vi.advanceTimersByTimeAsync(FORWARD_DEADLINE_MS);
    const res = await pending!;
    expect(res.status).toBe(504);
    expect(await res.text()).toContain(UNREACHABLE_PAGE_COPY.title);
  });

  it('keeps the plain line for what is not a page load', async () => {
    const res = await routeToWorkspace(
      new Request('http://localhost:3400/explorer.txt', { headers: { Accept: '*/*' } }),
      { app: 'livedesign', origin: 'http://localhost:3000', fetch: unreachable },
    );
    expect(res!.status).toBe(502);
    expect(await res!.text()).toBe(
      'router: liveworkspace at http://localhost:3000 could not be reached',
    );
  });
});
