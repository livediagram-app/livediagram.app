// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/components/chrome/auth-shared', () => ({
  useAuthHrefs: () => ({ signInHref: '/sign-in/' }),
}));
vi.mock('@/components/chrome/AuthControls', () => ({ SignInIcon: () => null }));
vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

const { SignInBanner } = await import('./SignInBanner');
const { TOAST_FLOOR_CHANGED_EVENT, TOAST_FLOOR_SELECTOR } =
  await import('@/components/toast/toast-floor');

afterEach(cleanup);

describe('SignInBanner', () => {
  // docs/specs/014-identity/sign-in-encouragement.md: the headline names what an account opens up.
  it('invites a sign-in for Teams & AI, in one short line of reasons', () => {
    const view = render(<SignInBanner surface="Explorer" onDismiss={() => {}} />);
    expect(view.getByText('Sign in to access Teams & AI')).toBeTruthy();
    expect(
      view.getByText('Share with your team, build with AI, sync across devices.'),
    ).toBeTruthy();
  });

  // docs/specs/014-identity/sign-in-encouragement.md "Banner": white reads on it in light and dark alike. brand-500 and
  // brand-600 drew the words at 2.8:1 and 4.1:1, and the copy at 85% white under 3.4:1.
  it('is brand-700 to brand-800 in either appearance, its copy at 90% white', () => {
    const view = render(<SignInBanner surface="Explorer" onDismiss={() => {}} />);
    const card = view.container.querySelector('[data-toast-floor]')!;
    expect(card.className).toContain('from-brand-700 to-brand-800');
    expect(card.className).not.toMatch(/(from|to)-brand-[56]00/);
    expect(view.getByText(/Share with your team/).className).toContain('text-white/90');
  });

  // docs/specs/004-interface-design/forced-colors.md: forced colours drop the gradient; a solid fill under it keeps the
  // banner opaque over the canvas.
  it('has a solid fill under its gradient', () => {
    const view = render(<SignInBanner surface="Explorer" onDismiss={() => {}} />);
    const card = view.container.querySelector('[data-toast-floor]')!;
    expect(card.className).toMatch(/(^|\s)bg-brand-800(\s|$)/);
  });

  // docs/specs/014-identity/sign-in-encouragement.md "Banner": a sideways phone has little height to give.
  it('is one slim row on a phone held sideways', () => {
    render(<SignInBanner surface="Explorer" onDismiss={() => {}} />);
    expect(screen.getByText(/Share with your team/).className).toContain('landscape-phone:hidden');
  });

  // docs/specs/014-identity/sign-in-encouragement.md: a panel opened from the chrome reaches up into the banner's band.
  it('steps aside while a panel opened from the chrome is open', () => {
    render(<SignInBanner surface="Editor" onDismiss={() => {}} />);
    const wrapper = screen.getByText('Sign in to access Teams & AI').closest('.fixed')!;
    expect(wrapper.className).toContain(
      '[body:has([data-dock-button]_[aria-expanded=true])_&]:hidden',
    );
  });

  // docs/specs/004-interface-design/toasts.md "Placement": the toasts stand on the banner while it shows, rather
  // than landing on its words ("Document deleted · Undo" did). Its card is bottom chrome, and it says when it comes
  // and goes so a toast already up moves with it.
  it('is bottom chrome the toasts stand on, and says when it comes and goes', () => {
    const heard = vi.fn();
    window.addEventListener(TOAST_FLOOR_CHANGED_EVENT, heard);
    const view = render(<SignInBanner surface="Explorer" onDismiss={() => {}} />);
    const card = document.querySelector(TOAST_FLOOR_SELECTOR);
    expect(card?.textContent).toContain('Sign in to access Teams & AI');
    expect(heard).toHaveBeenCalledTimes(1);
    view.unmount();
    expect(heard).toHaveBeenCalledTimes(2);
    window.removeEventListener(TOAST_FLOOR_CHANGED_EVENT, heard);
  });
});
