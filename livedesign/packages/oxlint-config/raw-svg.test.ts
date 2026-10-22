import { beforeAll, describe, expect, it } from 'vitest';
import { findingsOf, lintFixtures, type Finding } from './lint-fixtures';

// Raw icon-sized <svg> is rejected outside the art allow-list
// (docs/specs/004-interface-design/iconography.md, "Guarding").
const SVG = 'livepages(no-raw-icon-svg)';
const TITLE = 'livepages(no-native-title)';
const ICON = 'export const A = () => <svg width="18" height="18" />;';

const FIXTURES = {
  'components/StringWidth.tsx': 'export const A = () => <svg width="14" height="14" />;',
  'components/NumericWidth.tsx': 'export const A = () => <svg width={24} height={24} />;',
  'components/Illustration.tsx': 'export const A = () => <svg width="240" height="130" />;',
  'components/Computed.tsx': 'export const A = ({ s }: { s: number }) => <svg width={s} />;',
  'components/palette/palette-tile-art.tsx': ICON,
  'components/feature-art/canvas.tsx': ICON,
  'components/Thing.test.tsx': ICON,
  'components/palette/context-menu-tiles.tsx': 'export const A = () => <button title="Zoom" />;',
};

let findings: Finding[];
beforeAll(() => {
  findings = lintFixtures(FIXTURES);
});

const svgErrors = (file: keyof typeof FIXTURES) => findingsOf(findings, file, SVG);

describe('raw icon svg rule', () => {
  it('rejects an icon-sized svg with a string width', () => {
    const errors = svgErrors('components/StringWidth.tsx');
    expect(errors).toHaveLength(1);
    expect(errors[0]?.message).toMatch(/Glyph/);
  });

  it('rejects an icon-sized svg with a numeric width', () => {
    expect(svgErrors('components/NumericWidth.tsx')).toHaveLength(1);
  });

  it('leaves illustration-sized and computed widths alone', () => {
    expect(svgErrors('components/Illustration.tsx')).toEqual([]);
    expect(svgErrors('components/Computed.tsx')).toEqual([]);
  });

  it('allows art files and tests', () => {
    expect(svgErrors('components/palette/palette-tile-art.tsx')).toEqual([]);
    expect(svgErrors('components/feature-art/canvas.tsx')).toEqual([]);
    expect(svgErrors('components/Thing.test.tsx')).toEqual([]);
  });

  it('keeps the native title rule in art files', () => {
    expect(findingsOf(findings, 'components/palette/context-menu-tiles.tsx', TITLE)).toHaveLength(
      1,
    );
  });
});
