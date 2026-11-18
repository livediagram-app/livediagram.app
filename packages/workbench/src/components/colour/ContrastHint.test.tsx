// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { contrastRatio } from '@liveworkspace/element-model/colour-math';
import type { TextGround } from '@liveworkspace/element-model/text-contrast';
import type { TextContrastProbe } from '@liveworkspace/element-model/text-contrast-probe';
import { CONTRAST_ROW_PX, ContrastHint } from './ContrastHint';

// Each product's docs/specs/004-interface-design/colour-picker.md "Reading on its ground".
afterEach(cleanup);

const PAPER: TextGround = { tones: ['#ffffff'], on: 'page' };
const hint = () => screen.getByTestId('contrast-hint');
// One ground, judging the hex it is given.
const on = (
  ground: TextGround,
  current: string | null,
  extra: Partial<TextContrastProbe> = {},
): TextContrastProbe => ({
  ground,
  large: false,
  exported: false,
  current,
  colourOf: (id) => (id.startsWith('#') ? id : null),
  ...extra,
});
const Hint = ({
  colour,
  ground = PAPER,
  large = false,
  onUse = vi.fn(),
}: {
  colour: string | null;
  ground?: TextGround;
  large?: boolean;
  onUse?: (hex: string) => void;
}) => <ContrastHint probes={[on(ground, colour, { large })]} judged={null} onUse={onUse} />;

