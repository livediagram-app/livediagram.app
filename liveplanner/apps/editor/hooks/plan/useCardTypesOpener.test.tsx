// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { openCardTypes } from './card-types-opener';
import { useCardTypesOpener } from './useCardTypesOpener';

// docs/specs/026-plan/item-types.md "The Card Types panel", Share roles: Edit Cards and openCardTypes() open the panel
// for an Editor only. CanvasChrome turns the opener on with `!zenMode && !readOnly`, and readOnly is true for a
// Participant and a Viewer alike, so for them it never registers and openCardTypes() opens nothing.
const ACTIVE = { Editor: true, Participant: false, Viewer: false } as const;

function Chrome({
  active,
  activeDockPanel = null,
  onOpen,
}: {
  active: boolean;
  activeDockPanel?: 'card-types' | null;
  onOpen: (id: string, button: HTMLElement, above?: boolean) => void;
}) {
  const ref = useCardTypesOpener(active, { activeDockPanel, handleDockButtonClick: onOpen });
  return <button ref={ref}>Types</button>;
}

afterEach(cleanup);

describe('openCardTypes by share role', () => {
  it('opens the panel from its button for an Editor', () => {
    const onOpen = vi.fn();
    const { getByRole } = render(<Chrome active={ACTIVE.Editor} onOpen={onOpen} />);
    expect(openCardTypes()).toBe(true);
    expect(onOpen).toHaveBeenCalledWith('card-types', getByRole('button'), true);
  });

  it('never toggles an open panel shut', () => {
    const onOpen = vi.fn();
    render(<Chrome active activeDockPanel="card-types" onOpen={onOpen} />);
    expect(openCardTypes()).toBe(true);
    expect(onOpen).not.toHaveBeenCalled();
  });

  it.each(['Participant', 'Viewer'] as const)('opens nothing for a %s', (role) => {
    const onOpen = vi.fn();
    render(<Chrome active={ACTIVE[role]} onOpen={onOpen} />);
    expect(openCardTypes()).toBe(false);
    expect(onOpen).not.toHaveBeenCalled();
  });

  it('stops opening once an Editor loses edit rights, and when the chrome goes', () => {
    const onOpen = vi.fn();
    const r = render(<Chrome active onOpen={onOpen} />);
    r.rerender(<Chrome active={false} onOpen={onOpen} />);
    expect(openCardTypes()).toBe(false);
    r.rerender(<Chrome active onOpen={onOpen} />);
    r.unmount();
    expect(openCardTypes()).toBe(false);
    expect(onOpen).not.toHaveBeenCalled();
  });
});
