import { deflateRawSync, deflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { ByteBudget, BudgetExceeded, decompressDiagram, inflateBytes } from './inflate';

const compress = (xml: string) =>
  deflateRawSync(Buffer.from(encodeURIComponent(xml), 'latin1')).toString('base64');

describe('decompressDiagram', () => {
  it('reverses draw.io compression (base64, raw deflate, URI encoding)', async () => {
    const xml = '<mxGraphModel><root><mxCell id="0"/></root></mxGraphModel>';
    expect(await decompressDiagram(compress(xml), new ByteBudget(1_000_000))).toBe(xml);
  });

  it('keeps non-ASCII text through the URI encoding', async () => {
    const xml = '<mxCell value="Café ✓ 日本"/>';
    expect(await decompressDiagram(compress(xml), new ByteBudget(1_000_000))).toBe(xml);
  });

  it('ignores whitespace inside the base64', async () => {
    const b64 = compress('<a/>');
    const spaced = `\n  ${b64.slice(0, 4)}\n${b64.slice(4)}  `;
    expect(await decompressDiagram(spaced, new ByteBudget(1_000))).toBe('<a/>');
  });

  it('uses the inflated text as it is when it is not URI-encoded', async () => {
    const raw = deflateRawSync(Buffer.from('<a v="100%"/>', 'latin1')).toString('base64');
    expect(await decompressDiagram(raw, new ByteBudget(1_000))).toBe('<a v="100%"/>');
  });

  it('removes control characters draw.io would zap', async () => {
    expect(await decompressDiagram(compress('<a>\u0001x\ty</a>'), new ByteBudget(1_000))).toBe(
      '<a>x\ty</a>',
    );
  });

  it('refuses output beyond the budget', async () => {
    const big = compress(`<a>${'x'.repeat(5_000)}</a>`);
    await expect(decompressDiagram(big, new ByteBudget(1_000))).rejects.toBeInstanceOf(
      BudgetExceeded,
    );
  });

  it('rejects text that is not base64 deflate', async () => {
    await expect(decompressDiagram('not base64 at all!', new ByteBudget(1_000))).rejects.toThrow();
  });
});

describe('inflateBytes', () => {
  it('inflates zlib streams', async () => {
    const out = await inflateBytes(
      deflateSync(Buffer.from('hello')),
      'deflate',
      new ByteBudget(100),
    );
    expect(new TextDecoder().decode(out)).toBe('hello');
  });

  it('shares one budget across calls', async () => {
    const budget = new ByteBudget(8);
    await inflateBytes(deflateSync(Buffer.from('hello')), 'deflate', budget);
    await expect(
      inflateBytes(deflateSync(Buffer.from('hello')), 'deflate', budget),
    ).rejects.toBeInstanceOf(BudgetExceeded);
  });
});
