import { describe, expect, it } from 'vitest';
import { faceAttrs } from './face-finish';
import { markedGroup, replaceBlocks } from './svg-markup-blocks';
import { svgMarkerFace, svgProfessionalFace } from './svg-render-face-finish';
import { svgSketchFace } from './svg-render-sketch';

describe('markedGroup', () => {
  it('finds the group whose opening tag carries the attribute', () => {
    const m = '<rect/><g transform="t" data-finish="marker"><path d="M0 0"/></g><text>x</text>';
    const at = markedGroup(m, 'data-finish="marker"')!;
    expect(m.slice(at[0], at[1])).toBe(
      '<g transform="t" data-finish="marker"><path d="M0 0"/></g>',
    );
  });

  it('is null when there is none, or the attribute is not on a group', () => {
    expect(markedGroup('<rect/>', 'data-finish="marker"')).toBeNull();
    expect(markedGroup('<g><rect data-finish="marker"/></g>', 'data-finish="marker"')).toBeNull();
  });
});

describe('replaceBlocks', () => {
  it('replaces each whole block of the named tags, and only whole tag names', () => {
    const m = '<defs><x/></defs><rect/><mask id="m"><y/></mask><markerX/>';
    expect(replaceBlocks(m, ['defs', 'mask', 'marker'], () => '#')).toBe('#<rect/>#<markerX/>');
  });

  it('leaves an opening tag with no closing one as it is', () => {
    expect(replaceBlocks('<defs><rect/>', ['defs'], () => '#')).toBe('<defs><rect/>');
  });
});

// CodeQL js/polynomial-redos: the face passes read markup in one linear pass. Worst cases that a backtracking pattern
// rescans from every opening tag must finish within a small budget.
describe('linear on hostile markup', () => {
  const budgetMs = 250;
  const time = (fn: () => void) => {
    const t = performance.now();
    fn();
    return performance.now() - t;
  };

  it('reads attributes from a long run of name characters', () => {
    expect(time(() => faceAttrs(' ' + '-'.repeat(200_000)))).toBeLessThan(budgetMs);
  });

  it('scans many unclosed groups and blocks', () => {
    const groups = '<g data-finish="marker">'.repeat(20_000);
    const defs = '<defs>'.repeat(20_000);
    const paths = '<path d="M0 0">'.repeat(20_000);
    expect(
      time(() => svgMarkerFace(groups + defs + paths, 'e', { width: 100, height: 100 })),
    ).toBeLessThan(budgetMs * 4);
    expect(time(() => svgSketchFace('<g data-finish="sketch">'.repeat(20_000)))).toBeLessThan(
      budgetMs * 4,
    );
    expect(
      time(() => svgProfessionalFace('<rect data-sticker-shadow="" '.repeat(20_000))),
    ).toBeLessThan(budgetMs * 4);
  });
});
