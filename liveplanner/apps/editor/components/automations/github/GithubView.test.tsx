// @vitest-environment jsdom
// docs/specs/026-plan/automations.md "The GitHub view": Not Connected and Connect GitHub (with its refusal), the
// connection's account and repositories, the chooser (Save, Undo, the private note, past 20, refusals), Change on
// GitHub, Disconnect's in-app confirm, each return line, and an Editor-only read (a Participant, a Viewer or a guest
// is refused `github_needs_editor`).
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GithubConnectionView } from '@liveplanner/api-schema';
import { GithubView } from './GithubView';
import { resetGithubForTests } from './use-github-connection';

const client = vi.hoisted(() => ({
  readGithub: vi.fn(),
  startGithubConnect: vi.fn(),
  chooseGithubRepositories: vi.fn(),
  disconnectGithub: vi.fn(),
}));
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
const track = vi.hoisted(() => vi.fn());
vi.mock('@/lib/telemetry', () => ({ track }));
const toast = vi.hoisted(() => ({
  info: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
}));
vi.mock('@/hooks/ui/useToast', () => ({ useToast: () => toast }));

const { GithubRefusal } = await import('./github-client');

const SCOPE = { ownerId: 'o1', projectId: 'p1', shareCode: null };
const NOW = Date.UTC(2026, 10, 12, 12);
const repo = (
  id: number,
  fullName: string,
  over: { private?: boolean; chosen?: boolean } = {},
) => ({
  id,
  fullName,
  private: over.private ?? false,
  chosen: over.chosen ?? false,
});
const connection = (over: Partial<GithubConnectionView> = {}): GithubConnectionView =>
  ({
    installationId: 7,
    account: 'acme',
    connectedBy: { id: 'u1', name: 'Ana Costa', color: '#7c3aed' },
    connectedAt: NOW - 3_600_000,
    repositories: [
      repo(1, 'acme/web', { chosen: true }),
      repo(2, 'acme/secret', { private: true }),
    ],
    ...over,
  }) as GithubConnectionView;

const view = (props: Partial<Parameters<typeof GithubView>[0]> = {}) =>
  render(<GithubView scope={SCOPE} now={NOW} phone={false} onBack={() => {}} {...props} />);
const button = (name: string | RegExp) => screen.getByRole('button', { name });

beforeEach(() => {
  resetGithubForTests();
  vi.clearAllMocks();
  window.sessionStorage.clear();
});
afterEach(cleanup);

describe('GithubView: not connected', () => {
  it('says what connecting does and asks for, then goes to GitHub', async () => {
    client.readGithub.mockResolvedValue(null);
    client.startGithubConnect.mockResolvedValue(
      'https://github.com/apps/liveplanner/installations/new?state=s',
    );
    view();
    expect(screen.getByRole('status', { name: 'Loading GitHub' })).toBeTruthy();
    await screen.findByRole('heading', { name: 'Connect GitHub' });
    expect(screen.getByText('Read-only: pull requests, checks and metadata.')).toBeTruthy();
    expect(screen.getByText('No personal GitHub token is kept.')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Learn about connecting GitHub' })).toBeTruthy();
    fireEvent.click(button('Connect GitHub'));
    expect(track).toHaveBeenCalledWith('Plan', 'Started', 'GithubConnect');
    await waitFor(() =>
      expect(go).toHaveBeenCalledWith(
        'https://github.com/apps/liveplanner/installations/new?state=s',
      ),
    );
    expect(button('Opening GitHub…')).toHaveProperty('disabled', true);
  });

  it('says why a connect is refused, and lets it be tried again', async () => {
    client.readGithub.mockResolvedValue(null);
    client.startGithubConnect.mockRejectedValueOnce(new GithubRefusal(403, 'github_needs_editor'));
    client.startGithubConnect.mockRejectedValueOnce(new Error('offline'));
    view();
    fireEvent.click(await screen.findByRole('button', { name: 'Connect GitHub' }));
    expect((await screen.findByRole('alert')).textContent).toBe(
      'Only an Editor signed in can connect GitHub.',
    );
    fireEvent.click(button('Connect GitHub'));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/didn’t answer/));
    expect(go).not.toHaveBeenCalled();
  });
});

