// @vitest-environment jsdom
// docs/specs/026-plan/automations.md "The Automations screen" (Templates) and "GitHub triggers" (Templates): the
// GitHub chip and its six templates only where the deployment has the GitHub App, a GitHub template opening on When
// with Connect GitHub First on a plan not connected, the rule and its picks kept for the round trip and marked again
// on return, and nothing for someone who is not an Editor (the screen refuses them before the gallery).
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import type { AutomationRuleBody } from '@liveplanner/items';
import { PlanProvider, type PlanContextValue } from '@/components/plan/PlanContext';
import { AutomationsDialog } from '../AutomationsDialog';
import type { AutomationsTarget } from '../AutomationsContext';
import { AutomationRefusal } from '../automations-client';
import { forgetAutomations } from '../use-automations';
import { ANA, outline, rule } from '../test-fixtures';
import { resetGithubForTests } from './use-github-connection';

const client = vi.hoisted(() => ({ listAutomations: vi.fn(), createRule: vi.fn() }));
vi.mock('../automations-client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../automations-client')>()),
  ...client,
}));
const github = vi.hoisted(() => ({ readGithub: vi.fn(), startGithubConnect: vi.fn() }));
vi.mock('./github-client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./github-client')>()),
  ...github,
}));
const go = vi.hoisted(() => vi.fn());
vi.mock('./github-return', async (importOriginal) => {
  const real = await importOriginal<typeof import('./github-return')>();
  return {
    ...real,
    goConnectGithub: (
      s: Parameters<typeof real.goConnectGithub>[0],
      d: Parameters<typeof real.goConnectGithub>[1],
    ) => real.goConnectGithub(s, d, go),
  };
});
const caps = vi.hoisted(() => ({ githubEnabled: true }));
vi.mock('@/hooks/persistence/useCapabilities', () => ({
  useCapabilities: () => ({ emailEnabled: false, githubEnabled: caps.githubEnabled }),
}));
const track = vi.hoisted(() => vi.fn());
vi.mock('@/lib/telemetry', () => ({ track }));
vi.mock('@/hooks/ui/useToast', () => ({
  useToast: () => ({ info: vi.fn(), success: vi.fn(), error: vi.fn(), warn: vi.fn() }),
}));

const SCOPE = { ownerId: 'o1', projectId: 'p1', shareCode: null };
// The fixture plan: To Do, In Progress and Done, no column named like Review.
const o = outline();
const plan = {
  types: o.types,
  statusNames: o.statuses,
  statusPhases: o.phases,
  people: o.people,
  items: o.items,
  self: ANA,
  openItem: vi.fn(),
  planTabs: () => [],
} as unknown as PlanContextValue;

const GITHUB = [
  'review-on-open',
  'done-on-merge',
  'flag-failing-checks',
  'tell-checks-pass',
  'back-on-close',
  'merged-to-slack',
];

function Harness({ initial }: { initial: AutomationsTarget }) {
  const [target, setTarget] = useState(initial);
  return (
    <PlanProvider value={plan}>
      <AutomationsDialog scope={SCOPE} target={target} onTarget={setTarget} onClose={() => {}} />
    </PlanProvider>
  );
}

const tiles = () => [...document.querySelectorAll('[data-template]')];
const ids = () => tiles().map((t) => t.getAttribute('data-template'));
const chipNames = () =>
  within(screen.getByRole('group', { name: 'Template categories' }))
    .getAllByRole('button')
    .map((b) => b.textContent);
const marked = () => [...document.querySelectorAll('[data-pick]')].map((c) => c.textContent);

beforeEach(() => {
  forgetAutomations();
  resetGithubForTests();
  vi.clearAllMocks();
  window.sessionStorage.clear();
  caps.githubEnabled = true;
  client.listAutomations.mockResolvedValue({ rules: [rule()], runsToday: 0, runsPerDay: 1000 });
  github.readGithub.mockResolvedValue(null);
});
afterEach(cleanup);

