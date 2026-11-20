// @vitest-environment jsdom

// AI Settings (docs/specs/030-knowledgebase/search-and-ask.md "Ask", "Share roles"): the key's state, who gets the
// controls, and that the key is held nowhere once it has been sent.
import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { KnowledgeAiSettings } from '@liveknowledge/api-schema';
import { ApiError } from '@liveworkspace/workbench/lib/api/api-error';

const api = vi.hoisted(() => ({
  apiKnowledgeAi: vi.fn(),
  apiSetKnowledgeAiKey: vi.fn(),
  apiRemoveKnowledgeAiKey: vi.fn(),
  apiSetKnowledgeAiModel: vi.fn(),
}));
vi.mock('@/lib/api/knowledge', async (actual) => ({
  ...(await actual<typeof import('@/lib/api/knowledge')>()),
  ...api,
}));
vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));
vi.mock('@/hooks/persistence/useIsOfflineDocument', () => ({
  useIsOfflineDocument: () => offline.value,
}));
const offline = vi.hoisted(() => ({ value: false }));

import { track } from '@/lib/telemetry';
import { aiSettingsStore } from '@/lib/knowledge-ask/ai-settings-store';
import { closeAiSettings, openAiSettings } from '@/lib/knowledge-ask/ai-settings-open';
import { AiSettingsHost } from './AiSettingsDialog';
import { ROLES, chromeValue, renderInEditor, type Role } from './test-chrome';

const SECRET = 'sk-ant-api03-THIS-IS-THE-SECRET-4f2a';
const MODELS = [
  { id: 'claude-fable-5-2', label: 'Claude Fable 5.2' },
  { id: 'claude-haiku-5-5', label: 'Claude Haiku 5.5' },
];
const settings = (over: Partial<KnowledgeAiSettings> = {}): KnowledgeAiSettings => ({
  hasKey: false,
  keyHint: '',
  model: 'claude-fable-5-2',
  models: MODELS,
  ...over,
});

beforeEach(() => {
  offline.value = false;
  api.apiKnowledgeAi.mockResolvedValue(settings());
});
afterEach(() => {
  cleanup();
  act(() => closeAiSettings());
  aiSettingsStore.reset();
  vi.clearAllMocks();
});

async function open(role: Role = 'edit', over: Record<string, unknown> = {}) {
  const utils = renderInEditor(<AiSettingsHost />, chromeValue(role, over));
  act(() => openAiSettings());
  await screen.findByRole('dialog', { name: 'AI Settings' });
  await waitFor(() => expect(screen.getByRole('status').textContent).not.toBe(''));
  return utils;
}
const keyField = () => document.querySelector<HTMLInputElement>('[data-ai-key-field]');
const type = (value: string) => {
  const field = keyField()!;
  field.value = value;
  fireEvent.input(field);
};

