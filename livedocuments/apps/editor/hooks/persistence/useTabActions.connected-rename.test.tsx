// @vitest-environment jsdom

// A connected tab's own name (liveworkspace/docs/specs/004-index/connected-tabs.md "A tab's own name"): a rename is this
// canvas's label, the file's kept beside it, and counted; nothing typed follows the file again; the file's answered name
// (an open) follows or is held beside the label, counting nothing. A tab of content renames as ever.
import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Tab } from '@livedocuments/document';
import { track } from '@/lib/telemetry';
import { useTabActions } from './useTabActions';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

const CONNECTION = { id: 'cn_abcdefghijklmnopqrstuvwx', app: 'liveplanner', itemId: 'p1' };
const plain = { id: 'c', name: 'Launch plan', elements: [], connection: CONNECTION } as Tab;
const renamed = { ...plain, name: 'Plan', targetName: 'Launch plan' } as Tab;
const content = { id: 't', name: 'Tab 1', elements: [] } as unknown as Tab;

beforeEach(() => vi.mocked(track).mockClear());

function actions(tab: Tab) {
  const commitTabs = vi.fn();
  const deps = new Proxy<Record<string, unknown>>(
    { tabs: [tab], activeId: tab.id, canEditStructure: true, commitTabs },
    { get: (target, key: string) => (key in target ? target[key] : vi.fn()) },
  );
  const { result } = renderHook(() => useTabActions(deps as never));
  // What the one commit made of the tab, or undefined when nothing was committed.
  const committed = () => {
    const call = commitTabs.mock.calls[0];
    return call ? (call[0] as (ts: Tab[]) => Tab[])([tab])[0] : undefined;
  };
  return { ...result.current, committed };
}

describe('renaming a connected tab', () => {
  it('keeps the name as this document’s label and the file’s name beside it', () => {
    const a = actions(plain);
    a.renameTab('c', 'Plan');
    expect(a.committed()).toEqual(renamed);
    expect(track).toHaveBeenCalledWith('Tab', 'Changed', 'ConnectedName');
  });

  it('follows the file again when renamed to nothing', () => {
    const a = actions(renamed);
    a.renameTab('c', '');
    expect(a.committed()).toEqual(plain);
    expect(track).toHaveBeenCalledWith('Tab', 'Changed', 'ConnectedNameReset');
  });

  it('commits and counts nothing when nothing changes', () => {
    const a = actions(plain);
    a.renameTab('c', '');
    expect(a.committed()).toBeUndefined();
    expect(track).not.toHaveBeenCalled();
  });

  it('renames a tab of content as before', () => {
    const a = actions(content);
    a.renameTab('t', 'Overview');
    expect(a.committed()).toMatchObject({ name: 'Overview' });
    expect(a.committed()).not.toHaveProperty('targetName');
    expect(track).toHaveBeenCalledWith('Tab', 'Renamed');
  });
});

describe('following a connected tab’s file', () => {
  it('takes the answered name on a tab that follows, counting nothing', () => {
    const a = actions(plain);
    a.followConnectedTab('c', 'Launch plan v2');
    expect(a.committed()).toMatchObject({ name: 'Launch plan v2' });
    expect(track).not.toHaveBeenCalled();
  });

  it('holds the answered name beside a renamed tab’s own', () => {
    const a = actions(renamed);
    a.followConnectedTab('c', 'Launch plan v2');
    expect(a.committed()).toMatchObject({ name: 'Plan', targetName: 'Launch plan v2' });
  });

  it('changes nothing for the same name, a tab of content or a tab not there', () => {
    const same = actions(renamed);
    same.followConnectedTab('c', 'Launch plan');
    expect(same.committed()).toBeUndefined();
    const other = actions(content);
    other.followConnectedTab('t', 'Anything');
    other.followConnectedTab('gone', 'Anything');
    expect(other.committed()).toBeUndefined();
  });
});
