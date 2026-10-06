// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TrashClusterButton } from './TrashClusterButton';

// docs/specs/026-plan/items.md "Trash": the target lights from the pointer's place, so a captured touch
// pointer (which never fires pointerenter on it) still sees "Let go to trash it".
const plan = { draggingItemId: 'item0001' as string | null, items: new Map() };
vi.mock('@/components/plan/PlanContext', () => ({ usePlan: () => plan }));

afterEach(cleanup);

function move(x: number, y: number) {
  const e = new Event('pointermove') as PointerEvent;
  Object.assign(e, { clientX: x, clientY: y });
  act(() => {
    window.dispatchEvent(e);
  });
}

describe('TrashClusterButton', () => {
  it('lights while the dragged card is over it, wherever the pointer is captured', () => {
    render(<TrashClusterButton popoverOpen={false} onTogglePopover={() => {}} />);
    const target = screen.getByRole('status');
    target.getBoundingClientRect = () => ({ left: 10, right: 110, top: 10, bottom: 60 }) as DOMRect;
    expect(target.textContent).toContain('Drop to Trash');
    move(50, 30);
    expect(target.textContent).toContain('Let go to trash it');
    move(300, 300);
    expect(target.textContent).toContain('Drop to Trash');
  });
});
