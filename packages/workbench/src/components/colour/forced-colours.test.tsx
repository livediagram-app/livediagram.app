// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { SwatchChip } from './ColourSwatch';
import { CustomColourEditor } from './CustomColourEditor';

// docs/specs/004-interface-design/forced-colors.md: colour that is the content keeps it under a contrast theme. A
// repainted swatch was an empty square, and the colour could not be picked.
afterEach(cleanup);

const keeps = (el: Element) => expect(el.className).toMatch(/(^|\s)forced-color-adjust-none(\s|$)/);

describe('colour under forced colours', () => {
  it('keeps a swatch chip in the colour it stands for', () => {
    const { container } = render(<SwatchChip colour="#f59e0b" />);
    keeps(container.querySelector('[data-swatch-chip]')!);
  });

  it('keeps the custom colour editor’s plane, hue slider and chip', () => {
    const { container } = render(<CustomColourEditor start="#0ea5e9" onUse={() => {}} />);
    keeps(screen.getByRole('slider', { name: 'Hue' }));
    keeps(container.querySelector('.cursor-crosshair')!);
    keeps(screen.getByRole('textbox', { name: 'Hex' }).previousElementSibling!);
  });
});
