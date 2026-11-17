// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PlanCardsClusterStrip } from './PlanCardsClusterStrip';

// docs/specs/026-plan/items.md "The Plan strip": on a wide desktop each button is named beside its icon, as the
// cluster's other strips are (docs/specs/007-editor/editor-app.md "Named on a wide desktop"); narrower, icons alone.
// Finding a card is the editor's Search (items.md "Finding a card"), so the strip holds the Trash and Card Types only.
const plan = {
  draggingItemId: null as string | null,
  canEdit: true,
  types: [{ id: 'task' }] as unknown[],
  items: new Map([['a', { id: 'a', fields: { status: 'trash' } }]]) as Map<string, unknown>,
};
vi.mock('@/components/plan/PlanContext', () => ({ usePlan: () => plan }));
const dock = { names: true };
vi.mock('@liveworkspace/workbench/hooks/ui/useDockNames', () => ({
  useDockNames: () => dock.names,
}));

afterEach(cleanup);

const strip = () =>
  render(
    <PlanCardsClusterStrip
      types={{ open: false, onToggle: () => {} }}
      trash={{ open: false, onToggle: () => {} }}
    />,
  );

describe('the Plan strip’s names', () => {
  it('names every button beside its icon on a wide desktop, in order', () => {
    dock.names = true;
    strip();
    expect(screen.getAllByRole('button').map((b) => b.textContent)).toEqual(['Trash1', 'Types']);
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
    expect(screen.getAllByRole('button').map((b) => b.textContent)).toEqual(['1', '']);
    expect(
      screen.getByRole('button', { name: /Open the Trash/ }).querySelector('.absolute'),
    ).toBeTruthy();
  });

  it('has no Find a Card', () => {
    dock.names = true;
    strip();
    expect(screen.queryByRole('button', { name: /Find/ })).toBeNull();
  });
});

// On a phone beside the Session strip (docs/specs/012-collaboration/session-tools.md "The Session strip") the strip
// folds into one More Card Tools button, so the cluster stays one row at 390px; its menu holds Card Types and Trash.
describe('the Plan strip folded on a phone', () => {
  it('is one button whose menu opens each panel above it', () => {
    dock.names = false;
    const types = vi.fn();
    render(
      <PlanCardsClusterStrip
        folded
        types={{ open: false, onToggle: types }}
        trash={{ open: false, onToggle: () => {} }}
      />,
    );
    const more = screen.getByRole('button', { name: 'More card tools' });
    expect(screen.getAllByRole('button')).toHaveLength(1);
    fireEvent.click(more);
    expect(screen.getAllByRole('menuitem').map((r) => r.textContent)).toEqual([
      'Card Types',
      'Trash',
    ]);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Card Types' }));
    expect(types).toHaveBeenCalledWith(more);
    expect(screen.queryByRole('menuitem')).toBeNull();
  });

  // A press on a row reaches only the menu: bubbling up the React tree to the canvas would take the focus and shut the
  // menu before the row's click, so no row would open.
  it('keeps a press on a row from reaching the canvas under it', () => {
    dock.names = false;
    const canvas = vi.fn();
    const types = vi.fn();
    render(
      <div onPointerDown={canvas}>
        <PlanCardsClusterStrip folded types={{ open: false, onToggle: types }} />
      </div>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'More card tools' }));
    canvas.mockClear();
    const row = screen.getByRole('menuitem', { name: 'Card Types' });
    fireEvent.pointerDown(row);
    expect(canvas).not.toHaveBeenCalled();
    fireEvent.click(row);
    expect(types).toHaveBeenCalled();
  });
});

// docs/specs/026-plan/items.md "No New Card button": a card is added where it lives (a board's card type chips, a
// cell's Add card), so the strip offers no New Card, open or folded, to anyone.
describe('the Plan strip without New Card', () => {
  it('has no New Card button or row', () => {
    dock.names = false;
    strip();
    expect(screen.queryByRole('button', { name: /New Card/ })).toBeNull();
    cleanup();
    render(<PlanCardsClusterStrip folded types={{ open: false, onToggle: () => {} }} />);
    fireEvent.click(screen.getByRole('button', { name: 'More card tools' }));
    expect(screen.queryByRole('menuitem', { name: /New Card/ })).toBeNull();
  });
});

// docs/specs/026-plan/item-types.md "The Card Types panel", Share roles: Card Types (its button, its folded row) is an
// Editor's, as the Trash is; a Participant and a Viewer get neither (CanvasChrome passes both only to an editor), so
// their strip is not drawn.
describe('the Plan strip by share role', () => {
  const ROLES = {
    Editor: {
      types: { open: false, onToggle: () => {} },
      trash: { open: false, onToggle: () => {} },
    },
    Participant: {},
    Viewer: {},
  } as const;
  const roleStrip = (role: keyof typeof ROLES, folded = false) =>
    render(<PlanCardsClusterStrip folded={folded} {...ROLES[role]} />);
  // Runs body on a plan with no card types and nothing in the Trash.
  const noTypes = (body: () => void) => {
    const was = { types: plan.types, items: plan.items };
    plan.types = [];
    plan.items = new Map();
    try {
      body();
    } finally {
      Object.assign(plan, was);
    }
  };

  it('gives an Editor the Trash and Card Types', () => {
    dock.names = false;
    roleStrip('Editor');
    expect(screen.getAllByRole('button')).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Open Card Types' })).toBeTruthy();
    expect(document.querySelector('[data-tour-id="card-types"]')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Open the Trash/ })).toBeTruthy();
  });

  it('gives an Editor Card Types alone on a plan with no card types', () => {
    dock.names = false;
    noTypes(() => {
      roleStrip('Editor');
      expect(screen.getAllByRole('button')).toHaveLength(1);
      expect(screen.getByRole('button', { name: 'Open Card Types' })).toBeTruthy();
    });
  });

  it.each([
    ['Participant', false],
    ['Viewer', false],
    ['Participant', true],
    ['Viewer', true],
  ] as const)('draws no strip for a %s (folded: %s)', (role, folded) => {
    const { container } = roleStrip(role, folded);
    expect(container.innerHTML).toBe('');
  });
});
