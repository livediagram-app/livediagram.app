import { describe, expect, it } from 'vitest';
import { computeRefs, type Element } from '@livedesign/design';
import { box, lint, tabOf, text } from './fixtures/build';
import { lintTab } from './lint';

const LONG = 'An extremely long label that cannot possibly fit in this small box';

const messy = () =>
  tabOf(
    box('7f3a2c91-0000-4000-8000-000000000001', 0, 0, { label: LONG, textSize: 'md' }),
    box('b', 400, 0, { label: LONG }),
    text('t1', 0, 200, 'One'),
    text('t2', 0, 208, 'Two'),
    {
      id: 'line',
      type: 'arrow',
      from: { kind: 'free', x: 0, y: 400 },
      to: { kind: 'free', x: 600, y: 400 },
    },
  );

describe('lintTab', () => {
  it('is deterministic: the same tab gives the same report in the same order', () => {
    expect(lint(messy())).toEqual(lint(messy()));
  });

  it('orders by code, then reading position, then refs', () => {
    expect(lint(messy()).findings.map((f) => `${f.code} ${f.refs.join(',')}`)).toEqual([
      'label-overflow 7f3a',
      'label-overflow b',
      'text-overflow t1,t2',
    ]);
  });

  it('prints the refs the views print', () => {
    const tab = messy();
    const refs = computeRefs(tab.elements.map((el) => el.id));
    const printed = new Set(tab.elements.map((el) => refs.refOf(el.id)));
    for (const f of lint(tab).findings)
      for (const ref of f.refs) expect(printed.has(ref)).toBe(true);
  });

  it('counts by severity and measures the extent, the boxes and the texts', () => {
    const report = lint(messy());
    expect(report.counts).toEqual({ error: 0, warning: 3, info: 0 });
    expect(report.measures).toEqual({ extent: { width: 600, height: 400 }, boxes: 2, texts: 2 });
  });

  it('lints only visible layers, and skips boxes without a usable rect (N1, N6)', () => {
    const hidden = { ...box('h', 0, 0, { label: LONG }), layerId: 'off' } as Element;
    const report = lint({
      elements: [hidden, text('h2', 0, 0, LONG, { layerId: 'off' })],
      layers: [{ id: 'off', name: 'Off', visible: false }],
    });
    expect(report.findings).toEqual([]);
    expect(report.measures.extent).toBeNull();
    const logged: Record<string, unknown>[] = [];
    lint(tabOf(box('nan', Number.NaN, 0), box('ok', 0, 0)), {
      log: (fp, fields) => void (fp === '[lint] run' && logged.push(fields)),
    });
    expect(logged[0]).toMatchObject({ skipped: 1, boxes: 1 });
  });

  it('logs one run with counts, never content', () => {
    const logged: [string, Record<string, unknown>][] = [];
    lint(messy(), { log: (fp, fields) => void logged.push([fp, fields]) });
    expect(logged.map(([fp]) => fp)).toEqual(['[lint] run']);
    const [, fields] = logged[0]!;
    for (const value of Object.values(fields))
      expect(['number', 'boolean', 'string'].includes(typeof value)).toBe(true);
    expect(JSON.stringify(fields)).not.toMatch(/extremely|7f3a/);
    expect(fields).toMatchObject({ 'label-overflow': 2, 'text-overflow': 1, warnings: 3 });
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
