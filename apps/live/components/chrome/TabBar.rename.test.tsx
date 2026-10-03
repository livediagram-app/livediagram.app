// @vitest-environment jsdom

// The command palette asks for an active-tab rename by bumping
// `renameActiveNonce` (docs/specs/007-editor/live-app.md).

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { TabBar } from './TabBar';
import { tabBarProps as props } from './TabBar.test-props';

const editing = () => screen.queryByRole('textbox');

afterEach(cleanup);

describe('TabBar rename request', () => {
  it('opens the rename editor on the active tab once per request', () => {
    const { rerender } = render(<TabBar {...props({ renameActiveNonce: 0 })} />);
    expect(editing()).toBeNull();
    rerender(<TabBar {...props({ renameActiveNonce: 1 })} />);
    expect((editing() as HTMLInputElement | null)?.value).toBe('First');
  });

  it('does not move the editor to a tab switched to later', () => {
    const { rerender } = render(<TabBar {...props({ renameActiveNonce: 0 })} />);
    rerender(<TabBar {...props({ renameActiveNonce: 1 })} />);
    rerender(<TabBar {...props({ renameActiveNonce: 1, activeId: 't2' })} />);
    expect((editing() as HTMLInputElement | null)?.value).toBe('First');
  });

  it('does not replay an old request when the bar mounts again', () => {
    render(<TabBar {...props({ renameActiveNonce: 3 })} />);
    expect(editing()).toBeNull();
  });
});
