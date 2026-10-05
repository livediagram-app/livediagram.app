import { describe, expect, it } from 'vitest';
import type { Element } from '@livediagram/document';
import { LINT_MAX_ARROWS } from '../constants';
import { arrow, box, lint, of, tabOf } from '../fixtures/build';
import { formatLintReport } from '../format';

// A column of sources on the left, a column of targets on the right, every source joined to the target
// across from another: n arrows crossing pairwise.
function crossed(n: number): Element[] {
  const els: Element[] = [];
  for (let i = 0; i < n; i++) els.push(box(`s${i}`, 0, i * 100), box(`t${i}`, 600, i * 100));
  for (let i = 0; i < n; i++) els.push(arrow(`x${i}`, `s${i}`, `t${n - 1 - i}`));
  return els;
}

describe('edge-crossings', () => {
  it('fires above a quarter of a crossing per arrow, naming the most crossed', () => {
    const report = lint(tabOf(...crossed(4)));
    expect(report.measures.crossings).toBe(6);
    const [f] = of(report, 'edge-crossings');
    expect(f!.refs).toEqual(['x0', 'x1', 'x2', 'x3']);
    expect(f!.message).toBe('s0→t3, s1→t2, s2→t1 +1: 6 crossings among 4 arrows, limit 1');
    expect(f!.fix).toBe('layout type:shape');
  });

  it('stays quiet at or under the limit', () => {
    const report = lint(tabOf(...crossed(2)));
    expect(report.measures.crossings).toBe(1);
    expect(
      of(
        lint(
          tabOf(
            ...crossed(2),
            box('p', 0, 500),
            box('q', 600, 500),
            arrow('y', 'p', 'q'),
            box('r', 0, 700),
            box('s', 600, 700),
            arrow('z', 'r', 's'),
          ),
        ),
        'edge-crossings',
      ),
    ).toEqual([]);
  });

  it('names fewer than three without a count of the rest', () => {
    expect(of(lint(tabOf(...crossed(2))), 'edge-crossings')[0]!.message).toBe(
      's0→t1, s1→t0: 1 crossings among 2 arrows, limit 0',
    );
  });

  it(`skips the pair check above ${LINT_MAX_ARROWS} arrows and says so (N2)`, () => {
    const els: Element[] = [box('a', 0, 0), box('b', 400, 0)];
    for (let i = 0; i <= LINT_MAX_ARROWS; i++) els.push(arrow(`x${i}`, 'a', 'b'));
    const logged: string[] = [];
    const report = lint(tabOf(...els), { log: (fp) => logged.push(fp) });
    expect(report.skipped.crossings).toBe(true);
    expect(report.measures.crossings).toBeNull();
    expect(formatLintReport(report).split('\n')[0]).toMatch(/^crossings skipped \(301 arrows\) · /);
    expect(logged).toContain('[lint] crossings skipped');
  });
});
