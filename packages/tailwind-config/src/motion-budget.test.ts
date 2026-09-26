import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  MOTION_TOKENS,
  checkMotionBudget,
  durationBoundMs,
  formatViolations,
  scanSource,
  scanStylesheet,
} from './motion-budget';

const T = MOTION_TOKENS;

describe('durationBoundMs', () => {
  it('reads literal milliseconds and seconds', () => {
    expect(durationBoundMs('150ms', T)).toBe(150);
    expect(durationBoundMs('0.25s', T)).toBe(250);
    expect(durationBoundMs('.3s', T)).toBe(300);
    expect(durationBoundMs('0.01ms !important', T)).toBe(0.01);
  });

  it('resolves motion tokens, with or without a fallback', () => {
    expect(durationBoundMs('var(--transition-duration-micro)', T)).toBe(150);
    expect(durationBoundMs('var(--transition-duration-long, 999ms)', T)).toBe(250);
    expect(durationBoundMs('var(--motion-cascade-cap)', T)).toBe(100);
  });

  it('treats any other variable as unbounded, fallback or not', () => {
    expect(durationBoundMs('var(--lvd-slide-ms)', T)).toBe(Infinity);
    expect(durationBoundMs('var(--stagger-step, 40ms)', T)).toBe(Infinity);
  });

  it('bounds min() by its smallest known argument and max() by its largest', () => {
    expect(
      durationBoundMs(
        'min(calc(var(--stagger-i, 0) * var(--motion-cascade-step)), var(--motion-cascade-cap))',
        T,
      ),
    ).toBe(100);
    expect(durationBoundMs('max(100ms, 200ms)', T)).toBe(200);
    expect(durationBoundMs('max(100ms, var(--x))', T)).toBe(Infinity);
  });

  it('bounds a single-term calc and leaves any other calc unbounded', () => {
    expect(durationBoundMs('calc(120ms)', T)).toBe(120);
    expect(durationBoundMs('calc(2s * var(--lvd-anim-speed, 1))', T)).toBe(Infinity);
  });

  it('resolves MOTION_MS template placeholders and nothing else', () => {
    expect(durationBoundMs('${MOTION_MS.short}ms', T)).toBe(200);
    expect(durationBoundMs('${REORDER_MS}ms', T)).toBe(Infinity);
  });

  it('reads auto as no time: a scroll-driven animation follows the scroll, not a clock', () => {
    expect(durationBoundMs('auto', T)).toBe(0);
  });

  it('treats unrecognised text as unbounded', () => {
    expect(durationBoundMs('soon', T)).toBe(Infinity);
    expect(durationBoundMs('', T)).toBe(Infinity);
  });
});

