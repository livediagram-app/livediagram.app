// @vitest-environment jsdom

// Version History (docs/specs/006-document/version-history.md "In the editor", "Who may do what"; blueprint VH18,
// VH19): every role looks, only an Editor names, restores or copies, and a restore asks first, in place, then offers
// Undo from its toast.

import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { VersionSummary } from '@livedocuments/api-schema';
import type { Element, Tab } from '@livedocuments/document';

const api = vi.hoisted(() => ({
  apiListVersions: vi.fn(),
  apiReadVersion: vi.fn(),
  apiNameCurrentVersion: vi.fn(),
  apiRenameVersion: vi.fn(),
  apiRestoreVersion: vi.fn(),
  apiCopyVersion: vi.fn(),
}));
vi.mock('@/lib/api-client', () => api);
const toast = vi.hoisted(() => ({
  info: vi.fn(),
  success: vi.fn(),
  warning: vi.fn(),
  error: vi.fn(),
  offer: vi.fn(),
  action: vi.fn(),
}));
vi.mock('@/hooks/ui/useToast', () => ({ useToast: () => toast }));
const track = vi.hoisted(() => vi.fn());
vi.mock('@/lib/telemetry', () => ({ track }));
// The pages are VersionPreview's own suite: here, which tab and which outlines it was handed.
vi.mock('./VersionPreview', () => ({
  VersionPreview: ({ tab, marks }: { tab: Tab; marks: { changed: Set<string> } | null }) => (
    <div data-testid="preview" data-labels={tab.elements.map((e) => e.label).join(',')}>
      {marks ? `changed:${[...marks.changed].join(',')}` : 'no marks'}
    </div>
  ),
}));

import { VersionHistoryPanel } from './VersionHistoryPanel';
import { isOwnVersionWrite, resetOwnVersionWrites } from '@/lib/own-version-writes';

const box = (id: string, label: string): Element => ({
  id,
  type: 'shape',
  shape: 'square',
  x: 0,
  y: 0,
  width: 10,
  height: 10,
  label,
});
const NOW_TAB: Tab = { id: 't1', name: 'Pitch', elements: [box('a', 'After')] };
const OLD_TAB: Tab = { id: 't1', name: 'Pitch', elements: [box('a', 'Before')] };
const VERSION: VersionSummary = {
  id: 'v1',
  tabId: 't1',
  rev: 2,
  kind: 'idle',
  name: 'Draft',
  author: { name: 'Ada', color: '#123456' },
  savedAt: Date.now() - 60_000,
  createdAt: Date.now() - 60_000,
  bytes: 10,
  elementCount: 1,
};

function panel(opts: { canEdit?: boolean; canCopy?: boolean; onClose?: () => void } = {}) {
  return render(
    <VersionHistoryPanel
      documentId="d1"
      who={{ ownerId: 'me', shareCode: null }}
      tabs={[
        { id: 't1', name: 'Pitch' },
        { id: 't2', name: 'Notes' },
      ]}
      tabId="t1"
      nowTab={NOW_TAB}
      canEdit={opts.canEdit ?? true}
      canCopy={opts.canCopy ?? true}
      onShowTab={vi.fn()}
      onClose={opts.onClose ?? vi.fn()}
    />,
  );
}

async function openVersion() {
  fireEvent.click(await screen.findByRole('button', { name: /Draft/ }));
  await screen.findByText(/Compared with now: 1 changed/);
}

beforeEach(() => {
  api.apiListVersions.mockResolvedValue([VERSION]);
  api.apiReadVersion.mockResolvedValue({ version: VERSION, tab: OLD_TAB });
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  resetOwnVersionWrites();
});

