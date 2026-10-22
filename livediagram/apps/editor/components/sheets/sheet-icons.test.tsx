// @vitest-environment jsdom
// The Sheet toolbar's glyphs (blueprint sheet-element.md "Assets and external resources"): each draws an svg in
// `currentColor`, and the ones with a variant draw it.
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  BordersIcon,
  CheckMark,
  ChevronIcon,
  ClearFormatIcon,
  DecimalsIcon,
  FillColourIcon,
  FilterIcon,
  FontSizeIcon,
  FreezeIcon,
  HAlignIcon,
  MergeIcon,
  NumberFormatIcon,
  SigmaIcon,
  SortIcon,
  TextColourIcon,
  VAlignIcon,
  WrapIcon,
} from './sheet-icons';

const svgOf = (node: React.ReactElement) => render(node).container.querySelector('svg');

describe('the sheet toolbar glyphs', () => {
  it.each([
    ['Merge', <MergeIcon key="m" />],
    ['Sort', <SortIcon key="s" />],
    ['Text Colour', <TextColourIcon key="t" />],
    ['Font Size', <FontSizeIcon key="f" />],
    ['Clear Format', <ClearFormatIcon key="c" />],
    ['Fill Colour', <FillColourIcon key="fc" />],
    ['Number Format', <NumberFormatIcon key="n" />],
    ['Borders', <BordersIcon key="b" />],
    ['Wrap', <WrapIcon key="w" />],
    ['Freeze', <FreezeIcon key="fr" />],
    ['Filter', <FilterIcon key="fi" />],
    ['Sigma', <SigmaIcon key="si" />],
    ['Chevron', <ChevronIcon key="ch" />],
  ])('%s draws an svg with content', (_name, node) => {
    const svg = svgOf(node)!;
    expect(svg).toBeTruthy();
    expect(svg.childElementCount).toBeGreaterThan(0);
  });

  it('draws each horizontal alignment differently', () => {
    const drawn = (['l', 'c', 'r'] as const).map((to) => svgOf(<HAlignIcon to={to} />)!.innerHTML);
    expect(new Set(drawn).size).toBe(3);
  });

  it('draws each vertical alignment differently', () => {
    const drawn = (['t', 'm', 'b'] as const).map((to) =>
      svgOf(<VAlignIcon to={to} />)!
        .querySelectorAll('path')[1]!
        .getAttribute('d'),
    );
    expect(new Set(drawn).size).toBe(3);
  });

  it('shows more or fewer decimals', () => {
    expect(svgOf(<DecimalsIcon more />)!.textContent).toBe('.00');
    expect(svgOf(<DecimalsIcon more={false} />)!.textContent).toBe('.0');
  });

  it('ticks the choice in force only', () => {
    expect(render(<CheckMark on />).container.textContent).toBe('✓');
    expect(render(<CheckMark on={false} />).container.textContent).toBe('');
  });
});
