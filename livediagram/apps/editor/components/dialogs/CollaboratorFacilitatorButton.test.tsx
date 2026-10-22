// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FacilitatorButton } from './CollaboratorFacilitatorButton';

// docs/specs/012-collaboration/facilitator.md "Who may move it": a free baton is any Editor's to hand out, so a
// Participant or Viewer sees no verb on somebody else's row, and a row that can't hold it is greyed with why.
function row(p: Partial<Parameters<typeof FacilitatorButton>[0]>) {
  return render(
    <FacilitatorButton
      isSelf={false}
      name="Sam"
      canHold
      iCanHold
      theyHoldIt={false}
      batonFree
      iHoldIt={false}
      isOwner={false}
      onPress={vi.fn()}
      {...p}
    />,
  );
}

describe('FacilitatorButton', () => {
  it("offers an Editor Make Facilitator on another Editor's row while the baton is free", () => {
    const { getByRole } = row({});
    expect(getByRole('button', { name: 'Make Sam the facilitator' })).toHaveProperty(
      'disabled',
      false,
    );
  });

  it("offers a Participant or Viewer no verb on somebody else's row", () => {
    const { queryByRole } = row({ iCanHold: false });
    expect(queryByRole('button')).toBeNull();
  });

  it('still lets the owner hand it on, whatever the baton', () => {
    const { getByRole } = row({ iCanHold: false, isOwner: true, batonFree: false });
    expect(getByRole('button', { name: 'Make Sam the facilitator' })).toBeTruthy();
  });

  it("greys Make Facilitator on a Participant's or Viewer's row", () => {
    const { getByRole } = row({ canHold: false });
    expect(getByRole('button', { name: 'Make Sam the facilitator' })).toHaveProperty(
      'disabled',
      true,
    );
  });

  it("greys Take Facilitation on a Participant's own row", () => {
    const { getByRole } = row({ isSelf: true, canHold: false, iCanHold: false });
    expect(getByRole('button', { name: 'Take Facilitation' })).toHaveProperty('disabled', true);
  });
});
