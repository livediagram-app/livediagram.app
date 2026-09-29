// @vitest-environment jsdom

// The command palette asks for an active-tab rename by bumping
// `renameActiveNonce` (docs/specs/007-editor/live-app.md).

import { cleanup, render, screen } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Tab } from '@livediagram/document';
import { TabBar } from './TabBar';

type Props = ComponentProps<typeof TabBar>;

const tabs: Tab[] = [
  { id: 't1', name: 'First', elements: [] },
  { id: 't2', name: 'Second', elements: [] },
];

// Every callback a no-op; only the data the bar renders is real.
function props(over: Partial<Props>): Props {
  const base = {
    tabs,
    activeId: 't1',
    activeTabHasContent: false,
    otherDocuments: [],
    participantsByTab: new Map(),
    selfId: 'me',
    ...over,
  };
  return new Proxy(base, {
    get: (target, key) => (key in target ? target[key as keyof typeof target] : vi.fn()),
    has: () => true,
  }) as unknown as Props;
}

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
