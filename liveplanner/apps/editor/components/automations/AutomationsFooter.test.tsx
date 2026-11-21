// @vitest-environment jsdom
// docs/specs/026-plan/automations.md "Where it lives" and "Who may do what": the footer's Automations button is an
// Editor of the whole plan's (a Participant, a Viewer, a tab link and an embed see none), its amber dot says a rule
// paused, and it opens the screen. On a plan kept Offline it opens Share's sync gate with the Automations copy,
// and once synced goes on to the screen. The host reads the list once the plan settles.
import './test-kit';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useMemo, useState } from 'react';
import { ChromeControls } from '@/components/chrome/ChromeControls';
import { AUTOMATIONS_FIRST_READ_MS } from '@liveworkspace/automations-ui/AutomationsHost';
import { toolBadges } from '@/components/dialogs/tool-gate';
import { PlanAutomationsHost } from './PlanAutomationsHost';
import { automationsScopeFor } from '@liveworkspace/automations-ui/automations-gate';
import { useAutomationsGate } from '@liveworkspace/automations-ui/use-automations-gate';
import { forgetAutomations } from './use-automations';
import { rule } from './test-fixtures';

const listAutomations = vi.hoisted(() => vi.fn());
vi.mock('./automations-client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./automations-client')>()),
  listAutomations,
}));
const track = vi.hoisted(() => vi.fn());
vi.mock('@/lib/telemetry', () => ({ track }));
vi.mock('./PlanAutomationsScreen', () => ({
  PlanAutomationsScreen: () => <div role="dialog" aria-label="Automations" />,
}));
const toast = vi.hoisted(() => ({ info: vi.fn(), success: vi.fn(), error: vi.fn() }));
vi.mock('@liveworkspace/workbench/hooks/ui/useToast', () => ({ useToast: () => toast }));

// The gate is its own chunk: load it once up front, so a test's first open doesn't wait on the import.
await import('./PlanAutomationsGate');
await import('./PlanAutomationsScreen');

const ITEMS = { ownerId: 'o1', itemId: 'p1', shareCode: null, tabId: null };
const EDITOR = {
  level: 'edit' as const,
  structureReadOnly: false,
  offline: false,
  hydrated: true,
  embed: false,
  signedIn: true,
  authLoaded: true,
  scope: ITEMS,
};

function Footer({
  ready = true,
  sync = async () => {},
  ...initial
}: Parameters<typeof automationsScopeFor>[0] & { ready?: boolean; sync?: () => Promise<void> }) {
  // Syncing moves the plan to the server: the gate's input flips, as the editor's does.
  const [gate, setGate] = useState(initial);
  const syncs = async () => {
    await sync();
    setGate((g) => ({ ...g, offline: false }));
  };
  const { signedIn, offline } = gate;
  const badges = useMemo(() => toolBadges({ signedIn, offline }), [signedIn, offline]);
  const door = useAutomationsGate({ ...gate, ready, sync: syncs, badges });
  return (
    <PlanAutomationsHost scope={automationsScopeFor(gate)} plan={undefined} gate={door}>
      <ChromeControls onOpenSearch={() => {}} onOpenSettings={() => {}} />
    </PlanAutomationsHost>
  );
}

