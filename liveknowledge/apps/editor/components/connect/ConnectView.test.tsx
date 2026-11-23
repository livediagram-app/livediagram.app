// @vitest-environment jsdom

// Connect (docs/specs/030-knowledgebase/mcp-connect.md): the four steps for every app, copy, the access per role,
// the status, the aside, and the view signed out and Offline.
import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { KnowledgeAgent } from '@liveknowledge/api-schema';

const api = vi.hoisted(() => ({ apiKnowledgeOverview: vi.fn() }));
vi.mock('@/lib/api/knowledge', async (actual) => ({
  ...(await actual<typeof import('@/lib/api/knowledge')>()),
  ...api,
}));
vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));
const offline = vi.hoisted(() => ({ value: false }));
vi.mock('@/hooks/persistence/useIsOfflineDocument', () => ({
  useIsOfflineDocument: () => offline.value,
}));

import { track } from '@/lib/telemetry';
import { ROLES, chromeValue, renderInEditor, type Role } from '@/components/ask/test-chrome';
import { CONNECT_APP_KEY } from '@/lib/knowledge-connect/connect-apps';
import { ConnectView } from './ConnectView';

const agent = (id: string, over: Partial<KnowledgeAgent> = {}): KnowledgeAgent => ({
  id,
  name: id,
  readsThisWeek: 2,
  topPages: [],
  ...over,
});
const agentsAre = (agents: KnowledgeAgent[]) =>
  api.apiKnowledgeOverview.mockImplementation(() => Promise.resolve({ agents }));

const writeText = vi.fn(() => Promise.resolve());
beforeEach(() => {
  Object.assign(navigator, { clipboard: { writeText } });
  agentsAre([]);
});
afterEach(() => {
  cleanup();
  offline.value = false;
  localStorage.clear();
  window.history.replaceState(null, '', '/document/d1');
  vi.clearAllMocks();
});

async function open(role: Role = 'edit', over: Record<string, unknown> = {}) {
  const utils = renderInEditor(<ConnectView />, chromeValue(role, over));
  await waitFor(() =>
    expect(
      document.querySelector('[data-connect-status]')?.getAttribute('data-connect-status'),
    ).not.toBe('loading'),
  );
  return utils;
}
const region = (name: string) => screen.getByRole('region', { name });
const step = (name: string) => within(region(name));
const app = (name: string) => screen.getByRole('radio', { name });
const status = () => document.querySelector<HTMLElement>('[data-connect-status]')!;

