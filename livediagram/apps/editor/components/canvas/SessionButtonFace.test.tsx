// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SessionButtonFace } from './SessionButtonFace';

// docs/specs/012-collaboration/facilitator.md "Being told you cannot": a face somebody may not press says why, and
// while somebody else runs the session the reason names them, since the reader may well have edit access.
afterEach(cleanup);

const vote = { tool: 'vote', dots: 3 } as const;
const face = (props: Partial<Parameters<typeof SessionButtonFace>[0]>) =>
  render(<SessionButtonFace config={vote} label="" textColor="#000" canStart={false} {...props} />);

describe('SessionButtonFace when it cannot be pressed', () => {
  it('names the facilitator to an Editor while somebody else runs the session', () => {
    face({ onPress: vi.fn(), runBy: 'Ana' });
    const inert = screen.getByLabelText(/Ana is facilitating this session/);
    expect(inert.getAttribute('aria-disabled')).not.toBeNull();
    expect(screen.queryByText(/Only people with edit access/)).toBeNull();
  });

  it('tells someone without edit access that it is not theirs', () => {
    face({});
    expect(screen.getByLabelText(/Only people with edit access can start this/)).toBeTruthy();
  });

  it('is a button for whoever may run it', () => {
    face({ onPress: vi.fn(), canStart: true });
    expect(screen.getByRole('button', { name: /starts this for everyone/ })).toBeTruthy();
  });
});
