// @vitest-environment jsdom

// An Editor's Preview sent to the form's link (docs/specs/030-forms/forms.md "Preview"): every answer the api gives
// read as one the Preview can act on.

import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiSendFormPreview } from './forms';

afterEach(() => {
  vi.unstubAllGlobals();
});

const answer = (res: Response | Error) =>
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => {
      if (res instanceof Error) throw res;
      return res;
    }),
  );

const send = () => apiSendFormPreview('me', 'd1', 't1', { answers: { q: 'x' }, other: {} });

describe('apiSendFormPreview', () => {
  it('reads a counted preview, a form with no link, refused answers and a failure', async () => {
    answer(Response.json({ number: 3 }, { status: 201 }));
    expect(await send()).toEqual({ kind: 'sent' });
    answer(Response.json({ error: 'form_not_published' }, { status: 404 }));
    expect(await send()).toEqual({ kind: 'not_published' });
    answer(Response.json({ error: 'invalid_answers', errors: { q: 'required' } }, { status: 400 }));
    expect(await send()).toEqual({ kind: 'invalid', errors: { q: 'required' } });
    answer(Response.json({ error: 'not_found' }, { status: 404 }));
    expect(await send()).toEqual({ kind: 'failed' });
    answer(new Response('oops', { status: 500 }));
    expect(await send()).toEqual({ kind: 'failed' });
    answer(new Error('offline'));
    expect(await send()).toEqual({ kind: 'failed' });
  });
});