describe('the steps', () => {
  it('are four, numbered, under a header that says what the view is for', async () => {
    await open();
    expect(screen.getByRole('heading', { level: 1, name: 'Connect MCP' })).toBeTruthy();
    expect(
      screen.getByText('Connect an AI app over MCP so it can read and write this knowledgebase.'),
    ).toBeTruthy();
    const steps = within(screen.getByRole('list', { name: 'Steps' }));
    expect(steps.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual([
      'Pick Your AI App',
      'Add liveknowledge to Claude',
      'Approve and Choose Access',
      'Check It Worked',
    ]);
  });

  it.each([
    ['Claude', 'Open Claude connectors', 'https://mcp.liveknowledge.app/mcp'],
    [
      'Claude Code',
      null,
      'claude mcp add --transport http --scope user liveknowledge https://mcp.liveknowledge.app/mcp',
    ],
    ['ChatGPT', 'Open ChatGPT settings', 'https://mcp.liveknowledge.app/mcp'],
    ['Cursor', 'Add to Cursor', '"url": "https://mcp.liveknowledge.app/mcp"'],
    ['VS Code', 'Add to VS Code', '"type": "http"'],
    ['Other App', null, 'Authorization: Bearer lwt_…'],
  ])('show %s’s own steps, with what to copy', async (name, action, code) => {
    await open();
    fireEvent.click(app(name));
    expect(app(name).getAttribute('aria-checked')).toBe('true');
    const add = region(`Add liveknowledge to ${name}`);
    if (action) expect(within(add).getByRole('link', { name: new RegExp(action) })).toBeTruthy();
    expect(add.textContent).toContain(code);
    expect(localStorage.getItem(CONNECT_APP_KEY)).toBe(
      {
        Claude: 'claude',
        'Claude Code': 'claude-code',
        ChatGPT: 'chatgpt',
        Cursor: 'cursor',
        'VS Code': 'vscode',
        'Other App': 'other',
      }[name],
    );
  });

  it('opens a Claude link in a new tab, said for a screen reader', async () => {
    await open();
    const link = step('Add liveknowledge to Claude').getByRole('link', {
      name: /Open Claude connectors/,
    });
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toBe('noopener noreferrer');
    expect(link.textContent).toContain('(opens in a new tab)');
  });

  it('copies the address, says Copied, and tells telemetry', async () => {
    await open();
    await act(async () => {
      fireEvent.click(
        step('Add liveknowledge to Claude').getByRole('button', { name: 'Copy the text' }),
      );
    });
    expect(writeText).toHaveBeenCalledWith('https://mcp.liveknowledge.app/mcp');
    expect(screen.getAllByText('Copied').length).toBeGreaterThan(0);
    expect(track).toHaveBeenCalledWith('UI', 'Copied', 'McpSetup');
  });

  it('opens on the app picked last in this browser, and the arrows move the pick', async () => {
    localStorage.setItem(CONNECT_APP_KEY, 'cursor');
    await open();
    expect(app('Cursor').getAttribute('aria-checked')).toBe('true');
    expect(app('Cursor').tabIndex).toBe(0);
    expect(app('Claude').tabIndex).toBe(-1);
    fireEvent.keyDown(app('Cursor'), { key: 'ArrowRight' });
    expect(app('VS Code').getAttribute('aria-checked')).toBe('true');
    expect(document.activeElement).toBe(app('VS Code'));
    fireEvent.keyDown(app('VS Code'), { key: 'End' });
    expect(app('Other App').getAttribute('aria-checked')).toBe('true');
    fireEvent.keyDown(app('Other App'), { key: 'ArrowRight' });
    expect(app('Claude').getAttribute('aria-checked')).toBe('true');
    fireEvent.keyDown(app('Claude'), { key: 'ArrowLeft' });
    expect(app('Other App').getAttribute('aria-checked')).toBe('true');
    fireEvent.keyDown(app('Other App'), { key: 'Home' });
    expect(app('Claude').getAttribute('aria-checked')).toBe('true');
    fireEvent.keyDown(app('Claude'), { key: 'Tab' });
    expect(app('Claude').getAttribute('aria-checked')).toBe('true');
  });
});

// mcp-connect.md "Share roles": every role connects one that reads; a Viewer's never suggests; only an Editor's
// writes, once allowed.
describe('the access, by role', () => {
  it.each([
    ['edit', ['Yes', 'Yes, unless Read-Only', 'Once You Allow It'], true],
    ['participate', ['Yes', 'Yes, unless Read-Only', 'Only an Editor’s'], false],
    ['view', ['Yes', 'Not for a Viewer', 'Only an Editor’s'], false],
  ] as const)('as %s', async (role, yours, opensAgents) => {
    await open(role);
    const access = region('Approve and Choose Access');
    const rows = [...access.querySelectorAll('[data-connect-access-row]')];
    expect(rows.map((row) => row.querySelector('.rounded-full')?.textContent)).toEqual(
      yours.map((words) => `Yours: ${words}`),
    );
    expect(access.textContent).toContain('Never on a page that is Verified or Review Due');
    expect(access.textContent).toContain('“Handbook”');
    const button = within(access).queryByRole('button', { name: 'Open Connected Agents' });
    expect(!!button).toBe(opensAgents);
    if (button) {
      fireEvent.click(button);
      expect(window.location.search).toBe('?view=ai');
    }
  });
});

describe('the status', () => {
  it('waits, with a prompt naming this knowledgebase to copy', async () => {
    await open();
    const check = step('Check It Worked');
    expect(status().textContent).toContain('Waiting for Your App');
    expect(status().textContent).toContain('Checking every 10 seconds');
    await act(async () => {
      fireEvent.click(check.getByRole('button', { name: 'Copy the text' }));
    });
    expect(writeText).toHaveBeenCalledWith(
      'Search my liveknowledge knowledgebase "Handbook" and tell me in five lines what it covers. Name the pages you read.',
    );
    expect(track).toHaveBeenCalledWith('UI', 'Copied', 'ConnectPrompt');
    fireEvent.click(check.getByRole('button', { name: 'Check Now' }));
    await waitFor(() => expect(api.apiKnowledgeOverview).toHaveBeenCalledTimes(2));
  });

  it('says Connected once an app reads here, with Manage in Insights', async () => {
    await open();
    agentsAre([
      agent('Claude', { lastSeenAt: Date.now(), door: 'mcp', scopes: ['read', 'suggest'] }),
    ]);
    fireEvent.click(step('Check It Worked').getByRole('button', { name: 'Check Now' }));
    await waitFor(() => expect(status().textContent).toContain('Connected: Claude'));
    expect(status().textContent).toContain('Last seen today, 2 pages read this week.');
    fireEvent.click(within(status()).getByRole('button', { name: 'Manage in Insights' }));
    expect(window.location.search).toBe('?view=ai');
  });

  it('says it could not check, with Try Again', async () => {
    api.apiKnowledgeOverview.mockImplementation(() => Promise.reject(new Error('offline')));
    await open();
    expect(screen.getByText('Could Not Check')).toBeTruthy();
    agentsAre([]);
    fireEvent.click(screen.getByRole('button', { name: 'Try Again' }));
    await waitFor(() => expect(status().textContent).toContain('Waiting for Your App'));
  });
});

describe('beside the steps', () => {
  it('list the apps already connected, at most five, with their chips and a way to manage them', async () => {
    agentsAre([
      agent('Claude', { door: 'mcp', scopes: ['read', 'suggest', 'write'] }),
      ...['A', 'B', 'C', 'D', 'E'].map((id) => agent(id)),
    ]);
    await open();
    const aside = region('Already Connected');
    const rows = aside.querySelectorAll('[data-agent]');
    expect(rows).toHaveLength(5);
    expect(
      within(rows[0] as HTMLElement).getByRole('list', { name: 'What it may do' }).textContent,
    ).toBe('ReadsSuggests EditsWrites');
    expect(rows[0]!.textContent).toContain('Through the MCP server');
    fireEvent.click(within(aside).getByRole('button', { name: 'Manage in Insights' }));
    expect(window.location.search).toBe('?view=ai');
  });

  it('say when none is connected yet', async () => {
    await open();
    expect(step('Already Connected').getByText('No Apps Connected Yet')).toBeTruthy();
  });

  it('give the command line and API tokens', async () => {
    const openSettingsOn = vi.fn();
    await open('edit', { openSettingsOn });
    const other = region('Other Ways In');
    expect(other.textContent).toContain('liveknowledge auth login');
    expect(other.textContent).toContain('liveknowledge context "Handbook"');
    fireEvent.click(within(other).getByRole('button', { name: 'Open API Tokens' }));
    expect(openSettingsOn).toHaveBeenCalledWith('tokens');
  });
});

describe('when there is nothing to connect', () => {
  it('asks someone not signed in to sign in, reading nothing', () => {
    renderInEditor(<ConnectView />, chromeValue('edit', { accountUserId: null }));
    expect(screen.getByRole('heading', { name: 'Sign In to Connect an AI App' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Sign In' })).toBeTruthy();
    expect(api.apiKnowledgeOverview).not.toHaveBeenCalled();
  });

  it.each(ROLES)('says an Offline knowledgebase cannot be reached, as %s', (role) => {
    offline.value = true;
    renderInEditor(<ConnectView />, chromeValue(role));
    expect(screen.getByText('No Connections to an Offline Knowledgebase')).toBeTruthy();
    expect(api.apiKnowledgeOverview).not.toHaveBeenCalled();
  });

  it('draws nothing without a knowledgebase', () => {
    const { container } = renderInEditor(
      <ConnectView />,
      chromeValue('edit', { documentId: null }),
    );
    expect(container.textContent).toBe('');
  });
});