describe('the GitHub templates', () => {
  it('are not shown at all where the deployment has no GitHub', async () => {
    caps.githubEnabled = false;
    render(<Harness initial={{ view: 'templates' }} />);
    await screen.findByRole('heading', { name: 'All Templates' });
    expect(chipNames()).not.toContain('GitHub');
    expect(tiles()).toHaveLength(22);
    expect(ids().some((id) => GITHUB.includes(id!))).toBe(false);
  });

  it('have their chip last, which narrows the tiles to the six, each with its picture', async () => {
    render(<Harness initial={{ view: 'templates' }} />);
    await screen.findByRole('heading', { name: 'All Templates' });
    expect(chipNames().at(-1)).toBe('GitHub');
    expect(tiles()).toHaveLength(28);
    fireEvent.click(screen.getByRole('button', { name: 'GitHub' }));
    expect(ids()).toEqual(GITHUB);
    for (const tile of tiles()) {
      expect(tile.querySelector('[aria-hidden]')?.childElementCount).toBeGreaterThan(0);
      expect(tile.textContent).toContain('GitHub');
    }
  });

  it('open on When, which connects a plan not yet connected, keeping the rule and its picks', async () => {
    github.startGithubConnect.mockResolvedValue('https://github.com/install');
    render(<Harness initial={{ view: 'templates' }} />);
    fireEvent.click(
      await screen.findByRole('button', { name: /Review When a Pull Request Opens/ }),
    );
    expect(track).toHaveBeenCalledWith('UI', 'Opened', 'AutomationTemplate.review-on-open');
    expect(await screen.findByRole('textbox', { name: 'Rule name' })).toHaveProperty(
      'value',
      'Review When a Pull Request Opens',
    );
    // No column named like Review here: the move is left to pick.
    expect(marked().some((t) => t?.includes('Pick a column'))).toBe(true);
    // On a phone the When step opens in its drawer.
    fireEvent.click(screen.getByRole('button', { name: 'When' }));
    expect(await screen.findByText('Connect GitHub First')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Connect GitHub' }));
    await waitFor(() => expect(go).toHaveBeenCalledWith('https://github.com/install'));
    const kept = JSON.parse(window.sessionStorage.getItem('liveplanner:github-draft:p1')!) as {
      body: AutomationRuleBody;
      picks: unknown[];
    };
    expect(kept.body).toMatchObject({
      name: 'Review When a Pull Request Opens',
      trigger: { kind: 'pull_request_opened' },
      steps: [{ kind: 'move', status: '' }],
    });
    expect(kept.picks).toEqual([{ path: 'steps.0', pick: 'column' }]);
  });

  it('come back from GitHub with what is left to pick still marked', async () => {
    const body = {
      name: 'Review When a Pull Request Opens',
      trigger: { kind: 'pull_request_opened' },
      conditions: [],
      steps: [{ kind: 'move', status: '' }],
      chain: false,
      timeZone: 'UTC',
    } as unknown as AutomationRuleBody;
    render(
      <Harness
        initial={{
          view: 'rule',
          ruleId: null,
          kept: { body, picks: [{ path: 'steps.0', pick: 'column' }] },
          github: 'connected',
        }}
      />,
    );
    await screen.findByRole('textbox', { name: 'Rule name' });
    expect(marked().some((t) => t?.includes('Pick a column'))).toBe(true);
  });

  it('are an Editor’s alone: anyone else is refused the screen, gallery and all', async () => {
    client.listAutomations.mockRejectedValue(
      new AutomationRefusal(403, { error: 'automations_need_editor' }),
    );
    render(<Harness initial={{ view: 'templates' }} />);
    expect(await screen.findByText('Only an Editor Can See Rules')).toBeTruthy();
    expect(tiles()).toHaveLength(0);
  });
});

// Work Tracker 764: automations.md "GitHub triggers" (Needs Attention on a plan not connected).
describe('a GitHub rule on a plan not connected', () => {
  it('needs attention, with Connect GitHub to the view', async () => {
    client.listAutomations.mockResolvedValue({
      rules: [rule({ trigger: { kind: 'pull_request_merged' }, attention: [{ kind: 'github' }] })],
      runsToday: 0,
      runsPerDay: 1000,
    });
    render(<Harness initial={{ view: 'rules' }} />);
    const note = await screen.findByText(/GitHub isn’t connected/);
    expect(note.closest('[data-rule-needs]')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Connect GitHub' }));
    expect(await screen.findByRole('heading', { name: 'Connect GitHub' })).toBeTruthy();
  });

  it('offers no Connect GitHub where the deployment has no GitHub', async () => {
    caps.githubEnabled = false;
    client.listAutomations.mockResolvedValue({
      rules: [rule({ trigger: { kind: 'pull_request_merged' }, attention: [{ kind: 'github' }] })],
      runsToday: 0,
      runsPerDay: 1000,
    });
    render(<Harness initial={{ view: 'rules' }} />);
    await screen.findByText(/GitHub isn’t connected/);
    expect(screen.queryByRole('button', { name: 'Connect GitHub' })).toBeNull();
  });
});
