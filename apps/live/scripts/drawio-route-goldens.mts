// Golden routes from draw.io itself, for the route port's tests
// (docs/specs/020-import-export/blueprints/drawio-import.md "Testing").
//
// For every hand-written fixture page it writes, per edge, the points of the path draw.io desktop's
// CLI draws: each page is exported to SVG with its edges made headless, square-cornered and coloured
// uniquely (so each path is found by its colour), beside a marker square whose place gives the
// SVG's offset back to draw.io units. A curved path's points are its quadratic control points
// between its ends, the corners draw.io smooths through.
//
//   pnpm --filter @livediagram/live exec tsx scripts/drawio-route-goldens.mts \
//     --drawio /path/to/squashfs-root/drawio [--out <dir>] [fixture.drawio | /abs/file.drawio ...]
//
// Writes <out>/<file>.json, by default lib/drawio/__fixtures__/routes/. A file named by an absolute
// path (an uncompressed draw.io file of your own) is read where it is; keep its goldens outside
// the repo with --out. Needs `xvfb-run` for the headless export.

import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, isAbsolute, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const fixtures = join(here, '..', 'lib', 'drawio', '__fixtures__');
const DEFAULT_FIXTURES = [
  'routes.drawio',
  'flowchart.drawio',
  'swimlanes.drawio',
  'uml.drawio',
  'cloud-architecture.drawio',
];
const MARKER = { x: -5000, y: -5000, size: 10, fill: '#fe0001' };
// Everything that would move a path's ends or corners away from the route itself.
const PLAIN_EDGE = 'endArrow=none;startArrow=none;rounded=0;jumpStyle=none;shadow=0;sketch=0;';

type Point = [number, number];
type PageRoutes = Record<string, Point[]>;

function parseArgs(argv: string[]) {
  let drawio = '';
  let out = join(fixtures, 'routes');
  const files: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--drawio') drawio = argv[++i]!;
    else if (argv[i] === '--out') out = argv[++i]!;
    else files.push(argv[i]!);
  }
  if (!drawio) {
    console.error('usage: drawio-route-goldens.mts --drawio <bin> [fixture.drawio ...]');
    process.exit(2);
  }
  return { drawio, out, files: files.length > 0 ? files : DEFAULT_FIXTURES };
}

const colourOf = (i: number) => `#0a${(i + 1).toString(16).padStart(4, '0')}`;

// One page's diagram XML with its edges plain and coloured, and the marker square added.
function preparePage(page: string): { xml: string; colours: Map<string, string> } {
  const colours = new Map<string, string>();
  let i = 0;
  // A UserObject / object wrapper carries the id of the mxCell inside it.
  let wrapperId: string | undefined;
  const xml = page
    .replace(/<(UserObject|object|mxCell)\b([^>]*)>/g, (tag, name: string, attrs: string) => {
      if (name !== 'mxCell') {
        wrapperId = /\bid="([^"]+)"/.exec(attrs)?.[1];
        return tag;
      }
      if (!/\bedge="1"/.test(attrs)) return tag;
      const id = /\bid="([^"]+)"/.exec(attrs)?.[1] ?? wrapperId;
      if (!id) return tag;
      const colour = colourOf(i++);
      colours.set(colour, id);
      const style = /\bstyle="([^"]*)"/.exec(attrs)?.[1] ?? '';
      const plain = `${style}${style === '' || style.endsWith(';') ? '' : ';'}${PLAIN_EDGE}strokeColor=${colour};`;
      return tag.includes('style="')
        ? tag.replace(/\bstyle="[^"]*"/, `style="${plain}"`)
        : tag.replace('<mxCell', `<mxCell style="${plain}"`);
    })
    .replace(
      /(<root>\s*<mxCell id="([^"]+)"\s*\/>\s*<mxCell id="([^"]+)" parent="[^"]+"\s*\/>)/,
      (all, _whole: string, _root: string, layer: string) =>
        `${all}<mxCell id="golden-marker" style="fillColor=${MARKER.fill};strokeColor=none;" vertex="1" parent="${layer}"><mxGeometry x="${MARKER.x}" y="${MARKER.y}" width="${MARKER.size}" height="${MARKER.size}" as="geometry"/></mxCell>`,
    );
  if (!xml.includes('golden-marker')) throw new Error('no layer to put the marker on');
  return { xml, colours };
}

