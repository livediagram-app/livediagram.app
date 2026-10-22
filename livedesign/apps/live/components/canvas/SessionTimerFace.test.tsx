// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SessionTimerFace } from './SessionTimerFace';

afterEach(cleanup);

const face = (props: Partial<Parameters<typeof SessionTimerFace>[0]>) =>
  render(
    <SessionTimerFace
      timer={null}
      durationMs={300_000}
      readOnly
      borderPx={2}
      minutes={5}
      {...props}
    />,
  );

// docs/specs/012-collaboration/facilitator.md "Being told you cannot": a Timer element somebody else's baton
// governs shows its clock without controls, and says whose it is.
describe('SessionTimerFace while somebody else facilitates', () => {
  it('names the facilitator and drops the Start', () => {
    face({ runBy: 'Ana', onStart: vi.fn() });
    expect(
      screen.getByText('Ana is facilitating this session; ask them to run the timer.'),
    ).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Start timer' })).toBeNull();
  });

  it('says nothing of it to the facilitator or with nobody facilitating', () => {
    face({ readOnly: false, runBy: null, onStart: vi.fn() });
    expect(screen.queryByText(/is facilitating/)).toBeNull();
    expect(screen.getByRole('button', { name: 'Start timer' })).toBeTruthy();
  });
});
