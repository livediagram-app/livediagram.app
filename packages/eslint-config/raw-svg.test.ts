import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';
import config from './index.js';

// Raw icon-sized <svg> is rejected outside the art allow-list
// (docs/specs/004-interface-design/iconography.md, "Guarding").
const eslint = new ESLint({ overrideConfigFile: true, overrideConfig: config });

async function svgErrors(code: string, filePath = 'components/Sample.tsx'): Promise<string[]> {
  const [result] = await eslint.lintText(code, { filePath });
  return (result?.messages ?? [])
    .filter((m) => m.ruleId === 'no-restricted-syntax')
    .map((m) => m.message);
}

describe('raw icon svg rule', () => {
  it('rejects an icon-sized svg with a string width', async () => {
    const errors = await svgErrors('export const A = () => <svg width="14" height="14" />;');
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/Glyph/);
  });

  it('rejects an icon-sized svg with a numeric width', async () => {
    expect(await svgErrors('export const A = () => <svg width={24} height={24} />;')).toHaveLength(
      1,
    );
  });

  it('leaves illustration-sized and computed widths alone', async () => {
    expect(await svgErrors('export const A = () => <svg width="240" height="130" />;')).toEqual([]);
    expect(
      await svgErrors('export const A = ({ s }: { s: number }) => <svg width={s} />;'),
    ).toEqual([]);
  });

  it('allows art files and tests', async () => {
    const code = 'export const A = () => <svg width="18" height="18" />;';
    expect(await svgErrors(code, 'components/palette/palette-tile-art.tsx')).toEqual([]);
    expect(await svgErrors(code, 'components/feature-art/canvas.tsx')).toEqual([]);
    expect(await svgErrors(code, 'components/Thing.test.tsx')).toEqual([]);
  });

  it('keeps the native title rule in art files', async () => {
    const code = 'export const A = () => <button title="Zoom" />;';
    expect(await svgErrors(code, 'components/palette/palette-tile-art.tsx')).toHaveLength(1);
  });
});
