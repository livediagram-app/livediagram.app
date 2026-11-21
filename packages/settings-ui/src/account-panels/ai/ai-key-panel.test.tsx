// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { withAccountHost } from '../../test/account-host';
import { AiKeyPanel } from './AiKeyPanel';
import { aiKeyPath, modelLabel, type AiKeysAnswer, type AiKeyState } from './ai-keys';

// Settings › AI (liveworkspace/docs/specs/003-accounts/ai-keys.md "Settings"): Built-In AI or Your Own Key, a key
// written once and never shown again, its model changed and the key removed; a team's key for its admins, and only
// word of it for its members.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const KEY = 'sk-ant-api03-planted-secret-key-4f2a';
const PROVIDERS: AiKeysAnswer['providers'] = [
  {
    id: 'anthropic',
    label: 'Anthropic (Claude)',
    keyPrefix: 'sk-ant-',
    defaultModel: 'claude-fable-5-2',
    models: [
      { id: 'claude-fable-5-2', label: 'Claude Fable 5.2' },
      { id: 'claude-haiku-5-5', label: 'Claude Haiku 5.5' },
    ],
  },
  {
    id: 'openai',
    label: 'OpenAI',
    keyPrefix: 'sk-',
    defaultModel: 'gpt-6.2-astra',
    models: [{ id: 'gpt-6.2-astra', label: 'GPT-6.2 Astra' }],
  },
];
const SET: AiKeyState = {
  provider: 'anthropic',
  model: 'claude-fable-5-2',
  hint: '4f2a',
  setAt: 1_790_000_000_000,
};

let state: AiKeysAnswer;
let refusal: { status: number; error: string } | null;
let sent: { url: string; method: string; body: unknown }[];
let container: HTMLDivElement;
let root: Root;

const json = (status: number, body: unknown) =>
  Promise.resolve(new Response(JSON.stringify(body), { status }));

beforeEach(() => {
  state = { available: true, key: null, teams: [], providers: PROVIDERS };
  refusal = null;
  sent = [];
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string, init?: RequestInit) => {
      const method = init?.method ?? 'GET';
      const body = init?.body
        ? (JSON.parse(String(init.body)) as Record<string, string>)
        : undefined;
      sent.push({ url, method, body });
      if (method === 'GET') return json(200, state);
      if (refusal) return json(refusal.status, { error: refusal.error });
      const team = /teams\/([^/]+)\/ai-key/.exec(url)?.[1];
      const apply = (key: AiKeyState | null) => {
        if (team)
          state = { ...state, teams: state.teams.map((t) => (t.id === team ? { ...t, key } : t)) };
        else state = { ...state, key };
      };
      const current = team ? state.teams.find((t) => t.id === team)!.key : state.key;
      if (method === 'PUT')
        apply({
          provider: body!.provider as 'anthropic',
          model: body!.model!,
          hint: body!.key!.slice(-4),
          setAt: 1_790_000_000_000,
        });
      if (method === 'PATCH') apply({ ...current!, model: body!.model! });
      if (method === 'DELETE') apply(null);
      return json(200, state);
    }),
  );
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

const settle = () => act(async () => new Promise((r) => setTimeout(r, 0)));
const buttons = (name: string) =>
  [...container.querySelectorAll('button')].filter((b) => b.textContent === name);
