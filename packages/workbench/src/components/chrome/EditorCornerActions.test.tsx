// @vitest-environment jsdom
// The corner card leads with the item's approval badge (liveworkspace/docs/specs/004-index/approvals.md "In the
// editor"): inside an editor's approvals door with an approval to show, and nowhere else (livehuddle, which has no door).
import { act, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Approval } from '@liveworkspace/index-client';
import { ApprovalDoorProvider, type ApprovalDoor } from '@liveworkspace/explorer/approvals';
import { EditorCornerActions } from './EditorCornerActions';

vi.mock('./AuthControls', () => ({ AuthControls: () => <span>Account</span> }));

const awaiting: Approval = {
  id: 'ap_1',
  itemId: 'p1',
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

function door(approval: Approval | null): ApprovalDoor {
  return {
    client: {
      getApproval: vi.fn(async () => ({ approval })),
      requestApproval: vi.fn(),
      decideApproval: vi.fn(),
      cancelApproval: vi.fn(),
      approvalPeople: vi.fn(),
    },
    itemId: 'p1',
    share: null,
    viewerId: 'user_me',
    canRequest: true,
    noun: 'plan',
    openShare: vi.fn(),
  };
}

const card = () => (
  <EditorCornerActions
    showShare
    shareable={false}
    onOpenShare={() => {}}
    copyDescription="Copy it."
  />
);

describe('the corner card’s approval badge', () => {
  it('comes first, before Share and the account, in the card’s shape', async () => {
    render(<ApprovalDoorProvider door={door(awaiting)}>{card()}</ApprovalDoorProvider>);
    const badge = await screen.findByRole('button', { name: /Awaiting 0 of 1/ });
    const actions = document.querySelector<HTMLElement>('[data-corner-actions]')!;
    expect(actions.contains(badge)).toBe(true);
    expect(badge.className).toContain('h-9');
    const buttons = within(actions).getAllByRole('button');
    expect(buttons[0]).toBe(badge);
    expect(buttons[1]?.textContent).toContain('Share');
  });

  it('draws nothing without a door, or with no approval', async () => {
    const { unmount } = render(card());
    expect(document.querySelector('[data-approval-status]')).toBeNull();
    unmount();
    const none = door(null);
    render(<ApprovalDoorProvider door={none}>{card()}</ApprovalDoorProvider>);
    await waitFor(() => expect(none.client.getApproval).toHaveBeenCalled());
    await act(async () => {});
    expect(document.querySelector('[data-approval-status]')).toBeNull();
  });
});
