// @vitest-environment jsdom
// docs/specs/026-plan/automations.md "Where it lives" and "Who may do what": the footer's Automations button is an
// Editor of the whole plan's (a Participant, a Viewer, a tab link and an embed see none), its amber dot says a rule
// paused, and it opens the screen. On a plan in Browser Storage it opens Rules Run on Our Servers instead. The host
// reads the list once the plan settles.
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ChromeControls } from '@/components/chrome/ChromeControls';
import { AutomationsHost, AUTOMATIONS_FIRST_READ_MS } from './AutomationsHost';
import { automationsOfflineFor, automationsScopeFor } from './automations-gate';
import { forgetAutomations } from './use-automations';
import { rule } from './test-fixtures';

const listAutomations = vi.hoisted(() => vi.fn());
vi.mock('./automations-client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./automations-client')>()),
  listAutomations,
}));
const track = vi.hoisted(() => vi.fn());
vi.mock('@/lib/telemetry', () => ({ track }));
vi.mock('./AutomationsDialog', () => ({
  AutomationsDialog: () => <div role="dialog" aria-label="Automations" />,
}));
vi.mock('@/hooks/ui/useToast', () => ({
  useToast: () => ({ info: vi.fn(), success: vi.fn(), error: vi.fn() }),
}));

const ITEMS = { ownerId: 'o1', projectId: 'p1', shareCode: null, tabId: null };
const EDITOR = {
  level: 'edit' as const,
  structureReadOnly: false,
  offline: false,
  hydrated: true,
  embed: false,
  scope: ITEMS,
};

const save = vi.hoisted(() => vi.fn());
function Footer({
  signedIn = true,
  ...gate
}: Parameters<typeof automationsScopeFor>[0] & { signedIn?: boolean }) {
  const offline = automationsOfflineFor(gate)
    ? { signedIn, signInHref: '/sign-in/?return=/p1', save }
    : null;
  return (
    <AutomationsHost scope={automationsScopeFor(gate)} plan={undefined} offline={offline}>
      <ChromeControls onOpenSearch={() => {}} onOpenSettings={() => {}} />
    </AutomationsHost>
  );
}

beforeEach(() => {
  forgetAutomations();
  vi.clearAllMocks();
  vi.useFakeTimers();
  listAutomations.mockResolvedValue({ rules: [rule()], runsToday: 0, runsPerDay: 1000 });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('the Automations button', () => {
  it('sits between Search and Settings for an Editor, and opens the screen', async () => {
    render(<Footer {...EDITOR} />);
    const labels = [...document.querySelectorAll('button')].map((b) =>
      b.getAttribute('aria-label'),
    );
    expect(labels.indexOf('Automations')).toBe(labels.indexOf('Search') + 1);
    expect(labels.indexOf('Settings')).toBe(labels.indexOf('Automations') + 1);
    fireEvent.click(screen.getByRole('button', { name: 'Automations' }));
    expect(track).toHaveBeenCalledWith('UI', 'Opened', 'Automations');
    await act(async () => {});
    expect(screen.getByRole('dialog', { name: 'Automations' })).toBeTruthy();
  });

  it.each([
    ['a Participant', { level: 'participate' as const, structureReadOnly: true }],
    ['a Viewer', { level: 'view' as const, structureReadOnly: true }],
    ['a tab-scoped link', { scope: { ...ITEMS, tabId: 't1' } }],
    ['an embed', { embed: true }],
    ['a Viewer of a plan in Browser Storage', { offline: true, level: 'view' as const }],
    ['an embedded plan in Browser Storage', { offline: true, embed: true }],
  ])('is not drawn for %s', (_who, over) => {
    render(<Footer {...EDITOR} {...over} />);
    expect(screen.queryByRole('button', { name: /Automations/ })).toBeNull();
    act(() => {
      vi.advanceTimersByTime(AUTOMATIONS_FIRST_READ_MS);
    });
    expect(listAutomations).not.toHaveBeenCalled();
  });

  it('reads the list once the plan settles, and shows the amber dot while a rule is paused', async () => {
    listAutomations.mockResolvedValue({
      rules: [rule({ paused: { reason: 'x', at: 1 } })],
      runsToday: 0,
      runsPerDay: 1000,
    });
    render(<Footer {...EDITOR} />);
    expect(listAutomations).not.toHaveBeenCalled();
    await act(async () => vi.advanceTimersByTime(AUTOMATIONS_FIRST_READ_MS));
    expect(listAutomations).toHaveBeenCalledOnce();
    expect(screen.getByRole('button', { name: 'Automations, a rule is paused' })).toBeTruthy();
    expect(document.querySelector('[data-automations-paused]')).toBeTruthy();
  });

  it('opens Rules Run on Our Servers on a plan in Browser Storage, and saves it to the account', async () => {
    vi.useRealTimers();
    save.mockResolvedValueOnce(undefined);
    render(<Footer {...EDITOR} offline />);
    fireEvent.click(screen.getByRole('button', { name: 'Automations' }));
    expect(track).toHaveBeenCalledWith('UI', 'Opened', 'AutomationsOffline');
    const dialog = await screen.findByRole('dialog', { name: 'Rules Run on Our Servers' });
    expect(dialog.textContent).toContain('so they need it saved to your account.');
    expect(screen.getByText('How Rules Work').closest('a')).toBeTruthy();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Save to Your Account' }));
    });
    expect(save).toHaveBeenCalledOnce();
    expect(screen.queryByRole('dialog', { name: 'Rules Run on Our Servers' })).toBeNull();
    // No rules to read: the plan has none.
    expect(listAutomations).not.toHaveBeenCalled();
  });

  it('asks a guest on a plan in Browser Storage to sign in first', async () => {
    vi.useRealTimers();
    render(<Footer {...EDITOR} offline signedIn={false} />);
    fireEvent.click(screen.getByRole('button', { name: 'Automations' }));
    const link = await screen.findByRole('link', { name: 'Save to Your Account' });
    expect(link.getAttribute('href')).toBe('/sign-in/?return=/p1');
    expect(screen.getByText(/Sign in first/)).toBeTruthy();
  });

  it('keeps the panel open and says why when the save fails', async () => {
    vi.useRealTimers();
    save.mockRejectedValueOnce(new Error('offline'));
    render(<Footer {...EDITOR} offline />);
    fireEvent.click(screen.getByRole('button', { name: 'Automations' }));
    await screen.findByRole('dialog', { name: 'Rules Run on Our Servers' });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Save to Your Account' }));
    });
    expect(screen.getByRole('dialog', { name: 'Rules Run on Our Servers' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Save to Your Account' })).toHaveProperty(
      'disabled',
      false,
    );
  });
});
