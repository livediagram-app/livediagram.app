// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { KnowledgeAiSettings } from '@liveknowledge/api-schema';
import { announceAiKeyChanged } from '@liveworkspace/settings-ui/ai-source';

// The source line in liveknowledge (docs/specs/030-knowledgebase/search-and-ask.md "The source line"): which key
// answers, from `GET ai`, who may change it, a key that will not open, and a fresh read when Settings changes a key.
const opened = vi.hoisted(() => ({ settings: vi.fn(), ai: vi.fn() }));
vi.mock('@liveworkspace/workbench/lib/open-settings', () => ({
  requestOpenSettings: opened.settings,
}));
vi.mock('./AiSettingsButton', () => ({ openAiSettingsFrom: opened.ai }));
const track = vi.hoisted(() => vi.fn());
vi.mock('@/lib/telemetry', () => ({ track }));
const store = vi.hoisted(() => ({
  refresh: vi.fn(async () => {}),
  get: vi.fn((): unknown => ({ status: 'idle' })),
}));
vi.mock('@/lib/knowledge-ask/ai-settings-store', () => ({ aiSettingsStore: store }));

import { KnowledgeAiSource, knowledgeAiLine } from './KnowledgeAiSource';

const settings = (over: Partial<KnowledgeAiSettings> = {}): KnowledgeAiSettings => ({
  provider: 'anthropic',
  providers: [],
  hasKey: false,
  builtIn: true,
  keyHint: '',
  model: 'claude-fable-5-2',
  models: [{ id: 'claude-fable-5-2', label: 'Claude Fable 5.2' }],
  ...over,
});
const ready = (over: Partial<KnowledgeAiSettings> = {}) =>
  ({ status: 'ready', settings: settings(over) }) as const;
const WHO = { ownerId: 'o1', shareCode: null };

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('which AI answers here', () => {
  it('is nothing while unread or with no AI at all, and holds its place while it reads', () => {
    expect(knowledgeAiLine({ status: 'loading' }, true)).toEqual({ kind: 'loading' });
    expect(knowledgeAiLine({ status: 'idle' }, true)).toBeNull();
    expect(knowledgeAiLine(ready({ builtIn: false }), true)).toBeNull();
  });

  it('is built-in AI, for anyone signed in to change with a key of their own', () => {
    expect(knowledgeAiLine(ready(), false)).toEqual({ kind: 'built-in', canChange: true });
  });

  it('is the knowledgebase’s own key, for those who manage it, named by its model', () => {
    expect(knowledgeAiLine(ready({ hasKey: true }), true)).toEqual({
      kind: 'key',
      owner: 'item',
      provider: 'anthropic',
      model: 'Claude Fable 5.2',
      canChange: true,
    });
    expect(knowledgeAiLine(ready({ hasKey: true }), false)).toMatchObject({ canChange: false });
  });

  it('is the team’s key for its admins alone, and the person’s own for them, on its own provider', () => {
    const shared = { usesModel: 'gpt-6.2-astra', usesProvider: 'openai' as const };
    expect(knowledgeAiLine(ready({ uses: 'team', ...shared }), true)).toEqual({
      kind: 'key',
      owner: 'team',
      provider: 'openai',
      model: 'gpt-6.2-astra',
      canChange: false,
    });
    expect(
      knowledgeAiLine(
        ready({ uses: 'personal', ...shared, usesModelLabel: 'GPT-6.2 Astra' }),
        false,
      ),
    ).toMatchObject({ owner: 'you', model: 'GPT-6.2 Astra', canChange: true });
  });

  it('says a key that will not open, with no provider guessed', () => {
    expect(knowledgeAiLine(ready({ uses: 'personal' }), false)).toMatchObject({
      kind: 'failed',
      owner: 'you',
      provider: null,
      canChange: true,
    });
  });
});

describe('the line', () => {
  it('opens Settings › AI from built-in AI, and counts a key added there once Settings says so', async () => {
    render(<KnowledgeAiSource state={ready()} who={WHO} documentId="d1" manageAi={false} />);
    act(() => screen.getByRole('button', { name: 'Use Your Own Key, in Settings › AI' }).click());
    expect(opened.settings).toHaveBeenCalledWith('ai');
    expect(track).toHaveBeenCalledWith('UI', 'Opened', 'AiSourceSettings');
    store.get.mockReturnValue(ready({ uses: 'personal', usesModel: 'claude-fable-5-2' }));
    await act(async () => announceAiKeyChanged());
    expect(store.refresh).toHaveBeenCalledWith(WHO, 'd1');
    expect(track).toHaveBeenCalledWith('UI', 'Added', 'AiSourceKey');
  });

  it('counts nothing added when Settings left built-in AI in place, or was not opened from the line', async () => {
    render(<KnowledgeAiSource state={ready()} who={WHO} documentId="d1" manageAi={false} />);
    store.get.mockReturnValue(ready());
    await act(async () => announceAiKeyChanged());
    act(() => screen.getByRole('button').click());
    await act(async () => announceAiKeyChanged());
    store.get.mockReturnValue({ status: 'loading' });
    await act(async () => announceAiKeyChanged());
    expect(track).not.toHaveBeenCalledWith('UI', 'Added', 'AiSourceKey');
  });

  it('opens the knowledgebase’s AI Settings on its own key', () => {
    render(
      <KnowledgeAiSource state={ready({ hasKey: true })} who={WHO} documentId="d1" manageAi />,
    );
    expect(screen.getByText('This Knowledgebase’s Key')).toBeTruthy();
    act(() => screen.getByRole('button', { name: 'Change, in Settings › AI' }).click());
    expect(opened.ai).toHaveBeenCalled();
    expect(opened.settings).not.toHaveBeenCalled();
  });
});
