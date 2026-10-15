// @vitest-environment jsdom

// The boundary's face (docs/specs/009-elements/boundary.md): a wash of its accent unless it has a fill, its title in a
// tab (Tab style) or not, and its meta line, edited in place once selected.

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createShape, type ShapeElement } from '@livediagram/document';
import { BoundaryFace } from './BoundaryFace';

afterEach(cleanup);

const make = (over: Partial<ShapeElement> = {}) =>
  ({ ...(createShape('boundary', 0, 0) as ShapeElement), ...over }) as ShapeElement;

function show(element: ShapeElement, editable = true) {
  const onSetMeta = vi.fn<(value: string) => void>();
  const { container } = render(
    <BoundaryFace
      element={element}
      labelNode={<span>AWS Cloud</span>}
      accent="#0d9488"
      ink="#0f172a"
      fontFamily={undefined}
      editable={editable}
      onSetMeta={onSetMeta}
    />,
  );
  return { onSetMeta, container };
}

const backgrounds = (container: HTMLElement) =>
  [...container.querySelectorAll<HTMLElement>('div[aria-hidden]')].map(
    (d) => d.style.backgroundColor,
  );

describe('BoundaryFace', () => {
  it('washes its area and fills a tab with the accent in Tab style', () => {
    const { container } = show(make());
    expect(screen.getByText('AWS Cloud')).toBeTruthy();
    const fills = backgrounds(container);
    expect(fills).toHaveLength(2);
    expect(fills[1]).toBe('rgb(13, 148, 136)');
  });

  it('draws no tab in Inset style and no wash under an explicit fill', () => {
    const { container } = show(make({ boundaryStyle: 'inset', fillColor: '#ffffff' }));
    expect(backgrounds(container)).toHaveLength(0);
  });

  it('shows the meta line only when it has one, and commits an edit in place', () => {
    show(make());
    expect(screen.queryByRole('textbox', { name: 'Boundary meta line' })).toBeNull();
    cleanup();
    const { onSetMeta } = show(make({ pageSubtitle: '10.0.0.0/16' }));
    const line = screen.getByRole('textbox', { name: 'Boundary meta line' });
    expect(line.textContent).toBe('10.0.0.0/16');
    fireEvent.focus(line);
    line.textContent = '10.1.0.0/16';
    fireEvent.keyDown(line, { key: 'Enter' });
    fireEvent.blur(line);
    expect(onSetMeta).toHaveBeenCalledWith('10.1.0.0/16');
  });

  it('brackets a C4 meta line for a reader who cannot edit it', () => {
    show(make({ boundaryStyle: 'c4', pageSubtitle: 'Software System' }), false);
    expect(screen.getByText('[Software System]')).toBeTruthy();
  });
});
