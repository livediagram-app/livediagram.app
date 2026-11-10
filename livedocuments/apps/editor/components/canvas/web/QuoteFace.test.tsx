// @vitest-environment jsdom

// The quote's face (docs/specs/009-elements/quote.md): its slots, the name and role edited in place once selected, the
// Card look's box and the Plain look without one.

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { applyShapeVariant, createShape, type ShapeElement } from '@livedocuments/document';
import { QuoteFace } from './QuoteFace';

afterEach(cleanup);

function face(element: ShapeElement, editable = true) {
  const onSetHeading = vi.fn();
  const view = render(
    <QuoteFace
      element={element}
      labelNode={<span>words</span>}
      accent="#4f46e5"
      fill="#ffffff"
      textColor="#334155"
      fontFamily={undefined}
      editable={editable}
      onSetRows={vi.fn()}
      onSetHeading={onSetHeading}
    />,
  );
  return { onSetHeading, view };
}

describe('QuoteFace', () => {
  it('draws the mark, the words, the initial, the name and the role in its card', () => {
    const { view } = face(createShape('quote', 0, 0));
    expect(view.container.querySelector('[data-quote-mark]')?.textContent).toBe('“');
    expect(screen.getByText('words')).toBeTruthy();
    expect(screen.getByText('S')).toBeTruthy();
    expect(screen.getByRole('textbox', { name: 'Quote name' }).textContent).toBe('Sam Rivera');
    expect(screen.getByRole('textbox', { name: 'Quote role' }).textContent).toBe(
      'Operations Lead, Example Co',
    );
    expect(view.container.querySelector('.border')).not.toBeNull();
  });

  it('a Plain quote has no box, and no role line when it has none', () => {
    const { view } = face(applyShapeVariant(createShape('quote', 0, 0), 'pull'), false);
    expect(view.container.querySelector('.border')).toBeNull();
    expect(screen.queryByRole('textbox', { name: 'Quote role' })).toBeNull();
  });

  it('edits the name in place', () => {
    const { onSetHeading } = face(createShape('quote', 0, 0));
    const line = screen.getByRole('textbox', { name: 'Quote name' });
    fireEvent.focus(line);
    line.textContent = 'Jo Park';
    fireEvent.keyDown(line, { key: 'Enter' });
    fireEvent.blur(line);
    expect(onSetHeading).toHaveBeenCalledWith('pageTitle', 'Jo Park');
  });

  it('read-only, its lines take no focus', () => {
    face(createShape('quote', 0, 0), false);
    expect(screen.getByRole('textbox', { name: 'Quote name' }).getAttribute('tabindex')).toBeNull();
  });

  it('a photo it cannot show yet keeps the initial', () => {
    face({ ...createShape('quote', 0, 0), imageId: 'img-1' });
    expect(screen.getByText('S')).toBeTruthy();
  });
});
