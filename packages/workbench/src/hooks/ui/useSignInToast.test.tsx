// @vitest-environment jsdom
// The guest sign-in toast (docs/specs/014-identity/sign-in-encouragement.md): a standing toast with Sign In, raised
// about five minutes into a guest's session, never for an account, an embed, once closed or in zen mode, and taken
// down when it stops being wanted.
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@liveworkspace/ui/toast';
import { WORKBENCH_DEFAULTS, configureWorkbench } from '../../bindings';
import { SIGN_IN_TOAST_MESSAGE, useSignInToast } from './useSignInToast';

const push = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
  usePathname: () => '/document/abc/',
}));

// A key of its own per test: the store keeps what was written in memory for the session.
let run = 0;
let KEY = '';
const FIVE_MINUTES = 5 * 60_000;
const track = vi.fn();

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
  run += 1;
  KEY = `test:signin-dismissed:${run}`;
  configureWorkbench({ ...WORKBENCH_DEFAULTS, track });
  track.mockClear();
  push.mockClear();
});
afterEach(() => {
  configureWorkbench(WORKBENCH_DEFAULTS);
  vi.useRealTimers();
});

type Props = { accountUserId: string | null; appChrome: boolean; hidden: boolean };
const guest: Props = { accountUserId: null, appChrome: true, hidden: false };

function Host(props: Props) {
  useSignInToast({ dismissKey: KEY, ...props });
  return null;
}

function mount(props: Props) {
  const view = render(
    <ToastProvider>
      <Host {...props} />
    </ToastProvider>,
  );
  return {
    ...view,
    update: (next: Props) =>
      view.rerender(
        <ToastProvider>
          <Host {...next} />
        </ToastProvider>,
      ),
  };
}

const elapse = (ms: number) => act(() => void vi.advanceTimersByTime(ms));
const message = () => screen.queryByText(SIGN_IN_TOAST_MESSAGE);
// A toast leaving plays its exit, then the stack removes it.
const settle = () => elapse(1_000);

describe('useSignInToast', () => {
  it("raises a guest's standing toast after the delay, with Sign In alone", () => {
    mount(guest);
    expect(message()).toBeNull();
    elapse(FIVE_MINUTES);
    expect(message()).not.toBeNull();
    // A toast's usual width, in the green highlight look.
    const card = screen.getByRole('status');
    expect(card.className).toContain('sm:max-w-[36rem]');
    expect(card.hasAttribute('data-toast-highlight')).toBe(true);
    const buttons = screen.getAllByRole('button').map((b) => b.textContent);
    expect(buttons).toContain('Sign In');
    expect(buttons).not.toContain('Learn More');
    // Standing: it does not time out.
    elapse(60_000);
    expect(message()).not.toBeNull();
  });

  it('never shows for an account, in an embed, once dismissed or in zen mode', () => {
    for (const props of [
      { ...guest, accountUserId: 'u1' },
      { ...guest, appChrome: false },
      { ...guest, hidden: true },
    ]) {
      const view = mount(props);
      elapse(FIVE_MINUTES);
      expect(message()).toBeNull();
      view.unmount();
    }
    localStorage.setItem(KEY, '1');
    mount(guest);
    elapse(FIVE_MINUTES);
    expect(message()).toBeNull();
  });

  it('Sign In tracks the Selected event and goes to the sign-in page, back here after', () => {
    mount(guest);
    elapse(FIVE_MINUTES);
    fireEvent.click(screen.getByRole('button', { name: 'Sign In' }));
    expect(track).toHaveBeenCalledWith('UI', 'Selected', 'SignInBannerEditor');
    expect(push).toHaveBeenCalledWith(
      `/sign-in/?redirect_url=${encodeURIComponent(window.location.pathname)}`,
    );
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it('closing it tracks the Closed event and keeps it away in this browser', () => {
    mount(guest);
    elapse(FIVE_MINUTES);
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(track).toHaveBeenCalledWith('UI', 'Closed', 'SignInBannerEditor');
    expect(localStorage.getItem(KEY)).toBe('1');
    settle();
    expect(message()).toBeNull();
  });

  it('leaves when zen mode hides it or the guest signs in, without restarting the delay', () => {
    const view = mount(guest);
    elapse(FIVE_MINUTES);
    view.update({ ...guest, hidden: true });
    settle();
    expect(message()).toBeNull();
    view.update(guest);
    expect(message()).not.toBeNull();
    view.update({ ...guest, accountUserId: 'u1' });
    settle();
    expect(message()).toBeNull();
    expect(track).not.toHaveBeenCalled();
  });

  it('is taken down when the editor closes', () => {
    function Page({ editor }: { editor: boolean }) {
      return <ToastProvider>{editor ? <Host {...guest} /> : null}</ToastProvider>;
    }
    const view = render(<Page editor />);
    elapse(FIVE_MINUTES);
    expect(message()).not.toBeNull();
    view.rerender(<Page editor={false} />);
    settle();
    expect(message()).toBeNull();
  });
});
