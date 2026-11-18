// @vitest-environment jsdom

// The assignee picker draws each person as every other surface does (docs/specs/012-collaboration/
// assigned-actions.md "Their colour"): their chosen presence colour, else the Automatic one from their name, never
// the brand blue.

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { automaticPresenceColour } from '@liveworkspace/settings/presence';
import { AssigneePicker, type PickableMember } from './AssignActionAssigneePicker';

afterEach(() => cleanup());

const member = (over: Partial<PickableMember>): PickableMember => ({
  userId: 'u',
  memberId: 'm',
  name: 'Bea Holt',
  email: null,
  teamId: 't',
  teamName: 'Crew',
  ...over,
});

function discs(selfRow: PickableMember, members: PickableMember[], assignee: PickableMember) {
  render(
    <AssigneePicker
      signedIn
      selfRow={selfRow}
      grouped={[['t', { teamName: 'Crew', members }]]}
      members={members}
      memberOfDocumentTeam
      documentTeamId="t"
      assignee={assignee}
      onPick={vi.fn()}
      signInHref="/sign-in"
      teams={[]}
      movingToTeamId={null}
      moveFailed={false}
    />,
  );
  return screen.getAllByTestId('assignee-disc');
}

describe('AssigneePicker colours', () => {
  it('paints each person in their presence colour, the selected row included', () => {
    const self = member({ userId: 'me', memberId: undefined, name: 'Ada', color: '#8b5cf6' });
    const chose = member({ userId: 'u1', memberId: 'm1', name: 'Bea Holt', color: '#ef4444' });
    const automatic = member({ userId: 'u2', memberId: 'm2', name: 'Cy Dunn', color: null });
    const [selfDisc, choseDisc, automaticDisc] = discs(self, [chose, automatic], chose);

    expect(selfDisc!.style.getPropertyValue('--identity')).toBe('#8b5cf6');
    expect(choseDisc!.style.getPropertyValue('--identity')).toBe('#ef4444');
    expect(automaticDisc!.style.getPropertyValue('--identity')).toBe(
      automaticPresenceColour('Cy Dunn').value,
    );
    // Dark mode paints the colour's deep shade under white; light mode the ink that reaches AA on the colour.
    expect(choseDisc!.style.getPropertyValue('--identity-deep')).toBe('#b91c1c');
    expect(choseDisc!.style.getPropertyValue('--identity-ink')).toMatch(/^#/);
    // No brand fill left on any disc; selection still reads from the row's own tint and label.
    for (const disc of [selfDisc, choseDisc, automaticDisc]) {
      expect(disc!.className).not.toContain('bg-brand');
    }
    const picked = screen.getByRole('button', { name: /Bea Holt/ });
    expect(picked.getAttribute('aria-pressed')).toBe('true');
    expect(picked.className).toContain('bg-brand-50');
    expect(picked.textContent).toContain('Selected');
  });
});
