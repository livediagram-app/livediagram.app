import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { afterAll, describe, expect, it } from 'vitest';
import { cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import { checkFirstLoad, FIRST_LOAD_BUDGETS, firstLoad, scriptSources } from './budget';

// liveworkspace/docs/specs/010-site/blueprints/site.md "Performance and limits".
const out = mkdtempSync(join(tmpdir(), 'first-load-'));
afterAll(() => rmSync(out, { recursive: true, force: true }));
mkdirSync(join(out, '_liveworkspace/_next/static/chunks'), { recursive: true });
const big = 'x'.repeat(4000) + Array.from({ length: 4000 }, (_, i) => i.toString(36)).join(',');
writeFileSync(join(out, '_liveworkspace/_next/static/chunks/a.js'), big);
writeFileSync(join(out, '_liveworkspace/_next/static/chunks/b.js'), 'console.log(1)');
const gz = (s: string) => gzipSync(s, { level: 9 }).length;
writeFileSync(
  join(out, 'index.html'),
  '<html><head><script>inline()</script><script src="/_liveworkspace/_next/static/chunks/a.js" async=""></script>' +
    '<link rel="preload" href="/x.css"/></head><body><script src="/_liveworkspace/_next/static/chunks/b.js" async></script>' +
    '<script src="/_liveworkspace/_next/static/chunks/a.js" async=""></script></body></html>',
);

describe('scriptSources', () => {
  it('lists each script file once, in order, and skips inline scripts', () => {
    expect(
      scriptSources(
        '<script>a()</script><script src="/s/1.js"></script><script async src="/s/2.js"></script><script src="/s/1.js"></script><script src="/data.json"></script>',
      ),
    ).toEqual(['/s/1.js', '/s/2.js']);
  });

  it('reads a long page in linear time', () => {
    const html = '<script src="/a.js"></script>'.repeat(20_000) + '<script'.repeat(20_000);
    expect(cpuMsOf(() => scriptSources(html))).toBeLessThan(500);
  });
});

describe('firstLoad', () => {
  it('sums the gzipped size of every script the page asks for, counted once', () => {
    expect(firstLoad(out, 'index.html')).toEqual({
      page: 'index.html',
      scripts: 2,
      gzipBytes: gz(big) + gz('console.log(1)'),
    });
  });
});

describe('checkFirstLoad', () => {
  it('passes a page within its budget and names its size', () => {
    const result = checkFirstLoad(out, { 'index.html': 100 });
    expect(result.ok).toBe(true);
    expect(result.lines[0]).toMatch(
      /^\[first-load\] ok: index\.html \d+\.\d KiB gzip in 2 scripts \(budget 100 KiB\)$/,
    );
  });

  it('fails a page over its budget', () => {
    const result = checkFirstLoad(out, { 'index.html': 0.01 });
    expect(result.ok).toBe(false);
    expect(result.lines[0]).toContain('[first-load] over: index.html');
  });

  it('watches the front door and the Explorer', () => {
    expect(Object.keys(FIRST_LOAD_BUDGETS)).toEqual(['index.html', 'explorer.html']);
  });
});
