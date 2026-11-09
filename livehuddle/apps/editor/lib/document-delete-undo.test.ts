// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';

const index = vi.hoisted(() => ({ deleteItem: vi.fn() }));
vi.mock('@liveworkspace/workbench/lib/index-client', () => ({ indexClient: index }));
vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

const { trashOpenDocument } = await import('./document-delete-undo');
const { isDocumentDeleted } = await import('@liveworkspace/workbench/lib/document-tombstones');

afterEach(() => {
  vi.clearAllMocks();
});

describe('trashOpenDocument', () => {
  it('tombstones the document before the delete, so autosave cannot write it back, then leaves with the Undo', async () => {
    const seen: boolean[] = [];
    index.deleteItem.mockImplementation(async () => void seen.push(isDocumentDeleted('a')));
    const leave = vi.fn();
    expect(await trashOpenDocument('a', 'Roadmap', leave)).toBe(true);
    expect(seen).toEqual([true]);
    expect(leave).toHaveBeenCalledWith('/explorer?trashed=a&title=Roadmap');
  });

  it('lifts the tombstone and stays when the index refuses', async () => {
    index.deleteItem.mockRejectedValue(new Error('no'));
    const leave = vi.fn();
    expect(await trashOpenDocument('b', 'Roadmap', leave)).toBe(false);
    expect(isDocumentDeleted('b')).toBe(false);
    expect(leave).not.toHaveBeenCalled();
  });
});
