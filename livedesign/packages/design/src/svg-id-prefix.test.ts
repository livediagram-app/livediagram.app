import { describe, expect, it } from 'vitest';
import { prefixSvgIds } from './svg-id-prefix';

describe('prefixSvgIds', () => {
  it('prefixes every id and the references to it, and nothing else', () => {
    const svg =
      '<svg><defs><linearGradient id="g1"/><marker id="m"/></defs>' +
      '<rect fill="url(#g1)"/><path marker-end="url(#m)"/><use href="#m"/><rect fill="url(#other)"/></svg>';
    expect(prefixSvgIds(svg, 'ci-')).toBe(
      '<svg><defs><linearGradient id="ci-g1"/><marker id="ci-m"/></defs>' +
        '<rect fill="url(#ci-g1)"/><path marker-end="url(#ci-m)"/><use href="#ci-m"/><rect fill="url(#other)"/></svg>',
    );
  });

  it('leaves markup without ids as it is', () => {
    expect(prefixSvgIds('<svg><rect/></svg>', 'x-')).toBe('<svg><rect/></svg>');
  });
});
