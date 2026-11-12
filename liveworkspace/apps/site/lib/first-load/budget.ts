// The site's first-load budget (liveworkspace/docs/specs/010-site/blueprints/site.md "Performance and limits"): the
// gzipped size of every script a page's prebuilt HTML asks for, read from the export after `next build`. The build
// fails when a page goes over (scripts/first-load-budget.ts), so a static import that drags lazy code into every
// page's first load is caught where it lands, not weeks later.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

/** Each watched page's export file and its budget in gzipped KiB (measured, plus a few KiB of room). */
export const FIRST_LOAD_BUDGETS: Readonly<Record<string, number>> = {
  // The front door: 208.7 KiB measured (2026-11-12, Work Item 341).
  'index.html': 212,
  // The Explorer, where most people land once signed in: 371.1 KiB measured (2026-11-12, Work Item 341).
  'explorer.html': 380,
};

export type FirstLoad = { page: string; scripts: number; gzipBytes: number };

/** Every script's src in a page's HTML, once each, in order. */
export function scriptSources(html: string): string[] {
  const found: string[] = [];
  for (const tag of html.split('<script').slice(1)) {
    const end = tag.indexOf('>');
    const attrs = end < 0 ? tag : tag.slice(0, end);
    const at = attrs.indexOf(' src="');
    if (at < 0) continue;
    const src = attrs.slice(at + 6, attrs.indexOf('"', at + 6));
    if (src.endsWith('.js') && !found.includes(src)) found.push(src);
  }
  return found;
}

/** A page's first load from the export in `out`: the scripts its HTML asks for and their gzipped total. */
export function firstLoad(out: string, page: string): FirstLoad {
  const sources = scriptSources(readFileSync(join(out, page), 'utf8'));
  let gzipBytes = 0;
  for (const src of sources) {
    gzipBytes += gzipSync(readFileSync(join(out, src.replace(/^\//, ''))), { level: 9 }).length;
  }
  return { page, scripts: sources.length, gzipBytes };
}

const kib = (bytes: number) => (bytes / 1024).toFixed(1);

/** One line per watched page, and whether every one is within its budget. */
export function checkFirstLoad(
  out: string,
  budgets: Readonly<Record<string, number>> = FIRST_LOAD_BUDGETS,
): { ok: boolean; lines: string[] } {
  const lines: string[] = [];
  let ok = true;
  for (const [page, budget] of Object.entries(budgets)) {
    const load = firstLoad(out, page);
    const over = load.gzipBytes > budget * 1024;
    if (over) ok = false;
    lines.push(
      `[first-load] ${over ? 'over' : 'ok'}: ${page} ${kib(load.gzipBytes)} KiB gzip in ${load.scripts} scripts (budget ${budget} KiB)`,
    );
  }
  return { ok, lines };
}
