// @vitest-environment jsdom

// The element tour offer (docs/specs/007-editor/element-tours.md "The tour offer"): a separate small toolbar to the
// right of the selection toolbar, the Tour glyph and word, Play and Cancel; on a phone it wraps to the far side.

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SelectionPopover } from '@/components/canvas/SelectionPopover';
import { ElementTourOffer } from './ElementTourOffer';

afterEach(cleanup);

const offer = () => ({
  elementId: 'sk1',
  kind: 'sankey' as const,
  play: vi.fn(),
  dismiss: vi.fn(),
});

describe('ElementTourOffer', () => {
  it('names the tour, and plays or cancels it', () => {
    const o = offer();
    render(<ElementTourOffer offer={o} />);
    const bar = screen.getByRole('toolbar', { name: 'Tour of this Sankey diagram' });
    expect(bar.textContent).toContain('Tour');
    fireEvent.click(screen.getByRole('button', { name: 'Take the Tour' }));
    expect(o.play).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'No Thanks' }));
    expect(o.dismiss).toHaveBeenCalledTimes(1);
  });

  it('gives its buttons the toolbar touch targets', () => {
    render(<ElementTourOffer offer={offer()} />);
    for (const name of ['Take the Tour', 'No Thanks'])
      expect(screen.getByRole('button', { name }).className).toContain('touch-target-y');
  });
});

describe('SelectionPopover aside', () => {
  const renderWith = (aside?: React.ReactNode) =>
    render(
      <SelectionPopover
        bounds={{ x: 100, y: 100, width: 80, height: 40 }}
        canvasOffset={{ x: 0, y: 0 }}
        zoom={1}
        title="Selected Sankey"
        onDuplicate={() => {}}
        aside={aside}
      />,
    );

  it('sits as its own toolbar before the selection toolbar, away from Delete, in one placed group', () => {
    renderWith(<ElementTourOffer offer={offer()} />);
    const toolbar = screen.getByTestId('selection-popover');
    const tour = screen.getByTestId('element-tour-offer');
    expect(toolbar.contains(tour)).toBe(false);
    expect(toolbar.parentElement).toBe(tour.parentElement);
    expect(toolbar.compareDocumentPosition(tour) & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy();
  });

  it('wraps on a narrow screen to the far side from the element', () => {
    renderWith(<ElementTourOffer offer={offer()} />);
    const group = screen.getByTestId('selection-popover').parentElement!;
    expect(group.className).toContain('max-w-[calc(100vw-1rem)]');
    // A wrapped offer goes on the far side from the element: above the toolbar when it sits above, below it when it
    // sits below (wrap reversed, as the offer comes first). jsdom has no room above, so it sits below here, its
    // caption under it too.
    const above = screen
      .getByText('Selected Sankey')
      .closest('span.absolute')!
      .className.includes('bottom-full');
    expect(group.classList.contains(above ? 'flex-wrap' : 'flex-wrap-reverse')).toBe(true);
    expect(group.classList.contains(above ? 'flex-wrap-reverse' : 'flex-wrap')).toBe(false);
  });

  it('draws nothing beside the toolbar without one', () => {
    renderWith();
    expect(screen.queryByTestId('element-tour-offer')).toBeNull();
  });
});
