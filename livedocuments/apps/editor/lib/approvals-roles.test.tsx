// @vitest-environment jsdom
// docs/specs/013-workspace/share-roles.md "Approving is a Viewer's one write" and approvals.md, as the editor draws
// them: an Editor of the whole document asks and cancels; an Editor confined to one tab, a Participant and a Viewer
// cannot, but each answers a request that names them; a guest has no door at all. The index's half is
// liveworkspace/apps/index/src/approvals.test.ts.
import { fireEvent, render, renderHook, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Approval } from '@liveworkspace/index-client';
import {
  ApprovalBanner,
  ApprovalDoorProvider,
  useEditorApprovalDoor,
} from '@liveworkspace/explorer/approvals';
import { resolveEditorCapabilities } from '@/lib/editor-capabilities';

type Level = 'edit' | 'participate' | 'view';
const LEVELS: readonly Level[] = ['edit', 'participate', 'view'];

const asked: Approval = {
  id: 'ap_1',
  itemId: 'i1',
  state: 'open',
  status: 'awaiting',
  requestedBy: { id: 'user_owner', name: 'Owner' },
  note: null,
  due: null,
  snapshotId: null,
  createdAt: 1,
  closedAt: null,
  approved: 0,
  approvers: [{ id: 'user_me', name: 'Me', decision: 'pending', note: null, decidedAt: null }],
};

function client() {
  return {
    getApproval: vi.fn(async () => ({ approval: asked })),
    decideApproval: vi.fn(async () => ({
      approval: {
        ...asked,
        state: 'approved' as const,
        status: 'approved' as const,
        approved: 1,
        approvers: [{ ...asked.approvers[0]!, decision: 'approved' as const, decidedAt: 2 }],
      },
    })),
    requestApproval: vi.fn(),
    cancelApproval: vi.fn(),
    approvalPeople: vi.fn(),
  };
}

function doorFor(level: Level, opts: { tab?: boolean; accountId?: string | null } = {}) {
  const api = client();
  const { result } = renderHook(() =>
    useEditorApprovalDoor({
      hydrated: true,
      isOffline: false,
      embedMode: false,
      workbench: null,
      accountId: opts.accountId === undefined ? 'user_me' : opts.accountId,
      itemId: 'i1',
      teamId: null,
      level: resolveEditorCapabilities(level).level,
      isStructureReadOnly: opts.tab ?? false,
      shareCode: level === 'edit' ? null : 'code1',
      client: api,
      noun: 'document',
      teamMembers: async () => [],
      snapshots: null,
      setShareOpen: () => {},
    }),
  );
  return { door: result.current, api };
}

describe('approvals by share role', () => {
  it('lets only an Editor of the whole document ask and cancel', () => {
    expect(LEVELS.map((level) => doorFor(level).door?.canRequest)).toEqual([true, false, false]);
    expect(doorFor('edit', { tab: true }).door?.canRequest).toBe(false);
  });

  it('gives a guest no door', () => {
    for (const level of LEVELS) expect(doorFor(level, { accountId: null }).door).toBeNull();
  });

  it.each(LEVELS)('lets a named %s approve: the one write a Viewer has', async (level) => {
    const { door, api } = doorFor(level);
    const { unmount } = render(
      <ApprovalDoorProvider door={door}>
        <ApprovalBanner />
      </ApprovalDoorProvider>,
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Approve' }));
    await screen.findByText(/You approved this/);
    expect(api.decideApproval).toHaveBeenCalledWith(
      'i1',
      { decision: 'approve' },
      level === 'edit' ? null : { code: 'code1' },
    );
    unmount();
  });
});
