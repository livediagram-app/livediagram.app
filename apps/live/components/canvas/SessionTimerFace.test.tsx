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

// docs/specs/012-collaboration/session-button.md: a read-only Timer element shows its clock without controls.
describe('SessionTimerFace controls', () => {
  it('drops the Start on a read-only face', () => {
    face({ onStart: vi.fn() });
    expect(screen.queryByRole('button', { name: 'Start timer' })).toBeNull();
  });

  it('offers the Start to whoever may run it', () => {
    face({ readOnly: false, onStart: vi.fn() });
    expect(screen.getByRole('button', { name: 'Start timer' })).toBeTruthy();
  });
});
