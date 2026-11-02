// Resolving instances stays linear (docs/specs/009-elements/blueprints/components.md "Performance and limits"): a
// 30-screen design with a component on every screen expands well inside its budget, and doubling the screens
// roughly doubles the work rather than squaring it.
import { describe, expect, it } from 'vitest';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import { expandInstances } from './component-resolve';
import { libraryLookup, libraryOf, type DesignComponent } from './components';
import { box, instanceOf, text } from './components.test.fixtures';
import type { Element } from './index';

// A 12-element header: a bar, a brand, eight links and two icons.
function header(): DesignComponent {
  const elements: Element[] = [
    box('bar', 0, 0, 1200, 64),
    text('brand', 16, 20, 'Acme'),
    ...Array.from({ length: 8 }, (_, i) => text(`link${i}`, 400 + i * 90, 22, `Link ${i}`)),
    box('search', 1120, 18, 28, 28, { shape: 'icon', iconId: 'search' }),
    box('menu', 1160, 18, 28, 28, { shape: 'icon', iconId: 'menu' }),
  ];
  return { id: 'hdr', name: 'Header', width: 1200, height: 64, elements, updatedAt: 1 };
}

// One screen: its header instance and 40 ordinary elements.
function screens(n: number): { elements: Element[] } {
  const main = header();
  const elements: Element[] = [];
  for (let s = 0; s < n; s++) {
    const y = s * 900;
    elements.push(instanceOf(main, { id: `inst${s}`, x: 0, y }));
    for (let i = 0; i < 40; i++)
      elements.push(box(`s${s}e${i}`, (i % 8) * 140, y + 100 + Math.floor(i / 8) * 120));
  }
  return { elements };
}

describe('expandInstances, 30 screens', () => {
  const lookup = libraryLookup(libraryOf([header()]));

  it('expands a component on every screen inside the budget', () => {
    const tab = screens(30);
    let out: { elements: Element[] } = tab;
    const ms = cpuMsOf(() => {
      for (let i = 0; i < 20; i++) out = expandInstances(tab, lookup);
    });
    expect(out.elements).toHaveLength(30 * (1 + 40 + 12));
    // 20 runs, so the budget per expand is a twentieth of this.
    expect(ms).toBeLessThan(cpuBudgetMs(100));
  });

  it('grows linearly with the screens', () => {
    const small = screens(60);
    const large = screens(240);
    const time = (tab: { elements: Element[] }) =>
      cpuMsOf(() => {
        for (let i = 0; i < 10; i++) expandInstances(tab, lookup);
      });
    time(small);
    const a = time(small);
    const b = time(large);
    // Four times the screens: well under sixteen times the work (quadratic) even on a noisy machine.
    expect(b).toBeLessThan(Math.max(a, 1) * 10);
  });
});
