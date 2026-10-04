// The worst case of docs/specs/024-agents/blueprints/document-views.md "Performance and limits": a
// 10,000-element tab with 100 containers. It renders in tens of milliseconds; the one-second ceiling
// leaves room for a loaded runner and still catches an accidental quadratic step, which takes seconds.
import { describe, expect, it } from 'vitest';
import type { Element } from '@livediagram/document';
import { arrowBetween, shapeAt } from './__fixtures__/build';
import { buildViewModel } from './model';
import { outlineView } from './outline';

const RENDER_CEILING_MS = 1000;

function largestTab() {
  const elements: Element[] = [];
  for (let frame = 0; frame < 100; frame++) {
    const [fx, fy] = [(frame % 10) * 2200, Math.floor(frame / 10) * 2200];
    elements.push(shapeAt('frame', `frame-${frame}`, fx, fy, 2000, 2000));
    for (let i = 0; i < 66; i++) {
      elements.push(
        shapeAt(
          'square',
          `n-${frame}-${i}`,
          fx + (i % 8) * 240 + 20,
          fy + Math.floor(i / 8) * 200 + 40,
        ),
      );
    }
    for (let i = 0; i < 33; i++)
      elements.push(arrowBetween(`a-${frame}-${i}`, `n-${frame}-${i}`, `n-${frame}-${i + 1}`));
  }
  return { id: 'largest', name: 'Largest', elements };
}

describe('views at the element cap', () => {
  const tab = largestTab();

  it('renders 10,000 elements and fits them to the MCP budget within the ceiling', () => {
    expect(tab.elements).toHaveLength(10_000);
    const start = performance.now();
    const full = outlineView(buildViewModel(tab));
    const fitted = outlineView(buildViewModel(tab), { budget: 8000 });
    expect(performance.now() - start).toBeLessThan(RENDER_CEILING_MS);
    expect(full.text.split('\n')).toHaveLength(1 + 100 + 6600);
    expect(fitted.state).toBe('containers-collapsed');
  });
});
