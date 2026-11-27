// @vitest-environment jsdom

// Sessions on Start Planning (docs/specs/026-plan/session-tabs.md "Making one"): a Sessions entry on the rail with a
// Refinement card that hands its kind on; a search for a meeting word finds it; without `onSession` (a Participant or
// a Viewer, who may not make tabs) there is none.
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetCommunityEnabledForTests } from '@liveworkspace/community-ui';
import { resetCommunityStartForTests } from '@liveworkspace/community-ui/start';
import { StartPlanning } from './StartPlanning';

vi.mock('@/components/plan/PlanContext', () => ({ usePlan: () => null }));
vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));
vi.mock('@/components/connect/useConnectStart', () => ({ useConnectStart: () => undefined }));

beforeEach(() => {
  resetCommunityStartForTests();
  resetCommunityEnabledForTests();
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => Response.json({ categories: {}, communityEnabled: false })),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const rail = () => screen.getByRole('navigation', { name: 'Categories' });

describe('Start Planning: Sessions', () => {
  it('an Editor picks Refinement from Sessions', () => {
    const onSession = vi.fn();
    render(<StartPlanning onPickBoard={vi.fn()} onSession={onSession} />);
    fireEvent.click(within(rail()).getByRole('button', { name: /^Sessions/ }));
    expect(screen.getByRole('heading', { name: 'Sessions' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /^Refinement/ }));
    expect(onSession).toHaveBeenCalledWith('refinement');
  });

  it('an Editor picks Sprint Planning from Sessions, and a search for capacity finds it', () => {
    const onSession = vi.fn();
    render(<StartPlanning onPickBoard={vi.fn()} onSession={onSession} />);
    fireEvent.click(within(rail()).getByRole('button', { name: /^Sessions/ }));
    fireEvent.click(screen.getByRole('button', { name: /^Sprint Planning/ }));
    expect(onSession).toHaveBeenCalledWith('planning');
    fireEvent.change(screen.getByRole('textbox', { name: /Find a board/ }), {
      target: { value: 'capacity' },
    });
    expect(screen.getByRole('button', { name: /^Sprint Planning/ })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^Refinement/ })).toBeNull();
  });

  it('a search for grooming finds it', () => {
    render(<StartPlanning onPickBoard={vi.fn()} onSession={vi.fn()} />);
    fireEvent.change(screen.getByRole('textbox', { name: /Find a board/ }), {
      target: { value: 'grooming' },
    });
    expect(screen.getByRole('button', { name: /^Refinement/ })).toBeTruthy();
  });

  it('a Participant or Viewer has no Sessions', () => {
    render(<StartPlanning onPickBoard={vi.fn()} />);
    expect(within(rail()).queryByRole('button', { name: /^Sessions/ })).toBeNull();
  });
});
