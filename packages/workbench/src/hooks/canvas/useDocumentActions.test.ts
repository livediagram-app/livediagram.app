// @vitest-environment jsdom

import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const index = vi.hoisted(() => ({ copyItem: vi.fn(), deleteItem: vi.fn() }));
vi.mock('../../lib/index-client', () => ({ indexClient: index }));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock('../ui/useToast', () => ({ useToast: () => toast }));

const { createDocumentActions } = await import('./useDocumentActions');

// An editor's bindings, faked.
const track = vi.fn();
const trashOpenDocument = vi.fn(async (_id: string, _name: string) => true);
let sharePassword: string | null = null;
const useDocumentActions = createDocumentActions({
  trackDuplicated: () => track('Document', 'Duplicated', 'Copy'),
  trackDeleted: () => track('Document', 'Deleted'),
  trashOpenDocument,
  getSessionSharePassword: () => sharePassword,
  DOCUMENT_FAILURE: {
    duplicate: (name) => `Could not duplicate ${name ?? 'the item'}.`,
    delete: (name) => `Could not delete ${name ?? 'the item'}.`,
  },
});

const assign = vi.fn();

function actions(over: Partial<Parameters<typeof useDocumentActions>[0]> = {}) {
  return renderHook(() =>
    useDocumentActions({
      documentId: 'p1',
      documentName: 'Roadmap',
      confirm: vi.fn(async () => true),
      copying: false,
      setCopying: vi.fn(),
      sessionShareCode: null,
      ...over,
    }),
  ).result.current;
}

beforeEach(() => {
  sharePassword = null;
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { ...window.location, origin: 'http://localhost:3102', assign },
  });
});
afterEach(() => vi.clearAllMocks());

// Copy and delete are the index's (liveworkspace/docs/specs/004-index/one-explorer-contracts.md "Items"): the index
// makes the copy's row and has this app copy the content; a delete sends the item to the Trash.
describe('useDocumentActions', () => {
  it('copies through the link a visitor came in on, then opens the copy', async () => {
    sharePassword = 'pw';
    index.copyItem.mockResolvedValue({ item: { id: 'p2' } });
    await actions({ sessionShareCode: 'code1' }).makeCopy();
    expect(index.copyItem).toHaveBeenCalledWith('p1', {}, { code: 'code1', password: 'pw' });
    expect(track).toHaveBeenCalledWith('Document', 'Duplicated', 'Copy');
    expect(assign).toHaveBeenCalledWith('http://localhost:3102/document/p2');
  });

  it('copies as the person themself without a link', async () => {
    index.copyItem.mockResolvedValue({ item: { id: 'p2' } });
    await actions().makeCopy();
    expect(index.copyItem).toHaveBeenCalledWith('p1', {}, null);
  });

  it('makes no copy while one runs, or with nothing open', async () => {
    await actions({ copying: true }).makeCopy();
    await actions({ documentId: null }).makeCopy();
    expect(index.copyItem).not.toHaveBeenCalled();
  });

  it('lets the person try a refused copy again', async () => {
    index.copyItem.mockRejectedValue(new Error('no'));
    const setCopying = vi.fn();
    await actions({ setCopying }).makeCopy();
    expect(setCopying).toHaveBeenLastCalledWith(false);
    expect(toast.error).toHaveBeenCalledWith('Could not duplicate Roadmap.');
  });

  it('sends the open item to the Trash through the editor', async () => {
    await actions().deleteDocument('p1');
    expect(trashOpenDocument).toHaveBeenCalledWith('p1', 'Roadmap');
    expect(index.deleteItem).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('says so when the open item does not go', async () => {
    trashOpenDocument.mockResolvedValueOnce(false);
    await actions().deleteDocument('p1');
    expect(toast.error).toHaveBeenCalledWith('Could not delete Roadmap.');
  });

  it('deletes another item through the index', async () => {
    index.deleteItem.mockResolvedValue(undefined);
    await actions().deleteDocument('p3');
    expect(index.deleteItem).toHaveBeenCalledWith('p3');
    expect(track).toHaveBeenCalledWith('Document', 'Deleted');
    index.deleteItem.mockRejectedValue(new Error('no'));
    await actions().deleteDocument('p4');
    expect(toast.error).toHaveBeenCalledWith('Could not delete the item.');
  });

  it('opens an item, through its link when it has one, and starts a new one', () => {
    actions().openDocument('p9', 's 1');
    expect(assign).toHaveBeenCalledWith('http://localhost:3102/document/p9?s=s%201');
    actions().openDocument('p8');
    expect(assign).toHaveBeenCalledWith('http://localhost:3102/document/p8');
    actions().newDocument();
    expect(assign).toHaveBeenCalledWith('http://localhost:3102/new');
  });
});
