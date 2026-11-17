// @vitest-environment jsdom
// History in the footer's Tools with Snapshots in it (owner, 2026-11-17; liveworkspace/docs/specs/004-index/
// footer-tools-menu.md "History, with Snapshots in it"): this editor's host hands History its Snapshots, from the
// door the editor opens, beside the open item's timeline.
import { render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SnapshotsDoorProvider, type SnapshotsDoor } from '@liveworkspace/snapshots/ui';

const rows = vi.hoisted(() => vi.fn((_: unknown) => null));
vi.mock('@liveworkspace/workbench/components/chrome/useItemToolsRows', () => ({
  useItemToolsRows: rows,
}));
vi.mock('@/hooks/persistence/useAccountBootstrap', () => ({
  useAccountBootstrap: () => ({ isSignedIn: true, accountUserId: 'u1' }),
}));
vi.mock('@/app/document/[id]/EditorContext', () => ({
  useEditorContext: () => ({ syncToCloud: async () => {}, selfParticipant: { id: 'u1' } }),
}));
vi.mock('@/hooks/persistence/useIsOfflineDocument', () => ({ useIsOfflineDocument: () => false }));
vi.mock('@/lib/api-client', () => ({ getSessionSharePassword: () => null }));
vi.mock('@/lib/explorer-host', () => ({ itemHref: () => '/x', useTokenTeams: () => [] }));
vi.mock('@liveworkspace/workbench/lib/index-client', () => ({ indexClient: {} }));

import { ItemToolsHost } from './ItemToolsHost';

afterEach(() => rows.mockClear());

const door: SnapshotsDoor = {
  api: { list: vi.fn(), take: vi.fn(), remove: vi.fn(), revert: vi.fn() },
  noun: 'canvas',
  viewerId: 'u1',
};

const last = () =>
  rows.mock.calls.at(-1)![0] as {
    snapshots: { useExtras: unknown; Alone: unknown } | null;
    history: { itemId: string } | null;
  };

describe('ItemToolsHost', () => {
  it('hands History the Snapshots of an editor who may take them, beside the timeline', () => {
    render(
      <SnapshotsDoorProvider door={door}>
        <ItemToolsHost currentDocumentId="i1" currentShareCode={null} />
      </SnapshotsDoorProvider>,
    );
    expect(last().snapshots).toMatchObject({ useExtras: expect.any(Function) });
    expect(last().history?.itemId).toBe('i1');
  });

  it('hands none without the door, and no timeline for a share link', () => {
    render(
      <SnapshotsDoorProvider door={null}>
        <ItemToolsHost currentDocumentId="i1" currentShareCode="abc" />
      </SnapshotsDoorProvider>,
    );
    expect(last().snapshots).toBeNull();
    expect(last().history).toBeNull();
  });
});
