// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The first run's starts (docs/specs/013-workspace/explorer-home.md "First run"): Start Blank, Popular Templates
// with Browse All Templates, and Already Have Work? with the way back for someone signed out and the imports.

import { WELCOME_POPULAR } from '@/app/explorer/home/first-run-starts';

const { track } = vi.hoisted(() => ({ track: vi.fn() }));
vi.mock('@/lib/telemetry', () => ({ track }));
vi.mock('@/components/start/template-card', async () => {
  const { TEMPLATES } = await import('@liveplanner/templates');
  return {
    TemplatePicture: ({ kind }: { kind: string }) => <span data-testid={`picture-${kind}`} />,
    templateOf: (kind: string) => TEMPLATES.find((t) => t.kind === kind)!,
  };
});
vi.mock('@/components/chrome/auth-shared', () => ({
  useAuthHrefs: () => ({ signInHref: '/sign-in?return=home' }),
}));

import { HomeWelcome } from './HomeWelcome';

beforeEach(() => track.mockReset());
afterEach(cleanup);

const section = (name: string) => screen.getByRole('region', { name });

describe('HomeWelcome', () => {
  it('counts itself shown', () => {
    render(<HomeWelcome offerSignIn={false} />);
    expect(track).toHaveBeenCalledWith('Home', 'Opened', 'Welcome');
  });

  it("starts each of Plan's blanks at once", () => {
    render(<HomeWelcome offerSignIn={false} />);
    const links = within(section('Start Blank')).getAllByRole('link');
    expect(links.map((l) => l.getAttribute('href'))).toEqual([
      '/new?template=blank-plan',
      '/new?template=blank-spreadsheet',
      '/new?template=blank-form',
    ]);
    fireEvent.click(links[0]!);
    expect(track).toHaveBeenLastCalledWith('Home', 'Selected', 'Welcome.Blank');
  });

  it("offers Plan's popular templates, up to eight, and a way to all of them", () => {
    render(<HomeWelcome offerSignIn={false} />);
    const popular = section('Popular Templates');
    const starts = popular.querySelectorAll('[data-welcome-start]');
    expect(starts.length).toBeGreaterThan(0);
    expect(starts.length).toBeLessThanOrEqual(8);
    expect([...starts].map((a) => a.getAttribute('data-welcome-start'))).toEqual([
      ...WELCOME_POPULAR,
    ]);
    expect(starts[0]!.getAttribute('href')).toBe(`/new?template=${WELCOME_POPULAR[0]}`);
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

  it('offers the imports beside it', () => {
    render(
      <HomeWelcome
        offerSignIn={false}
        importToolbar={<button type="button">Import from</button>}
      />,
    );
    const have = section('Already Have Work?');
    expect(within(have).getByText('Bring It With You')).toBeTruthy();
    expect(within(have).getByRole('button', { name: 'Import from' })).toBeTruthy();
    expect(within(have).queryByText('Nothing here yet? Sign in')).toBeNull();
  });

  it('leaves Already Have Work? out with neither', () => {
    render(<HomeWelcome offerSignIn={false} />);
    expect(screen.queryByRole('region', { name: 'Already Have Work?' })).toBeNull();
  });
});
