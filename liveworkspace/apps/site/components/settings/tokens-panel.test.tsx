// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TokensPanel } from './TokensPanel';

// Settings › API Tokens (liveworkspace/docs/specs/010-site/site.md "Settings"): making a token and seeing it once,
// copying it, and revoking one, by keyboard as well as by pointer.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const TOKEN = {
  id: 't1',
  name: 'Weekly report',
  readOnly: false,
  createdAt: 1_790_000_000_000,
  lastUsedAt: null,
  expiresAt: 1_800_000_000_000,
};

let tokens = [TOKEN];
const json = (status: number, body: unknown) =>
  Promise.resolve(new Response(JSON.stringify(body), { status }));

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  tokens = [TOKEN];
  vi.stubGlobal(
    'fetch',
    vi.fn((_url: string, init?: RequestInit) => {
      if (init?.method === 'POST')
        return json(201, { ...TOKEN, id: 't2', name: 'New', secret: 'lwt_secret' });
      if (init?.method === 'DELETE') {
        tokens = [];
        return json(200, {});
      }
      return json(200, { tokens });
    }),
  );
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
const button = (name: string) =>
  [...container.querySelectorAll('button')].find((b) => b.textContent === name)!;
const press = async (name: string) => {
  const b = button(name);
  b.focus();
  await act(async () => b.click());
  await settle();
};

describe('API Tokens', () => {
  it('moves focus to Keep when Revoke asks, and back to Revoke when kept', async () => {
    act(() => root.render(<TokensPanel />));
    await settle();
    await press('Revoke');
    expect(document.activeElement).toBe(button('Keep'));
    await press('Keep');
    expect(document.activeElement).toBe(button('Revoke'));
  });

  it('puts focus on the list’s heading once a token is revoked, not on the page', async () => {
    act(() => root.render(<TokensPanel />));
    await settle();
    await press('Revoke');
    await press('Revoke now');
    expect(document.activeElement?.textContent).toBe('Your tokens');
  });

  it('says so and selects the token when the browser refuses the clipboard', async () => {
    const writeText = vi.fn(() => Promise.reject(new DOMException('denied', 'NotAllowedError')));
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });
    act(() => root.render(<TokensPanel />));
    await settle();
    await press('Make token');
    await press('Copy');
    expect(writeText).toHaveBeenCalledWith('lwt_secret');
    expect(container.querySelector('[role=alert]')?.textContent).toMatch(/didn’t let us copy/);
    expect(window.getSelection()?.toString()).toBe('lwt_secret');
  });

  it('returns focus to the name field when the new token is put away', async () => {
    act(() => root.render(<TokensPanel />));
    await settle();
    await press('Make token');
    await press('Done');
    expect(document.activeElement?.getAttribute('aria-label')).toBe('Token name');
  });
});
