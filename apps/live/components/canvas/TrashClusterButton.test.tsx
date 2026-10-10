// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PlanCardsClusterStrip } from './PlanCardsClusterStrip';

// docs/specs/026-plan/items.md "Trash": the Trash leads Plan's strip with its count; while a card is dragged it
// becomes a drop target that lights from the pointer's place, so a captured touch pointer (which never fires
// pointerenter on it) still sees "Let go to trash it".
const plan = {
  draggingItemId: null as string | null,
  items: new Map([['a', { id: 'a', fields: { status: 'trash' } }]]),
};
vi.mock('@/components/plan/PlanContext', () => ({ usePlan: () => plan }));

afterEach(cleanup);

const strip = (withTrash = true) =>
  render(
    <PlanCardsClusterStrip
      finderOpen={false}
      onToggleFinder={() => {}}
      typesOpen={false}
      onToggleTypes={() => {}}
      trash={withTrash ? { open: false, onToggle: () => {} } : undefined}
    />,
  );

function move(x: number, y: number) {
  const e = new Event('pointermove') as PointerEvent;
  Object.assign(e, { clientX: x, clientY: y });
  act(() => {
    window.dispatchEvent(e);
  });
}

describe('the Trash in Plan’s strip', () => {
  it('comes first, with its count, and not at all without it', () => {
    plan.draggingItemId = null;
    strip();
    expect(screen.getAllByRole('button').map((b) => b.getAttribute('aria-label'))).toEqual([
      'Open the Trash, 1 card',
      'Find a Card',
      'Open Card Types',
    ]);
    cleanup();
    strip(false);
    expect(screen.queryByRole('button', { name: /Trash/ })).toBeNull();
  });

  it('lights while the dragged card is over it, wherever the pointer is captured', () => {
    plan.draggingItemId = 'item0001';
    strip();
    expect(screen.queryByRole('button', { name: /Trash/ })).toBeNull();
    const target = screen.getByRole('status');
    target.getBoundingClientRect = () => ({ left: 10, right: 110, top: 10, bottom: 60 }) as DOMRect;
    expect(target.textContent).toContain('Drop to Trash');
    move(50, 30);
    expect(target.textContent).toContain('Let go to trash it');
    move(300, 300);
    expect(target.textContent).toContain('Drop to Trash');
  });
});
