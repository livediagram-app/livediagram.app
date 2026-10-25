import { describe, expect, it, vi } from 'vitest';
import type { SheetsBridge } from '@/hooks/sheets/useSheetsBridge';
import { makeFormSheet } from './forms-make-sheet';
import { noteTabSaved } from '@liveworkspace/workbench/lib/tab-saved';

const create = vi.fn();
vi.mock('@/components/sheets/sheet-store-client', () => ({ sheetStoreOf: () => ({ create }) }));

// Issue #984: the responses sheet's create raced its tab's save and came back 404 before the retry landed.
describe('makeFormSheet', () => {
  it('sends the create only once the new tab is saved', async () => {
    const bridge = {
      scope: { projectId: 'docF', ownerId: 'o', shareCode: null, tabId: null },
    } as unknown as SheetsBridge;
    const made = makeFormSheet(bridge, { id: 's1', tabId: 'responses', title: 'Responses' });
    await new Promise((r) => setTimeout(r, 20));
    expect(create).not.toHaveBeenCalled();
    noteTabSaved('docF', 'responses');
    await made;
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ id: 's1', tabId: 'responses', title: 'Responses' }),
    );
  });
});
