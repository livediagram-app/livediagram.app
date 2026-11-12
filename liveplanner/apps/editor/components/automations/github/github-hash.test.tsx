// @vitest-environment jsdom
// docs/specs/026-plan/automations.md "The GitHub view" (Coming back from GitHub): the `#github=` result read once and
// dropped from the address, its telemetry, the rule kept for the round trip (taken once, never a broken one), and the
// Automations host opening at the GitHub view or the kept rule, only for an Editor's scope.
import { act, cleanup, render, screen } from '@testing-library/react';
import { StrictMode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AutomationRuleBody } from '@liveplanner/items';
import type { AutomationsScope } from '../automations-client';
import { AutomationsHost } from '../AutomationsHost';
import {
  dropGithubHash,
  githubResultOf,
  keepGithubDraft,
  takeGithubDraft,
  trackGithubResult,
} from './github-hash';

const track = vi.hoisted(() => vi.fn());
vi.mock('@/lib/telemetry', () => ({ track }));
vi.mock('../use-automations', () => ({ readAutomations: vi.fn() }));
vi.mock('../AutomationsDialog', () => ({
  AutomationsDialog: ({ target }: { target: unknown }) => (
    <pre data-testid="target">{JSON.stringify(target)}</pre>
  ),
}));
await import('../AutomationsDialog');

const SCOPE: AutomationsScope = { ownerId: 'o1', projectId: 'p1', shareCode: null };
const DRAFT = {
  name: 'Done on Merge',
  trigger: { kind: 'pull_request_merged' },
  conditions: [],
  steps: [],
  chain: false,
} as unknown as AutomationRuleBody;

beforeEach(() => {
  vi.clearAllMocks();
  window.sessionStorage.clear();
  window.history.replaceState(null, '', '/project/p1');
});
afterEach(cleanup);

describe('github-hash', () => {
  it('reads each result, and nothing else', () => {
    expect(githubResultOf('#github=connected')).toBe('connected');
    expect(githubResultOf('github=failed')).toBe('failed');
    expect(githubResultOf('#t=t1&github=requested')).toBe('requested');
    expect(githubResultOf('#github=maybe')).toBeNull();
    expect(githubResultOf('')).toBeNull();
  });

  it('drops the result from the address, keeping its path and query', () => {
    window.history.replaceState(null, '', '/project/p1?x=1#github=connected');
    dropGithubHash();
    expect(window.location.pathname + window.location.search + window.location.hash).toBe(
      '/project/p1?x=1',
    );
    const replace = vi.spyOn(window.history, 'replaceState');
    dropGithubHash();
    expect(replace).not.toHaveBeenCalled();
  });

  it('keeps a draft once, and never a broken one', () => {
    keepGithubDraft('p1', DRAFT);
    expect(takeGithubDraft('p1')).toEqual(DRAFT);
    expect(takeGithubDraft('p1')).toBeNull();
    keepGithubDraft('p1', DRAFT);
    keepGithubDraft('p1', null);
    expect(takeGithubDraft('p1')).toBeNull();
    window.sessionStorage.setItem('liveplanner:github-draft:p1', '{"name":1}');
    expect(takeGithubDraft('p1')).toBeNull();
    window.sessionStorage.setItem('liveplanner:github-draft:p1', 'not json');
    expect(takeGithubDraft('p1')).toBeNull();
  });

  it('keeps no draft where session storage throws', () => {
    const set = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    expect(() => keepGithubDraft('p1', DRAFT)).not.toThrow();
    set.mockRestore();
    expect(takeGithubDraft('p1')).toBeNull();
  });

  it('sends each return’s telemetry, with no repository or title', () => {
    trackGithubResult('connected');
    trackGithubResult('failed');
    trackGithubResult('requested');
    expect(track.mock.calls).toEqual([
      ['Plan', 'Linked', 'Github'],
      ['Plan', 'Ended', 'GithubConnectFailed'],
      ['Plan', 'Ended', 'GithubConnectRequested'],
    ]);
  });
});

describe('AutomationsHost: back from GitHub', () => {
  const host = (scope: AutomationsScope | null) => (
    <AutomationsHost scope={scope} plan={undefined}>
      <span />
    </AutomationsHost>
  );

  it('opens the GitHub view with how it went, once the Editor scope is known', async () => {
    window.history.replaceState(null, '', '/project/p1#github=connected');
    const { rerender } = render(host(null));
    expect(window.location.hash).toBe('');
    expect(screen.queryByTestId('target')).toBeNull();
    rerender(host(SCOPE));
    await act(async () => {});
    expect(JSON.parse(screen.getByTestId('target').textContent)).toEqual({
      view: 'github',
      result: 'connected',
    });
    expect(track).toHaveBeenCalledWith('Plan', 'Linked', 'Github');
    expect(track).toHaveBeenCalledWith('UI', 'Opened', 'Automations');
  });

  it('opens the rule kept for the round trip', async () => {
    keepGithubDraft('p1', DRAFT);
    window.history.replaceState(null, '', '/project/p1#github=requested');
    render(host(SCOPE));
    await act(async () => {});
    expect(JSON.parse(screen.getByTestId('target').textContent)).toEqual({
      view: 'rule',
      ruleId: null,
      kept: DRAFT,
      github: 'requested',
    });
    expect(takeGithubDraft('p1')).toBeNull();
  });

  it('opens the rule kept even when the effect runs twice (Strict Mode)', async () => {
    keepGithubDraft('p1', DRAFT);
    window.history.replaceState(null, '', '/project/p1#github=connected');
    render(<StrictMode>{host(SCOPE)}</StrictMode>);
    await act(async () => {});
    expect(JSON.parse(screen.getByTestId('target').textContent)).toEqual({
      view: 'rule',
      ruleId: null,
      kept: DRAFT,
      github: 'connected',
    });
  });

  it('opens nothing for someone with no Editor scope, and clears the address', async () => {
    window.history.replaceState(null, '', '/project/p1#github=failed');
    render(host(null));
    await act(async () => {});
    expect(screen.queryByTestId('target')).toBeNull();
    expect(window.location.hash).toBe('');
    expect(track).not.toHaveBeenCalled();
  });
});
