// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The first run's starts (docs/specs/013-workspace/explorer-home.md "First run"): Start Blank, Popular Templates
// with Browse All Templates, and Already Have Work? with the way back for someone signed out and the imports.

const { track } = vi.hoisted(() => ({ track: vi.fn() }));
vi.mock('@/lib/telemetry', () => ({ track }));
vi.mock('@/components/start/template-card', () => ({
  TemplatePicture: ({ kind }: { kind: string }) => <span data-testid={`picture-${kind}`} />,
}));
vi.mock('@/components/chrome/auth-shared', () => ({
  useAuthHrefs: () => ({ signInHref: '/sign-in?return=home' }),
}));

import { WELCOME_POPULAR } from '@/app/explorer/home/first-run-starts';
import { HomeWelcome } from './HomeWelcome';

beforeEach(() => track.mockReset());
afterEach(cleanup);

const section = (name: string) => screen.getByRole('region', { name });

describe('HomeWelcome', () => {
  it('counts itself shown', () => {
    render(<HomeWelcome offerSignIn={false} />);
    expect(track).toHaveBeenCalledWith('Home', 'Opened', 'Welcome');
  });

  it('starts each mode blank at once', () => {
    render(<HomeWelcome offerSignIn={false} />);
    const links = within(section('Start Blank')).getAllByRole('link');
    expect(links.map((l) => l.getAttribute('href'))).toEqual([
      '/new?template=blank-illustration',
      '/new?template=blank-slide-deck',
      '/new?template=blank-article',
      '/new?template=blank-infographic',
      '/new?template=blank-logo',
    ]);
    fireEvent.click(links[0]!);
    expect(track).toHaveBeenLastCalledWith('Home', 'Selected', 'Welcome.Blank');
  });

  it('offers the popular templates and a way to all of them', () => {
    render(<HomeWelcome offerSignIn={false} />);
    const popular = section('Popular Templates');
    const starts = popular.querySelectorAll('[data-welcome-start]');
    expect(starts).toHaveLength(WELCOME_POPULAR.length);
    expect(starts[0]!.getAttribute('href')).toBe('/new?template=article');
    fireEvent.click(starts[0]!);
    expect(track).toHaveBeenLastCalledWith('Home', 'Selected', 'Welcome.Template');
    const all = within(popular).getByRole('link', { name: 'Browse All Templates' });
    expect(all.getAttribute('href')).toBe('/new');
  });

  it('offers the way back to someone who may have been signed out', () => {
    render(<HomeWelcome offerSignIn />);
    const have = section('Already Have Work?');
    expect(within(have).getByText('Nothing here yet? Sign in')).toBeTruthy();
    const signIn = within(have).getByRole('link', { name: 'Sign In' });
    expect(signIn.getAttribute('href')).toBe('/sign-in?return=home');
    fireEvent.click(signIn);
    expect(track).toHaveBeenLastCalledWith('Home', 'Selected', 'Welcome.SignIn');
  });

  it('leaves Already Have Work? out for someone with nothing to come back to', () => {
    render(<HomeWelcome offerSignIn={false} />);
    expect(screen.queryByRole('region', { name: 'Already Have Work?' })).toBeNull();
  });
});
