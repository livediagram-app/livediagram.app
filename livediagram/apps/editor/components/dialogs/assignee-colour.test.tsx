// @vitest-environment jsdom

// One person, one colour (docs/specs/012-collaboration/assigned-actions.md "Their colour"): someone who chose a
// presence colour in Settings wears it on their assignee dot as on their cursor. The cursor draws the participant's
// colour, which the api fills as `presenceColourOf(name, profile.color)` (src/liveworkspace/profiles.ts); the dot is
// built from the colour stored when the action was assigned, from the team's members list or the Myself row.

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { presenceColourOf } from '@liveworkspace/settings/presence';
import { createShape, type BoxedElement, type ElementAction } from '@livediagram/document';
import type { SaveActionInput } from '@/hooks/collab/useEditorActions';
import type { TeamMember } from '@/lib/api-client';
import { elementIndicatorItems } from '@/components/canvas/useElementIndicators';
import { AssignActionDialog } from './AssignActionDialog';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));
vi.mock('next/navigation', () => ({ usePathname: () => '/document/d1' }));

const RED = '#ef4444';
const bea: TeamMember = {
  id: 'm_bea',
  teamId: 'team_1',
  userId: 'u_bea',
  email: 'bea@x.test',
  role: 'member',
  status: 'joined',
  name: 'Bea Holt',
  color: RED,
  createdAt: 0,
  updatedAt: 0,
};
vi.mock('@/lib/api-client', async (load) => ({
  ...(await load<typeof import('@/lib/api-client')>()),
  apiTeamMembers: vi.fn(async () => [bea]),
}));

afterEach(() => cleanup());

type Props = Parameters<typeof AssignActionDialog>[0];
const props = (over: Partial<Props>): Props => ({
  open: true,
  existing: null,
  elementLabel: 'Retry budget',
  teams: [{ id: 'team_1', name: 'Crew' }],
  ownerId: 'u_ada',
  selfUserId: 'u_ada',
  selfName: 'Ada',
  documentTeamId: 'team_1',
  emailEnabled: false,
  onSubmit: vi.fn(),
  onClose: vi.fn(),
  ...over,
});

// The dot on an element carrying the action the dialog saved.
function dotColour(input: SaveActionInput): string | undefined {
  const action: ElementAction = {
    id: 'a',
    name: input.name,
    description: '',
    assignee: input.assignee,
    teamId: input.teamId,
    assignerId: 'u_ada',
    assignerName: 'Ada',
    status: 'open',
    createdAt: 0,
    updatedAt: 0,
  };
  const el = { ...createShape('square', 0, 0), action } as BoxedElement;
  const handlers = {
    onFollowLink: vi.fn(),
    onOpenComments: vi.fn(),
    onOpenAction: vi.fn(),
    onOpenNote: vi.fn(),
    tabSummaries: [],
  };
  return elementIndicatorItems(el, handlers).find((i) => i.kind === 'action')?.assignee?.color;
}

describe('a chosen presence colour', () => {
  it('is the same on a teammate’s cursor and on their assignee dot', async () => {
    const onSubmit = vi.fn<(input: SaveActionInput) => void>();
    render(<AssignActionDialog {...props({ onSubmit })} />);
    fireEvent.click(await screen.findByRole('button', { name: /Bea Holt/ }));
    fireEvent.click(screen.getByRole('button', { name: /assign action/i }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());

    const cursor = presenceColourOf(bea.name!, bea.color);
    expect(cursor).toBe(RED);
    expect(onSubmit.mock.calls[0]![0].assignee.color).toBe(RED);
    expect(dotColour(onSubmit.mock.calls[0]![0])).toBe(cursor);
  });

  it('is the same on your own cursor and on the dot of an action you take yourself', () => {
    const onSubmit = vi.fn<(input: SaveActionInput) => void>();
    // The cursor draws the participant's colour; the Myself row is handed the same one.
    const selfParticipant = { name: 'Ada', color: '#10b981' };
    render(<AssignActionDialog {...props({ onSubmit, selfColor: selfParticipant.color })} />);
    fireEvent.click(screen.getByRole('button', { name: /assign action/i }));
    expect(dotColour(onSubmit.mock.calls[0]![0])).toBe(selfParticipant.color);
  });

  it('leaves an action saved before colours rode along on the Automatic colour', () => {
    const input = {
      name: 'Old',
      description: '',
      assignee: { userId: 'u_bea', name: 'Bea Holt' },
      teamId: 'team_1',
      notifyEmail: false,
    } satisfies SaveActionInput;
    expect(dotColour(input)).toBe(presenceColourOf('Bea Holt', null));
  });
});
