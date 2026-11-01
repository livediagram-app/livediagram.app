import { describe, expect, it } from 'vitest';
import type { DesignComponent, Element, Tab } from '@livedesign/design';
import { graphView } from './graph';
import { instanceSummaryOf } from './instance-summary';
import { buildViewModel } from './model';
import { outlineView } from './outline';
import { renderView } from './render-view';

const main: DesignComponent = {
  id: 'nav',
  name: 'Nav bar',
  width: 200,
  height: 40,
  updatedAt: 1,
  elements: [{ id: 'brand', type: 'text', x: 0, y: 0, width: 60, height: 20, label: 'Acme' }],
};

const instance = (extra: Record<string, unknown> = {}): Element => ({
  id: 'top',
  type: 'shape',
  shape: 'instance',
  componentId: 'nav',
  x: 0,
  y: 0,
  width: 200,
  height: 40,
  ...extra,
});

const tabOf = (elements: Element[]): Tab => ({ id: 'tab-1', name: 'T', elements });

describe('instanceSummaryOf', () => {
  const lookup = (id: string) => (id === 'nav' ? main : undefined);

  it('names the main, then how many main elements its overrides touch and which fields', () => {
    expect(instanceSummaryOf(instance(), lookup)).toBe('instance of "Nav bar"');
    const overridden = instance({
      componentOverrides: {
        brand: { label: 'Home', textColor: '#fff' },
        bar: { fillColor: '#000' },
      },
    });
    expect(instanceSummaryOf(overridden, lookup)).toBe(
      'instance of "Nav bar" overrides=2 fields=label,fillColor,textColor',
    );
  });

  it('says when the main is not loaded, missing, or not named at all', () => {
    expect(instanceSummaryOf(instance(), null)).toBe('instance of nav (main not loaded)');
    expect(instanceSummaryOf(instance({ componentId: 'gone' }), lookup)).toBe(
      'instance of gone (main missing)',
    );
    expect(instanceSummaryOf(instance({ componentId: undefined }), lookup)).toBe(
      'instance of ? (no componentId)',
    );
  });

  it('prints no overrides for an empty record, and no fields for entries holding none', () => {
    expect(instanceSummaryOf(instance({ componentOverrides: {} }), lookup)).toBe(
      'instance of "Nav bar"',
    );
    expect(instanceSummaryOf(instance({ componentOverrides: { brand: {} } }), lookup)).toBe(
      'instance of "Nav bar" overrides=1',
    );
  });

  it('is null for anything but an instance', () => {
    const square = { ...instance(), shape: 'square' } as Element;
    expect(instanceSummaryOf(square, lookup)).toBeNull();
  });
});

describe('instances in the views', () => {
  const tab = tabOf([instance({ componentOverrides: { brand: { label: 'Shop' } } })]);

  it('outline: one line for the instance, kept when a budget drops attributes', () => {
    const model = buildViewModel(tab, { components: [main] });
    const full = outlineView(model);
    expect(full.text.split('\n')[1]).toBe(
      'instance top instance of "Nav bar" overrides=1 fields=label',
    );
    expect(full.json.nodes[0]).toMatchObject({
      summary: 'instance of "Nav bar" overrides=1 fields=label',
    });
    const tight = outlineView(model, { budget: 30 });
    expect(['attributes-dropped', 'root-collapsed', 'containers-collapsed']).toContain(tight.state);
  });

  it('outline without a library names the main by id', () => {
    expect(outlineView(buildViewModel(tab)).text).toContain(
      'instance top instance of nav (main not loaded)',
    );
  });

  it('graph and show name the main too', () => {
    const arrowed = tabOf([
      instance(),
      { id: 'b', type: 'shape', shape: 'square', x: 300, y: 0, width: 40, height: 40 },
      {
        id: 'a1',
        type: 'arrow',
        from: { kind: 'pinned', elementId: 'top', anchor: 'e' },
        to: { kind: 'pinned', elementId: 'b', anchor: 'w' },
      },
    ]);
    const model = buildViewModel(arrowed, { components: [main] });
    expect(graphView(model).text).toContain('instance top instance of "Nav bar"');
    const shown = renderView({ view: 'show', ref: 'top' }, arrowed, { components: [main] });
    expect(shown.ok && shown.text).toContain('  instance of "Nav bar"');
  });
});
