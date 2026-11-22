import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PAGE_RAIL_STRIP_WIDTH, PAGE_RAIL_WIDTH } from './PageRail';

// The page's scroller ends where the docked rail (or its strip) begins, in app/globals.css: kept in step with the
// rail's widths, so the scroller and its scrollbar never run under the rail.
const css = readFileSync(join(__dirname, '../../app/globals.css'), 'utf8');
const rightOf = (state: string) =>
  new RegExp(
    String.raw`\[data-page-rail='${state}'\]\) > \[data-page-scroller\] \{\s*right: (\d+)px;`,
  ).exec(css)?.[1];

describe('the page scroller beside the rail', () => {
  it('ends where the docked rail begins', () => {
    expect(Number(rightOf('docked'))).toBe(PAGE_RAIL_WIDTH);
  });
  it('ends where the collapsed strip begins', () => {
    expect(Number(rightOf('strip'))).toBe(PAGE_RAIL_STRIP_WIDTH);
  });
});
