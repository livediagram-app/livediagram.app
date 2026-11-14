import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import {
  compare,
  findGroups,
  formatBaseline,
  isCandidate,
  isFactoryBinding,
  isReexportBinding,
  parseBaseline,
  report,
} from './duplicate-guard.mjs';

const ls = (/** @type {[string, string][]} */ rows) =>
  rows.map(([blob, file]) => `100644 ${blob} 0\t${file}`).join('\n');
const code = () => 'export const x = 1;\n';

test('a candidate is a hand-written, non-test source file in a product', () => {
  assert.equal(isCandidate('livediagram/apps/editor/lib/a.ts'), true);
  assert.equal(isCandidate('liveplanner/packages/ui/src/B.tsx'), true);
  assert.equal(isCandidate('livedesign/scripts/e2e-stack.mjs'), true);
  assert.equal(isCandidate('packages/ui/src/a.ts'), false);
  assert.equal(isCandidate('liveworkspace/apps/site/a.ts'), false);
  assert.equal(isCandidate('livediagram/apps/editor/lib/a.test.ts'), false);
  assert.equal(isCandidate('livediagram/apps/editor/lib/a.spec.tsx'), false);
  assert.equal(isCandidate('livediagram/apps/editor/__tests__/a.ts'), false);
  assert.equal(isCandidate('livediagram/apps/editor/next-env.d.ts'), false);
  assert.equal(isCandidate('livediagram/apps/api/worker-configuration.d.ts'), false);
  assert.equal(isCandidate('livediagram/packages/icons/src/generated/a.ts'), false);
  assert.equal(isCandidate('livediagram/packages/icons/src/a.generated.ts'), false);
  assert.equal(isCandidate('livediagram/README.md'), false);
  assert.equal(isCandidate('liveplanner/packages/sheets/oxlint.config.ts'), false);
  assert.equal(isCandidate('livedesign/apps/mcp/vitest.config.ts'), false);
  assert.equal(isCandidate('livediagram/apps/editor/next.config.mjs'), false);
  assert.equal(isCandidate('livediagram/apps/editor/lib/canvas.config-ish.ts'), true);
});

test('a pure @liveworkspace re-export is a binding, anything more is not', () => {
  assert.equal(
    isReexportBinding("// Shared.\nexport * from '@liveworkspace/model-core/slug';\n"),
    true,
  );
  assert.equal(
    isReexportBinding(
      '/* a */\nexport type {\n  A,\n  B,\n} from \'@liveworkspace/cli-kit/io\';\nexport { c as d } from "@liveworkspace/x";\n',
    ),
    true,
  );
  assert.equal(isReexportBinding("'use client';\nexport * as k from '@liveworkspace/ui';"), true);
  assert.equal(isReexportBinding("export * from './slug';\n"), false);
  assert.equal(isReexportBinding("export * from '@livediagram/document';\n"), false);
  assert.equal(
    isReexportBinding("export * from '@liveworkspace/ui';\nexport const HEADER = 'X-Doc';\n"),
    false,
  );
  assert.equal(isReexportBinding('// only a comment\n'), false);
});

test('a door that hands product modules to a shared factory is a binding', () => {
  const door = (/** @type {string} */ body) =>
    "'use client';\n// The dock.\nimport { createDock } from '@liveworkspace/workbench/dock';\n" +
    "import * as shared from '@liveworkspace/element-model/factories';\n" +
    "import dynamic from 'next/dynamic';\nimport * as layout from '@/lib/layout';\n" +
    "import type { Element } from './index';\n" +
    body;
  const yes = [
    'export const useDock = createDock<layout.Id>(layout);\n',
    'export const { a, b: c } = createDock({\n  get base() {\n    return layout.BASE;\n  },\n  pick: (id) => layout.pick(id, { deep: true }),\n});\n',
    'export function createText(x: number, y: { a: number; b: number }): Element {\n  return shared.createText(x, y);\n}\n',
    'export const Lazy = dynamic(createDock(layout.load), { ssr: false });\nexport const DOCK = createDock(layout);\nexport const { open } = DOCK;\n',
    "createDock(layout);\nexport const Bridge = layout.ON ? dynamic(() => import('./b').then((m) => m.B)) : null;\nexport const D = createDock(Bridge);\n",
    "export { x } from './x';\nexport type Dock = ReturnType<typeof createDock>;\nexport const D = createDock(layout);\n",
  ];
  for (const body of yes) assert.equal(isFactoryBinding(door(body)), true, body);
  const no = [
    "export const STEPS = { row: 'in a row', column: 'in a column' };\n",
    'export const n = createDock(layout) + 1;\n',
    'export function pick(id: string) {\n  const d = createDock(layout);\n  return d.pick(id);\n}\n',
    'export function pick(id: string): Element[] {\n  if (!id) return [];\n  return shared.pick(id);\n}\n',
    'export const D = layout.make(createDock);\nexport const E = (a) => {\n  return createDock(a);\n};\n',
    'export const D = createDock(layout);\nexport class Box {}\n',
    'export const View = () => <div className="x" />;\nexport const D = createDock(layout);\n',
    'export const D = layout.make(layout);\n',
    'export const D = createDock(layout.items.filter((i) => i.on && i.ready));\n',
  ];
  for (const body of no) assert.equal(isFactoryBinding(door(body)), false, body);
  assert.equal(
    isFactoryBinding("import { make } from '@livediagram/document';\nexport const D = make(1);\n"),
    false,
  );
  assert.equal(
    isFactoryBinding(
      "import type { ArrowOf } from '@liveworkspace/element-model/arrow';\nimport type { Link } from './index';\nexport type Arrow = ArrowOf<Link>;\n",
    ),
    true,
  );
});

