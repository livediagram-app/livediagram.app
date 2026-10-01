// @vitest-environment jsdom

import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const trackMock = vi.fn();
const setFolderMock = vi.fn();
vi.mock('@/lib/telemetry', () => ({ track: (...a: unknown[]) => trackMock(...a) }));
vi.mock('@/lib/api-client', () => ({
  apiCopyDocument: vi.fn(),
  apiSetDocumentFolder: (...a: unknown[]) => setFolderMock(...a),
}));
vi.mock('@/hooks/persistence/useDocumentListActions', () => ({
  useDocumentListActions: () => ({}),
}));
vi.mock('@/hooks/ui/useToast', () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn() }),
}));

const { useDocumentActions } = await import('./useDocumentActions');

// The two hooks useDocumentActions calls are mocked above; one render gives its actions.
function actions() {
  return renderHook(() =>
    useDocumentActions({
      documentId: null,
      documentName: '',
      documentList: [],
      setDocumentList: vi.fn(),
      confirm: vi.fn() as never,
      ownerId: 'me',
      hookDeleteFolder: vi.fn(),
      sharedDocuments: [],
      setSharedDocuments: vi.fn(),
      copying: false,
      setCopying: vi.fn(),
      sessionShareCode: null,
      refreshTeamLibraries: vi.fn(),
      refreshDocumentList: vi.fn(),
    }),
  ).result.current;
}

const flush = () => new Promise((r) => setTimeout(r, 0));

// docs/specs/017-telemetry/telemetry.md: Team·Added·Document counts a document ENTERING a team library,
// whichever surface filed it; Team·Moved·Document is every other scope move.
describe('moveDocumentTo telemetry', () => {
  beforeEach(() => {
    trackMock.mockReset();
    setFolderMock.mockReset().mockResolvedValue(undefined);
  });

  it('counts a personal document filed into a team as Added', async () => {
    actions().moveDocumentTo('d1', { teamId: 't1', folderId: null }, null);
    await flush();
    expect(trackMock).toHaveBeenCalledExactlyOnceWith('Team', 'Added', 'Document');
  });

  it('counts a move within or out of a team as Moved', async () => {
    actions().moveDocumentTo('d1', { teamId: 't1', folderId: 'f1' }, 't1');
    actions().moveDocumentTo('d1', { teamId: null, folderId: null }, 't1');
    // A caller that does not say where the document came from (team library rows).
    actions().moveDocumentTo('d1', { teamId: 't2', folderId: null });
    await flush();
    expect(trackMock.mock.calls).toEqual([
      ['Team', 'Moved', 'Document'],
      ['Team', 'Moved', 'Document'],
      ['Team', 'Moved', 'Document'],
    ]);
  });

  it('counts nothing when the server refused the move', async () => {
    setFolderMock.mockRejectedValue(new Error('403'));
    actions().moveDocumentTo('d1', { teamId: 't1', folderId: null }, null);
    await flush();
    expect(trackMock).not.toHaveBeenCalled();
  });
});
