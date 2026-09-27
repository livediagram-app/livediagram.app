import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';
import config from './index.js';

// Native `title` is not a hint (docs/specs/004-interface-design/tooltips-hover-cards-popovers.md): the
// shared config rejects it everywhere except the elements where it is an
// accessible name rather than a hover.
const eslint = new ESLint({ overrideConfigFile: true, overrideConfig: config });

async function titleErrors(code: string): Promise<string[]> {
  const [result] = await eslint.lintText(code, { filePath: 'Sample.tsx' });
  return (result?.messages ?? [])
    .filter((m) => m.ruleId === 'no-restricted-syntax')
    .map((m) => m.message);
}

describe('native title rule', () => {
  it('rejects title on an interactive element', async () => {
    const errors = await titleErrors('export const A = () => <button title="Zoom in" />;');
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/Tooltip.*HoverCard/);
  });

  it('rejects title on plain text', async () => {
    expect(
      await titleErrors('export const A = () => <span title="Full name">Full…</span>;'),
    ).toHaveLength(1);
  });

  it('allows the accessible-name exceptions', async () => {
    expect(await titleErrors('export const A = () => <iframe title="Video" src="x" />;')).toEqual(
      [],
    );
    expect(
      await titleErrors('export const A = () => <abbr title="Domain event">DE</abbr>;'),
    ).toEqual([]);
  });

  it('leaves component props named title alone', async () => {
    expect(await titleErrors('export const A = () => <Panel title="Layers" />;')).toEqual([]);
    expect(await titleErrors('export const A = () => <HoverCard title="Zoom" />;')).toEqual([]);
  });
});
