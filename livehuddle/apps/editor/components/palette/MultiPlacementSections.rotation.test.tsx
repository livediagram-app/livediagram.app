// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createSticky, type BoxedElement, type Element } from '@livehuddle/document';
import { storedAnnotation } from '@/test/retired-elements';
import { MultiPlacementSections } from './MultiPlacementSections';
import type { EditorContextMenuProps } from './EditorContextMenu.types';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));
afterEach(cleanup);

// docs/specs/009-elements/annotations.md: the menu has no Rotation for an annotation marker, so a selection of only
// markers offers none, and a mixed one reads its tiles off a member that turns.
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

// A stored annotation marker is retired (docs/specs/002-project-scope/not-in-livehuddle.md "The element engine").
const note = (id: string, rotation?: number) =>
  storedAnnotation(id, { x: 0, y: 0, width: 44, height: 44 }, rotation ? { rotation } : {});
const square = (id: string, rotation: number) =>
  ({ ...createSticky(0, 0), id, rotation }) as Element;

describe('the multi-selection Rotation', () => {
  it('is not offered for a selection of only annotation markers', () => {
    menu([note('a', 45), note('b')]);
    expect(screen.queryByText('Rotation')).toBeNull();
  });

  it("marks the angle of a member that turns, never a marker's stored turn", () => {
    menu([note('a', 45), square('s', 90)]);
    expect(screen.getByText('Rotation')).toBeTruthy();
    expect(screen.getByText('90°').closest('button')!.getAttribute('aria-pressed')).toBe('true');
  });
});
