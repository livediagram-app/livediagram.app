import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PageDraftRequest } from '@livedocuments/api-schema';
import { DESCRIBE_PAGE_WORDS } from '@/components/canvas/describe-page/describe-page-words';
import { draftPage, PageDraftRefusal } from './page-drafts';

vi.mock('../guest-token', () => ({
  readGuestToken: () => ({ token: 'guest-jwt', id: 'guest_1', expiresAt: 1 }),
}));

// Describe a Page's call (docs/specs/007-editor/describe-a-page.md "The dialog"): the words posted, the draft answered,
// the api's refusals thrown in its own words, anything else a failure.
const request: PageDraftRequest = {
  prompt: 'Pricing',
  documentId: 'doc_1',
  tabId: 't1',
  kind: 'slide',
};
const answer = (status: number, body: unknown) => {
  const seen: { url: string; init?: RequestInit }[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      seen.push({ url: String(url), init });
      return new Response(typeof body === 'string' ? body : JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
      });
    }),
  );
  return seen;
};
afterEach(() => vi.unstubAllGlobals());

describe('draftPage', () => {
  it('posts the words and answers the draft', async () => {
    const draft = { kind: 'writing', markdown: 'x' };
    const seen = answer(200, { draft, provider: 'built-in', model: 'm' });
    const out = await draftPage('guest_1', request, new AbortController().signal);
    expect(out.draft).toEqual(draft);
    expect(seen[0]!.url).toMatch(/\/api\/page-drafts$/);
    expect(seen[0]!.init!.method).toBe('POST');
    expect(JSON.parse(seen[0]!.init!.body as string)).toEqual(request);
  });

  it('throws the api’s refusal in its words, a key’s failure with it', async () => {
    answer(422, {
      error: 'ai_key_failed',
      message: 'Claude did not accept the API key.',
      aiKey: { source: 'account', provider: 'anthropic', kind: 'bad-key' },
    });
    const refused = await draftPage('guest_1', request, new AbortController().signal).catch(
      (e: unknown) => e,
    );
    expect(refused).toBeInstanceOf(PageDraftRefusal);
    expect(refused).toMatchObject({
      status: 422,
      code: 'ai_key_failed',
      message: 'Claude did not accept the API key.',
      aiKey: { kind: 'bad-key' },
    });
  });

  it('throws a plain failure for anything else', async () => {
    for (const body of [
      { error: 'unknown_code', message: 'x' },
      { error: 'page_draft_failed' },
      'oops',
    ]) {
      answer(500, body);
      const failed = await draftPage('guest_1', request, new AbortController().signal).catch(
        (e: unknown) => e,
      );
      expect(failed).toBeInstanceOf(Error);
      expect(failed).not.toBeInstanceOf(PageDraftRefusal);
    }
  });
});

describe('the toast once a page is made', () => {
  it('names the kind, and the layout where it has one', () => {
    expect(DESCRIBE_PAGE_WORDS.slide.made('Agenda')).toBe('Added a slide from the Agenda layout');
    expect(DESCRIBE_PAGE_WORDS.slide.made(null)).toBe('Added a slide');
    expect(DESCRIBE_PAGE_WORDS.infographic.made('Key Stats')).toBe(
      'Added a page from the Key Stats layout',
    );
    expect(DESCRIBE_PAGE_WORDS.infographic.made(null)).toBe('Added a page');
    expect(DESCRIBE_PAGE_WORDS.article.made(null)).toBe('Added an article');
    expect(DESCRIBE_PAGE_WORDS.flashcard.made(null)).toBe('Added a card');
  });
});
