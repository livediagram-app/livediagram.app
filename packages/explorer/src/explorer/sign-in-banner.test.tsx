import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createFakeIndex } from '../test/fakeClient';
import { Explorer, type ExplorerProps } from './Explorer';
import { SIGN_IN_BANNER_KEY } from './SignInBanner';

const props = (over: Partial<ExplorerProps> = {}): ExplorerProps => ({
  app: 'liveplanner',
  client: createFakeIndex().client,
  view: { kind: 'recent' },
  onNavigate: vi.fn(),
  itemHref: (i) => `/open/${i.id}`,
  onCreate: vi.fn(),
  signInHref: '/sign-in?next=/explorer',
  ...over,
});

afterEach(() => localStorage.clear());

describe('a guest’s sign-in banner', () => {
  it('shows a guest Sign In, the reasons and a close the browser remembers, each reported', async () => {
    const onTelemetry = vi.fn();
    const { unmount } = render(
      <Explorer {...props({ signedIn: false, signInBanner: { onTelemetry, helpHref: '/h' } })} />,
    );
    const banner = await screen.findByRole('region', { name: 'Sign in' });
    expect(banner.querySelector('a')!.getAttribute('href')).toBe('/sign-in?next=/explorer');
    fireEvent.click(screen.getByRole('button', { name: 'Learn More' }));
    expect(onTelemetry).toHaveBeenCalledWith('Opened', 'SignInReasonsExplorer');
    expect(await screen.findByRole('dialog', { name: 'Why sign in' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Guests and accounts' }).getAttribute('href')).toBe(
      '/h',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Not Now' }));
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(onTelemetry).toHaveBeenCalledWith('Closed', 'SignInBannerExplorer');
    expect(screen.queryByRole('region', { name: 'Sign in' })).toBeNull();
    expect(localStorage.getItem(SIGN_IN_BANNER_KEY)).toBe('1');
    unmount();
    // Closed once, it stays closed.
    render(<Explorer {...props({ signedIn: false, signInBanner: { onTelemetry } })} />);
    await act(async () => {});
    expect(screen.queryByRole('region', { name: 'Sign in' })).toBeNull();
  });

  it('is never shown to an account, or without the host asking for it', async () => {
    render(<Explorer {...props({ signedIn: true, signInBanner: {} })} />);
    render(<Explorer {...props({ signedIn: false })} />);
    await act(async () => {});
    expect(screen.queryByRole('region', { name: 'Sign in' })).toBeNull();
  });
});
