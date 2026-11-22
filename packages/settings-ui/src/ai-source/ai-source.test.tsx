// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AiKeyFailure } from '@liveworkspace/ai/key-failure';
import type { AiKeysAnswer, AiKeyState } from '../account-panels/ai/ai-keys';
import type { SettingsApiResult, SettingsRequest } from '../request';
import { AiSource } from './AiSource';
import {
  AI_KEY_CHANGED_EVENT,
  aiSourceOf,
  announceAiKeyChanged,
  type AiSourceLine,
} from './ai-source-model';
import { useAiSource, type AiSourceEvent } from './useAiSource';

// The source line (liveworkspace/docs/specs/003-accounts/ai-keys.md "The source line (AiSource)"): which AI a feature
// runs on, in the order the servers follow, its action for those who may change it, a failing key said with a fix,
// and a fresh read each time Settings › AI changes something. Never any part of a key.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const PROVIDERS: AiKeysAnswer['providers'] = [
  {
    id: 'anthropic',
    label: 'Anthropic (Claude)',
    keyPrefix: 'sk-ant-',
    defaultModel: 'claude-fable-5-2',
    models: [{ id: 'claude-fable-5-2', label: 'Claude Fable 5.2' }],
  },
  {
    id: 'openai',
    label: 'OpenAI',
    keyPrefix: 'sk-',
    defaultModel: 'gpt-6.2-astra',
    models: [{ id: 'gpt-6.2-astra', label: 'GPT-6.2 Astra' }],
  },
];
const MINE: AiKeyState = {
  provider: 'anthropic',
  model: 'claude-fable-5-2',
  hint: '4f2a',
  setAt: 1,
};
const TEAMS: AiKeyState = { provider: 'openai', model: 'gpt-6.2-astra', hint: '9b9b', setAt: 2 };
const answer = (over: Partial<AiKeysAnswer> = {}): AiKeysAnswer => ({
  available: true,
  key: null,
  teams: [],
  providers: PROVIDERS,
  ...over,
});
const failed = (over: Partial<AiKeyFailure> = {}): AiKeyFailure => ({
  source: 'account',
  provider: 'anthropic',
  kind: 'bad-key',
  ...over,
});

describe('which AI the line names', () => {
  it('is built-in AI with no key, with the action where keys can be kept', () => {
    expect(aiSourceOf(answer(), null)).toEqual({ kind: 'built-in', canChange: true });
    expect(aiSourceOf(answer({ available: false }), null)).toEqual({
      kind: 'built-in',
      canChange: false,
    });
  });

  it('is the person’s own key, by provider and model', () => {
    expect(aiSourceOf(answer({ key: MINE }), null)).toEqual({
      kind: 'key',
      owner: 'you',
      provider: 'anthropic',
      model: 'Claude Fable 5.2',
      canChange: true,
    });
  });

  it('is the item’s team’s key first, for its admins to change', () => {
    const teams = [
      { id: 'team-1', name: 'Design', canManage: false, key: TEAMS },
      { id: 'team-2', name: 'Ops', canManage: true, key: null },
    ];
    expect(aiSourceOf(answer({ key: MINE, teams }), 'team-1')).toEqual({
      kind: 'key',
      owner: 'team',
      provider: 'openai',
      model: 'GPT-6.2 Astra',
      canChange: false,
    });
    // A team with no key, or one the person is not in, falls to their own.
    expect(aiSourceOf(answer({ key: MINE, teams }), 'team-2')).toMatchObject({ owner: 'you' });
    expect(aiSourceOf(answer({ key: MINE, teams }), 'team-9')).toMatchObject({ owner: 'you' });
  });

  it('says a failed key, whose it is, and who may fix it', () => {
    const teams = [{ id: 'team-1', name: 'Design', canManage: true, key: TEAMS }];
    expect(aiSourceOf(answer(), null, failed())).toMatchObject({
      kind: 'failed',
      owner: 'you',
      provider: 'anthropic',
      canChange: true,
    });
    expect(aiSourceOf(answer({ teams }), 'team-1', failed({ source: 'team' }))).toMatchObject({
      owner: 'team',
      canChange: true,
    });
    expect(aiSourceOf(answer({ teams }), null, failed({ source: 'team' }))).toMatchObject({
      owner: 'team',
      canChange: false,
    });
    expect(aiSourceOf(answer(), null, failed({ source: 'item', provider: null }))).toMatchObject({
      owner: 'item',
      provider: null,
      canChange: false,
    });
  });

  it('announces a change on the window, for every mounted line', () => {
    const heard = vi.fn();
    window.addEventListener(AI_KEY_CHANGED_EVENT, heard);
    announceAiKeyChanged();
    window.removeEventListener(AI_KEY_CHANGED_EVENT, heard);
    expect(heard).toHaveBeenCalledTimes(1);
  });
});

