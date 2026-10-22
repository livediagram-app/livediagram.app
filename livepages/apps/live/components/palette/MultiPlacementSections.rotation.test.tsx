// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createShape, type BoxedElement, type Element } from '@livepages/document';
import { MultiPlacementSections } from './MultiPlacementSections';
import type { EditorContextMenuProps } from './EditorContextMenu.types';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));
afterEach(cleanup);

// docs/specs/009-elements/pointer-note.md: the menu has no Rotation for a pointer note, so a selection of only pointer
// notes offers none, and a mixed one reads its tiles off a member that turns.
function menu(sel: Element[]) {
  const boxed = sel as BoxedElement[];
  render(
    <MultiPlacementSections
      props={
        {
          onCommitRotation: vi.fn(),
          onPreviewRotation: vi.fn(),
          onPreviewStyleEnd: vi.fn(),
        } as unknown as EditorContextMenuProps
      }
      sel={sel}
      boxedSel={boxed}
      morphable={[]}
      sectionProps={() => ({ open: true, onToggle: () => {}, flush: true })}
      onClose={() => {}}
    />,
  );
}

const note = (id: string, rotation?: number) =>
  ({ ...createShape('pointer-note', 0, 0), id, ...(rotation ? { rotation } : {}) }) as Element;
const square = (id: string, rotation: number) =>
  ({ ...createShape('square', 0, 0), id, rotation }) as Element;

describe('the multi-selection Rotation', () => {
  it('is not offered for a selection of only pointer notes', () => {
    menu([note('a', 45), note('b')]);
    expect(screen.queryByText('Rotation')).toBeNull();
  });

  it("marks the angle of a member that turns, never a pointer note's stored turn", () => {
    menu([note('a', 45), square('s', 90)]);
    expect(screen.getByText('Rotation')).toBeTruthy();
    expect(screen.getByText('90°').closest('button')!.getAttribute('aria-pressed')).toBe('true');
  });
});