describe('scanStylesheet', () => {
  const scan = (css: string) => scanStylesheet(css, 'x.css', T);

  it('passes chrome motion within the ceiling', () => {
    expect(scan('.a { transition: opacity 200ms ease; }')).toEqual([]);
    expect(
      scan('.a { animation: fade-in var(--transition-duration-long) ease-out both; }'),
    ).toEqual([]);
  });

  it('flags a transition past the ceiling with its line', () => {
    const v = scan('.a {\n  color: red;\n  transition: opacity 300ms ease;\n}');
    expect(v).toHaveLength(1);
    expect(v[0]).toMatchObject({ file: 'x.css', line: 3, rule: 'ceiling', limit: 250 });
  });

  it('adds the delay to the duration', () => {
    expect(scan('.a { animation: pop 200ms ease 100ms both; }')[0]?.rule).toBe('ceiling');
    expect(scan('.a { transition: opacity 150ms ease 100ms; }')).toEqual([]);
  });

  it('checks each part of a comma-separated transition', () => {
    const v = scan('.a { transition: color 100ms, border-color 0.3s ease; }');
    expect(v).toHaveLength(1);
    expect(v[0]?.found).toContain('0.3s');
  });

  it('holds hover-driven rules to the hover ceiling', () => {
    const v = scan(
      '.card { transition: border-color 200ms ease; }\n.card:hover { border-color: blue; }',
    );
    expect(v).toHaveLength(1);
    expect(v[0]).toMatchObject({ rule: 'hover-ceiling', limit: 150 });
  });

  it('recognises hover through :not() and nested selectors', () => {
    const css = [
      "[role='option'] .glyph { transition: transform 160ms ease; }",
      "[role='option']:hover:not(:disabled) .glyph { transform: scale(1.1); }",
    ].join('\n');
    expect(scan(css)[0]?.rule).toBe('hover-ceiling');
  });

  it('exempts looping and repeating animations as ambient indicators', () => {
    expect(scan('.s { animation: spin 1s linear infinite; }')).toEqual([]);
    expect(scan('.p { animation: pulse 0.7s ease-in-out 2; }')).toEqual([]);
    expect(scan('.p { animation: pulse 0.7s ease-in-out 1; }')[0]?.rule).toBe('ceiling');
  });

  it('reads Tailwind theme tokens and --animate-* declarations', () => {
    expect(scan('@theme { --animate-fly: fly 420ms ease; }')[0]?.rule).toBe('ceiling');
    expect(scan('@theme { --transition-duration-long: 300ms; }')[0]?.rule).toBe('ceiling');
    expect(scan('@theme { --animate-empty: float 3.6s ease-in-out infinite; }')).toEqual([]);
  });

  it('flags a token redeclared with a different value', () => {
    expect(scan('@theme { --transition-duration-micro: 120ms; }')[0]?.rule).toBe('token-drift');
    expect(scan('@theme { --transition-duration-micro: 150ms; }')).toEqual([]);
  });

  it('skips keyframe bodies and descends into media queries', () => {
    expect(scan('@keyframes x { from { opacity: 0; } to { opacity: 1; } }')).toEqual([]);
    expect(scan('@media (min-width: 1px) { .a { transition: opacity 900ms; } }')[0]?.rule).toBe(
      'ceiling',
    );
  });

  it('holds a standalone delay to the cascade cap', () => {
    expect(scan('.a > *:nth-child(3) { animation-delay: 20ms; }')).toEqual([]);
    expect(scan('.a > *:nth-child(9) { animation-delay: 245ms; }')[0]).toMatchObject({
      rule: 'ceiling',
      limit: 100,
    });
  });

  it('reports an unresolvable duration rather than assuming it is small', () => {
    expect(scan('.a { transition: opacity var(--mystery) ease; }')[0]?.rule).toBe('unbounded');
  });

  it('ignores comments while keeping line numbers', () => {
    const v = scan('/* transition: opacity 900ms;\n */\n.a { transition: opacity 900ms; }');
    expect(v).toHaveLength(1);
    expect(v[0]?.line).toBe(3);
  });

  it('ignores non-motion declarations that mention time-like words', () => {
    expect(scan('.a { view-transition-name: header; transition-property: opacity; }')).toEqual([]);
  });
});

