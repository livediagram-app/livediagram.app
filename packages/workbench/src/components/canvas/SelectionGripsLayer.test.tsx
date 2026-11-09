// @vitest-environment jsdom

import { useState } from 'react';
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  ArrowGripsPortal,
  BoxGripsPortal,
  SELECTION_GRIPS_Z_INDEX,
  SelectionGripsContext,
  SelectionGripsLayer,
  type SelectionGripHosts,
} from './SelectionGripsLayer';

// The grips layer every editor draws its selection grips in (each editor's canvas-and-palette.md "Resize"), and the
// planes a move's offset rides on (drag-preview.md "A very large move rides as one layer"). Each editor's own
// SelectionGripsLayer.test.tsx drives it with its element chrome.

function Harness({ shiftX, isoDepth }: { shiftX?: number; isoDepth?: number }) {
  const [hosts, setHosts] = useState<SelectionGripHosts | null>(null);
  return (
    <SelectionGripsContext.Provider value={hosts}>
      <svg>
        <ArrowGripsPortal arrowId="ar" shiftX={shiftX}>
          <circle data-testid="end" />
        </ArrowGripsPortal>
      </svg>
      <BoxGripsPortal>
        <div data-testid="box" data-ride-id="b" />
      </BoxGripsPortal>
      <SelectionGripsLayer onHosts={setHosts} isoDepth={isoDepth} />
    </SelectionGripsContext.Provider>
  );
}

describe('SelectionGripsLayer', () => {
  it('hosts the grips in two ride planes, each with a box of its own', () => {
    const { container } = render(<Harness isoDepth={7} />);
    const layer = container.querySelector<HTMLElement>('[data-selection-grips]')!;
    expect(layer.style.zIndex).toBe(String(SELECTION_GRIPS_Z_INDEX));
    expect(layer.style.getPropertyValue('--iso-z')).toBe('7');
    const planes = layer.querySelectorAll('[data-ride-plane]');
    expect(planes).toHaveLength(2);
    expect(planes[1]!.className).toBe('absolute inset-0');
    expect(planes[1]!.querySelector('[data-testid="box"]')).not.toBeNull();
  });

  it("tags an arrow's grips with its id, shifted with it", () => {
    const { container, rerender } = render(<Harness />);
    const g = container.querySelector('[data-selection-grips] g[data-ride-id="ar"]')!;
    expect(g.querySelector('[data-testid="end"]')).not.toBeNull();
    expect(g.getAttribute('transform')).toBeNull();
    rerender(<Harness shiftX={12} />);
    expect(
      container
        .querySelector('[data-selection-grips] g[data-ride-id="ar"]')!
        .getAttribute('transform'),
    ).toBe('translate(12 0)');
  });

  it('renders no grips outside a layer', () => {
    const { container } = render(
      <ArrowGripsPortal arrowId="ar">
        <circle data-testid="end" />
      </ArrowGripsPortal>,
    );
    expect(container.querySelector('[data-testid="end"]')).toBeNull();
  });
});
