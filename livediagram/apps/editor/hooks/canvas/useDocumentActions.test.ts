// @vitest-environment jsdom

import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const index = vi.hoisted(() => ({ copyItem: vi.fn(), deleteItem: vi.fn() }));
vi.mock('@/lib/index-client', () => ({ indexClient: index }));
vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock('@/hooks/ui/useToast', () => ({ useToast: () => toast }));

const { useDocumentActions } = await import('./useDocumentActions');
const { isDocumentDeleted } = await import('@/lib/document-tombstones');
const { takeDeleteUndo } = await import('@/lib/document-delete-undo');

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
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { ...window.location, origin: 'http://localhost:3200', assign },
  });
});
afterEach(() => vi.clearAllMocks());

// Copy and delete are the index's (liveworkspace/docs/one-explorer-contracts.md "Items"): the index makes the copy's
// row and has this app copy the content; a delete sends the document to the Trash.
describe('useDocumentActions', () => {
  it('copies through the link a visitor came in on, then opens the copy', async () => {
    index.copyItem.mockResolvedValue({ item: { id: 'p2' } });
    await actions({ sessionShareCode: 'code1' }).makeCopy();
    expect(index.copyItem).toHaveBeenCalledWith('p1', {}, { code: 'code1', password: null });
    expect(assign).toHaveBeenCalledWith('http://localhost:3200/document/p2');
  });

  it('lets the person try a refused copy again', async () => {
    index.copyItem.mockRejectedValue(new Error('no'));
    const setCopying = vi.fn();
    await actions({ setCopying }).makeCopy();
    expect(setCopying).toHaveBeenLastCalledWith(false);
    expect(toast.error).toHaveBeenCalled();
  });

  it('stops saving the open document before it goes to the Trash, then hands its Undo to the Explorer', async () => {
    let tombstonedAtDelete = false;
    index.deleteItem.mockImplementation(async () => {
      tombstonedAtDelete = isDocumentDeleted('p1');
    });
    await actions().deleteDocument('p1');
    expect(tombstonedAtDelete).toBe(true);
    expect(isDocumentDeleted('p1')).toBe(true);
    expect(assign).toHaveBeenCalledWith('/explorer');
    expect(takeDeleteUndo()).toEqual({ id: 'p1', title: 'Roadmap' });
  });

  it('lets a refused delete save again and stay open', async () => {
    index.deleteItem.mockRejectedValue(new Error('no'));
    await actions({ documentId: 'p3' }).deleteDocument('p3');
    expect(isDocumentDeleted('p3')).toBe(false);
    expect(assign).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalled();
  });

  it('opens a document, through its link when it has one', () => {
    actions().openDocument('p9', 's 1');
    expect(assign).toHaveBeenCalledWith('http://localhost:3200/document/p9?s=s%201');
  });
});
