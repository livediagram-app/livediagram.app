// @vitest-environment jsdom
// Icon contact sheet (docs/specs/004-interface-design/iconography.md, "Guarding"): renders every icon the
// editor draws, at its own size and at 4x, into one HTML page per source for review and the screenshot test.
// Run: `pnpm icons:sheet` (writes to $ICON_SHEET_DIR, default /tmp/icon-sheet).
import { mkdirSync, writeFileSync } from 'node:fs';
import type { ComponentType, ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { it } from 'vitest';

import * as uiIcons from '@livediagram/ui';
import { PALETTE_TILES } from '@/components/palette/palette-tile-defs';

const OUT = process.env.ICON_SHEET_DIR ?? '/tmp/icon-sheet';

type Cell = { name: string; node: ReactNode };

const modules = import.meta.glob(
  ['../../components/**/*-icons.tsx', '../../components/**/*-glyphs.tsx'],
  {
    eager: true,
  },
) as Record<string, Record<string, unknown>>;

const isIconExport = (name: string, v: unknown): v is ComponentType =>
  typeof v === 'function' && /^[A-Z]/.test(name) && /(Icon|Glyph)$/.test(name);

function cellsOf(mod: Record<string, unknown>): Cell[] {
  return Object.entries(mod).flatMap(([n, C]) =>
    n !== 'Glyph' && isIconExport(n, C) ? [{ name: n, node: <C /> }] : [],
  );
}

function renderCell({ name, node }: Cell): string {
  let svg: string;
  try {
    svg = renderToStaticMarkup(<>{node}</>);
  } catch {
    return `<figure class="err"><div class="n">${name}</div><div>needs props</div></figure>`;
  }
  if (!svg.includes('<svg')) return '';
  return `<figure><div class="n">${name}</div><div class="row"><span class="x1">${svg}</span><span class="x4">${svg}</span></div></figure>`;
}

const CSS = `body{margin:0;padding:16px;background:#0b1120;color:#e2e8f0;font:12px system-ui}
h1{font-size:14px;margin:8px 0}.grid{display:grid;grid-template-columns:repeat(8,1fr);gap:8px}
figure{margin:0;padding:8px;border:1px solid #1e293b;border-radius:8px;background:#0f172a}
.n{font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-bottom:6px}
.row{display:flex;align-items:center;gap:12px}.x1 svg{outline:1px dashed #334155}
.lvd-glyph *{vector-effect:non-scaling-stroke}.x4{zoom:4;display:inline-flex}.x4 svg{outline:0.25px dashed #334155}.err{opacity:.5}`;

function page(title: string, cells: Cell[]): string {
  return `<!doctype html><meta charset="utf-8"><style>${CSS}</style><h1>${title}</h1><div class="grid">${cells
    .map(renderCell)
    .join('')}</div>`;
}

it('writes the icon contact sheets', () => {
  mkdirSync(OUT, { recursive: true });
  const pages: [string, Cell[]][] = [
    ['ui', cellsOf(uiIcons as Record<string, unknown>)],
    ['palette-tiles', PALETTE_TILES.map((t) => ({ name: t.id, node: t.icon }))],
    ...Object.entries(modules).map(([path, mod]): [string, Cell[]] => [
      path
        .replace(/^.*components\//, '')
        .replace(/\.tsx$/, '')
        .replace(/\//g, '__'),
      cellsOf(mod),
    ]),
  ];
  for (const [slug, cells] of pages) writeFileSync(`${OUT}/${slug}.html`, page(slug, cells));
  writeFileSync(
    `${OUT}/index.json`,
    JSON.stringify(pages.map(([s, c]) => ({ slug: s, count: c.length }))),
  );
});
