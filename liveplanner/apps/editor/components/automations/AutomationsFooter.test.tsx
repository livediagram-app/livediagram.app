// @vitest-environment jsdom
// docs/specs/026-plan/automations.md "Where it lives" and "Who may do what": the footer's Automations button is an
// Editor of the whole plan's alone (a Participant, a Viewer, a tab link, an embed and Browser Storage see none), its
// amber dot says a rule paused, and it opens the screen. The host reads the list once the plan settles.
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ChromeControls } from '@/components/chrome/ChromeControls';
import { AutomationsHost, AUTOMATIONS_FIRST_READ_MS } from './AutomationsHost';
import { automationsScopeFor } from './automations-gate';
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

const ITEMS = { ownerId: 'o1', projectId: 'p1', shareCode: null, tabId: null };
const EDITOR = {
  level: 'edit' as const,
  structureReadOnly: false,
  offline: false,
  hydrated: true,
  embed: false,
  scope: ITEMS,
};

function Footer(gate: Parameters<typeof automationsScopeFor>[0]) {
  return (
    <AutomationsHost scope={automationsScopeFor(gate)} plan={undefined}>
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
    ['a plan in Browser Storage', { offline: true }],
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
});
