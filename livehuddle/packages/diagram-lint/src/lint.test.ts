import { describe, expect, it } from 'vitest';
import { computeRefs } from '@livehuddle/document';
import { arrow, box, frame, lint, tabOf } from './fixtures/build';
import { lintTab } from './lint';

// Stored arrows ride along as retired elements no check reads (part 4 of the element engine).
const messy = () =>
  tabOf(
    frame('f', 0, 0, 400, 300),
    box('a', 20, 80),
    box('7f3a2c91-0000-4000-8000-000000000001', 100, 100),
    box('b', 600, 80, { label: 'a' }),
    box('alone', 600, 400),
    box('long', 200, 300, {
      label: 'An extremely long label that cannot possibly fit in this small box',
      textSize: 'md',
    }),
    arrow('x', 'a', 'b'),
    arrow('y', '7f3a2c91-0000-4000-8000-000000000001', 'b'),
    arrow('gone', 'a', 'missing'),
  );

describe('lintTab', () => {
  it('is deterministic: the same tab gives the same report in the same order', () => {
    expect(lint(messy())).toEqual(lint(messy()));
  });

  it('orders by severity, then code, then reading position, then refs', () => {
    const codes = lint(messy()).findings.map((f) => f.code);
    expect(codes).toContain('label-overflow');
    expect(codes.indexOf('label-overflow')).toBeLessThan(codes.indexOf('duplicate-label'));
    const severities = lint(messy()).findings.map((f) => f.severity);
    expect(severities).toEqual(
      [...severities].sort(
        (p, q) => ['error', 'warning', 'info'].indexOf(p) - ['error', 'warning', 'info'].indexOf(q),
      ),
    );
  });

  it('prints the refs the views print', () => {
    const tab = messy();
    const refs = computeRefs(tab.elements.map((el) => el.id));
    const printed = new Set(tab.elements.map((el) => refs.refOf(el.id)));
    for (const f of lint(tab).findings)
      for (const ref of f.refs) expect(printed.has(ref)).toBe(true);
    expect(lint(tab).findings.some((f) => f.refs.includes('7f3a'))).toBe(true);
  });

  it('counts by severity and measures extent, with no arrow drawn as one', () => {
    const report = lint(messy());
    expect(report.counts.error).toBe(report.findings.filter((f) => f.severity === 'error').length);
    expect(report.measures.overlaps).toBe(
      report.findings.filter((f) => f.code === 'box-overlap').length,
    );
    expect(report.measures.extent).toEqual({ width: 720, height: 460 });
    expect(report.measures.boxes).toBe(5);
    expect(report.measures).toMatchObject({ arrows: 0, crossings: 0, behind: 0, overlaps: 0 });
    expect(report.skipped).toEqual({ crossings: false });
  });

  it('skips boxes without a usable rect (N6)', () => {
    const logged: Record<string, unknown>[] = [];
    lint(tabOf(box('nan', Number.NaN, 0), box('ok', 0, 0)), {
      log: (fp, fields) => fp === '[lint] run' && logged.push(fields),
    });
    expect(logged[0]).toMatchObject({ skipped: 1, boxes: 1 });
  });

  it('logs one run with counts, never content', () => {
    const logged: [string, Record<string, unknown>][] = [];
    lint(messy(), { log: (fp, fields) => logged.push([fp, fields]) });
    const [fp, fields] = logged.find(([f]) => f === '[lint] run')!;
    expect(fp).toBe('[lint] run');
    for (const value of Object.values(fields))
      expect(['number', 'boolean', 'string'].includes(typeof value)).toBe(true);
    expect(JSON.stringify(fields)).not.toMatch(/alone|7f3a/);
    // The long label and the id printed as a label.
    expect(fields['label-overflow']).toBe(2);
    expect(fields['duplicate-label']).toBe(1);
  });

  it('logs to the console by default', () => {
    const calls: unknown[] = [];
    const info = console.info;
    console.info = (...args: unknown[]) => void calls.push(args[0]);
    try {
      lintTab(tabOf(box('a', 0, 0)));
    } finally {
      console.info = info;
    }
    expect(calls).toContain('[lint] run');
  });
});
