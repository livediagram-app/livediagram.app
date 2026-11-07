import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiDropSuggestion, apiListSuggestions, apiRemoveSuggestion } from './suggestions';

vi.mock('../guest-token', () => ({ readGuestToken: () => null }));

// docs/specs/009-elements/team-pieces.md "The wire": a drop carries the box and the words alone; the read and the
// remove are the box's own routes.
afterEach(() => vi.unstubAllGlobals());

describe('the Suggestion Box client', () => {
  it('drops a note with only the box and its words', async () => {
    const fetchSpy = vi.fn(async () => Response.json({}, { status: 201 }));
    vi.stubGlobal('fetch', fetchSpy);
    await apiDropSuggestion('guest_1', 'doc 1', 'tab/1', 'box', 'More plants', 'code');
    const [url, init] = fetchSpy.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/documents/doc%201/tabs/tab%2F1/suggestions');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({ elementId: 'box', text: 'More plants' });
  });

  it('hands back a refusal’s code for the box to word', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json({ error: 'box_full' }, { status: 409 })),
    );
    await expect(apiDropSuggestion('guest_1', 'd', 't', 'box', 'Idea')).rejects.toMatchObject({
      code: 'box_full',
    });
  });

  it('reads a box’s notes and removes one', async () => {
    const notes = [{ id: 's1', text: 'Fruit', day: '2026-11-05' }];
    const fetchSpy = vi.fn(async (_url: string, init?: RequestInit) =>
      init?.method === 'DELETE'
        ? new Response(null, { status: 204 })
        : Response.json({ suggestions: notes }),
    );
    vi.stubGlobal('fetch', fetchSpy);
    expect(await apiListSuggestions('guest_1', 'd', 't', 'box 1')).toEqual(notes);
    expect(fetchSpy.mock.calls[0]![0]).toBe(
      '/api/documents/d/tabs/t/suggestions?elementId=box%201',
    );
    await apiRemoveSuggestion('guest_1', 'd', 't', 's1');
    const [url, init] = fetchSpy.mock.calls[1] as unknown as [string, RequestInit];
    expect(url).toBe('/api/documents/d/tabs/t/suggestions/s1');
    expect(init.method).toBe('DELETE');
  });
});
