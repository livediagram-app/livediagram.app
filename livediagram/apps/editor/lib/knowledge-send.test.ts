// Send to Knowledge Base, livediagram's side (docs/specs/013-workspace/send-to-knowledge.md): nothing is captured
// without an open tab, the capture reads the open tab when pressed, the picture draws the gathered part only, and the
// summary route's answers and refusals reach the picker as it reads them.
import { afterEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({ apiFetch: vi.fn() }));
vi.mock('@/lib/api/core', () => ({ API_BASE: 'https://api', apiFetch: api.apiFetch }));
vi.mock('@liveworkspace/workbench/lib/icon-registry', () => ({
  ensureIconCatalogs: async () => {},
}));
const drawn = vi.hoisted(() => ({ ids: [] as string[][] }));
vi.mock('@/lib/export-as-seen', () => ({ tabAsSeen: (t: unknown) => t }));
vi.mock('@/lib/export-tab', () => ({
  renderTabToCanvas: async (tab: { elements: { id: string }[] }) => {
    drawn.ids.push(tab.elements.map((e) => e.id));
    return { width: 40, height: 20, toDataURL: () => 'data:image/png;base64,QUJD' };
  },
}));

import { captureSelected, knowledgeSummariser, setKnowledgeTabSource } from './knowledge-send';

const tab = {
  id: 't1',
  elements: [
    {
      id: 'a',
      type: 'shape',
      shape: 'rectangle',
      x: 0,
      y: 0,
      width: 10,
      height: 10,
      label: 'Cart',
    },
    {
      id: 'b',
      type: 'shape',
      shape: 'rectangle',
      x: 50,
      y: 0,
      width: 10,
      height: 10,
      label: 'Pay',
    },
  ],
};

afterEach(() => {
  setKnowledgeTabSource(null);
  api.apiFetch.mockReset();
  drawn.ids = [];
});

describe('captureSelected', () => {
  it('captures nothing without an open tab, or with nothing selected', () => {
    expect(captureSelected(['a'])).toBeNull();
    setKnowledgeTabSource({ tab: () => tab as never, images: async () => undefined });
    expect(captureSelected([])).toBeNull();
    expect(captureSelected(['gone'])).toBeNull();
  });

  it('reads the open tab when pressed and draws only the selected part', async () => {
    const images = vi.fn(async () => undefined);
    setKnowledgeTabSource({ tab: () => tab as never, images });
    const capture = captureSelected(['a'])!;
    expect(capture).toMatchObject({ tabId: 't1', elementIds: ['a'], heading: 'Cart' });
    expect(await capture.picture()).toEqual({ png: 'QUJD', width: 40, height: 20 });
    expect(drawn.ids).toEqual([['a']]);
    expect(images).toHaveBeenCalled();
  });

  it('still draws when the images cannot load', async () => {
    setKnowledgeTabSource({
      tab: () => tab as never,
      images: async () => Promise.reject(new Error('offline')),
    });
    expect(await captureSelected(['a', 'b'])!.picture()).not.toBeNull();
  });
});

describe('knowledgeSummariser', () => {
  const ask = { tabId: 't1', selection: { items: [], links: [] }, focus: 'checkout' };
  const answer = (status: number, body: unknown) =>
    ({ ok: status < 300, status, json: async () => body }) as Response;

  it('posts the selection with its focus and team, and reads the summary', async () => {
    api.apiFetch.mockResolvedValue(
      answer(200, { markdown: 'It pays.', provider: 'x', model: 'y' }),
    );
    expect(await knowledgeSummariser('D 1', 'team_1')(ask)).toEqual({
      ok: true,
      markdown: 'It pays.',
    });
    const [url, init] = api.apiFetch.mock.calls[0]!;
    expect(url).toBe('https://api/documents/D%201/knowledge-summary');
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({
      tabId: 't1',
      selection: { items: [], links: [] },
      focus: 'checkout',
      teamId: 'team_1',
    });
  });

  it('passes a credits refusal on with whose month it is', async () => {
    api.apiFetch.mockResolvedValue(
      answer(429, {
        error: 'ai_credits_used',
        message: 'Used.',
        limit: 'aiCreditsPerMonth',
        owner: 'p:u1',
        used: 50,
        max: 50,
      }),
    );
    expect(await knowledgeSummariser('D', null)({ ...ask, focus: '' })).toEqual({
      ok: false,
      error: 'ai_credits_used',
      message: 'Used.',
      limit: 'aiCreditsPerMonth',
      owner: 'p:u1',
      used: 50,
      max: 50,
    });
    expect(
      JSON.parse((api.apiFetch.mock.calls[0]![1] as RequestInit).body as string),
    ).not.toHaveProperty('focus');
  });

  it('says plainly when the answer is unreadable', async () => {
    api.apiFetch.mockResolvedValue({
      ok: false,
      status: 502,
      json: async () => Promise.reject(new Error('html')),
    });
    const out = await knowledgeSummariser('D', null)(ask);
    expect(out).toMatchObject({ ok: false, error: 'summary_failed' });
    api.apiFetch.mockResolvedValue(answer(500, { error: 'x' }));
    expect(await knowledgeSummariser('D', null)(ask)).toEqual({
      ok: false,
      error: 'x',
      message: "Couldn't write the summary.",
    });
  });
});