let root: Root;
let host: HTMLDivElement;
beforeEach(() => {
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

const render = (node: React.ReactNode) => act(() => root.render(node));
const button = () => host.querySelector('button');

describe('the line', () => {
  it('says built-in AI with its allowance, and Use Your Own Key', () => {
    const act_ = vi.fn();
    render(
      <AiSource line={{ kind: 'built-in', canChange: true }} act={act_} allowance="10 a day." />,
    );
    expect(host.textContent).toContain('Built-in AI');
    expect(host.textContent).toContain('10 a day.');
    expect(button()?.textContent).toBe('Use Your Own Key');
    expect(button()?.getAttribute('aria-label')).toBe('Use Your Own Key, in Settings › AI');
    expect(button()?.className).toContain('cursor-pointer');
    act(() => button()!.click());
    expect(act_).toHaveBeenCalledTimes(1);
  });

  it('names a key by provider and model with Change, and a team’s for its members with no action', () => {
    const key: AiSourceLine = {
      kind: 'key',
      owner: 'you',
      provider: 'anthropic',
      model: 'Claude Fable 5.2',
      canChange: true,
    };
    render(<AiSource line={key} act={() => {}} />);
    expect(host.textContent).toContain('Your Key');
    expect(host.textContent).toContain('Anthropic · Claude Fable 5.2 · No daily limits');
    expect(button()?.textContent).toBe('Change');
    render(
      <AiSource
        line={{ ...key, owner: 'team', provider: 'openai', canChange: false }}
        act={null}
      />,
    );
    expect(host.textContent).toContain('Your Team’s Key');
    expect(host.textContent).toContain('OpenAI');
    expect(host.textContent).toContain('Only the team’s admins can change it.');
    expect(button()).toBeNull();
    render(
      <AiSource
        line={{ ...key, owner: 'item' }}
        act={null}
        itemKeyName="This Knowledgebase’s Key"
      />,
    );
    expect(host.textContent).toContain('This Knowledgebase’s Key');
  });

  it('says a failed key in its words, with Fix Key', () => {
    render(
      <AiSource
        line={{
          kind: 'failed',
          owner: 'you',
          provider: 'anthropic',
          words: 'Anthropic refused it.',
          canChange: true,
        }}
        act={() => {}}
        id="src"
      />,
    );
    expect(host.querySelector('#src')?.getAttribute('data-ai-source')).toBe('failed');
    expect(host.textContent).toContain('Your Key Needs Attention');
    expect(host.textContent).toContain('Anthropic refused it.');
    expect(button()?.textContent).toBe('Fix Key');
  });

  it('holds its place while it reads, and shows nothing with nothing to say', () => {
    render(<AiSource line={{ kind: 'loading' }} act={null} id="src" />);
    expect(host.querySelector('[aria-busy]')?.id).toBe('src');
    render(<AiSource line={null} act={null} />);
    expect(host.innerHTML).toBe('');
  });
});

// A stand-in for the account API: answers what it holds now, so a test can change it between reads.
function accountApi(first: AiKeysAnswer | 'error') {
  let held = first;
  const request = vi.fn(async (): Promise<SettingsApiResult<unknown>> =>
    held === 'error' ? { ok: false, status: 503, error: 'down' } : { ok: true, data: held },
  ) as unknown as SettingsRequest & ReturnType<typeof vi.fn>;
  return { request, hold: (next: AiKeysAnswer | 'error') => (held = next) };
}

function Line(props: {
  request: SettingsRequest | null;
  teamId?: string | null;
  failure?: AiKeyFailure | null;
  openSettings: () => void;
  track?: (event: AiSourceEvent) => void;
}) {
  const { line, act: action } = useAiSource(props);
  return <AiSource line={line} act={action} />;
}

const settle = () => act(async () => {});

describe('the line as a feature shows it', () => {
  it('reads once, opens Settings, and reads Your Key once a key is added and Settings closes, with no reload', async () => {
    const api = accountApi(answer());
    const openSettings = vi.fn();
    const track = vi.fn();
    render(<Line request={api.request} openSettings={openSettings} track={track} />);
    expect(host.querySelector('[aria-busy]')).not.toBeNull();
    await settle();
    expect(host.textContent).toContain('Built-in AI');
    expect(api.request).toHaveBeenCalledTimes(1);
    expect(api.request).toHaveBeenCalledWith('/ai-key');

    act(() => button()!.click());
    expect(openSettings).toHaveBeenCalledTimes(1);
    expect(track).toHaveBeenCalledWith('opened');

    api.hold(answer({ key: MINE }));
    await act(async () => announceAiKeyChanged());
    expect(host.textContent).toContain('Your Key');
    expect(button()?.textContent).toBe('Change');
    expect(track).toHaveBeenCalledWith('key-added');
    expect(track).toHaveBeenCalledTimes(2);
    expect(host.textContent).not.toContain('4f2a');
  });

  it('counts no key added when Settings was opened from a key', async () => {
    const api = accountApi(answer({ key: MINE }));
    const track = vi.fn();
    render(<Line request={api.request} openSettings={() => {}} track={track} />);
    await settle();
    act(() => button()!.click());
    await act(async () => announceAiKeyChanged());
    expect(track).toHaveBeenCalledTimes(1);
  });

  it('says a failure until Settings changes something, then the fresh answer', async () => {
    const api = accountApi(answer({ key: MINE }));
    render(<Line request={api.request} openSettings={() => {}} failure={failed()} />);
    await settle();
    expect(host.textContent).toContain('Needs Attention');
    await act(async () => announceAiKeyChanged());
    expect(host.textContent).not.toContain('Needs Attention');
    expect(host.textContent).toContain('Your Key');
  });

  it('shows nothing for a guest, or where the settings could not be read', async () => {
    render(<Line request={null} openSettings={() => {}} />);
    await settle();
    expect(host.innerHTML).toBe('');
    const api = accountApi('error');
    render(<Line request={api.request} openSettings={() => {}} />);
    await settle();
    expect(host.innerHTML).toBe('');
  });

  it('offers no action to a team member on the team’s key, nor where keys are not kept', async () => {
    const teams = [{ id: 'team-1', name: 'Design', canManage: false, key: TEAMS }];
    render(
      <Line
        request={accountApi(answer({ teams })).request}
        teamId="team-1"
        openSettings={() => {}}
      />,
    );
    await settle();
    expect(host.textContent).toContain('Your Team’s Key');
    expect(button()).toBeNull();
    render(
      <Line request={accountApi(answer({ available: false })).request} openSettings={() => {}} />,
    );
    await settle();
    expect(button()).toBeNull();
  });

  it('drops an answer that arrives after it is gone', async () => {
    let answerNow: (v: SettingsApiResult<unknown>) => void = () => {};
    const request = vi.fn(
      () => new Promise<SettingsApiResult<unknown>>((resolve) => (answerNow = resolve)),
    ) as unknown as SettingsRequest;
    render(<Line request={request} openSettings={() => {}} />);
    act(() => root.unmount());
    root = createRoot(host);
    await act(async () => answerNow({ ok: true, data: answer() }));
    expect(host.innerHTML).toBe('');
  });
});