describe('GithubView: connected', () => {
  it('shows the account, who connected it, and each repository with its lock', async () => {
    client.readGithub.mockResolvedValue(connection());
    view();
    await screen.findByText('acme');
    expect(screen.getByText(/Connected by Ana Costa/)).toBeTruthy();
    expect(screen.getAllByText(/acme\/(web|secret)/).map((n) => n.textContent)).toEqual([
      'acme/web',
      'acme/secret',
    ]);
    expect(screen.getByText('Private')).toBeTruthy();
    expect(screen.getByText('1 of 2 heard')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Save Repositories' })).toBeNull();
  });

  it('saves the picks, says what a private one shares, and undoes', async () => {
    client.readGithub.mockResolvedValue(connection());
    client.chooseGithubRepositories.mockResolvedValue(
      connection({
        repositories: [
          repo(1, 'acme/web', { chosen: true }),
          repo(2, 'acme/secret', { private: true, chosen: true }),
        ],
      }),
    );
    view();
    const secret = await screen.findByRole('switch', { name: /acme\/secret/ });
    fireEvent.click(secret);
    expect(screen.getByText(/share links included/)).toBeTruthy();
    fireEvent.click(button('Undo Changes'));
    expect(screen.queryByText(/share links included/)).toBeNull();
    fireEvent.click(screen.getByRole('switch', { name: /acme\/secret/ }));
    fireEvent.click(button('Save Repositories'));
    await waitFor(() =>
      expect(client.chooseGithubRepositories).toHaveBeenCalledWith(SCOPE, [1, 2]),
    );
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Save Repositories' })).toBeNull(),
    );
    expect(screen.getByText('2 of 2 heard')).toBeTruthy();
  });

  it('holds past 20 and says each refusal in words', async () => {
    const many = Array.from({ length: 22 }, (_, i) => repo(i + 1, `acme/r${i + 1}`));
    client.readGithub.mockResolvedValue(connection({ repositories: many }));
    view();
    await screen.findByText('Pick up to 20 repositories for this plan to hear.');
    const switches = screen.getAllByRole('switch');
    for (const s of switches.slice(0, 21)) fireEvent.click(s);
    expect(screen.getByRole('alert').textContent).toBe('Pick up to 20.');
    expect(button('Save Repositories')).toHaveProperty('disabled', true);
    fireEvent.click(switches[20]!);
    client.chooseGithubRepositories.mockRejectedValueOnce(
      new GithubRefusal(409, 'github_repository_full'),
    );
    fireEvent.click(button('Save Repositories'));
    expect((await screen.findByRole('alert')).textContent).toMatch(/already sends to 20 plans/);
    client.chooseGithubRepositories.mockRejectedValueOnce(new Error('offline'));
    fireEvent.click(button('Save Repositories'));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/didn’t save/));
  });

  it('says when the installation lists nothing', async () => {
    client.readGithub.mockResolvedValue(connection({ repositories: [] }));
    view({ phone: true });
    expect(await screen.findByText(/lists no repositories you can reach/)).toBeTruthy();
  });

  it('starts a connect again for Change on GitHub, and says a refusal', async () => {
    client.readGithub.mockResolvedValue(connection());
    client.startGithubConnect.mockResolvedValueOnce('https://github.com/x');
    view();
    fireEvent.click(await screen.findByRole('button', { name: 'Change on GitHub' }));
    await waitFor(() => expect(go).toHaveBeenCalledWith('https://github.com/x'));
    expect(window.sessionStorage.length).toBe(0);
    cleanup();
    client.startGithubConnect.mockRejectedValueOnce(new Error('offline'));
    view();
    fireEvent.click(await screen.findByRole('button', { name: 'Change on GitHub' }));
    expect((await screen.findByRole('alert')).textContent).toMatch(/didn’t answer/);
  });

  it('asks in the app before disconnecting, then shows Connect GitHub', async () => {
    client.readGithub.mockResolvedValue(connection());
    client.disconnectGithub.mockResolvedValue(undefined);
    view({ result: 'connected' });
    fireEvent.click(await screen.findByRole('button', { name: 'Disconnect' }));
    expect(screen.getByText('Disconnect GitHub?')).toBeTruthy();
    fireEvent.click(button('Cancel'));
    expect(screen.queryByText('Disconnect GitHub?')).toBeNull();
    expect(client.disconnectGithub).not.toHaveBeenCalled();
    fireEvent.click(button('Disconnect'));
    const confirms = screen.getAllByRole('button', { name: 'Disconnect' });
    fireEvent.click(confirms.at(-1)!);
    await screen.findByRole('heading', { name: 'Connect GitHub' });
    expect(client.disconnectGithub).toHaveBeenCalledWith(SCOPE);
    expect(track).toHaveBeenCalledWith('Plan', 'Unlinked', 'Github');
    expect(toast.info).toHaveBeenCalledWith('Disconnected GitHub');
    expect(document.querySelector('[data-github-result]')).toBeNull();
  });

  it('says a disconnect that failed, and stays connected', async () => {
    client.readGithub.mockResolvedValue(connection());
    client.disconnectGithub.mockRejectedValue(new GithubRefusal(403, 'github_needs_editor'));
    view();
    fireEvent.click(await screen.findByRole('button', { name: 'Disconnect' }));
    fireEvent.click(screen.getAllByRole('button', { name: 'Disconnect' }).at(-1)!);
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith('Only an Editor signed in can disconnect GitHub.'),
    );
    expect(screen.getByText('acme')).toBeTruthy();
  });
});

