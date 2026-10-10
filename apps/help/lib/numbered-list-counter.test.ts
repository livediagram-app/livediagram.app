import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// An article's numbered list draws its step numbers from a CSS counter on the
// `ol` (mdx-components.tsx). Tailwind has no `counter-reset-*` or
// `counter-increment-*` utilities, so classes spelled that way compile to
// nothing and every step reads "0". The counter must be set with arbitrary
// properties, which Tailwind does emit.

const source = readFileSync(
  fileURLToPath(new URL('../mdx-components.tsx', import.meta.url)),
  'utf8',
);

describe('numbered list counter', () => {
  it('resets and increments the step counter with arbitrary properties', () => {
    expect(source).toContain('[counter-reset:step]');
    expect(source).toContain('[&>li]:[counter-increment:step]');
    expect(source).toContain('[&>li]:before:content-[counter(step)]');
  });

  it('uses no counter utility Tailwind does not have', () => {
    expect(source).not.toMatch(/counter-(reset|increment)-\[/);
  });
});
