import { describe, expect, it } from 'vitest';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import type { DesignComponent, Element } from '@livedesign/design';
import { componentsView } from './components-view';

const design = { id: 'd1', name: 'Shop' };

function nav(extra: Partial<DesignComponent> = {}): DesignComponent {
  const elements: Element[] = [
    { id: 'bar', type: 'shape', shape: 'square', x: 0, y: 0, width: 200, height: 40 },
    { id: 'brand', type: 'text', x: 10, y: 10, width: 60, height: 20, label: 'Acme' },
    {
      id: 'Home Icon',
      type: 'shape',
      shape: 'icon',
      iconId: 'home',
      x: 170,
      y: 10,
      width: 20,
      height: 20,
    },
  ];
  return { id: 'nav', name: 'Nav bar', width: 200, height: 40, elements, updatedAt: 1, ...extra };
}

function many(id: string, count: number): DesignComponent {
  const elements: Element[] = Array.from({ length: count }, (_, i) => ({
    id: `e${i}`,
    type: 'shape',
    shape: 'square',
    x: i * 10,
    y: 0,
    width: 10,
    height: 10,
    label: `Item number ${i}`,
  }));
  return { id, name: `Main ${id}`, width: 400, height: 10, elements, updatedAt: 2 };
}

describe('componentsView', () => {
  it('lists each main with its frame and its elements, the ids overrides are keyed by', () => {
    const view = componentsView(design, [nav(), nav({ id: 'old', name: 'Old', archived: true })]);
    expect(view.text).toBe(
      [
        'doc d1 "Shop" · 2 components, 1 archived',
        'component nav "Nav bar" 200x40 · 3 elements',
        '  square bar takes=fillColor,strokeColor',
        '  text brand "Acme" takes=label,textColor',
        '  icon "Home Icon" takes=strokeColor,iconId',
        'component old "Old" 200x40 archived · 3 elements',
        '  square bar takes=fillColor,strokeColor',
        '  text brand "Acme" takes=label,textColor',
        '  icon "Home Icon" takes=strokeColor,iconId',
      ].join('\n'),
    );
    expect(view.fit.state).toBe('full');
    expect(view.json.design).toEqual(design);
    expect(view.json.components[1]).toMatchObject({ id: 'old', archived: true, collapsed: 0 });
    expect(view.json.components[0]!.elements[1]).toEqual({
      id: 'brand',
      kind: 'text',
      label: 'Acme',
      summary: null,
      takes: ['label', 'textColor'],
    });
    expect(view.json.elision).toBeNull();
  });

  it('prints an element’s content summary, and an element without a label', () => {
    const elements = [
      {
        id: 'link',
        type: 'arrow',
        from: { kind: 'free', x: 0, y: 0 },
        to: { kind: 'free', x: 40, y: 0 },
      },
      {
        id: 'grid',
        type: 'table',
        x: 0,
        y: 0,
        width: 80,
        height: 40,
        tableRows: [['a', 'b']],
      },
    ] as unknown as Element[];
    const main = { ...nav(), elements };
    const lines = componentsView(design, [main]).text.split('\n');
    expect(lines.slice(2)).toEqual([
      '  arrow link takes=strokeColor',
      '  table grid 0x0 takes=fillColor,strokeColor',
    ]);
  });

  it('says when the library is empty', () => {
    const view = componentsView(design, []);
    expect(view.text).toBe('doc d1 "Shop" · 0 components');
    expect(view.json.components).toEqual([]);
  });

  it('hides the largest mains’ elements first under a budget, and names the way to all of it', () => {
    const library = [nav(), many('big', 40)];
    const full = componentsView(design, library);
    const view = componentsView(design, library, { budget: 120, door: 'mcp' });
    expect(view.fit.state).toBe('elements-hidden');
    expect(view.text).toContain('component big "Main big" 400x10 · 40 elements (hidden)');
    expect(view.text).toContain('  text brand "Acme"');
    expect(view.text.split('\n').at(-1)).toBe(
      `… 40 elements hidden: read_design {"view":"components","budget":${full.fit.estimate}}`,
    );
    expect(view.json.components[1]).toMatchObject({ elements: [], collapsed: 40 });
    expect(view.json.elision).toMatchObject({
      arguments: { view: 'components', budget: full.fit.estimate },
    });
  });

  it('drops whole mains from the end when even their lines do not fit, in the CLI’s syntax', () => {
    const library = Array.from({ length: 30 }, (_, i) => many(`m${i}`, 1));
    const view = componentsView(design, library, { budget: 60 });
    expect(view.fit.state).toBe('lines-dropped');
    const last = view.text.split('\n').at(-1)!;
    expect(last).toMatch(/^… 1 element hidden; \d+ components hidden: component ls --budget \d+$/);
    expect(view.json.components.length).toBeLessThan(30);
  });

  it('names one hidden main in the singular', () => {
    const long = (id: string) => ({ ...many(id, 0), name: 'A main with a long name '.repeat(3) });
    const view = componentsView(design, [long('a'), long('b')], { budget: 60 });
    expect(view.text.split('\n').at(-1)).toMatch(/1 component hidden/);
  });

  it('stays linear on the largest library (200 mains of 200 elements)', () => {
    const library = Array.from({ length: 200 }, (_, i) => many(`m${i}`, 200));
    let view: ReturnType<typeof componentsView> | undefined;
    const ms = cpuMsOf(() => {
      view = componentsView(design, library, { budget: 1000 });
    });
    expect(view?.fit.state).toBe('lines-dropped');
    // Measured at about 60 ms; a quadratic fit took seconds.
    expect(ms).toBeLessThan(cpuBudgetMs(2000));
  });
});