test('groups span two or more products, by blob, leaving out bindings', () => {
  const groups = findGroups(
    ls([
      ['aaa', 'livediagram/lib/a.ts'],
      ['aaa', 'livedocuments/lib/a.ts'],
      ['aaa', 'livedocuments/lib/a-copy.ts'],
      ['bbb', 'livediagram/lib/b.ts'],
      ['bbb', 'livediagram/lib/b2.ts'],
      ['ccc', 'livediagram/lib/bind.ts'],
      ['ccc', 'liveplanner/lib/bind.ts'],
      ['ddd', 'livediagram/lib/t.test.ts'],
      ['ddd', 'liveplanner/lib/t.test.ts'],
      ['eee', 'packages/x/a.ts'],
      ['eee', 'livediagram/x/a.ts'],
    ]),
    (file) => (file.endsWith('bind.ts') ? "export * from '@liveworkspace/x';\n" : code()),
  );
  assert.deepEqual(groups, [
    ['livediagram/lib/a.ts', 'livedocuments/lib/a-copy.ts', 'livedocuments/lib/a.ts'],
  ]);
});

test('the baseline file round-trips', () => {
  const groups = [
    ['livediagram/a.ts', 'livehuddle/a.ts'],
    ['livedesign/app/design/[id]/b.ts', 'liveplanner/app/project/[id]/b.ts'],
  ];
  assert.deepEqual(parseBaseline(formatBaseline(groups)), groups);
});

const baseline = [
  ['livediagram/a.ts', 'livehuddle/a.ts', 'liveplanner/a.ts'],
  ['livediagram/b.ts', 'livehuddle/b.ts'],
];

test('the baseline as it is passes', () => {
  assert.equal(report(compare(baseline, baseline)), null);
});

test('a new group fails, naming its files and docs/structure.md', () => {
  const diff = compare([...baseline, ['livedesign/c.ts', 'livedocuments/c.ts']], baseline);
  assert.deepEqual(diff.added, [['livedesign/c.ts', 'livedocuments/c.ts']]);
  const message = report(diff) ?? '';
  assert.match(message, /new group/);
  assert.match(message, /livedesign\/c\.ts/);
  assert.match(message, /docs\/structure\.md/);
});

test('a known group gaining a copy fails', () => {
  const grownGroup = ['livedesign/b.ts', 'livediagram/b.ts', 'livehuddle/b.ts'];
  const diff = compare([baseline[0], grownGroup], baseline);
  assert.deepEqual(diff.grown, [{ group: grownGroup, extra: ['livedesign/b.ts'] }]);
  assert.match(report(diff) ?? '', /gained a copy \(livedesign\/b\.ts\)/);
});

test('two known groups becoming one counts as growth', () => {
  const merged = [...baseline[0], ...baseline[1]].sort();
  const diff = compare([merged], baseline);
  assert.equal(diff.grown.length, 1);
  assert.match(report(diff) ?? '', /merged groups/);
});

test('a group gone or shrunk fails with the --update hint', () => {
  const gone = compare([baseline[0]], baseline);
  assert.deepEqual(gone.stale, [baseline[1]]);
  assert.match(report(gone) ?? '', /--update to shrink the baseline/);

  const shrunk = compare([['livediagram/a.ts', 'livehuddle/a.ts'], baseline[1]], baseline);
  assert.deepEqual(shrunk.added, []);
  assert.deepEqual(shrunk.grown, []);
  assert.deepEqual(shrunk.stale, [baseline[0]]);
});

test('the committed baseline matches the tree', () => {
  assert.ok(readFileSync('.github/scripts/duplicate-baseline.txt', 'utf8').startsWith('#'));
  const out = execFileSync('node', ['.github/scripts/duplicate-guard.mjs'], { encoding: 'utf8' });
  assert.match(out, /no new copies/);
});
