// @vitest-environment jsdom

// The concept graphics' face (docs/specs/009-elements/concept-graphics.md): every row in place, edited in place once
// selected, and the animation class and per-row order the CSS reads.

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  applyShapeVariant,
  createShape,
  type ConceptShape,
  type ShapeElement,
  type WebRows,
} from '@livediagram/document';
import { ConceptFace } from './ConceptFace';

afterEach(cleanup);

const make = (kind: ConceptShape, over: Partial<ShapeElement> = {}) =>
  ({ ...(createShape(kind, 0, 0) as ShapeElement), ...over }) as ShapeElement & {
    shape: ConceptShape;
  };

function show(element: ShapeElement & { shape: ConceptShape }, editable = true) {
  const onSetRows = vi.fn<(rows: WebRows) => void>();
  const { container } = render(
    <ConceptFace
      element={element}
      labelNode={<span>centre words</span>}
      accent="#1d4ed8"
      fill="#ffffff"
      ink="#0f172a"
      fontFamily={undefined}
      editable={editable}
      onSetRows={onSetRows}
    />,
  );
  return { onSetRows, container };
}

function retype(name: string, text: string) {
  const line = screen.getByRole('textbox', { name });
  fireEvent.focus(line);
  line.textContent = text;
  fireEvent.keyDown(line, { key: 'Enter' });
  fireEvent.blur(line);
}

describe('ConceptFace', () => {
  it('draws a layer stack with its labels and notes, and commits an edited layer', () => {
    const { onSetRows } = show(make('layer-stack'));
    expect(screen.getByRole('textbox', { name: 'Layer 4' }).textContent).toBe('Storage');
    expect(screen.getByRole('textbox', { name: 'Layer 2 note' }).textContent).toBe('Workers');
    retype('Layer 1', 'UI');
    expect(onSetRows).toHaveBeenCalledWith({
      conceptRows: expect.arrayContaining([{ label: 'UI', note: 'Next.js' }]),
    });
  });

  it('draws a funnel value beside its tier', () => {
    show(applyShapeVariant(make('pyramid'), 'funnel') as ShapeElement & { shape: 'pyramid' });
    expect(screen.getByRole('textbox', { name: 'Tier 1 note' }).textContent).toBe('12,400');
  });

  it('puts a cycle label in the middle', () => {
    show(make('cycle'));
    expect(screen.getByText('centre words')).toBeTruthy();
    expect(screen.getByRole('textbox', { name: 'Step 1' }).textContent).toBe('Plan');
  });

  it('carries the animation class and builds a pyramid from its base', () => {
    const { container } = show(make('pyramid', { conceptAnim: 'build' }));
    expect(container.querySelector('.lvd-concept-build')).not.toBeNull();
    const rows = [...container.querySelectorAll<HTMLElement>('.lvd-cg-row')];
    expect(rows[0]!.style.getPropertyValue('--lvd-cg-i')).toBe('3');
    expect(rows[3]!.style.getPropertyValue('--lvd-cg-i')).toBe('0');
  });

  it('plays nothing it does not offer the kind', () => {
    const { container } = show(make('layer-stack', { conceptAnim: 'flow' }));
    expect(container.querySelector('.lvd-concept-flow')).toBeNull();
  });
});
