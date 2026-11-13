// @vitest-environment jsdom
// docs/specs/026-plan/automations.md "GitHub triggers": Pick a Trigger's GitHub group only where the deployment has
// GitHub (or for a rule already on one), noted Not Connected while the plan is not; a GitHub trigger's panel: Checks
// Finished's Failing or Passing, which cards it runs on, the repositories it hears with Manage, or Connect GitHub in
// place keeping the rule for the round trip; and off where GitHub is not set up.
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import type { AutomationRuleBody, AutomationTrigger } from '@liveplanner/items';
import { TriggerPanel } from '../step-panels/TriggerPanel';
import { outline, pickerTile } from '../test-fixtures';
import { GithubAutomationsContext, type GithubAutomations } from './github-automations';
import { heardRepositories, repositoryChoices, withRepositories } from './GithubTriggerFields';
import { valueInsertGroups } from '../value-insert-options';
import { offeredGroups } from '../trigger-groups';
import { resetGithubForTests } from './use-github-connection';

const client = vi.hoisted(() => ({ readGithub: vi.fn(), startGithubConnect: vi.fn() }));
vi.mock('./github-client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./github-client')>()),
  ...client,
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
vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

const SCOPE = { ownerId: 'o1', projectId: 'p1', shareCode: null };
const DRAFT = {
  name: 'Done on Merge',
  trigger: { kind: 'pull_request_merged' },
  conditions: [],
  steps: [{ kind: 'move', status: 'done' }],
  chain: false,
} as unknown as AutomationRuleBody;

let latest: AutomationTrigger;
function Panel({
  trigger,
  enabled = true,
  openView = () => {},
  inside = true,
}: {
  trigger: AutomationTrigger;
  enabled?: boolean;
  openView?: () => void;
  inside?: boolean;
}) {
  const [t, setT] = useState(trigger);
  const panel = (
    <TriggerPanel
      trigger={t}
      onChange={(next) => {
        latest = next;
        setT(next);
      }}
      outline={outline()}
      timeZone="UTC"
      conditions={0}
    />
  );
  const value: GithubAutomations = {
    enabled,
    scope: SCOPE,
    openView,
    draft: () => ({ body: DRAFT, picks: [] }),
    keepDraft: () => {},
  };
  return inside ? (
    <GithubAutomationsContext value={value}>{panel}</GithubAutomationsContext>
  ) : (
    panel
  );
}
const connected = (chosen: string[]) => ({
  installationId: 7,
  account: 'acme',
  connectedBy: { id: 'u1', name: 'Ana Costa' },
  connectedAt: 0,
  repositories: chosen.map((fullName, i) => ({
    id: i + 1,
    fullName,
    private: false,
    chosen: true,
  })),
});

beforeEach(() => {
  resetGithubForTests();
  vi.clearAllMocks();
  window.sessionStorage.clear();
});
afterEach(cleanup);

describe('Pick a Trigger: the GitHub group', () => {
  it('offers the four GitHub triggers where GitHub is set up, noted while not connected', async () => {
    client.readGithub.mockResolvedValue(null);
    render(<Panel trigger={{ kind: 'card_created' }} />);
    fireEvent.click(document.querySelector('[data-change-step]')!);
    for (const kind of [
      'pull_request_opened',
      'pull_request_merged',
      'pull_request_closed',
      'pull_request_checks',
    ])
      expect(pickerTile(kind)).toBeTruthy();
    expect(await screen.findByText('Not Connected')).toBeTruthy();
    fireEvent.click(pickerTile('pull_request_checks')!);
    expect(latest).toEqual({ kind: 'pull_request_checks', result: 'failing' });
  });

  it('shows no GitHub group, and reads nothing, where GitHub is not set up', () => {
    render(<Panel trigger={{ kind: 'card_created' }} enabled={false} />);
    fireEvent.click(document.querySelector('[data-change-step]')!);
    expect(pickerTile('pull_request_opened')).toBeNull();
    expect(pickerTile('card_moved')).toBeTruthy();
    expect(client.readGithub).not.toHaveBeenCalled();
  });

  it('keeps the group for a rule already on a GitHub trigger', () => {
    expect(offeredGroups(false).some((g) => g.id === 'github')).toBe(false);
    expect(offeredGroups(false, 'pull_request_merged').some((g) => g.id === 'github')).toBe(true);
    expect(offeredGroups(false, 'card_moved').some((g) => g.id === 'github')).toBe(false);
  });

  it('shows no GitHub group outside the Automations dialog', () => {
    render(<Panel trigger={{ kind: 'card_created' }} inside={false} />);
    fireEvent.click(document.querySelector('[data-change-step]')!);
    expect(pickerTile('pull_request_opened')).toBeNull();
  });
});

