// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The accounts API's `/get-session`, answered here: the accounts Worker adds the profile's colour to its user.
const call = vi.hoisted(() => vi.fn());
vi.mock('./accounts', async (original) => ({
  ...(await original<typeof import('./accounts')>()),
  call,
}));

let root: Root;
let host: HTMLDivElement;
beforeEach(() => {
  vi.resetModules();
  call.mockReset();
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

async function mount() {
  const session = await import('./session');
  function Show() {
    return <>{JSON.stringify(session.useSession())}</>;
  }
  await act(async () => root.render(<Show />));
  return { session, shown: () => JSON.parse(host.textContent ?? 'null') as unknown };
}

describe("the header's session", () => {
  it("carries the profile's colour from /get-session, and only one that is safe to paint", async () => {
    call.mockResolvedValue({
      ok: true,
      data: {
        user: {
          givenName: 'Ada',
          name: 'Ada Lovelace',
          color: '#ef4444',
          email: 'ada@example.com',
          createdAt: '2026-10-23T15:13:54.270Z',
        },
      },
    });
    const { shown } = await mount();
    // With the address and when the account was made, for Settings' Profile header.
    expect(shown()).toEqual({
      state: 'in',
      name: 'Ada',
      fullName: 'Ada Lovelace',
      colour: '#ef4444',
      email: 'ada@example.com',
      joined: '2026-10-23T15:13:54.270Z',
    });
    expect(call).toHaveBeenCalledTimes(1);
  });

  it('is null for Automatic, and for a colour that is not safe to paint', async () => {
    call.mockResolvedValue({ ok: true, data: { user: { name: 'Ada', color: 'url(x)' } } });
    const { shown } = await mount();
    expect(shown()).toMatchObject({ state: 'in', colour: null });
  });

  it('repaints at once when Settings › Profile picks a colour, with no request', async () => {
    call.mockResolvedValue({ ok: true, data: { user: { name: 'Ada', color: null } } });
    const { session, shown } = await mount();
    act(() => session.setSessionColour('#0ea5e9'));
    expect(shown()).toMatchObject({ colour: '#0ea5e9' });
    act(() => session.setSessionColour(null));
    expect(shown()).toMatchObject({ colour: null });
    expect(call).toHaveBeenCalledTimes(1);
  });
});
