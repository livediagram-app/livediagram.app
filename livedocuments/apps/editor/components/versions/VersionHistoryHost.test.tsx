// @vitest-environment jsdom

// Where Version History is drawn (docs/specs/006-document/version-history.md "In the editor"; blueprint VH19): nothing
// until opened; then the panel, handed what the session may do; closed with its tab or its document.

import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Tab } from '@livedocuments/document';

type PanelProps = import('./VersionHistoryPanel').VersionHistoryPanelProps;
const seen = vi.hoisted(() => ({ props: null as PanelProps | null }));
vi.mock('next/dynamic', () => ({
  default: () => (props: PanelProps) => {
    seen.props = props;
    return <div data-testid="panel">{props.tabs.map((t) => t.name).join(',')}</div>;
  },
}));

import {
  EditorChromeContext,
  createEditorChromeStore,
  type EditorContextValue,
} from '@/app/document/[id]/EditorContext';
import {
  closeVersionHistory,
  openVersionHistory,
  versionHistoryState,
} from '@/lib/version-history-store';
import { VersionHistoryHost } from './VersionHistoryHost';

afterEach(() => {
  cleanup();
  closeVersionHistory();
  seen.props = null;
});

const tab = (id: string, name: string): Tab => ({ id, name, elements: [] });

function view(over: Record<string, unknown> = {}) {
  return {
    documentId: 'd1',
    selfParticipant: { id: 'me' },
    sessionShareCode: null,
    can: { level: 'edit' },
    sessionTabScope: null,
    isOutOfScope: () => false,
    tabs: [tab('t1', 'Pitch'), tab('t2', 'Notes')],
    loadedTabIds: new Set(['t1']),
    ...over,
  } as unknown as EditorContextValue;
}

function host(value: EditorContextValue, onSelectTab = vi.fn()) {
  const store = createEditorChromeStore(value);
  const utils = render(
    <EditorChromeContext.Provider value={store}>
      <VersionHistoryHost onSelectTab={onSelectTab} />
    </EditorChromeContext.Provider>,
  );
  return { store, onSelectTab, ...utils };
}

describe('VersionHistoryHost', () => {
  it('draws nothing until opened, then the panel on the tab it was opened on', () => {
    host(view());
    expect(screen.queryByTestId('panel')).toBeNull();
    act(() => openVersionHistory('t1'));
    expect(screen.getByTestId('panel').textContent).toBe('Pitch,Notes');
    expect(seen.props).toMatchObject({ tabId: 't1', canEdit: true, canCopy: true });
    expect(seen.props!.nowTab?.id).toBe('t1');
  });

  it('hands a Viewer no edits, and a tab link no copy, and its own tab alone', () => {
    host(
      view({
        can: { level: 'view' },
        sessionTabScope: 't2',
        isOutOfScope: (id: string) => id !== 't2',
      }),
    );
    act(() => openVersionHistory('t2'));
    expect(seen.props).toMatchObject({ canEdit: false, canCopy: false });
    expect(screen.getByTestId('panel').textContent).toBe('Notes');
    // Not read yet: the panel waits for the editor's copy.
    expect(seen.props!.nowTab).toBeNull();
  });

  it('switches the editor and the panel to the tab picked', () => {
    const { onSelectTab } = host(view());
    act(() => openVersionHistory('t1'));
    act(() => seen.props!.onShowTab('t2'));
    expect(onSelectTab).toHaveBeenCalledWith('t2');
    expect(versionHistoryState()).toEqual({ tabId: 't2' });
  });

  it('closes when its tab is deleted', () => {
    const { store } = host(view());
    act(() => openVersionHistory('t2'));
    act(() => store.set(view({ tabs: [tab('t1', 'Pitch')] })));
    expect(versionHistoryState()).toBeNull();
    expect(screen.queryByTestId('panel')).toBeNull();
  });
});
