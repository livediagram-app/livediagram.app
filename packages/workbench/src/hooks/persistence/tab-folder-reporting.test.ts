// Tab-folder membership reporting (docs/specs/006-*/tab-folders.md + docs/specs/017-telemetry/telemetry.md).
//
// These assertions are about the exact (category, action, type) triple, which
// is not a stylistic detail: a dashboard metric card selects rows by an exact
// `type` match where `null` is a value, so an untyped `Tab·Created` from a
// folder operation lands in the headline "Tabs Created" card and inflates a
// count of tabs with a count of folders.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { configureWorkbench, type WorkbenchTrack } from '../../bindings';
import { testBindings } from '../../lib/testing/bindings';
import { trackTabFolderTransition } from './tab-folder-reporting';

const track = vi.fn<WorkbenchTrack>();

beforeEach(() => {
  track.mockReset();
  configureWorkbench(testBindings({ track }));
});

describe('trackTabFolderTransition', () => {
  it('reports joining a folder as a tab move, typed Folder', () => {
    trackTabFolderTransition(null, 'Research');
    expect(track).toHaveBeenCalledWith('Tab', 'Moved', 'Folder');
  });

  it('reports leaving a folder as a tab removal, typed Folder', () => {
    trackTabFolderTransition('Research', null);
    expect(track).toHaveBeenCalledWith('Tab', 'Removed', 'Folder');
  });

  it('reports folder-to-folder as a move (it landed somewhere)', () => {
    trackTabFolderTransition('Research', 'Archive');
    expect(track).toHaveBeenCalledWith('Tab', 'Moved', 'Folder');
  });

  it('never emits the untyped Tab events the metric cards count', () => {
    trackTabFolderTransition(null, 'Research');
    trackTabFolderTransition('Research', null);
    for (const call of track.mock.calls) expect(call[2]).toBe('Folder');
  });

  it('emits nothing when the membership did not actually change', () => {
    trackTabFolderTransition('Research', 'Research');
    trackTabFolderTransition(null, null);
    expect(track).not.toHaveBeenCalled();
  });
});
