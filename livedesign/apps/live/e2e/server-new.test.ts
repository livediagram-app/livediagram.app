import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// A guest's own /new keeps the new design in This Browser (docs/specs/006-design/save-locations.md), where the
// index has no item, so a spec that then seeds it through the api failed on `grant on <id>: 404`. Such a spec reaches
// /new through serverNewUrl or a fixture that does (docs/specs/003-system-architecture/e2e-smoke.md).

const dir = import.meta.dirname;
const read = (name: string) => readFileSync(join(dir, name), 'utf8');
// `page.goto('/new…')` with a plain address: the guest's own create.
const PLAIN_NEW = /\.goto\(\s*['`]\/new\b/;

describe('specs that seed a new design through the api', () => {
  it('make it on the server, never with a guest’s plain /new', () => {
    const offenders = readdirSync(dir)
      .filter((name) => name.endsWith('.spec.ts'))
      .filter((name) => {
        const src = read(name);
        return /\bseedTab\(/.test(src) && PLAIN_NEW.test(src);
      });
    expect(offenders).toEqual([]);
  });

  it('get the fixtures’ new designs on the server', () => {
    expect(read('fixtures.ts')).not.toMatch(PLAIN_NEW);
  });
});
