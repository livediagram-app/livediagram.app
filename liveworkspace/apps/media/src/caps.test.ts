// The gallery caps as deployed (liveworkspace/docs/specs/006-media/media.md "Uploads", step 4): 500 images and
// 1 GiB a person, the same in production and staging, each read by parsePositiveCap as the Worker reads it.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parsePositiveCap } from './env';

const toml = readFileSync(new URL('../wrangler.toml', import.meta.url).pathname, 'utf8');

// Each `[vars]`-style table's text, by its header, up to the next table.
function table(header: string): string {
  const start = toml.indexOf(`[${header}]\n`);
  expect(start).toBeGreaterThanOrEqual(0);
  const rest = toml.slice(start + header.length + 3);
  const next = rest.search(/^\[/m);
  return next === -1 ? rest : rest.slice(0, next);
}

const valueIn = (text: string, name: string) =>
  new RegExp(`^${name} = "([^"]*)"$`, 'm').exec(text)?.[1];

describe('gallery caps', () => {
  it.each(['vars', 'env.staging.vars'])('holds 500 images and 1 GiB a person in [%s]', (header) => {
    const vars = table(header);
    expect(parsePositiveCap(valueIn(vars, 'IMAGE_MAX_PER_OWNER'))).toBe(500);
    expect(parsePositiveCap(valueIn(vars, 'IMAGE_MAX_BYTES_PER_OWNER'))).toBe(1024 ** 3);
  });

  it('leaves room for 500 full-window screenshots (up to 1.1 MB each) under the byte cap', () => {
    expect(500 * 1.1 * 1024 * 1024).toBeLessThan(1024 ** 3);
  });
});
