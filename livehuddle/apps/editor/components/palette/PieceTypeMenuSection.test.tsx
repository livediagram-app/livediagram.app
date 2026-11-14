// @vitest-environment jsdom

// A piece's Type in the element menu (docs/specs/009-elements/office.md "A piece's type"): a Door, a Rug, a Corridor and
// a Meeting Table change their type in place, one tile per type named and drawn as its palette card.

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { applyShapeVariant, createShape, type ShapeElement } from '@livehuddle/document';
import { PieceTypeMenuSection } from './PieceTypeMenuSection';
import { pieceTypeChoices } from './piece-type-tiles';
import { EditorContextMenu } from './EditorContextMenu';
import type { EditorContextMenuProps } from './EditorContextMenu.types';

beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});
afterEach(cleanup);

const piece = (kind: Parameters<typeof createShape>[0], variant?: string) =>
  ({ ...applyShapeVariant(createShape(kind, 0, 0), variant), id: kind }) as ShapeElement;

function openMenu(target: ShapeElement, given: Record<string, unknown> = {}) {
  const base: Record<string, unknown> = {
    menu: { mode: 'element', elementId: target.id, x: 10, y: 10 },
    elements: [target],
    layers: [],
    theme: undefined,
    ...given,
  };
  const props = new Proxy(base, {
    get: (t, k: string) => (k in t ? t[k] : vi.fn()),
    has: () => true,
  }) as unknown as EditorContextMenuProps;
  const Host = () => EditorContextMenu(props);
  render(<Host />);
}

function showSection(target: ShapeElement) {
  const onSetType = vi.fn();
  render(
    <PieceTypeMenuSection
      target={target}
      sectionProps={() => ({ open: true, onToggle: () => {} })}
      onSetType={onSetType}
    />,
  );
  return onSetType;
}

const tiles = () => screen.getAllByRole('button').map((b) => b.textContent?.trim());
const tile = (name: string) =>
  screen.getAllByRole('button').find((b) => b.textContent?.trim() === name)!;

describe('pieceTypeChoices', () => {
  it('offers each kind’s types in palette order, named as its palette cards', () => {
    expect(pieceTypeChoices('door').map((c) => [c.type, c.label])).toEqual([
      ['swing', 'Door'],
      ['double', 'Double Door'],
      ['sliding', 'Sliding Door'],
      ['revolving', 'Revolving Door'],
    ]);
    expect(pieceTypeChoices('rug').map((c) => c.type)).toEqual([
      'oval',
      'round',
      'bordered',
      'runner',
      'striped',
      'persian',
      'kilim',
      'doormat',
    ]);
    expect(pieceTypeChoices('corridor').map((c) => c.label)).toEqual([
      'Straight',
      'Corner',
      'T-Junction',
      'Crossroads',
    ]);
    expect(pieceTypeChoices('meeting-table').map((c) => [c.type, c.label])).toEqual([
      ['standard', 'Meeting Table'],
      ['long', 'Long Table'],
    ]);
  });

  it('offers nothing for a kind whose type the menu does not change', () => {
    expect(pieceTypeChoices('room')).toEqual([]);
    expect(pieceTypeChoices('chair')).toEqual([]);
  });
});

describe('a piece’s Type section', () => {
  it('presses the piece’s own type, the first for one with none stored', () => {
    showSection(piece('door', 'sliding'));
    expect(tile('Sliding Door').getAttribute('aria-pressed')).toBe('true');
    expect(tile('Door').getAttribute('aria-pressed')).toBe('false');
    cleanup();
    showSection(piece('meeting-table'));
    expect(tile('Meeting Table').getAttribute('aria-pressed')).toBe('true');
  });

  it('asks for the type pressed, for the piece’s kind', () => {
    const onSetType = showSection(piece('rug'));
    fireEvent.click(tile('Persian'));
    expect(onSetType).toHaveBeenLastCalledWith('rug', 'persian');
    fireEvent.click(tile('Oval'));
    expect(onSetType).toHaveBeenLastCalledWith('rug', 'oval');
  });

  it('draws nothing for a kind with no types', () => {
    showSection(piece('chair'));
    expect(screen.queryAllByRole('button')).toEqual([]);
  });

  // A lone section stands in the menu itself; beside a piece's facing it folds under Tools with it.
  it('is in the element menu of a door and a corridor, and under Tools beside a rug’s and a table’s facing', () => {
    for (const kind of ['door', 'corridor'] as const) {
      openMenu(piece(kind));
      expect(tiles(), kind).toContain('Type');
      cleanup();
    }
    for (const kind of ['rug', 'meeting-table'] as const) {
      openMenu(piece(kind));
      expect(tiles(), kind).toContain('Tools');
      cleanup();
    }
  });

  it('leaves a door’s menu without Type when the menu has no way to change a type', () => {
    openMenu(piece('door'), { onSetPieceType: undefined });
    expect(tiles()).not.toContain('Type');
    expect(tiles()).not.toContain('Tools');
  });
});
