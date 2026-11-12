// @vitest-environment jsdom
// docs/specs/026-plan/automations.md "The GitHub view": the screen's header GitHub button only where the deployment has
// GitHub, the view in the tab's place with its way back, a rule kept for the round trip opened in the builder with
// how it went, and a new GitHub rule's save sending AutomationRuleGithub beside AutomationRule.
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import type { AutomationRuleBody } from '@liveplanner/items';
import { PlanProvider, type PlanContextValue } from '@/components/plan/PlanContext';
import { AutomationsDialog } from '../AutomationsDialog';
import type { AutomationsTarget } from '../AutomationsContext';
import { forgetAutomations } from '../use-automations';
import { ANA, outline, rule } from '../test-fixtures';
import { resetGithubForTests } from './use-github-connection';

const client = vi.hoisted(() => ({ listAutomations: vi.fn(), createRule: vi.fn() }));
vi.mock('../automations-client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../automations-client')>()),
  ...client,
}));
const github = vi.hoisted(() => ({ readGithub: vi.fn() }));
vi.mock('./github-client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./github-client')>()),
  ...github,
}));
const caps = vi.hoisted(() => ({ githubEnabled: true }));
vi.mock('@/hooks/persistence/useCapabilities', () => ({
  useCapabilities: () => ({ emailEnabled: false, githubEnabled: caps.githubEnabled }),
}));
const track = vi.hoisted(() => vi.fn());
vi.mock('@/lib/telemetry', () => ({ track }));
const toast = vi.hoisted(() => ({
  info: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
}));
vi.mock('@/hooks/ui/useToast', () => ({ useToast: () => toast }));

const SCOPE = { ownerId: 'o1', projectId: 'p1', shareCode: null };
const o = outline();
const plan = {
  types: o.types,
  statusNames: o.statuses,
  people: o.people,
  items: o.items,
  self: ANA,
  openItem: vi.fn(),
  planTabs: () => [],
} as unknown as PlanContextValue;

let shown: AutomationsTarget;
function Harness({ initial = { view: 'rules' } }: { initial?: AutomationsTarget }) {
  const [target, setTarget] = useState(initial);
  const onTarget = (next: AutomationsTarget) => {
    shown = next;
    setTarget(next);
  };
  return (
    <PlanProvider value={plan}>
      <AutomationsDialog scope={SCOPE} target={target} onTarget={onTarget} onClose={() => {}} />
    </PlanProvider>
  );
}

beforeEach(() => {
  forgetAutomations();
  resetGithubForTests();
  vi.clearAllMocks();
  caps.githubEnabled = true;
  client.listAutomations.mockResolvedValue({ rules: [rule()], runsToday: 0, runsPerDay: 1000 });
  github.readGithub.mockResolvedValue(null);
});
afterEach(cleanup);

describe('the Automations screen and GitHub', () => {
  it('opens the GitHub view from the header, and goes back to the rules', async () => {
    render(<Harness />);
    await screen.findByText('Done Means Wrapped Up');
    fireEvent.click(screen.getByRole('button', { name: 'GitHub Connection' }));
    expect(shown).toEqual({ view: 'github' });
    await screen.findByRole('heading', { name: 'Connect GitHub' });
    expect(screen.queryByRole('tab', { name: /Rules/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Automations' }));
    expect(shown).toEqual({ view: 'rules' });
  });

  it('shows no GitHub button where the deployment has no GitHub, and reads nothing', async () => {
    caps.githubEnabled = false;
    render(<Harness />);
    await screen.findByText('Done Means Wrapped Up');
    expect(screen.queryByRole('button', { name: 'GitHub Connection' })).toBeNull();
    expect(github.readGithub).not.toHaveBeenCalled();
  });

  it('opens the rule kept for the round trip, says how it went, and tracks a GitHub rule’s save', async () => {
    const draft = {
      name: 'Done on Merge',
      trigger: { kind: 'pull_request_merged' },
      conditions: [],
      steps: [{ kind: 'flag' }],
      chain: false,
      timeZone: 'UTC',
    } as unknown as AutomationRuleBody;
    client.createRule.mockImplementation((_s: unknown, body: AutomationRuleBody) =>
      Promise.resolve({ rule: rule({ ...body, id: 'r9' }) }),
    );
    render(<Harness initial={{ view: 'rule', ruleId: null, draft, github: 'connected' }} />);
    expect(await screen.findByRole('textbox', { name: 'Rule name' })).toHaveProperty(
      'value',
      'Done on Merge',
    );
    expect(toast.success).toHaveBeenCalledWith('GitHub is connected. Finish the rule and save it.');
    fireEvent.click(screen.getByRole('button', { name: 'Save Rule' }));
    await waitFor(() => expect(client.createRule).toHaveBeenCalled());
    expect(client.createRule.mock.calls[0]![1]).toMatchObject({
      trigger: { kind: 'pull_request_merged' },
    });
    expect(track).toHaveBeenCalledWith('Plan', 'Created', 'AutomationRule');
    expect(track).toHaveBeenCalledWith('Plan', 'Created', 'AutomationRuleGithub');
  });

  it('says a failed round trip at the rule, and sends no GitHub create for another trigger', async () => {
    const draft = {
      name: 'Plain',
      trigger: { kind: 'card_created' },
      conditions: [],
      steps: [{ kind: 'flag' }],
      chain: false,
    } as unknown as AutomationRuleBody;
    client.createRule.mockImplementation((_s: unknown, body: AutomationRuleBody) =>
      Promise.resolve({ rule: rule({ ...body, id: 'r9' }) }),
    );
    render(<Harness initial={{ view: 'rule', ruleId: null, draft, github: 'failed' }} />);
    await screen.findByRole('textbox', { name: 'Rule name' });
    expect(toast.error).toHaveBeenCalledWith(expect.stringMatching(/didn’t connect/));
    fireEvent.click(screen.getByRole('button', { name: 'Save Rule' }));
    await waitFor(() => expect(client.createRule).toHaveBeenCalled());
    expect(track).not.toHaveBeenCalledWith('Plan', 'Created', 'AutomationRuleGithub');
  });

  it('goes from a GitHub trigger’s Manage to the view', async () => {
    github.readGithub.mockResolvedValue({
      installationId: 7,
      account: 'acme',
      connectedBy: { id: 'u1', name: 'Ana Costa' },
      connectedAt: 0,
      repositories: [{ id: 1, fullName: 'acme/web', private: false, chosen: true }],
    });
    client.listAutomations.mockResolvedValue({
      rules: [rule({ trigger: { kind: 'pull_request_opened' } })],
      runsToday: 0,
      runsPerDay: 1000,
    });
    render(<Harness initial={{ view: 'rule', ruleId: 'r1' }} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Manage' }));
    expect(shown).toEqual({ view: 'github' });
  });
});
