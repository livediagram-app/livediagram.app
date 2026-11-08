import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// A browser with no guest token leaves the page it opens for the guest handoff and comes back, and a check that lands
// during that round trip fails with "Execution context was destroyed". The shared `test` fixture opens every test's
// context as a minted guest instead (docs/specs/003-system-architecture/e2e-smoke.md "Every test opens as a returning
// guest"), so a spec that opens a page takes `test` from the fixtures, and only the first visit's own test opts out.

const dir = import.meta.dirname;
const read = (name: string) => readFileSync(join(dir, name), 'utf8');
const specs = readdirSync(dir).filter((name) => name.endsWith('.spec.ts'));
const SHARED_TEST = /import\s*\{[^}]*\btest\b[^}]*\}\s*from\s*'\.\/fixtures'/;

describe('specs that open a page', () => {
  it('open it as a guest who already holds a token', () => {
    const offenders = specs.filter(
      (name) => /\.goto\(/.test(read(name)) && !SHARED_TEST.test(read(name)),
    );
    expect(offenders).toEqual([]);
  });

  it('leave the first visit to the smoke suite’s own test', () => {
    expect(specs.filter((name) => /\bfreshVisitor\b/.test(read(name)))).toEqual(['smoke.spec.ts']);
  });

  it('get the guest from the fixtures’ context', () => {
    expect(read('fixtures.ts')).toMatch(
      /if \(!freshVisitor && !PAGES_SIGN_IN\) await holdMintedGuest\(context\);/,
    );
  });
});
