// @vitest-environment jsdom

// The source line in an editor (liveworkspace/docs/specs/003-accounts/ai-keys.md "The source line (AiSource)"): it
// reads the account's keys over the app's bearer door, only for a signed-in person, names the item's team's key, opens
// Settings on its AI category, follows a key added there with no reload, and counts both events. Never the key.
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { announceAiKeyChanged } from '@liveworkspace/settings-ui/ai-source';

const hoisted = vi.hoisted(() => ({
  track: vi.fn(),
  open: vi.fn(),
  bearer: vi.fn(async (): Promise<string | null> => 'bearer-1'),
}));
vi.mock('../../bindings', () => ({
  workbench: { track: hoisted.track, api: { currentBearer: hoisted.bearer } },
}));
vi.mock('../../lib/open-settings', () => ({ requestOpenSettings: hoisted.open }));

import { AiSourceScope, WorkbenchAiSource, hasOwnAiKey } from './WorkbenchAiSource';

const KEY = { provider: 'anthropic', model: 'claude-fable-5-2', hint: '4f2a', setAt: 1 };
const PROVIDERS = [
  {
    id: 'anthropic',
    label: 'Anthropic (Claude)',
    keyPrefix: 'sk-ant-',
    defaultModel: 'claude-fable-5-2',
    models: [{ id: 'claude-fable-5-2', label: 'Claude Fable 5.2' }],
  },
];
let held: Record<string, unknown>;
const fetchSpy = vi.fn(async (_url: string, _init?: RequestInit) => Response.json(held));

beforeEach(() => {
  held = { available: true, key: null, teams: [], providers: PROVIDERS };
  vi.stubGlobal('fetch', fetchSpy);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

const settle = () => act(async () => {});

describe('WorkbenchAiSource', () => {
  it('shows nothing, and reads nothing, for a guest', async () => {
    render(<WorkbenchAiSource />);
    await settle();
    expect(document.querySelector('[data-ai-source]')).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('reads Your Key once a key is added in the Settings it opened, with no reload, counting both', async () => {
    render(
      <AiSourceScope teamId={null} signedIn>
        <WorkbenchAiSource allowance="10 a day." id="src" />
      </AiSourceScope>,
    );
    await settle();
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0]!;
    expect(url).toBe('/api/workspace/account/ai-key');
    expect((init!.headers as Record<string, string>)['authorization']).toBe('Bearer bearer-1');
    expect(screen.getByText('Built-in AI')).toBeTruthy();
    expect(screen.getByText('10 a day.')).toBeTruthy();

    act(() => screen.getByRole('button', { name: 'Use Your Own Key, in Settings › AI' }).click());
    expect(hoisted.open).toHaveBeenCalledWith('ai');
    expect(hoisted.track).toHaveBeenCalledWith('UI', 'Opened', 'AiSourceSettings');

    held = { ...held, key: KEY };
    await act(async () => announceAiKeyChanged());
    expect(screen.getByText('Your Key')).toBeTruthy();
    expect(screen.getByText('Anthropic · Claude Fable 5.2 · No daily limits')).toBeTruthy();
    expect(hoisted.track).toHaveBeenCalledWith('UI', 'Added', 'AiSourceKey');
    expect(document.body.textContent).not.toContain('4f2a');
  });

  it('names the item’s team’s key from the scope, or the team a dialog says', async () => {
    held = {
      ...held,
      teams: [{ id: 't1', name: 'Design', canManage: false, key: KEY }],
    };
    render(
      <AiSourceScope teamId="t1" signedIn>
        <WorkbenchAiSource />
        <WorkbenchAiSource teamId={null} />
      </AiSourceScope>,
    );
    await settle();
    expect(screen.getByText('Your Team’s Key')).toBeTruthy();
    expect(screen.getByText('Built-in AI')).toBeTruthy();
  });

  it('says a failed key, with Fix Key, where the dialog says signed in itself', async () => {
    render(
      <WorkbenchAiSource
        signedIn
        failure={{ source: 'account', provider: 'anthropic', kind: 'no-credit' }}
      />,
    );
    await settle();
    expect(screen.getByText('Your Key Needs Attention')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Fix Key, in Settings › AI' })).toBeTruthy();
  });
});

describe('hasOwnAiKey', () => {
  it('is whether the person has a key of their own, false on any failure to read', async () => {
    expect(await hasOwnAiKey()).toBe(false);
    held = { ...held, key: KEY };
    expect(await hasOwnAiKey()).toBe(true);
    hoisted.bearer.mockResolvedValueOnce(null);
    expect(await hasOwnAiKey()).toBe(false);
  });
});
