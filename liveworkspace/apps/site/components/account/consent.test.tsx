// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Consent } from './Consent';

// Allow access (liveworkspace/docs/specs/010-site/site.md "Accounts"): a client registered without our apps' trust
// asks here. Its answer goes to the accounts Worker; what comes back decides what the page says.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  window.history.replaceState(null, '', `/consent?client_id=${'x'.repeat(150)}&sig=s`);
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

const settle = () => act(async () => new Promise((r) => setTimeout(r, 0)));
const allow = async () => {
  const button = [...container.querySelectorAll('button')].find((b) => b.textContent === 'Allow')!;
  await act(async () => button.click());
  await settle();
};
const alertText = () => container.querySelector('[role=alert]')?.textContent ?? '';

describe('Consent', () => {
  it('wraps a long client id rather than running out of the card', async () => {
    act(() => root.render(<Consent />));
    expect(container.querySelector('strong')?.className).toContain('break-all');
  });

  it("isolates the client id, so an override in the address can't turn the sentence around", async () => {
    window.history.replaceState(null, '', '/consent?client_id=%E2%80%AEevil&sig=s');
    act(() => root.render(<Consent />));
    expect(container.querySelector('strong > bdi')?.textContent).toBe('\u202Eevil');
    expect(container.querySelector('h1')?.parentElement?.textContent).toContain(
      'wants to use your liveworkspace account.',
    );
  });

  it('says the connection failed, not that the request expired, when nothing answers', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new TypeError('Failed to fetch'))),
    );
    act(() => root.render(<Consent />));
    await allow();
    expect(alertText()).toMatch(/Couldn’t reach liveworkspace/);
  });

  it('says the request expired when the Worker turns it down', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(new Response('{}', { status: 401 }))),
    );
    act(() => root.render(<Consent />));
    await allow();
    expect(alertText()).toMatch(/That request has expired/);
  });
});
