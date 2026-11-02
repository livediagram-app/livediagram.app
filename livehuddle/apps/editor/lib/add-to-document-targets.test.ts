import { describe, expect, it, vi } from 'vitest';
import { addToDocumentTargets } from './add-to-document-targets';

vi.mock('@/lib/offline/offline-store', () => ({ OFFLINE_OWNER_ID: 'offline' }));

const docs = [
  { id: 'here', ownerId: 'me' },
  { id: 'roadmap', ownerId: 'me' },
  { id: 'local', ownerId: 'offline' },
];
const base = {
  documentId: 'here',
  documentList: docs,
  isOffline: false,
  workbench: false,
  isOwner: true,
};

describe('addToDocumentTargets', () => {
  it("offers the owner's other online documents", () => {
    expect(addToDocumentTargets(base).map((d) => d.id)).toEqual(['roadmap']);
  });

  it("offers nothing on a document you don't own, where the link would be refused", () => {
    expect(addToDocumentTargets({ ...base, isOwner: false })).toEqual([]);
  });

  it('offers nothing in an offline document or a workbench', () => {
    expect(addToDocumentTargets({ ...base, isOffline: true })).toEqual([]);
    expect(addToDocumentTargets({ ...base, workbench: true })).toEqual([]);
  });
});
