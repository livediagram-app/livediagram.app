import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DOCUMENT_ENVELOPE_KIND, type DocumentEnvelope } from '../export-document-text';
import { createApiLivediagramPort } from './livediagram-port';

// The Drive port's copy into the account (docs/specs/013-workspace/default-folders.md "Creation
// intent"): Import a copy is an import, so it carries the first tab's intent and lands in the
// person's default folder; a copy placed by the mirror keeps the mirror's place and carries none.

let createBodies: Record<string, unknown>[];

beforeEach(() => {
  createBodies = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.method === 'POST') createBodies.push(JSON.parse(String(init.body)));
      return new Response(JSON.stringify({ document: { id: 'new' } }), { status: 201 });
    }),
  );
});
afterEach(() => vi.unstubAllGlobals());

const envelope = (kind?: string): DocumentEnvelope => ({
  kind: DOCUMENT_ENVELOPE_KIND,
  schemaVersion: 1,
  exportedAt: 0,
  document: {
    id: 'src',
    name: 'Board',
    presentation: null,
    tabs: [{ id: 't1', name: 'Tab 1', elements: [], ...(kind ? { kind } : {}) }],
  } as DocumentEnvelope['document'],
});

describe('importDocumentCopy', () => {
  it("sends Import a copy with its first tab's intent", async () => {
    await createApiLivediagramPort('owner-1').importDocumentCopy(envelope('whiteboard'));
    expect(createBodies[0]).toMatchObject({ intent: { mode: 'draw', tabKind: 'diagram' } });
    expect(createBodies[0]).not.toHaveProperty('folderId');
  });

  it("sends a mirror-placed copy with no intent, keeping the mirror's place", async () => {
    await createApiLivediagramPort('owner-1').importDocumentCopy(envelope(), {
      id: 'copy',
      name: 'Board',
      folderId: null,
    });
    expect(createBodies[0]).not.toHaveProperty('intent');
    expect(createBodies[0]).toHaveProperty('folderId', null);
  });
});