describe('scanSource', () => {
  const scan = (src: string) => scanSource(src, 'x.tsx', T);

  it('passes numeric and token duration classes within the ceiling', () => {
    expect(scan('<div className="transition duration-200 ease-out" />')).toEqual([]);
    expect(scan('<div className="transition-opacity duration-long" />')).toEqual([]);
  });

  it('flags a numeric duration class past the ceiling', () => {
    const v = scan('const a = 1;\n<div className="transition-[width] duration-500" />');
    expect(v).toHaveLength(1);
    expect(v[0]).toMatchObject({ line: 2, rule: 'ceiling', limit: 250 });
  });

  it('holds a class list with hover variants to the hover ceiling', () => {
    expect(scan('<a className="transition duration-200 hover:-translate-y-0.5" />')[0]?.rule).toBe(
      'hover-ceiling',
    );
    expect(scan('<a className="transition duration-micro hover:bg-slate-50" />')).toEqual([]);
  });

  it('reads variant-prefixed and arbitrary duration classes', () => {
    expect(scan('<i className="motion-safe:duration-300" />')[0]?.rule).toBe('ceiling');
    expect(scan('<i className="duration-[400ms]" />')[0]?.rule).toBe('ceiling');
    expect(scan('<i className="duration-[var(--transition-duration-short)]" />')).toEqual([]);
  });

  it('holds delay classes to the cascade cap', () => {
    expect(scan('<i className="delay-75" />')).toEqual([]);
    expect(scan('<i className="delay-150" />')[0]).toMatchObject({ limit: 100 });
  });

  it('checks inline transition values in objects, assignments and templates', () => {
    expect(scan("style={{ transition: 'color 200ms ease-out' }}")).toEqual([]);
    expect(scan("style={{ transition: 'transform 420ms ease' }}")[0]?.rule).toBe('ceiling');
    expect(scan("node.style.transition = 'transform 420ms ease';")[0]?.rule).toBe('ceiling');
    expect(scan('node.style.transition = `transform ${MOTION_MS.short}ms ease-out`;')).toEqual([]);
    expect(scan('node.style.transition = `transform ${REORDER_MS}ms ease-out`;')[0]?.rule).toBe(
      'unbounded',
    );
    expect(scan("node.style.transition = 'none';")).toEqual([]);
  });

  it('does not read inline animation values', () => {
    expect(scan("style={{ animationDuration: '4s', animationDelay: '2s' }}")).toEqual([]);
  });

  it('does not mistake unrelated words for duration classes', () => {
    expect(scan("const label = 'duration-less';")).toEqual([]);
    expect(scan('const DURATION = 3;')).toEqual([]);
    expect(scan("track('Timer', 'Changed', 'duration')")).toEqual([]);
  });
});

describe('checkMotionBudget', () => {
  let root: string;
  afterEach(() => rmSync(root, { recursive: true, force: true }));

  function workspace(files: Record<string, string>): string {
    root = mkdtempSync(join(tmpdir(), 'motion-budget-'));
    for (const [path, text] of Object.entries(files)) {
      const full = join(root, path);
      mkdirSync(join(full, '..'), { recursive: true });
      writeFileSync(full, text);
    }
    return root;
  }

  it('walks stylesheets and sources, skipping builds, deps and tests', () => {
    const dir = workspace({
      'app/globals.css': '.a { transition: opacity 400ms; }',
      'components/Card.tsx': '<div className="duration-300" />',
      'node_modules/x/a.css': '.a { transition: opacity 900ms; }',
      '.next/static/a.css': '.a { transition: opacity 900ms; }',
      'out/a.css': '.a { transition: opacity 900ms; }',
      'components/Card.test.tsx': '<div className="duration-900" />',
      'e2e/a.spec.ts': '<div className="duration-900" />',
    });
    const v = checkMotionBudget({ root: dir });
    expect(v.map((x) => x.file)).toEqual(['app/globals.css', 'components/Card.tsx']);
  });

  it('does not read classified canvas stylesheets', () => {
    const dir = workspace({ 'app/canvas-motion.css': '.a { animation: x 2s ease; }' });
    expect(checkMotionBudget({ root: dir, canvasStylesheets: ['app/canvas-motion.css'] })).toEqual(
      [],
    );
  });

  it('reports a classified stylesheet that no longer exists', () => {
    const dir = workspace({ 'app/globals.css': '' });
    const v = checkMotionBudget({ root: dir, canvasStylesheets: ['app/gone.css'] });
    expect(v).toEqual([expect.objectContaining({ file: 'app/gone.css', rule: 'unbounded' })]);
  });

  it('formats violations with a recognisable fingerprint', () => {
    const dir = workspace({ 'a.css': '.a { transition: opacity 400ms; }' });
    expect(formatViolations(checkMotionBudget({ root: dir }))).toBe(
      'motion-budget: a.css:1 ceiling transition: opacity 400ms (> 250ms)',
    );
    expect(formatViolations([])).toBe('');
  });
});
