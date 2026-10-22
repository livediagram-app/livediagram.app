// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PlanCardsClusterStrip } from './PlanCardsClusterStrip';

// docs/specs/026-plan/items.md "The Plan strip": on a wide desktop each button is named beside its icon, as the
// cluster's other strips are (docs/specs/007-editor/editor-app.md "Named on a wide desktop"); narrower, icons alone.
const plan = {
  draggingItemId: null as string | null,
  canEdit: true,
  types: [{ id: 'task' }] as unknown[],
  items: new Map([['a', { id: 'a', fields: { status: 'trash' } }]]) as Map<string, unknown>,
};
vi.mock('@/components/plan/PlanContext', () => ({ usePlan: () => plan }));
const dock = { names: true };
vi.mock('@/hooks/ui/useDockNames', () => ({ useDockNames: () => dock.names }));

afterEach(cleanup);

const strip = () =>
  render(
    <PlanCardsClusterStrip
      finderOpen={false}
      onToggleFinder={() => {}}
      typesOpen={false}
      onToggleTypes={() => {}}
      trash={{ open: false, onToggle: () => {} }}
      newCard={{ open: false, onToggle: () => {} }}
    />,
  );

// The Trash's count follows its name.
const NAMES = ['Trash1', 'New', 'Find', 'Types'];

describe('the Plan strip’s names', () => {
  it('names every button beside its icon on a wide desktop, in order', () => {
    dock.names = true;
    strip();
    const buttons = screen.getAllByRole('button');
    expect(buttons.map((b) => b.textContent)).toEqual(NAMES);
    // The accessible names stay the fuller labels.
    expect(screen.getByRole('button', { name: 'Open Card Types' })).toBeTruthy();
    const trash = screen.getByRole('button', { name: 'Open the Trash, 1 card' });
    // Beside the name, not over it.
    expect(trash.querySelector('.absolute')).toBeNull();
  });

  it('shows icons alone when narrower', () => {
    dock.names = false;
    strip();
    // Only the Trash's count, in its corner.
    expect(screen.getAllByRole('button').map((b) => b.textContent)).toEqual(['1', '', '', '']);
    expect(
      screen.getByRole('button', { name: /Open the Trash/ }).querySelector('.absolute'),
    ).toBeTruthy();
  });
});
