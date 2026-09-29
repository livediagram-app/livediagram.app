import { describe, expect, it } from 'vitest';
import {
  LEGACY_DOCUMENTS_SUNSET,
  fromLegacyRequest,
  isLegacyDocumentsPath,
  renameWireKeys,
  toLegacyResponse,
} from './legacy-documents-alias';

describe('isLegacyDocumentsPath', () => {
  it('matches /api/diagrams and everything under it', () => {
    expect(isLegacyDocumentsPath('/api/diagrams')).toBe(true);
    expect(isLegacyDocumentsPath('/api/diagrams/d1/tabs/t1')).toBe(true);
  });
  it('leaves every other path alone', () => {
    expect(isLegacyDocumentsPath('/api/documents')).toBe(false);
    expect(isLegacyDocumentsPath('/api/diagramsx')).toBe(false);
    expect(isLegacyDocumentsPath('/diagrams')).toBe(false);
  });
});

describe('renameWireKeys', () => {
  it('renames keys at every depth, never values', () => {
    const renamed = renameWireKeys(
      { diagram: { id: 'd', name: 'diagram' }, diagrams: [{ diagramId: 'd', diagramName: 'n' }] },
      'toCurrent',
    );
    expect(renamed).toEqual({
      document: { id: 'd', name: 'diagram' },
      documents: [{ documentId: 'd', documentName: 'n' }],
    });
  });
  it('round-trips', () => {
    const current = { document: { documentTeamId: 't', documentOwnerId: 'o' } };
    expect(renameWireKeys(renameWireKeys(current, 'toLegacy'), 'toCurrent')).toEqual(current);
  });
});

describe('fromLegacyRequest', () => {
  it('moves the path to /api/documents and renames body keys', async () => {
    const req = new Request('https://x.test/api/diagrams/d1?q=1', {
      method: 'PUT',
      headers: { 'content-type': 'application/json', 'x-owner-id': 'o' },
      body: JSON.stringify({ diagramId: 'd1', name: 'n' }),
    });
    const next = await fromLegacyRequest(req);
    expect(new URL(next.url).pathname).toBe('/api/documents/d1');
    expect(new URL(next.url).search).toBe('?q=1');
    expect(next.method).toBe('PUT');
    expect(next.headers.get('x-owner-id')).toBe('o');
    expect(await next.json()).toEqual({ documentId: 'd1', name: 'n' });
  });
  it('passes a non-JSON body through untouched', async () => {
    const req = new Request('https://x.test/api/diagrams/d1/thumbnail', { method: 'GET' });
    const next = await fromLegacyRequest(req);
    expect(new URL(next.url).pathname).toBe('/api/documents/d1/thumbnail');
    expect(next.body).toBeNull();
  });
});

describe('toLegacyResponse', () => {
  it('renames JSON keys back and marks the route deprecated', async () => {
    const res = new Response(JSON.stringify({ document: { id: 'd' } }), {
      status: 201,
      headers: { 'content-type': 'application/json' },
    });
    const legacy = await toLegacyResponse(res);
    expect(legacy.status).toBe(201);
    expect(await legacy.json()).toEqual({ diagram: { id: 'd' } });
    expect(legacy.headers.get('Deprecation')).toBe('true');
    expect(legacy.headers.get('Sunset')).toBe(LEGACY_DOCUMENTS_SUNSET);
    expect(legacy.headers.get('Link')).toContain('/api/documents');
  });
  it('leaves a non-JSON body alone but still marks it', async () => {
    const legacy = await toLegacyResponse(
      new Response('<svg/>', { headers: { 'content-type': 'image/svg+xml' } }),
    );
    expect(await legacy.text()).toBe('<svg/>');
    expect(legacy.headers.get('Deprecation')).toBe('true');
  });
  it('passes an empty response through', async () => {
    const legacy = await toLegacyResponse(new Response(null, { status: 204 }));
    expect(legacy.status).toBe(204);
    expect(legacy.headers.get('Deprecation')).toBe('true');
  });
});

describe('fromLegacyRequest, the conversion header', () => {
  it('carries an old client’s X-Diagram-Conversion across as X-Document-Conversion', async () => {
    const req = new Request('https://x.test/api/diagrams/d1', {
      method: 'DELETE',
      headers: { 'X-Diagram-Conversion': 'offline' },
    });
    const next = await fromLegacyRequest(req);
    expect(next.headers.get('X-Document-Conversion')).toBe('offline');
    expect(next.headers.get('X-Diagram-Conversion')).toBeNull();
  });
});
