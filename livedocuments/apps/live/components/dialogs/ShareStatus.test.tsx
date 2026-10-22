// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ShareStatus } from './ShareStatus';

// docs/specs/007-editor/live-app.md "Layout, top to bottom": the status line states the document's exposure.
describe('ShareStatus', () => {
  const line = () => screen.getByRole('status').textContent;

  it('says Private while only the owner can get in', () => {
    render(<ShareStatus passes={0} password={false} />);
    expect(line()).toBe('Private: only you can open it.');
  });

  it('counts the passes, and says so when a password guards them', () => {
    render(<ShareStatus passes={2} password />);
    expect(line()).toBe(
      'Shared: anyone holding one of the 2 passes can get in, with the password.',
    );
  });

  it('never calls a team document private: every member can open it', () => {
    const { rerender } = render(<ShareStatus passes={0} password={false} team />);
    expect(line()).toBe('Team: every member of the team can open it.');
    rerender(<ShareStatus passes={1} password={false} team />);
    expect(line()).toBe(
      'Shared: every member of the team can open it, and anyone holding the pass can get in.',
    );
  });
});