describe('GithubView: coming back and who may', () => {
  it.each([
    ['connected', /GitHub is connected/],
    ['failed', /didn’t connect/],
    ['requested', /must approve the install/],
  ] as const)('says how a return went: %s', async (result, words) => {
    client.readGithub.mockResolvedValue(null);
    view({ result });
    const line = document.querySelector(`[data-github-result="${result}"]`);
    expect(line?.textContent).toMatch(words);
    await screen.findByRole('heading', { name: 'Connect GitHub' });
  });

  it('tells anyone but a signed-in Editor that it is an Editor’s', async () => {
    client.readGithub.mockRejectedValue(new GithubRefusal(403, 'github_needs_editor'));
    view();
    expect(await screen.findByText('Only an Editor Signed In Can Connect GitHub')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Connect GitHub' })).toBeNull();
  });

  it('offers Try Again when the read fails, and goes back by the breadcrumb', async () => {
    const onBack = vi.fn();
    client.readGithub.mockRejectedValueOnce(new Error('offline'));
    client.readGithub.mockResolvedValueOnce(null);
    view({ onBack });
    fireEvent.click(await screen.findByRole('button', { name: 'Try Again' }));
    await screen.findByRole('heading', { name: 'Connect GitHub' });
    fireEvent.click(button('Automations'));
    expect(onBack).toHaveBeenCalled();
  });

  it('reads the connection once for every reader of the plan', async () => {
    client.readGithub.mockResolvedValue(null);
    view();
    view();
    await act(async () => {});
    expect(client.readGithub).toHaveBeenCalledTimes(1);
  });
});

describe('GithubView: reading again', () => {
  beforeEach(() => client.readGithub.mockReset());
  it('reads the connection again each time the view opens, keeping what it shows meanwhile', async () => {
    client.readGithub.mockResolvedValueOnce(connection());
    view();
    await screen.findByText('acme');
    cleanup();
    // Disconnected elsewhere since: opening the view again shows it.
    client.readGithub.mockResolvedValueOnce(null);
    view();
    expect(screen.getByText('acme')).toBeTruthy();
    await screen.findByRole('heading', { name: 'Connect GitHub' });
    expect(client.readGithub).toHaveBeenCalledTimes(2);
  });

  it('reads the list again when a picked repository left, and counts only the listed picks', async () => {
    client.readGithub.mockResolvedValueOnce(connection());
    view();
    await screen.findByText('acme/secret');
    fireEvent.click(screen.getAllByRole('switch').at(-1)!);
    client.chooseGithubRepositories.mockRejectedValueOnce(
      new GithubRefusal(409, 'github_repository_gone'),
    );
    // acme/secret left the installation.
    client.readGithub.mockResolvedValueOnce(
      connection({ repositories: [repo(1, 'acme/web', { chosen: true })] }),
    );
    fireEvent.click(button('Save Repositories'));
    expect((await screen.findByRole('alert')).textContent).toMatch(/left the installation/);
    await waitFor(() => expect(screen.queryByText('acme/secret')).toBeNull());
    expect(client.readGithub).toHaveBeenCalledTimes(2);
    // The gone pick is not counted, and nothing is left to save.
    expect(screen.getByText('1 of 1 heard')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Save Repositories' })).toBeNull();
  });

  it('disconnects once for a double press', async () => {
    client.readGithub.mockResolvedValue(connection());
    let done: () => void = () => {};
    client.disconnectGithub.mockReturnValue(new Promise<void>((r) => (done = r)));
    view();
    fireEvent.click(await screen.findByRole('button', { name: 'Disconnect' }));
    fireEvent.click(screen.getAllByRole('button', { name: 'Disconnect' }).at(-1)!);
    fireEvent.click(screen.getAllByRole('button', { name: /Disconnect/ }).at(-1)!);
    await act(async () => done());
    expect(client.disconnectGithub).toHaveBeenCalledTimes(1);
    expect(toast.info).toHaveBeenCalledTimes(1);
  });
});
