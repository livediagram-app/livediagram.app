// @vitest-environment jsdom

// A piece's Type in the element menu (docs/specs/009-elements/office.md "A piece's type"): a Door, a Rug, a Corridor and
// a Meeting Table change their type in place, one tile per type named and drawn as its palette card.

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import {
  applyShapeVariant,
  createShape,
  snapDoorToWall,
  type ShapeElement,
} from '@livehuddle/document';
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

function showSection(target: ShapeElement, elements: ShapeElement[] = [target]) {
  const onSetType = vi.fn();
  render(
    <PieceTypeMenuSection
      target={target}
      elements={elements}
      sectionProps={() => ({ open: true, onToggle: () => {} })}
      onSetType={onSetType}
    />,
  );
  return onSetType;
}

const tiles = () => screen.getAllByRole('button').map((b) => b.textContent?.trim());
const tile = (name: string) =>
  screen.getAllByRole('button').find((b) => b.textContent?.trim() === name) as HTMLButtonElement;

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

  // A Door on a wall shorter than a type: that type's tile is disabled, with a hover card saying why.
  it('disables a door type too wide for the door’s wall', () => {
    const room = {
      ...createShape('room', 0, 0),
      id: 'room',
      width: 140,
      height: 200,
      roomDoor: 'none',
    } as ShapeElement;
    const door = snapDoorToWall({ ...createShape('door', 0, 0), id: 'door', x: 22, y: 190 }, [
      room,
    ]);
    const onSetType = showSection(door, [room, door]);
    const double = tile('Double Door');
    expect(double.disabled || double.getAttribute('aria-disabled') === 'true').toBe(true);
    fireEvent.click(double);
    expect(onSetType).not.toHaveBeenCalled();
    expect(tile('Sliding Door').disabled).toBe(false);
    expect(document.body.textContent).toContain('is wider than the wall this door stands on');
  });
});

// docs/specs/009-elements/office.md "A piece's type": a selection's menu offers the right-clicked piece's Type, and a
// pick retypes every selected piece of that kind.
describe('the selection menu’s Type', () => {
  const rug = { ...piece('rug'), id: 'rug-a' } as ShapeElement;
  const rug2 = { ...piece('rug'), id: 'rug-b', y: 300 } as ShapeElement;
  const door = piece('door');

  function openSelectionMenu(elementId: string | undefined, selection: ShapeElement[]) {
    const onSetPieceType = vi.fn();
    openMenu(selection[0]!, {
      menu: { mode: 'multi', x: 10, y: 10, ...(elementId ? { elementId } : {}) },
      elements: selection,
      selectionElements: selection,
      onSetPieceType,
    });
    return onSetPieceType;
  }

  it('offers the right-clicked rug’s types, and asks for Persian on its kind', () => {
    const onSetPieceType = openSelectionMenu('rug-b', [door, rug, rug2]);
    fireEvent.click(tile('Type'));
    fireEvent.click(tile('Persian'));
    expect(onSetPieceType).toHaveBeenCalledExactlyOnceWith('rug', 'persian');
  });

  it('offers the right-clicked door’s types in a selection with rugs', () => {
    openSelectionMenu('door', [door, rug]);
    fireEvent.click(tile('Type'));
    expect(tiles()).toContain('Double Door');
    expect(tiles()).not.toContain('Persian');
  });

  it('offers the one kind with none right-clicked, and no Type for two kinds or none', () => {
    openSelectionMenu(undefined, [rug, rug2]);
    expect(tiles()).toContain('Type');
    cleanup();
    openSelectionMenu(undefined, [door, rug]);
    expect(tiles()).not.toContain('Type');
    cleanup();
    openSelectionMenu('chair', [piece('chair')]);
    expect(tiles()).not.toContain('Type');
  });
});