const numbers = (s: string) => (s.match(/-?\d+(\.\d+)?(e-?\d+)?/g) ?? []).map(Number);

// A path's points: M and L points; for a curve (mxPolyline.paintCurvedLine), M, every Q control
// point and the last end. A two-point curve is one Q whose control is its start.
function pathPoints(d: string): Point[] {
  const out: Point[] = [];
  const commands = d.match(/[MLQC][^MLQC]*/g) ?? [];
  const quads = commands.filter((c) => c[0] === 'Q').length;
  commands.forEach((cmd, i) => {
    const n = numbers(cmd.slice(1));
    if (cmd[0] === 'M' || cmd[0] === 'L') out.push([n[0]!, n[1]!]);
    else if (cmd[0] === 'Q') {
      const start = out[0]!;
      if (!(quads === 1 && n[0] === start[0] && n[1] === start[1])) out.push([n[0]!, n[1]!]);
      if (i === commands.length - 1) out.push([n[2]!, n[3]!]);
    }
  });
  return out;
}

function goldenRoutes(drawio: string, svg: string, colours: Map<string, string>): PageRoutes {
  const marker = new RegExp(
    `<rect x="(-?[\\d.]+)" y="(-?[\\d.]+)" width="${MARKER.size}" height="${MARKER.size}"[^>]*fill="${MARKER.fill}"`,
  ).exec(svg);
  if (!marker) throw new Error(`marker not found in ${drawio}'s export`);
  const dx = MARKER.x - Number(marker[1]);
  const dy = MARKER.y - Number(marker[2]);
  const routes: PageRoutes = {};
  for (const path of svg.matchAll(/<path d="([^"]+)"([^>]*)>/g)) {
    const stroke = /\bstroke="(#[0-9a-f]{6})"/i.exec(path[2]!)?.[1]?.toLowerCase();
    const id = stroke ? colours.get(stroke) : undefined;
    if (!id || routes[id]) continue;
    routes[id] = pathPoints(path[1]!).map(([x, y]) => [
      Math.round((x + dx) * 100) / 100,
      Math.round((y + dy) * 100) / 100,
    ]);
  }
  return routes;
}

function main() {
  const { drawio, out: outDir, files } = parseArgs(process.argv.slice(2));
  const work = mkdtempSync(join(tmpdir(), 'drawio-goldens-'));
  mkdirSync(outDir, { recursive: true });
  for (const name of files) {
    const source = readFileSync(isAbsolute(name) ? name : join(fixtures, basename(name)), 'utf8');
    const pages = [...source.matchAll(/<diagram\b[^>]*>[\s\S]*?<\/diagram>/g)].map((m) => m[0]);
    const out: Record<string, PageRoutes> = {};
    pages.forEach((page, index) => {
      const { xml, colours } = preparePage(page);
      if (colours.size === 0) return;
      const file = join(work, `page.drawio`);
      writeFileSync(file, `<mxfile host="goldens">${xml}</mxfile>`);
      const svg = join(work, 'page.svg');
      execFileSync(
        'xvfb-run',
        ['-a', drawio, '--no-sandbox', '--disable-gpu', '-x', '-f', 'svg', '-o', svg, file],
        { stdio: 'ignore' },
      );
      const routes = goldenRoutes(name, readFileSync(svg, 'utf8'), colours);
      const missing = [...colours.values()].filter((id) => !routes[id]);
      if (missing.length > 0) console.warn(`${name} page ${index + 1}: not drawn`, missing);
      out[String(index)] = routes;
    });
    const target = join(outDir, basename(name).replace(/\.(drawio|xml)$/, '.json'));
    writeFileSync(target, `${JSON.stringify(out, null, 2)}\n`);
    console.log(
      `${name}: ${Object.values(out).reduce((n, r) => n + Object.keys(r).length, 0)} routes`,
    );
  }
}

main();
