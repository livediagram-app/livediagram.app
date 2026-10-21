import { describe, expect, it } from 'vitest';
import { computeRefs, type Element } from '@livediagram/document';
import { arrow, box, frame, lint, quiet, tabOf } from './fixtures/build';
import { graphEdgeIds, lintGraph, lintTab } from './lint';

const messy = () =>
  tabOf(
    frame('f', 0, 0, 400, 300),
    box('a', 20, 80),
    box('7f3a2c91-0000-4000-8000-000000000001', 100, 100),
    box('b', 600, 80, { label: 'a' }),
    box('alone', 600, 400),
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
    expect(codes.indexOf('box-overlap')).toBeLessThan(codes.indexOf('arrow-behind-box'));
    expect(codes.indexOf('arrow-dangling')).toBeLessThan(codes.indexOf('node-isolated'));
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

  it('counts by severity and measures overlaps, behind and extent', () => {
    const report = lint(messy());
    expect(report.counts.error).toBe(report.findings.filter((f) => f.severity === 'error').length);
    expect(report.measures.overlaps).toBe(
      report.findings.filter((f) => f.code === 'box-overlap').length,
    );
    expect(report.measures.extent).toEqual({ width: 720, height: 460 });
    expect(report.measures.boxes).toBe(4);
    expect(report.measures.arrows).toBe(2);
  });

  it('lints only visible layers, and skips boxes without a usable rect (N1, N6)', () => {
    const hidden = { ...box('h', 0, 0), layerId: 'off' } as Element;
    const report = lint({
      elements: [hidden, box('h2', 50, 20, { layerId: 'off' })],
      layers: [{ id: 'off', name: 'Off', visible: false }],
    });
    expect(report.findings).toEqual([]);
    expect(report.measures.extent).toBeNull();
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
    expect(fields.source).toBe('tab');
    expect(JSON.stringify(fields)).not.toMatch(/alone|7f3a/);
    expect(fields['box-overlap']).toBe(1);
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

describe('lintGraph', () => {
  it('lays a graph out deterministically, its arrows named e1, e2, … clear of node ids (LN28)', () => {
    const input = {
      nodes: [
        { id: 'a', label: 'A' },
        { id: 'e1', label: 'E' },
      ],
      edges: [{ from: 'a', to: 'e1' }],
    };
    const { elements, report } = lintGraph(input, { log: quiet });
    expect(elements.filter((el) => el.type === 'arrow').map((el) => el.id)).toEqual(['e1-2']);
    expect(report.findings).toEqual([]);
    expect(lintGraph(input, { log: quiet })).toEqual(lintGraph(input, { log: quiet }));
    const next = graphEdgeIds({ nodes: [{ id: 'e1' }, { id: 'e1-2' }], edges: [] });
    expect([next(), next()]).toEqual(['e1-3', 'e2']);
  });

  it("judges against a graph source's direction", () => {
    const input = {
      direction: 'right' as const,
      nodes: [{ id: 'a' }, { id: 'b' }],
      edges: [{ from: 'a', to: 'b' }],
    };
    expect(lintGraph(input, { log: quiet }).report.findings).toEqual([]);
  });
});