const press = async (name: string, nth = 0) => {
  await act(async () => buttons(name)[nth]!.click());
  await settle();
};
const field = () => container.querySelector<HTMLInputElement>('input[type=password]')!;
function type(input: HTMLInputElement, value: string) {
  const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
  act(() => {
    set.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}
function choose(select: HTMLSelectElement, value: string) {
  act(() => {
    select.value = value;
    select.dispatchEvent(new Event('change', { bubbles: true }));
  });
}
const render = async () => {
  act(() => root.render(withAccountHost(<AiKeyPanel />)));
  await settle();
};
const writes = () => sent.filter((s) => s.method !== 'GET');

describe('Settings › AI, your own key', () => {
  it('starts on Built-In AI, and saves a key once, write-only, never showing it again', async () => {
    await render();
    expect(buttons('Built-In AI')[0]!.getAttribute('aria-pressed')).toBe('true');
    expect(field()).toBeNull();
    await press('Your Own Key');
    const input = field();
    expect(input.autocomplete).toBe('off');
    type(input, KEY);
    await press('Save Key');
    expect(writes()).toEqual([
      {
        url: '/api/account/ai-key',
        method: 'PUT',
        body: { provider: 'anthropic', model: 'claude-fable-5-2', key: KEY },
      },
    ]);
    expect(container.querySelector('[data-ai-key-state]')?.textContent).toContain(
      'Key ending 4f2a',
    );
    expect(field()).toBeNull();
    expect(container.innerHTML).not.toContain(KEY);
  });

  it("sends the chosen provider's model, and nothing until a key is typed", async () => {
    await render();
    await press('Your Own Key');
    await press('OpenAI');
    expect(buttons('Save Key')[0]!.disabled).toBe(true);
    type(field(), 'sk-proj-something-long-9c1d');
    await press('Save Key');
    expect(writes()[0]!.body).toEqual({
      provider: 'openai',
      model: 'gpt-6.2-astra',
      key: 'sk-proj-something-long-9c1d',
    });
  });

  it('says why a key was refused, in our words, and clears the field', async () => {
    refusal = { status: 422, error: 'key_rejected' };
    await render();
    await press('Your Own Key');
    type(field(), KEY);
    await press('Save Key');
    expect(container.querySelector('[role=alert]')?.textContent).toBe(
      'The provider didn’t accept that key. Check it and try again.',
    );
    expect(field().value).toBe('');
  });

  it('changes the model, replaces the key and removes it, asking first', async () => {
    state = { ...state, key: SET };
    await render();
    expect(container.querySelector('[data-ai-key-provider]')?.textContent).toBe(
      'Anthropic (Claude)',
    );
    choose(container.querySelector('select')!, 'claude-haiku-5-5');
    await settle();
    expect(writes().at(-1)).toEqual({
      url: '/api/account/ai-key',
      method: 'PATCH',
      body: { model: 'claude-haiku-5-5' },
    });

    await press('Replace Key');
    expect(buttons('Built-In AI')).toHaveLength(0);
    await press('Cancel');
    await press('Replace Key');
    type(field(), 'sk-ant-api03-a-new-planted-key-7777');
    await press('Replace Key');
    expect(writes().at(-1)).toMatchObject({ method: 'PUT', body: { model: 'claude-haiku-5-5' } });
    expect(container.querySelector('[data-ai-key-state]')?.textContent).toContain(
      'Key ending 7777',
    );

    await press('Remove');
    expect(writes().filter((w) => w.method === 'DELETE')).toHaveLength(0);
    await press('Remove now');
    expect(writes().at(-1)).toMatchObject({ method: 'DELETE' });
    expect(buttons('Built-In AI')[0]!.getAttribute('aria-pressed')).toBe('true');
  });

  it("says when keys can't be kept here, and when Settings couldn't be read", async () => {
    state = { ...state, available: false };
    await render();
    expect(container.textContent).toContain('AI keys can’t be kept here just now.');
    act(() => root.unmount());
    root = createRoot(container);
    vi.mocked(fetch).mockImplementationOnce(() => json(500, { error: 'boom' }));
    await render();
    expect(container.querySelector('[role=alert]')?.textContent).toContain('Something went wrong');
    await press('Try Again');
    expect(container.textContent).toContain('Your Key');
  });
});

describe("Settings › AI, a team's key", () => {
  it('is an editor for its admins and a word for its members, with no ending', async () => {
    state = {
      ...state,
      teams: [
        { id: 'team_1', name: 'Design', canManage: true, key: null },
        {
          id: 'team_2',
          name: 'Ops',
          canManage: false,
          key: { ...SET, provider: 'openai', hint: '' },
        },
        { id: 'team_3', name: 'Docs', canManage: false, key: null },
      ],
    };
    await render();
    expect(container.textContent).toContain('Your Teams’ Keys');
    const members = [...container.querySelectorAll('[data-ai-team-member]')].map(
      (p) => p.textContent,
    );
    expect(members).toEqual([
      'Uses the team’s OpenAI key in the team’s work. Only its admins can change it.',
      'No team key: the team’s work uses your key, or built-in AI. Its admins can add one.',
    ]);
    await press('Your Own Key', 1);
    type(field(), KEY);
    await press('Save Key');
    expect(writes()).toEqual([
      {
        url: '/api/account/teams/team_1/ai-key',
        method: 'PUT',
        body: expect.objectContaining({ key: KEY }),
      },
    ]);
    expect(container.textContent).toContain('Key ending 4f2a');
  });
});

describe('the helpers', () => {
  it('name a path, a model and a provider', () => {
    expect(aiKeyPath('a/b')).toBe('/teams/a%2Fb/ai-key');
    expect(modelLabel(PROVIDERS, { ...SET, model: 'gone' })).toBe('gone');
    expect(modelLabel([], SET)).toBe('claude-fable-5-2');
  });
});
