/* eslint-disable react-hooks/rules-of-hooks -- the two hooks useDiagramActions calls are mocked below, so it runs as a plain function here. */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const trackMock = vi.fn();
const setFolderMock = vi.fn();
vi.mock('@/lib/telemetry', () => ({ track: (...a: unknown[]) => trackMock(...a) }));
vi.mock('@/lib/api-client', () => ({
  apiCopyDiagram: vi.fn(),
  apiSetDiagramFolder: (...a: unknown[]) => setFolderMock(...a),
}));
vi.mock('@/hooks/persistence/useDiagramListActions', () => ({
  useDiagramListActions: () => ({}),
}));
vi.mock('@/hooks/ui/useToast', () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn() }),
}));

const { useDiagramActions } = await import('./useDiagramActions');

function actions() {
  return useDiagramActions({
    diagramId: null,
    diagramName: '',
    diagramList: [],
    setDiagramList: vi.fn(),
    confirm: vi.fn() as never,
    ownerId: 'me',
    hookDeleteFolder: vi.fn(),
    sharedDiagrams: [],
    setSharedDiagrams: vi.fn(),
    copying: false,
    setCopying: vi.fn(),
    sessionShareCode: null,
    refreshTeamLibraries: vi.fn(),
    refreshDiagramList: vi.fn(),
  });
}

const flush = () => new Promise((r) => setTimeout(r, 0));

// spec/22: Team·Added·Diagram counts a diagram ENTERING a team library,
// whichever surface filed it; Team·Moved·Diagram is every other scope move.
describe('moveDiagramTo telemetry', () => {
  beforeEach(() => {
    trackMock.mockReset();
    setFolderMock.mockReset().mockResolvedValue(undefined);
  });

  it('counts a personal diagram filed into a team as Added', async () => {
    actions().moveDiagramTo('d1', { teamId: 't1', folderId: null }, null);
    await flush();
    expect(trackMock).toHaveBeenCalledExactlyOnceWith('Team', 'Added', 'Diagram');
  });

  it('counts a move within or out of a team as Moved', async () => {
    actions().moveDiagramTo('d1', { teamId: 't1', folderId: 'f1' }, 't1');
    actions().moveDiagramTo('d1', { teamId: null, folderId: null }, 't1');
    // A caller that does not say where the diagram came from (team library rows).
    actions().moveDiagramTo('d1', { teamId: 't2', folderId: null });
    await flush();
    expect(trackMock.mock.calls).toEqual([
      ['Team', 'Moved', 'Diagram'],
      ['Team', 'Moved', 'Diagram'],
      ['Team', 'Moved', 'Diagram'],
    ]);
  });

  it('counts nothing when the server refused the move', async () => {
    setFolderMock.mockRejectedValue(new Error('403'));
    actions().moveDiagramTo('d1', { teamId: 't1', folderId: null }, null);
    await flush();
    expect(trackMock).not.toHaveBeenCalled();
  });
});
