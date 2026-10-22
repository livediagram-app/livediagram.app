// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Glyph } from './Glyph';
import { Prims } from './Prims';

const vars = (el: Element) => {
  const s = (el as SVGSVGElement).style;
  return ['l', 'r', 't', 'b'].map((k) => s.getPropertyValue(`--glyph-ink-${k}`));
};

describe('Glyph ink insets', () => {
  it('emits the blank margin per side in rendered px, stroke included', () => {
    // 3.5..12.5 on a 16 grid at 13px with a 1.5px stroke: 3.5 * 13/16 - 0.75 = 2.09px.
    const { container } = render(
      <Glyph size={13} units={16} weight={1.5}>
        <path d="M3.5 8h9M9 4.5 12.5 8 9 11.5" />
        <rect x="3.5" y="3.5" width="9" height="9" />
      </Glyph>,
    );
    expect(vars(container.querySelector('svg')!)).toEqual(['2.09px', '2.09px', '2.09px', '2.09px']);
  });

  it('reads Prims, fragments and groups', () => {
    const { container } = render(
      <Glyph size={24} units={24} weight={0}>
        <>
          <g>
            <Prims prims={[{ t: 'circle', cx: 12, cy: 12, r: 8 }]} />
          </g>
        </>
      </Glyph>,
    );
    expect(vars(container.querySelector('svg')!)).toEqual(['4px', '4px', '4px', '4px']);
  });

  it('omits the insets when a child cannot be read', () => {
    const Custom = () => <path d="M0 0" />;
    const { container } = render(
      <Glyph size={16}>
        <path d="M2 2h12" transform="rotate(45)" />
        <Custom />
      </Glyph>,
    );
    expect(vars(container.querySelector('svg')!)).toEqual(['', '', '', '']);
  });

  it('keeps a caller style', () => {
    const { container } = render(
      <Glyph size={16} style={{ opacity: 0.5 }}>
        <path d="M2 8h12" />
      </Glyph>,
    );
    const svg = container.querySelector('svg')!;
    expect(svg.style.opacity).toBe('0.5');
    expect(svg.style.getPropertyValue('--glyph-ink-l')).not.toBe('');
  });
});