describe('A GitHub trigger’s panel', () => {
  it('picks Failing or Passing for Checks Finished, and says which cards it runs on', async () => {
    client.readGithub.mockResolvedValue(connected(['acme/web']));
    render(<Panel trigger={{ kind: 'pull_request_checks', result: 'failing' }} />);
    expect(screen.getByText(/Runs once on each card the pull request links/)).toBeTruthy();
    fireEvent.change(screen.getByRole('combobox', { name: 'Checks Turn' }), {
      target: { value: 'passing' },
    });
    expect(latest).toEqual({ kind: 'pull_request_checks', result: 'passing' });
    fireEvent.change(screen.getByRole('combobox', { name: 'Checks Turn' }), {
      target: { value: 'failing' },
    });
    expect(latest).toEqual({ kind: 'pull_request_checks', result: 'failing' });
    expect(await screen.findByText('Hears acme/web on acme.')).toBeTruthy();
  });

  it('names the repositories it hears, with Manage to the GitHub view', async () => {
    const openView = vi.fn();
    client.readGithub.mockResolvedValue(
      connected(['acme/web', 'acme/api', 'acme/cli', 'acme/docs']),
    );
    render(<Panel trigger={{ kind: 'pull_request_opened' }} openView={openView} />);
    expect(await screen.findByText('Hears acme/web, acme/api and 2 more on acme.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Manage' }));
    expect(openView).toHaveBeenCalled();
    expect(screen.queryByRole('combobox', { name: 'Checks Turn' })).toBeNull();
  });

  it('says a connection with no repository picked hears nothing', async () => {
    client.readGithub.mockResolvedValue(connected([]));
    render(<Panel trigger={{ kind: 'pull_request_closed' }} />);
    expect(await screen.findByText(/No repository is picked yet/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Pick Repositories' })).toBeTruthy();
  });

  it('connects in place, keeping the rule for the round trip', async () => {
    client.readGithub.mockResolvedValue(null);
    client.startGithubConnect.mockResolvedValue('https://github.com/install');
    render(<Panel trigger={{ kind: 'pull_request_merged' }} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Connect GitHub' }));
    await waitFor(() => expect(go).toHaveBeenCalledWith('https://github.com/install'));
    expect(JSON.parse(window.sessionStorage.getItem('liveplanner:github-draft:p1')!)).toEqual({
      body: DRAFT,
      picks: [],
    });
  });

  it('says a refused read, and a failed one with Try Again', async () => {
    const { GithubRefusal } = await import('./github-client');
    client.readGithub.mockRejectedValueOnce(new GithubRefusal(403, 'github_needs_editor'));
    render(<Panel trigger={{ kind: 'pull_request_merged' }} />);
    expect(await screen.findByText('Only an Editor signed in can connect GitHub.')).toBeTruthy();
    cleanup();
    resetGithubForTests();
    client.readGithub.mockRejectedValueOnce(new Error('offline'));
    client.readGithub.mockResolvedValueOnce(connected(['acme/web']));
    render(<Panel trigger={{ kind: 'pull_request_merged' }} />);
    expect(screen.getByText('Checking GitHub…')).toBeTruthy();
    fireEvent.click(await screen.findByRole('button', { name: 'Try Again' }));
    expect(await screen.findByText('Hears acme/web on acme.')).toBeTruthy();
  });

  it('says the rule hears nothing where GitHub is not set up', () => {
    render(<Panel trigger={{ kind: 'pull_request_merged' }} enabled={false} />);
    expect(screen.getByText(/GitHub isn’t set up here/)).toBeTruthy();
    expect(client.readGithub).not.toHaveBeenCalled();
  });

  it('joins the repositories it hears in words', () => {
    expect(heardRepositories(['a/b'])).toBe('a/b');
    expect(heardRepositories(['a/b', 'a/c'])).toBe('a/b and a/c');
    expect(heardRepositories(['a/b', 'a/c', 'a/d'])).toBe('a/b, a/c and 1 more');
  });
});

// Work Tracker 763 and 762 (automations.md "GitHub triggers"): a trigger keeps to some of the repositories the plan
// hears; a GitHub rule's text offers the pull request's values.
describe('A GitHub trigger’s repositories and values', () => {
  const chip = (name: string) => screen.getByRole('button', { name: new RegExp(`^${name}`) });

  it('picks repositories as chips, none meaning every one, and keeps them as Checks Turn changes', async () => {
    client.readGithub.mockResolvedValue(connected(['acme/web', 'acme/api']));
    render(<Panel trigger={{ kind: 'pull_request_checks', result: 'failing' }} />);
    expect(await screen.findByText('Repositories')).toBeTruthy();
    expect(screen.getByText('None picked: every repository this plan hears.')).toBeTruthy();
    fireEvent.click(chip('acme/api'));
    expect(latest).toEqual({
      kind: 'pull_request_checks',
      result: 'failing',
      repositories: ['acme/api'],
    });
    expect(chip('acme/api').getAttribute('aria-pressed')).toBe('true');
    fireEvent.change(screen.getByRole('combobox', { name: 'Checks Turn' }), {
      target: { value: 'passing' },
    });
    expect(latest).toMatchObject({ result: 'passing', repositories: ['acme/api'] });
    fireEvent.click(chip('acme/api'));
    expect(latest).toEqual({ kind: 'pull_request_checks', result: 'passing' });
  });

  it('shows a named repository the plan no longer hears, pressed, to unpick', async () => {
    client.readGithub.mockResolvedValue(connected(['acme/web']));
    render(
      <Panel trigger={{ kind: 'pull_request_merged', repositories: ['ACME/WEB', 'acme/old'] }} />,
    );
    expect(
      (await screen.findByRole('button', { name: /^acme\/web/ })).getAttribute('aria-pressed'),
    ).toBe('true');
    const gone = chip('acme/old · Not Heard');
    expect(gone.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(gone);
    expect(latest).toEqual({ kind: 'pull_request_merged', repositories: ['acme/web'] });
  });

  it('offers no chips when the plan hears one repository and the rule names none', async () => {
    client.readGithub.mockResolvedValue(connected(['acme/web']));
    render(<Panel trigger={{ kind: 'pull_request_opened' }} />);
    expect(await screen.findByText('Hears acme/web on acme.')).toBeTruthy();
    expect(screen.queryByText('Repositories')).toBeNull();
  });

  it('works out the choices and the trigger', () => {
    expect(repositoryChoices(['acme/web'], ['Acme/Web', 'x/y'])).toEqual([
      { value: 'acme/web', label: 'acme/web' },
      { value: 'x/y', label: 'x/y · Not Heard' },
    ]);
    expect(withRepositories({ kind: 'pull_request_opened', repositories: ['a/b'] }, [])).toEqual({
      kind: 'pull_request_opened',
    });
  });

  it('offers the Pull Request values only in a GitHub rule', () => {
    const ids = (github: boolean) => valueInsertGroups(false, [], false, github).map((g) => g.id);
    expect(ids(true)).toEqual(['card', 'pull_request']);
    expect(ids(false)).toEqual(['card']);
    expect(valueInsertGroups(false, [], false, true)[1]!.options.map((o) => o.label)).toEqual([
      'Pull Request Title',
      'Pull Request Number',
      'Pull Request Link',
    ]);
  });
});
