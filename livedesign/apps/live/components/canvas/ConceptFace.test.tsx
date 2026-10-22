// @vitest-environment jsdom

// The concept graphics' face (docs/specs/009-elements/concept-graphics.md): every row in place, edited in place once
// selected, and the animation class and per-row order the CSS reads.

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  applyShapeVariant,
  createShape,
  type ConceptShape,
  type ShapeElement,
  type WebRows,
} from '@livedesign/document';
import { ConceptFace } from './ConceptFace';
import { setConceptTourPreview } from '@/lib/concept-tour-preview';

afterEach(cleanup);

const make = (kind: ConceptShape, over: Partial<ShapeElement> = {}) =>
  ({ ...createShape(kind, 0, 0), ...over }) as ShapeElement & {
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

  it('draws a hub with its centre words, its satellites and a spoke to each', () => {
    const { container } = show(make('hub'));
    expect(screen.getByText('centre words')).toBeTruthy();
    expect(screen.getByRole('textbox', { name: 'Satellite 6' }).textContent).toBe('Support');
    expect(container.querySelectorAll('line')).toHaveLength(6);
    cleanup();
    const off = show(make('hub', { hubSpokes: false }));
    expect(off.container.querySelectorAll('line')).toHaveLength(0);
  });

  it('builds a hub from its centre, then each satellite', () => {
    const { container } = show(make('hub', { conceptAnim: 'build' }));
    const rows = [...container.querySelectorAll<HTMLElement>('.lvd-cg-row')];
    expect(rows.map((r) => r.style.getPropertyValue('--lvd-cg-i'))).toEqual([
      '0',
      '1',
      '2',
      '3',
      '4',
      '5',
      '6',
    ]);
  });

  it('paints an onion outermost first but builds it from the core', () => {
    const { container } = show(make('onion', { conceptAnim: 'build' }));
    const rows = [...container.querySelectorAll<HTMLElement>('.lvd-cg-row')];
    expect(rows[0]!.style.getPropertyValue('--lvd-cg-i')).toBe('3');
    expect(screen.getByRole('textbox', { name: 'Ring 1' }).textContent).toBe('Domain');
  });

  it('draws each chevron with its label and the note under it, and commits an edited note', () => {
    const { onSetRows, container } = show(make('chevrons'));
    expect(container.querySelectorAll('polygon')).toHaveLength(4);
    expect(screen.getByRole('textbox', { name: 'Stage 4 note' }).textContent).toBe('manual gate');
    retype('Stage 1 note', 'merge');
    expect(onSetRows).toHaveBeenCalledWith({
      conceptRows: expect.arrayContaining([{ label: 'Commit', note: 'merge' }]),
    });
  });
});

// Element tours (docs/specs/007-editor/element-tours.md): the rows a step points at, and an animation previewed on the
// graphic without being stored.
describe('ConceptFace under an element tour', () => {
  afterEach(() => act(() => setConceptTourPreview(null)));

  it('marks each row and note for a step to point at', () => {
    const { container } = show(make('layer-stack'));
    expect(container.querySelectorAll('[data-concept-row]')).toHaveLength(4);
    expect(container.querySelectorAll('[data-concept-note]')).toHaveLength(4);
    expect(container.querySelector('[data-concept-row="0"]')?.textContent).toContain(
      'Presentation',
    );
  });

  it('plays a previewed animation once on its own graphic, and drops it after', () => {
    const el = { ...make('layer-stack'), id: 'stack' } as ShapeElement & { shape: ConceptShape };
    const { container } = show(el);
    const root = () => container.firstElementChild as HTMLElement;
    expect(root().className).not.toContain('lvd-concept-build');
    act(() => setConceptTourPreview({ elementId: 'other', anim: 'build', run: 1 }));
    expect(root().className).not.toContain('lvd-concept-build');
    act(() => setConceptTourPreview({ elementId: 'stack', anim: 'build', run: 2 }));
    expect(root().className).toContain('lvd-concept-build');
    expect(root().className).not.toContain('lvd-concept-build-loop');
    act(() => setConceptTourPreview(null));
    expect(root().className).not.toContain('lvd-concept-build');
  });

  it('marks the middle of a cycle and a hub for a step to point at', () => {
    expect(
      show(make('cycle')).container.querySelector('[data-tour-part="concept-centre"]')?.textContent,
    ).toBe('centre words');
    cleanup();
    expect(
      show(make('hub')).container.querySelector('[data-tour-part="concept-centre"]'),
    ).not.toBeNull();
  });

  it('keeps a previewed loop going while its step is up', () => {
    const el = { ...make('cycle'), id: 'loop' } as ShapeElement & { shape: ConceptShape };
    const { container } = show(el);
    act(() => setConceptTourPreview({ elementId: 'loop', anim: 'flow', run: 1 }));
    const root = container.firstElementChild as HTMLElement;
    expect(root.className).toContain('lvd-concept-flow');
    expect(root.style.getPropertyValue('--lvd-concept-iter')).toBe('');
  });

  it("holds a chevron stage's bar open for a tour step, without changing its animation", () => {
    const el = { ...make('chevrons'), id: 'chev' } as ShapeElement & { shape: ConceptShape };
    const { container } = show(el);
    const bars = () => container.querySelectorAll('[data-concept-row-bar]');
    const before = bars().length;
    act(() => setConceptTourPreview({ elementId: 'chev', bar: 1, run: 1 }));
    expect(container.querySelector('[data-concept-row-bar][aria-label="Stage 2"]')).not.toBeNull();
    expect((container.firstElementChild as HTMLElement).className).not.toContain(
      'lvd-concept-pulse',
    );
    act(() => setConceptTourPreview(null));
    expect(bars().length).toBe(before);
  });
});
