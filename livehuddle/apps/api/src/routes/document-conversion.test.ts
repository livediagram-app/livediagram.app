import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DOCUMENT_CONVERSION_HEADER } from '@livediagram/api-schema';
import type { Env } from '../types';
import type { RouteContext } from './context';
import { handleDocumentIndexRoutes } from './document-index-routes';

// Offline Mode's Take Offline (docs/specs/006-document/offline-mode.md) declares itself with
// DOCUMENT_CONVERSION_HEADER: the canvas leaves the account for good, bypassing the Trash, and the index records it
// as taken offline (its Timeline). A value the api does not recognise is never trusted: a plain delete.

const ENV = { INDEX_ORIGIN: 'https://index.test', INDEX_KEY: 'k' } as unknown as Env;

let searches: string[] = [];

beforeEach(() => {
  searches = [];
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const req = new Request(input, init);
    const url = new URL(req.url);
    if (req.method === 'DELETE' && url.pathname.endsWith('/items/d1')) {
      searches.push(url.search);
      return new Response(null, { status: 204 });
    }
    return Response.json({ error: 'not_found' }, { status: 404 });
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function deleteContext(conversion?: string): RouteContext {
  const url = new URL('https://api.test/api/documents/d1');
  return {
    request: new Request(url, {
      method: 'DELETE',
      headers: conversion ? { [DOCUMENT_CONVERSION_HEADER]: conversion } : {},
    }),
    env: ENV,
    url,
    segments: ['api', 'documents', 'd1'],
    accountUserId: null,
    verifiedUserId: 'user_a',
    accountEmail: null,
    resolveOwner: () => 'user_a',
    token: { id: 'tok1' },
    workbench: null,
    teams: [],
    bearer: null,
  };
}

const del = (conversion?: string) => handleDocumentIndexRoutes(deleteContext(conversion));

describe('Take Offline', () => {
  it('removes the canvas for good, bypassing the Trash, as taken offline', async () => {
    expect((await del('offline'))!.status).toBe(204);
    expect(searches).toEqual(['?permanent=true&reason=offline']);
  });

  it('sends a plain delete to the Trash when nothing is declared', async () => {
    const res = (await del())!;
    expect(res.status).toBe(204);
    expect(searches).toEqual(['']);
    // Its 204 carries the CORS headers every other answer does, so a cross-origin caller can read it.
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
  });

  it('ignores an unrecognised conversion value rather than trusting it', async () => {
    expect((await del('banana'))!.status).toBe(204);
    expect(searches).toEqual(['']);
  });
});