describe('ContrastHint', () => {
  it('says nothing while the colour reads', () => {
    render(<Hint colour="#0f172a" />);
    expect(hint().childElementCount).toBe(0);
    expect(hint().getAttribute('role')).toBe('status');
  });

  it('shows the ratio and the target under 4.5:1, and Use applies a shade that passes', () => {
    const onUse = vi.fn();
    render(<Hint colour="#fde047" onUse={onUse} />);
    expect(hint().textContent).toContain('Hard to read on this page');
    // Floored, never rounded up onto the target.
    expect(hint().textContent).toContain(
      `${Math.floor(contrastRatio('#fde047', '#ffffff') * 10) / 10}:1, aim for 4.5:1`,
    );
    const use = screen.getByRole('button', { name: /^Use #[0-9a-f]{6}, a darker shade/ });
    fireEvent.click(use);
    const picked = onUse.mock.calls[0]![0] as string;
    expect(contrastRatio(picked, '#ffffff')).toBeGreaterThanOrEqual(4.5);
  });

  it('holds large text to 3:1', () => {
    render(<Hint colour="#949494" large />);
    expect(hint().childElementCount).toBe(0);
    cleanup();
    render(<Hint colour="#b0b0b0" large />);
    expect(hint().textContent).toContain('aim for 3:1');
  });

  it('offers a lighter shade on a dark fill and names the ground', () => {
    render(<Hint colour="#1e3a8a" ground={{ tones: ['#0f172a'], on: 'shape' }} />);
    expect(hint().textContent).toContain('Hard to read on its fill');
    expect(
      screen.getByRole('button', { name: /a lighter shade that reads on its fill/ }),
    ).toBeTruthy();
  });

  it('shows no Use when no shade of the hue passes, and nothing for no colour', () => {
    render(<Hint colour="#808080" ground={{ tones: ['#000000', '#ffffff'], on: 'card' }} />);
    expect(hint().textContent).toContain('on the shape behind');
    expect(screen.queryByRole('button')).toBeNull();
    cleanup();
    render(<Hint colour={null} />);
    expect(hint().childElementCount).toBe(0);
  });
});

describe('ContrastHint row', () => {
  const row = () => document.querySelector<HTMLElement>('[data-contrast-row]')!;

  it('keeps one height whether the colour reads, falls short or is none', () => {
    const { rerender } = render(<Hint colour="#0f172a" />);
    expect(row().style.height).toBe(`${CONTRAST_ROW_PX}px`);
    rerender(<Hint colour="#fde047" />);
    expect(row().style.height).toBe(`${CONTRAST_ROW_PX}px`);
    rerender(<Hint colour={null} />);
    expect(row().style.height).toBe(`${CONTRAST_ROW_PX}px`);
  });

  it('says quietly that a colour reads, outside the status region', () => {
    render(<Hint colour="#0f172a" />);
    const reads = document.querySelector('[data-contrast-reads]')!;
    expect(reads.textContent).toContain('Easy to read on this page');
    expect(reads.textContent).toContain(
      `${Math.floor(contrastRatio('#0f172a', '#ffffff') * 10) / 10}:1`,
    );
    expect(hint().childElementCount).toBe(0);
  });

  it('says it judges the exported page on a dark canvas, on the white it exports', () => {
    render(
      <ContrastHint
        probes={[on(PAPER, '#fde047', { exported: true })]}
        judged={null}
        onUse={vi.fn()}
      />,
    );
    expect(hint().textContent).toContain('Hard to read on the exported page');
    const tile = hint().querySelector<HTMLElement>('[data-contrast-tile]')!;
    expect(tile.style.backgroundColor).toBe('rgb(255, 255, 255)');
    expect(
      screen.getByRole('button', { name: /a darker shade that reads on the exported page/ }),
    ).toBeTruthy();
  });

  it('judges several grounds by the worst, and offers one shade that reads on all', () => {
    const onUse = vi.fn();
    const cream: TextGround = { tones: ['#fef3c7'], on: 'card' };
    render(
      <ContrastHint
        probes={[on(PAPER, '#64748b'), on(cream, '#64748b'), on(PAPER, '#64748b')]}
        judged={null}
        onUse={onUse}
      />,
    );
    expect(hint().textContent).toContain('Hard to read for 1 of 3');
    expect(hint().textContent).toContain(
      `Worst ${Math.floor(contrastRatio('#64748b', '#fef3c7') * 10) / 10}:1`,
    );
    fireEvent.click(screen.getByRole('button', { name: /shade that reads on all 3/ }));
    const picked = onUse.mock.calls[0]![0] as string;
    expect(contrastRatio(picked, '#ffffff')).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(picked, '#fef3c7')).toBeGreaterThanOrEqual(4.5);
  });

  it('says several read when every ground passes, judging the hovered swatch', () => {
    render(
      <ContrastHint
        probes={[on(PAPER, '#fde047'), on(PAPER, null)]}
        judged="#0f172a"
        onUse={vi.fn()}
      />,
    );
    const reads = document.querySelector('[data-contrast-reads]')!;
    expect(reads.textContent).toContain('Easy to read for all 2');
    expect(reads.textContent).toContain('At least');
  });
});

describe('ContrastHint grounds', () => {
  it('names a canvas, a cell, and a canvas judged as saved in the other appearance', () => {
    const { rerender } = render(
      <Hint colour="#fde047" ground={{ tones: ['#fbfaf7'], on: 'canvas' }} />,
    );
    expect(hint().textContent).toContain('Hard to read on the canvas');
    rerender(<Hint colour="#fde047" ground={{ tones: ['#fef3c7'], on: 'cell' }} />);
    expect(hint().textContent).toContain('Hard to read on its cell');
    rerender(
      <ContrastHint
        probes={[on({ tones: ['#fbfaf7'], on: 'canvas' }, '#fde047', { exported: true })]}
        judged={null}
        onUse={vi.fn()}
      />,
    );
    expect(hint().textContent).toContain('Hard to read on the light canvas');
    rerender(
      <ContrastHint
        probes={[on({ tones: ['#0d121a'], on: 'canvas' }, '#1e3a8a', { exported: true })]}
        judged={null}
        onUse={vi.fn()}
      />,
    );
    expect(hint().textContent).toContain('Hard to read on the dark canvas');
  });

  it('counts a probe standing for several cells as that many', () => {
    render(
      <ContrastHint
        probes={[on({ tones: ['#ffffff'], on: 'cell' }, '#fde047', { count: 4 })]}
        judged={null}
        onUse={vi.fn()}
      />,
    );
    expect(hint().textContent).toContain('Hard to read for 4 of 4');
  });

  it('tells the picker when the mouse reaches the row, and only the mouse', () => {
    const onArrive = vi.fn();
    render(
      <ContrastHint
        probes={[on(PAPER, '#fde047')]}
        judged={null}
        onUse={vi.fn()}
        onArrive={onArrive}
      />,
    );
    const row = document.querySelector<HTMLElement>('[data-contrast-row]')!;
    fireEvent.pointerEnter(row, { pointerType: 'touch' });
    expect(onArrive).not.toHaveBeenCalled();
    fireEvent.pointerEnter(row, { pointerType: 'mouse' });
    expect(onArrive).toHaveBeenCalledTimes(1);
  });
});
