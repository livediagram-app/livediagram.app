// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Session } from '@/lib/session';

// Work Tracker 997: signed in, the front door still asked the person to create an account below the hero. Now each
// account ask below it offers the way on instead, and signed out (or not yet known) nothing changes.

let session: Session = { state: 'checking' };
vi.mock('@/lib/session', () => ({ useSession: () => session }));

const { AccountTileLink, ClosingActions, SignUpPromise } = await import('./AccountActions');

afterEach(cleanup);

function page() {
  const { container } = render(
    <>
      <span data-promise="">
        <SignUpPromise />
      </span>
      <AccountTileLink />
      <ClosingActions />
    </>,
  );
  const links = [...container.querySelectorAll('a')].map((a) => [
    a.textContent?.replace('→', '').trim(),
    a.getAttribute('href'),
  ]);
  return { text: container.textContent ?? '', links, container };
}

describe('the front door’s account asks', () => {
  for (const state of ['checking', 'out'] as const) {
    it(`asks for an account while ${state === 'out' ? 'signed out' : 'it checks'}`, () => {
      session = { state };
      const { text, links } = page();
      expect(links).toEqual([
        ['Create your account', '/sign-up?return=%2F'],
        ['Create your free account', '/sign-up?return=%2F'],
        ['Pick an app', '#apps'],
      ]);
      expect(text).toContain('No sign-up needed');
      expect(text).toContain('Or start your work as a guest without signing in at all.');
    });
  }

  it('signed in, offers the Explorer and the apps, and no sign-up anywhere', () => {
    session = { state: 'in', name: 'Ada', fullName: 'Ada L', colour: null, picture: null };
    const { text, links, container } = page();
    expect(links).toEqual([
      ['Open your Explorer', '/explorer'],
      ['Open Explorer', '/explorer'],
      ['Pick an app', '#apps'],
    ]);
    expect(text).not.toMatch(/sign[- ]?up|create your|without signing in/i);
    expect(links.some(([, href]) => href?.includes('/sign-up'))).toBe(false);
    expect(text).toContain('You’re signed in to every app.');
    expect(container.querySelector('[data-closing-actions="signed-in"]')).not.toBeNull();
  });

  it('keeps the same lines and buttons either way, so the swap moves nothing', () => {
    session = { state: 'out' };
    const out = page();
    const shape = (c: HTMLElement) =>
      [...c.querySelectorAll('[data-closing-actions] *')].map((el) => el.tagName).join(',');
    const outShape = shape(out.container);
    cleanup();
    session = { state: 'in', name: 'Ada', fullName: null, colour: null, picture: null };
    expect(shape(page().container)).toBe(outShape);
  });
});