// Automations is a row in the footer's Tools menu (liveworkspace/docs/specs/004-index/footer-tools-menu.md).
const toolsButton = () => screen.getByRole('button', { name: /^Tools/ });
function automationsRow(): HTMLElement | null {
  if (toolsButton().getAttribute('aria-expanded') !== 'true') fireEvent.click(toolsButton());
  return document.querySelector<HTMLElement>('[data-tools-item="automations"]');
}
const openAutomations = () => fireEvent.click(automationsRow()!);

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
  it('is a row in Tools for an Editor, and opens the screen', async () => {
    render(<Footer {...EDITOR} />);
    const labels = [...document.querySelectorAll('button')].map((b) =>
      b.getAttribute('aria-label'),
    );
    expect(labels.indexOf('Settings')).toBe(labels.indexOf('Tools') + 1);
    openAutomations();
    expect(track).toHaveBeenCalledWith('UI', 'Opened', 'Automations');
    await act(async () => {});
    expect(screen.getByRole('dialog', { name: 'Automations' })).toBeTruthy();
  });

  it.each([
    ['a Participant', { level: 'participate' as const, structureReadOnly: true }],
    ['a Viewer', { level: 'view' as const, structureReadOnly: true }],
    ['a tab-scoped link', { scope: { ...ITEMS, tabId: 't1' } }],
    ['an embed', { embed: true }],
    ['a Viewer of a plan kept Offline', { offline: true, level: 'view' as const }],
    ['an embedded plan kept Offline', { offline: true, embed: true }],
  ])('is not drawn for %s', (_who, over) => {
    render(<Footer {...EDITOR} {...over} />);
    expect(automationsRow()).toBeNull();
    act(() => {
      vi.advanceTimersByTime(AUTOMATIONS_FIRST_READ_MS);
    });
    expect(listAutomations).not.toHaveBeenCalled();
  });

  it('reads the list once the plan settles, and shows the amber dot on Tools while a rule is paused', async () => {
    listAutomations.mockResolvedValue({
      rules: [rule({ enabled: false, paused: { reason: 'x', at: 1 } })],
      runsToday: 0,
      runsPerDay: 1000,
    });
    render(<Footer {...EDITOR} />);
    expect(listAutomations).not.toHaveBeenCalled();
    await act(async () => vi.advanceTimersByTime(AUTOMATIONS_FIRST_READ_MS));
    expect(listAutomations).toHaveBeenCalledOnce();
    expect(toolsButton().getAttribute('aria-label')).toBe('Tools, a rule is paused');
    expect(document.querySelector('[data-tools-attention="amber"]')).toBeTruthy();
    automationsRow();
    expect(document.querySelector('[data-automations-count]')).toBeNull();
  });

  it('counts the rules that are on in a badge, amber while one is paused, and none at 0', async () => {
    listAutomations.mockResolvedValue({
      rules: [
        rule({ id: 'a', enabled: true }),
        rule({ id: 'b', enabled: true, paused: { reason: 'x', at: 1 } }),
        rule({ id: 'c', enabled: false }),
      ],
      runsToday: 0,
      runsPerDay: 1000,
    });
    render(<Footer {...EDITOR} />);
    await act(async () => vi.advanceTimersByTime(AUTOMATIONS_FIRST_READ_MS));
    expect(toolsButton().getAttribute('aria-label')).toBe('Tools, a rule is paused');
    automationsRow();
    const badge = document.querySelector('[data-automations-count]')!;
    expect(badge.textContent).toBe('2');
    expect(badge.className).toContain('bg-amber-500');
    // Dark text on the amber, readable in both themes (white on amber-500 is 2.1:1).
    expect(badge.className).toContain('text-amber-950');
  });

  it('asks to sync a plan kept Offline first, as Share does, then goes on to the screen', async () => {
    vi.useRealTimers();
    const sync = vi.fn(async () => {});
    render(<Footer {...EDITOR} offline sync={sync} />);
    openAutomations();
    expect(track).toHaveBeenCalledWith('UI', 'Opened', 'AutomationsOffline');
    // The gate opens as Automations' own modal, in the shared plain words.
    const gate = (await screen.findByText(/You need to sync this plan/)).closest<HTMLElement>(
      '[role="dialog"]',
    )!;
    expect(gate.textContent).toContain(
      'You need to sync this plan to our servers to use Automations',
    );
    expect(gate.querySelector('[data-prompt-glyph]')!.getAttribute('data-prompt-glyph')).toBe(
      'cloud-off',
    );
    // No rules to read until it is synced.
    expect(listAutomations).not.toHaveBeenCalled();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Sync Plan' }));
    });
    expect(sync).toHaveBeenCalledOnce();
    expect(toast.success).toHaveBeenCalledOnce();
    // The same opening goes on: the screen (mocked here as its dialog) in place of the gate.
    await waitFor(() => expect(screen.queryByText(/You need to sync this plan/)).toBeNull());
    expect(await screen.findByRole('dialog', { name: 'Automations' })).toBeTruthy();
  });

  it('keeps Sync Plan shut until the reader is known, and Cancel closes the gate', async () => {
    vi.useRealTimers();
    const sync = vi.fn(async () => {});
    render(<Footer {...EDITOR} offline ready={false} sync={sync} />);
    openAutomations();
    await screen.findByText(/You need to sync this plan/);
    expect(screen.getByRole('button', { name: 'Sync Plan' })).toHaveProperty('disabled', true);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByText(/You need to sync this plan/)).toBeNull();
    expect(sync).not.toHaveBeenCalled();
  });

  it('keeps the gate open and says why when the sync fails', async () => {
    vi.useRealTimers();
    const sync = vi.fn(async () => {
      throw new Error('offline');
    });
    render(<Footer {...EDITOR} offline sync={sync} />);
    openAutomations();
    await screen.findByText(/You need to sync this plan/);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Sync Plan' }));
    });
    expect(toast.error).toHaveBeenCalledOnce();
    expect(screen.getByText(/You need to sync this plan/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Sync Plan' })).toHaveProperty('disabled', false);
  });

  it('asks a guest on a server plan to sign in, coming back with the screen open', async () => {
    vi.useRealTimers();
    window.history.replaceState(null, '', '/project/p1?s=abc#t=board');
    render(<Footer {...EDITOR} signedIn={false} />);
    openAutomations();
    expect(track).toHaveBeenCalledWith('UI', 'Opened', 'AutomationsSignIn');
    // The gate opens as Automations' own modal, in the shared plain words.
    const gate = (
      await screen.findByText(/You need to sign in to a liveworkspace/)
    ).closest<HTMLElement>('[role="dialog"]')!;
    expect(gate.textContent).toContain(
      'You need to sign in to a liveworkspace account to use Automations',
    );
    expect(gate.querySelector('[data-prompt-glyph]')!.getAttribute('data-prompt-glyph')).toBe(
      'person',
    );
    expect(screen.queryByRole('button', { name: 'Sync Plan' })).toBeNull();
    const href = screen.getByRole('link', { name: 'Sign In' }).getAttribute('href')!;
    const back = decodeURIComponent(href.split('redirect_url=')[1]!);
    expect(back).toBe('/project/p1?s=abc&automations=1#t=board');
    // A guest has no rules to read and no Only an Editor Can See Rules.
    expect(listAutomations).not.toHaveBeenCalled();
    expect(screen.queryByText('Only an Editor Can See Rules')).toBeNull();
  });

  it('waits for sign-in to answer before offering the guest gate', () => {
    render(<Footer {...EDITOR} signedIn={false} authLoaded={false} />);
    expect(automationsRow()).toBeNull();
  });

  it('opens on the rules when the page comes back from sign-in, dropping the ask', async () => {
    vi.useRealTimers();
    window.history.replaceState(null, '', '/project/p1?automations=1#t=board');
    render(<Footer {...EDITOR} />);
    expect(await screen.findByRole('dialog', { name: 'Automations' })).toBeTruthy();
    expect(window.location.search).toBe('');
    expect(window.location.hash).toBe('#t=board');
  });
});
