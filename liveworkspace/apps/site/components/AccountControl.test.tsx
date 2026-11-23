// @vitest-environment jsdom
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Session } from '@/lib/session';

// The header's account control (liveworkspace/docs/specs/010-site/site.md "The header"): the subscription provider
// comes around the signed-in menu from its own chunk, only where Pro is on and the page has none of its own
// (liveworkspace/docs/specs/010-site/blueprints/site.md "Performance and limits").
const state = vi.hoisted(() => ({
  pro: true,
  session: { state: 'checking' } as Session,
  wraps: 0,
}));
vi.mock('@liveworkspace/subscription-ui/flag', () => ({ proOn: () => state.pro }));
vi.mock('@/lib/session', () => ({ useSession: () => state.session, signOut: vi.fn() }));
vi.mock('@/components/subscription/SiteSubscription', () => ({
  SiteSubscription: ({ account, children }: { account: string; children: ReactNode }) => {
    state.wraps += 1;
    return <div data-subscription={account}>{children}</div>;
  },
}));

const { AccountControl } = await import('./AccountControl');

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const SIGNED_IN: Session = {
  state: 'in',
  name: 'Ada',
  fullName: 'Ada Lovelace',
  colour: null,
  picture: null,
};

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  state.pro = true;
  state.session = { state: 'checking' };
  state.wraps = 0;
});

const menuButton = () => host.querySelector<HTMLButtonElement>('button[aria-haspopup="menu"]');

describe('AccountControl', () => {
  it('holds the place unseen while checking, then is the Guest button for a visitor', () => {
    act(() => root.render(<AccountControl />));
    expect(host.querySelector('.invisible[aria-hidden]')).not.toBeNull();
    state.session = { state: 'out' };
    act(() => root.render(<AccountControl />));
    expect(host.querySelector('.invisible')).toBeNull();
    expect(menuButton()?.textContent).toContain('Guest');
    expect(state.wraps).toBe(0);
  });

  it('draws the signed-in menu inside the subscription provider once its code is in', async () => {
    state.session = SIGNED_IN;
    await act(async () => root.render(<AccountControl />));
    const wrap = host.querySelector('[data-subscription="in"]');
    expect(wrap?.querySelector('button[aria-haspopup="menu"]')?.textContent).toContain('Ada');
    expect(host.querySelector('.invisible')).toBeNull();
  });

  it('draws the menu at once, with no provider, where Pro is off', () => {
    state.pro = false;
    state.session = SIGNED_IN;
    act(() => root.render(<AccountControl />));
    expect(menuButton()?.textContent).toContain('Ada');
    expect(state.wraps).toBe(0);
  });

  it('adds no provider where the page has one around it', () => {
    state.session = SIGNED_IN;
    act(() => root.render(<AccountControl subscribed />));
    expect(menuButton()?.textContent).toContain('Ada');
    expect(state.wraps).toBe(0);
  });
});
