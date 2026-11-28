// @vitest-environment jsdom

// Slack and Teams (docs/specs/030-knowledgebase/chat-apps.md "Connecting"): each platform's state, Slack sent to its
// install page, Teams' code shown and watched for, Disconnect asked first, an install's return said, and a server
// that offers neither.
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { KnowledgeChatApps } from '@liveknowledge/api-schema';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

import { track } from '@/lib/telemetry';
import type { AskSession } from '@/components/ask/useAskSession';
import { chatReturnOf } from '@/lib/chat-apps/chat-apps-open';
import { ChatAppsDialog, TEAMS_POLL_MS } from './ChatAppsDialog';

const session = {
  documentId: 'kb',
  name: 'Handbook',
  who: { owner: 'user_o' },
  rights: {},
} as unknown as AskSession;

const NONE: KnowledgeChatApps = {
  slack: { offered: true, connection: null },
  teams: { offered: true, connection: null, appLink: 'https://teams.microsoft.com/l/app/x' },
};
const SLACK_ON: KnowledgeChatApps = {
  ...NONE,
  slack: { offered: true, connection: { name: 'Acme', connectedAt: Date.UTC(2026, 10, 21) } },
};

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.clearAllMocks();
});

function open(
  apps: KnowledgeChatApps[],
  back: Parameters<typeof ChatAppsDialog>[0]['back'] = null,
) {
  let call = 0;
  const api = {
    read: vi.fn(async () => apps[Math.min(call++, apps.length - 1)]!),
    startSlack: vi.fn(async () => ({ url: 'https://slack.com/oauth/v2/authorize?state=s' })),
    startTeams: vi.fn(async () => ({ code: 'ABCD-EFGH', expiresAt: Date.now() + 900_000 })),
    disconnect: vi.fn(async () => NONE),
    go: vi.fn(),
  };
  render(<ChatAppsDialog session={session} back={back} onClose={vi.fn()} api={api} />);
  return api;
}
const row = (name: string) => screen.getByRole('region', { name });

describe('the Slack and Teams dialog', () => {
  it('says what each platform is connected to', async () => {
    open([SLACK_ON]);
    expect(screen.getByRole('dialog', { name: 'Slack and Teams' })).toBeTruthy();
    await waitFor(() =>
      expect(within(row('Slack')).getByText(/Connected to Acme since 21 Nov 2026/)).toBeTruthy(),
    );
    expect(within(row('Microsoft Teams')).getByText('Not connected')).toBeTruthy();
    expect(within(row('Slack')).getByRole('button', { name: 'Disconnect' })).toBeTruthy();
    expect(track).toHaveBeenCalledWith('UI', 'Opened', 'ChatApps');
  });

  it("sends the Editor to Slack's install page", async () => {
    const api = open([NONE]);
    fireEvent.click(await within(row('Slack')).findByRole('button', { name: 'Connect Slack' }));
    await waitFor(() =>
      expect(api.go).toHaveBeenCalledWith('https://slack.com/oauth/v2/authorize?state=s'),
    );
    expect(track).toHaveBeenCalledWith('UI', 'Used', 'ChatConnectSlack');
  });

  it("shows Teams' code, and watches for the bot to take it", async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    const connected = {
      ...NONE,
      teams: { ...NONE.teams, connection: { name: 'Microsoft Teams', connectedAt: 1 } },
    };
    const api = open([NONE, NONE, connected]);
    await act(async () => {
      await Promise.resolve();
    });
    fireEvent.click(within(row('Microsoft Teams')).getByRole('button', { name: 'Connect Teams' }));
    expect(await screen.findByText('connect ABCD-EFGH')).toBeTruthy();
    expect(screen.getByRole('link', { name: /Open Teams/ }).getAttribute('href')).toContain(
      'teams.microsoft.com',
    );
    await act(async () => {
      vi.advanceTimersByTime(TEAMS_POLL_MS);
    });
    await act(async () => {
      vi.advanceTimersByTime(TEAMS_POLL_MS);
    });
    await waitFor(() => expect(screen.queryByText('connect ABCD-EFGH')).toBeNull());
    expect(api.read).toHaveBeenCalledTimes(3);
    expect(within(row('Microsoft Teams')).getByText(/Connected to Microsoft Teams/)).toBeTruthy();
  });

  it('asks before disconnecting, and says the new state', async () => {
    const api = open([SLACK_ON]);
    fireEvent.click(await within(row('Slack')).findByRole('button', { name: 'Disconnect' }));
    const confirm = await screen.findByRole('dialog', { name: 'Disconnect Slack?' });
    expect(confirm.textContent).toContain('Acme stops getting answers');
    fireEvent.click(within(confirm).getByRole('button', { name: 'Disconnect' }));
    await waitFor(() => expect(api.disconnect).toHaveBeenCalledWith(session.who, 'kb', 'slack'));
    await waitFor(() => expect(within(row('Slack')).getByText('Not connected')).toBeTruthy());
  });

  it("says how Slack's install came back, and what this server doesn't offer", async () => {
    open(
      [
        {
          slack: { offered: false, connection: null },
          teams: { offered: false, connection: null, appLink: null },
        },
      ],
      'taken',
    );
    expect(screen.getByRole('status').textContent).toContain(
      'already connected to another knowledgebase',
    );
    await waitFor(() =>
      expect(within(row('Slack')).getByText('Not set up on this server')).toBeTruthy(),
    );
    expect(within(row('Slack')).queryByRole('button')).toBeNull();
  });

  it('reads only the outcomes Slack sends back', () => {
    expect(chatReturnOf('?chat=connected')).toBe('connected');
    expect(chatReturnOf('?chat=other')).toBeNull();
    expect(chatReturnOf('')).toBeNull();
  });
});