describe('the key state', () => {
  it('says No Key Yet, then the ending once one is saved', async () => {
    await open();
    expect(screen.getByRole('status').textContent).toBe('No Key Yet');
    api.apiSetKnowledgeAiKey.mockResolvedValue(settings({ hasKey: true, keyHint: '4f2a' }));
    type(SECRET);
    fireEvent.click(screen.getByRole('button', { name: 'Save Key' }));
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('Key Ending 4f2a'));
    expect(screen.getByRole('button', { name: 'Replace' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Remove' })).toBeTruthy();
  });

  it('says the two plain sentences', async () => {
    await open();
    expect(screen.getByText(/encrypted when it is saved and is never shown again/)).toBeTruthy();
    expect(screen.getByText(/your team pays Anthropic for what Ask uses/)).toBeTruthy();
  });
});

describe('the key field', () => {
  it('is a password field no browser fills or keeps', async () => {
    await open();
    const field = keyField()!;
    expect(field.type).toBe('password');
    expect(field.getAttribute('autocomplete')).toBe('off');
    expect(field.closest('form')!.getAttribute('autocomplete')).toBe('off');
  });

  it('is cleared when the key is sent, and the key is in nothing the page holds afterwards', async () => {
    const { container } = await open();
    let answer!: (value: KnowledgeAiSettings) => void;
    api.apiSetKnowledgeAiKey.mockReturnValue(new Promise((resolve) => (answer = resolve)));
    const logs = ['log', 'info', 'warn', 'error', 'debug'].map((level) =>
      vi.spyOn(console, level as 'log').mockImplementation(() => {}),
    );
    type(SECRET);
    fireEvent.click(screen.getByRole('button', { name: 'Save Key' }));
    // Sent once, to the route, and already gone from the field while the request is out.
    expect(api.apiSetKnowledgeAiKey).toHaveBeenCalledTimes(1);
    expect(api.apiSetKnowledgeAiKey.mock.calls[0]![2]).toBe(SECRET);
    expect(keyField()!.value).toBe('');
    await act(async () => answer(settings({ hasKey: true, keyHint: '4f2a' })));
    expect(keyField()!.value).toBe('');
    expect(document.body.innerHTML).not.toContain(SECRET);
    expect(container.innerHTML).not.toContain('THIS-IS-THE-SECRET');
    expect(JSON.stringify(aiSettingsStore.get('d1'))).not.toContain('SECRET');
    expect(JSON.stringify(vi.mocked(track).mock.calls)).not.toContain('SECRET');
    expect(JSON.stringify([localStorage, sessionStorage])).not.toContain('SECRET');
    for (const log of logs) expect(JSON.stringify(log.mock.calls)).not.toContain('SECRET');
    expect(track).toHaveBeenCalledWith('UI', 'Added', 'AiKey');
  });

  it('is cleared when the key is refused, and the refusal is in words without the key', async () => {
    await open();
    api.apiSetKnowledgeAiKey.mockRejectedValue(new ApiError('set ai key', 400, 'invalid_key'));
    type(SECRET);
    fireEvent.click(screen.getByRole('button', { name: 'Save Key' }));
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('That is not a Claude API key.');
    expect(alert.textContent).not.toContain('SECRET');
    expect(keyField()!.value).toBe('');
    expect(screen.getByRole('status').textContent).toBe('No Key Yet');
  });

  it('sends nothing for an empty field', async () => {
    await open();
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Save Key' }).disabled).toBe(true);
    type('   ');
    fireEvent.submit(keyField()!.closest('form')!);
    expect(api.apiSetKnowledgeAiKey).not.toHaveBeenCalled();
  });
});

describe('removing the key', () => {
  it('asks first, then removes', async () => {
    api.apiKnowledgeAi.mockResolvedValue(settings({ hasKey: true, keyHint: '4f2a' }));
    api.apiRemoveKnowledgeAiKey.mockResolvedValue(settings());
    await open();
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
    expect(api.apiRemoveKnowledgeAiKey).not.toHaveBeenCalled();
    const confirm = await screen.findByRole('dialog', { name: 'Remove the Key?' });
    fireEvent.click(
      [...confirm.querySelectorAll('button')].find((b) => b.textContent === 'Remove')!,
    );
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('No Key Yet'));
    expect(api.apiRemoveKnowledgeAiKey).toHaveBeenCalledTimes(1);
    expect(track).toHaveBeenCalledWith('UI', 'Removed', 'AiKey');
  });

  it('keeps the key when the question is cancelled', async () => {
    api.apiKnowledgeAi.mockResolvedValue(settings({ hasKey: true, keyHint: '4f2a' }));
    await open();
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Cancel' }));
    expect(api.apiRemoveKnowledgeAiKey).not.toHaveBeenCalled();
    expect(screen.getByRole('status').textContent).toBe('Key Ending 4f2a');
  });
});

describe('the model', () => {
  it('is chosen from the models the route offers', async () => {
    api.apiSetKnowledgeAiModel.mockResolvedValue(settings({ model: 'claude-haiku-5-5' }));
    await open();
    const select = screen.getByRole<HTMLSelectElement>('combobox', { name: 'Model' });
    expect([...select.options].map((o) => o.textContent)).toEqual(MODELS.map((m) => m.label));
    fireEvent.change(select, { target: { value: 'claude-haiku-5-5' } });
    await waitFor(() => expect(select.value).toBe('claude-haiku-5-5'));
    expect(api.apiSetKnowledgeAiModel).toHaveBeenCalledWith(
      { ownerId: 'me', shareCode: null },
      'd1',
      'claude-haiku-5-5',
    );
  });
});

// search-and-ask.md "Share roles": add, replace or remove the key, model: Editor only.
describe.each(ROLES)('as %s', (role) => {
  const editor = role === 'edit';
  it(`${editor ? 'shows' : 'hides'} the key field, Remove and the model select`, async () => {
    // The route tells the ending to an Editor only.
    api.apiKnowledgeAi.mockResolvedValue(settings({ hasKey: true, keyHint: editor ? '4f2a' : '' }));
    await open(role);
    expect(screen.getByRole('status').textContent).toBe(editor ? 'Key Ending 4f2a' : 'Key Added');
    expect(keyField() !== null).toBe(editor);
    expect(screen.queryByRole('button', { name: 'Remove' }) !== null).toBe(editor);
    expect(screen.queryByRole('combobox', { name: 'Model' }) !== null).toBe(editor);
    expect(screen.getByText('Claude Fable 5.2')).toBeTruthy();
    expect(document.querySelector('[data-ai-settings-read-only]') === null).toBe(editor);
  });
});

describe('other states', () => {
  it('gives an Editor of a knowledgebase kept Offline no controls and says why', async () => {
    offline.value = true;
    await open('edit');
    expect(keyField()).toBeNull();
    expect(screen.getByText(/kept Offline has no Ask/)).toBeTruthy();
  });

  it('says so when the settings cannot be read, and reads them again when asked', async () => {
    api.apiKnowledgeAi.mockRejectedValueOnce(new Error('network'));
    await open();
    expect(screen.getByRole('alert').textContent).toContain('could not be read');
    fireEvent.click(screen.getByRole('button', { name: 'Try Again' }));
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('No Key Yet'));
    expect(api.apiKnowledgeAi).toHaveBeenCalledTimes(2);
  });
});
