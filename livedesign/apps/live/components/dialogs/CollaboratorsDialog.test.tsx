// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Tab } from '@livedesign/design';
import type { AccessLevel } from '@livedesign/api-schema';
import type { Participant } from '@/lib/identity';
import { bindWorkbench } from '@/lib/workbench-bindings';
import { HIDE_CURSORS_KEY } from '@/lib/workbench-keys';
import { CollaboratorsDialog } from './CollaboratorsDialog';

// Hide Participant Cursors (docs/specs/012-collaboration/collaborator-enhancements.md): the switch at the foot of
// the modal is every role's, since it only changes what this screen draws.

afterEach(() => window.localStorage.clear());

const person = (id: string, name: string): Participant => ({
  id,
  name,
  color: '#0ea5e9',
  status: 'online',
});
const tabs = [{ id: 't1', name: 'Overview' }] as unknown as Tab[];

function open(selfRole: AccessLevel) {
  bindWorkbench();
  return render(
    <CollaboratorsDialog
      participantsByTab={new Map([['t1', [person('me', 'Me'), person('sam', 'Sam')]]])}
      tabs={tabs}
      activeId="t1"
      selfId="me"
      selfRole={selfRole}
      focusId={null}
      followingId={null}
      onFollow={vi.fn()}
      onStopFollowing={vi.fn()}
      onGoToTab={vi.fn()}
      onClose={vi.fn()}
    />,
  );
}

describe('CollaboratorsDialog: Hide Participant Cursors', () => {
  it.each(['edit', 'participate', 'view'] as const)('offers the switch to a %s visitor', (role) => {
    open(role);
    expect(screen.getByRole('switch', { name: /Hide Participant Cursors/ })).toBeTruthy();
  });

  it("flips this device's choice under the editor's own key", () => {
    open('view');
    fireEvent.click(screen.getByRole('switch', { name: /Hide Participant Cursors/ }));
    expect(window.localStorage.getItem(HIDE_CURSORS_KEY)).toBe('true');
  });
});