describe('looking', () => {
  it('lists the versions, opens one read-only and outlines what changed', async () => {
    panel();
    expect(screen.getByRole('dialog', { name: 'Version History' })).toBeTruthy();
    await openVersion();
    expect(screen.getByTestId('preview').dataset.labels).toBe('Before');
    expect(screen.getByTestId('preview').textContent).toBe('changed:a');
    fireEvent.click(screen.getByRole('switch', { name: 'Show Changes' }));
    expect(screen.getByTestId('preview').textContent).toBe('no marks');
  });

  it('gives a Viewer or Participant no way to change anything', async () => {
    panel({ canEdit: false, canCopy: false });
    await openVersion();
    expect(screen.getByText('Only an Editor can restore a version.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Restore This Version' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Make a Copy' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Name This Version' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Rename' })).toBeNull();
  });

  it('says so when there are no versions yet, and when the read failed', async () => {
    api.apiListVersions.mockResolvedValueOnce([]);
    panel();
    expect(await screen.findByText('No earlier versions yet')).toBeTruthy();
    cleanup();
    api.apiListVersions.mockRejectedValueOnce(Object.assign(new Error('x'), { status: 500 }));
    panel();
    fireEvent.click(await screen.findByRole('button', { name: 'Try Again' }));
    expect(await screen.findByRole('button', { name: /Draft/ })).toBeTruthy();
  });

  it('closes on Escape', async () => {
    const onClose = vi.fn();
    panel({ onClose });
    await screen.findByRole('button', { name: /Draft/ });
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });
});

describe('restoring', () => {
  it('asks first, in place, then restores and offers Undo', async () => {
    api.apiRestoreVersion.mockImplementation(async () => {
      // The relay arrives while the request is out: this editor's own restore.
      expect(isOwnVersionWrite({ id: 'cs_1', tabId: 't1', summary: 'Restored “Draft”' })).toBe(
        true,
      );
      return { tabId: 't1', rev: 5, changesetId: 'cs_1', undoVersionId: 'v9' };
    });
    panel();
    await openVersion();
    fireEvent.click(screen.getByRole('button', { name: 'Restore This Version' }));
    expect(screen.getByRole('group', { name: 'Restore this version?' })).toBeTruthy();
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Restore' })));
    expect(api.apiRestoreVersion).toHaveBeenCalledWith(
      { ownerId: 'me', shareCode: null },
      'd1',
      't1',
      'v1',
    );
    const spec = toast.action.mock.calls.at(-1)![0] as {
      message: string;
      actions: { label: string; onSelect: () => void }[];
    };
    expect(spec.message).toMatch(/^Restored the version from today at/);
    api.apiRestoreVersion.mockResolvedValueOnce({
      tabId: 't1',
      rev: 6,
      changesetId: 'cs_2',
      undoVersionId: 'v10',
    });
    await act(async () => spec.actions[0]!.onSelect());
    await waitFor(() =>
      expect(toast.action).toHaveBeenLastCalledWith(
        expect.objectContaining({ message: 'Restore undone' }),
      ),
    );
    expect(api.apiRestoreVersion).toHaveBeenLastCalledWith(expect.anything(), 'd1', 't1', 'v9');
    expect(track).toHaveBeenCalledWith('Version', 'Undone', 'Editor');
  });

  it('says when the version is already the content, and when it is refused', async () => {
    api.apiRestoreVersion.mockResolvedValueOnce(null);
    panel();
    await openVersion();
    fireEvent.click(screen.getByRole('button', { name: 'Restore This Version' }));
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Restore' })));
    expect(toast.info).toHaveBeenCalledWith('Already the current version');
    api.apiRestoreVersion.mockRejectedValueOnce(
      Object.assign(new Error('x'), { code: 'elements_held' }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Restore This Version' }));
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Restore' })));
    expect(toast.error).toHaveBeenCalledWith(expect.stringMatching(/Someone is working/));
  });

  it('makes a copy named for its day, with a way to open it', async () => {
    api.apiCopyVersion.mockResolvedValueOnce({ id: 'tN', name: 'Pitch (copy)', rev: 1 });
    panel();
    await openVersion();
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Make a Copy' })));
    expect(api.apiCopyVersion.mock.calls[0]![4]).toMatch(/^Pitch \(/);
    expect(toast.action).toHaveBeenLastCalledWith(
      expect.objectContaining({ message: 'Made a copy: “Pitch (copy)”' }),
    );
  });

  it('hides Make a Copy from a tab link', async () => {
    panel({ canCopy: false });
    await openVersion();
    expect(screen.queryByRole('button', { name: 'Make a Copy' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Restore This Version' })).toBeTruthy();
  });
});

describe('naming', () => {
  it('names the current content and counts it', async () => {
    api.apiNameCurrentVersion.mockResolvedValueOnce({ ...VERSION, id: 'v3', name: 'Final' });
    panel();
    await screen.findByRole('button', { name: /Draft/ });
    fireEvent.click(screen.getByRole('button', { name: 'Name This Version' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Version name' }), {
      target: { value: '  Final ' },
    });
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Save' })));
    expect(api.apiNameCurrentVersion).toHaveBeenCalledWith(expect.anything(), 'd1', 't1', 'Final');
    expect(await screen.findByRole('button', { name: /Final/ })).toBeTruthy();
    expect(track).toHaveBeenCalledWith('Version', 'Named', 'Editor');
  });

  it('says why a name past the cap was refused', async () => {
    api.apiNameCurrentVersion.mockRejectedValueOnce(
      Object.assign(new Error('x'), { code: 'too_many_names' }),
    );
    panel();
    await screen.findByRole('button', { name: /Draft/ });
    fireEvent.click(screen.getByRole('button', { name: 'Name This Version' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Version name' }), {
      target: { value: 'More' },
    });
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Save' })));
    expect(screen.getByRole('alert').textContent).toMatch(/Remove a name first/);
  });

  it('renames and unnames the selected row', async () => {
    api.apiRenameVersion.mockResolvedValueOnce({ ...VERSION, name: null });
    panel();
    await openVersion();
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Remove Name' })));
    expect(api.apiRenameVersion).toHaveBeenCalledWith(expect.anything(), 'd1', 't1', 'v1', null);
    expect(await screen.findByRole('button', { name: /Automatic/ })).toBeTruthy();
  });
});
