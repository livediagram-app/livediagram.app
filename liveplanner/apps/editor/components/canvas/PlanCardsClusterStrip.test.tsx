// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
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
vi.mock('@liveworkspace/workbench/hooks/ui/useDockNames', () => ({
  useDockNames: () => dock.names,
}));

afterEach(cleanup);

const strip = () =>
  render(
    <PlanCardsClusterStrip
      finderOpen={false}
      onToggleFinder={() => {}}
      types={{ open: false, onToggle: () => {} }}
      trash={{ open: false, onToggle: () => {} }}
    />,
  );

// The Trash's count follows its name.
const NAMES = ['Trash1', 'Find', 'Types'];

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
    expect(screen.getAllByRole('button').map((b) => b.textContent)).toEqual(['1', '', '']);
    expect(
      screen.getByRole('button', { name: /Open the Trash/ }).querySelector('.absolute'),
    ).toBeTruthy();
  });
});

// On a phone beside the Session strip (docs/specs/012-collaboration/session-tools.md "The Session strip") the strip
// folds into one More Card Tools button, so the cluster stays one row at 390px; its menu holds the three.
describe('the Plan strip folded on a phone', () => {
  it('is one button whose menu opens each panel above it', () => {
    dock.names = false;
    const types = vi.fn();
    render(
      <PlanCardsClusterStrip
        folded
        finderOpen={false}
        onToggleFinder={() => {}}
        types={{ open: false, onToggle: types }}
        trash={{ open: false, onToggle: () => {} }}
      />,
    );
    const more = screen.getByRole('button', { name: 'More card tools' });
    expect(screen.getAllByRole('button')).toHaveLength(1);
    fireEvent.click(more);
    const rows = screen.getAllByRole('menuitem').map((r) => r.textContent);
    expect(rows).toEqual(['Find a Card', 'Card Types', 'Trash']);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Card Types' }));
    expect(types).toHaveBeenCalledWith(more);
    expect(screen.queryByRole('menuitem')).toBeNull();
  });

  // docs/specs/026-plan/items.md "Finding a card": a press on a row reaches only the menu. It used to bubble up the
  // React tree to the canvas, which took the focus and shut the menu before the row's click, so no row opened.
  it('keeps a press on a row from reaching the canvas under it', () => {
    dock.names = false;
    const canvas = vi.fn();
    const finder = vi.fn();
    render(
      <div onPointerDown={canvas}>
        <PlanCardsClusterStrip
          folded
          finderOpen={false}
          onToggleFinder={finder}
          types={{ open: false, onToggle: () => {} }}
        />
      </div>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'More card tools' }));
    canvas.mockClear();
    const row = screen.getByRole('menuitem', { name: 'Find a Card' });
    fireEvent.pointerDown(row);
    expect(canvas).not.toHaveBeenCalled();
    fireEvent.click(row);
    expect(finder).toHaveBeenCalled();
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
    render(
      <PlanCardsClusterStrip
        folded
        finderOpen={false}
        onToggleFinder={() => {}}
        types={{ open: false, onToggle: () => {} }}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'More card tools' }));
    expect(screen.queryByRole('menuitem', { name: /New Card/ })).toBeNull();
  });
});

// docs/specs/026-plan/item-types.md "The Card Types panel", Share roles: Card Types (its button, its folded row) is an
// Editor's, as the Trash is; a Participant and a Viewer get neither (CanvasChrome passes both only to an editor,
// on !readOnly, which is true for both), and keep Find a Card.
describe('the Plan strip by share role', () => {
  // What CanvasChrome hands the strip for each role.
  const ROLES = {
    Editor: {
      types: { open: false, onToggle: () => {} },
      trash: { open: false, onToggle: () => {} },
    },
    Participant: {},
    Viewer: {},
  } as const;
  const roleStrip = (role: keyof typeof ROLES, folded = false) =>
    render(
      <PlanCardsClusterStrip
        folded={folded}
        finderOpen={false}
        onToggleFinder={() => {}}
        {...ROLES[role]}
      />,
    );
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

  it('gives an Editor Trash, Find a Card and Card Types, unchanged', () => {
    dock.names = false;
    roleStrip('Editor');
    expect(screen.getAllByRole('button')).toHaveLength(3);
    expect(screen.getByRole('button', { name: 'Open Card Types' })).toBeTruthy();
    expect(document.querySelector('[data-tour-id="card-types"]')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Open the Trash/ })).toBeTruthy();
  });

  it('hands an Editor’s opener the Card Types button, or the folded button on a phone', () => {
    dock.names = false;
    for (const folded of [false, true]) {
      const buttonRef = { current: null as HTMLButtonElement | null };
      render(
        <PlanCardsClusterStrip
          folded={folded}
          finderOpen={false}
          onToggleFinder={() => {}}
          types={{ open: false, onToggle: () => {}, buttonRef }}
        />,
      );
      const name = folded ? 'More card tools' : 'Open Card Types';
      expect(buttonRef.current).toBe(screen.getByRole('button', { name }));
      cleanup();
    }
  });

  it('folds an Editor’s strip on a phone into a menu with Card Types', () => {
    dock.names = false;
    roleStrip('Editor', true);
    fireEvent.click(screen.getByRole('button', { name: 'More card tools' }));
    expect(screen.getAllByRole('menuitem').map((r) => r.textContent)).toEqual([
      'Find a Card',
      'Card Types',
      'Trash',
    ]);
  });

  it('gives an Editor Card Types alone on a plan with no card types', () => {
    dock.names = false;
    noTypes(() => {
      roleStrip('Editor');
      expect(screen.getAllByRole('button')).toHaveLength(1);
      expect(screen.getByRole('button', { name: 'Open Card Types' })).toBeTruthy();
    });
  });

  it.each(['Participant', 'Viewer'] as const)(
    'gives a %s only Find a Card, with no door into Card Types',
    (role) => {
      dock.names = false;
      roleStrip(role);
      expect(screen.getAllByRole('button')).toHaveLength(1);
      expect(screen.getByRole('button', { name: 'Find a Card' })).toBeTruthy();
      expect(screen.queryByRole('button', { name: 'Open Card Types' })).toBeNull();
      expect(screen.queryByRole('button', { name: /Open the Trash/ })).toBeNull();
      // Nothing for the Boards tour's Card Types track to point at.
      expect(document.querySelector('[data-tour-id="card-types"]')).toBeNull();
    },
  );

  it.each(['Participant', 'Viewer'] as const)(
    'shows a %s Find a Card itself on a phone, never a More Card Tools menu',
    (role) => {
      dock.names = false;
      roleStrip(role, true);
      expect(screen.queryByRole('button', { name: 'More card tools' })).toBeNull();
      const find = screen.getByRole('button', { name: 'Find a Card' });
      expect(screen.getAllByRole('button')).toEqual([find]);
      expect(screen.queryByRole('menuitem', { name: 'Card Types' })).toBeNull();
      expect(document.querySelector('[data-tour-id="card-types"]')).toBeNull();
    },
  );

  it.each([
    ['Participant', false],
    ['Viewer', false],
    ['Participant', true],
    ['Viewer', true],
  ] as const)('shows a %s no strip on a plan with no card types (folded: %s)', (role, folded) => {
    noTypes(() => {
      const { container } = roleStrip(role, folded);
      expect(container.innerHTML).toBe('');
    });
  });
});
