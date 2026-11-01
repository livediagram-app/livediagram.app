// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import type { DesignComponent, Element, Tab } from '@livedesign/design';
import {
  componentRegistry,
  expandForExport,
  registryLookup,
  setComponentRegistry,
} from './component-registry';
import { instanceMarkup } from './instance-svg';
import { renderTabToSvg } from './export-tab';
import {
  clipboardWriteFor,
  parseComponentsPayload,
  parseElementsPayload,
} from './clipboard-payload';

const main: DesignComponent = {
  id: 'hdr',
  name: 'Header',
  width: 200,
  height: 50,
  elements: [
    {
      id: 'bar',
      type: 'shape',
      shape: 'square',
      x: 0,
      y: 0,
      width: 200,
      height: 50,
      label: 'Acme',
      fillColor: '#123456',
    },
    {
      id: 'line',
      type: 'arrow',
      from: { kind: 'free', x: 0, y: 50 },
      to: { kind: 'free', x: 200, y: 50 },
    },
  ] as Element[],
  updatedAt: 1,
};

const instance = (over: Partial<Element> = {}): Element =>
  ({
    id: 'i1',
    type: 'shape',
    shape: 'instance',
    componentId: 'hdr',
    x: 100,
    y: 100,
    width: 400,
    height: 100,
    ...over,
  }) as Element;

const tab = (elements: Element[]): Tab => ({ id: 't', name: 'T', elements });

afterEach(() => setComponentRegistry(null));

describe('component registry', () => {
  it('expands instances against the published library, and leaves a tab with none alone', () => {
    expect(registryLookup('hdr')).toBeUndefined();
    setComponentRegistry(new Map([[main.id, main]]));
    expect(componentRegistry()?.get('hdr')).toBe(main);
    const plain = tab([]);
    expect(expandForExport(plain)).toBe(plain);
    const out = expandForExport(tab([instance()]));
    expect(out.elements.map((e) => e.id)).toEqual(['i1', 'i1/bar', 'i1/line']);
    // Twice is once.
    expect(expandForExport(out)).toBe(out);
    // An explicit lookup wins.
    expect(expandForExport(tab([instance()]), () => undefined).elements[0]).toMatchObject({
      label: 'Missing component',
    });
  });

  it('exports an instance as its main, overrides applied, and a missing one as a dashed frame', () => {
    setComponentRegistry(new Map([[main.id, main]]));
    const svg = renderTabToSvg(
      tab([instance({ componentOverrides: { bar: { label: 'Globex', fillColor: '#ff0000' } } })]),
    );
    expect(svg).toContain('Globex');
    expect(svg).not.toContain('Acme');
    expect(svg).toContain('#ff0000');
    setComponentRegistry(null);
    expect(renderTabToSvg(tab([instance()]))).toContain('Missing component');
  });
});

describe('instanceMarkup', () => {
  it('draws the main in the box at the origin, arrows after boxes', () => {
    const markup = instanceMarkup(
      { id: 'i', type: 'shape', shape: 'instance', x: 0, y: 0, width: 400, height: 100 },
      main,
      {},
      'light',
      '#ffffff',
    );
    expect(markup).toContain('Acme');
    expect(markup.indexOf('Acme')).toBeLessThan(markup.lastIndexOf('<path'));
  });
});

describe('clipboard carries mains', () => {
  it('writes the mains beside the elements and reads them back', () => {
    const { text } = clipboardWriteFor([instance()], 'copy', [main]);
    expect(parseElementsPayload(text)).toHaveLength(1);
    expect(parseComponentsPayload(text)).toEqual([main]);
    expect(parseComponentsPayload(clipboardWriteFor([instance()], 'copy').text)).toEqual([]);
    expect(parseComponentsPayload(null)).toEqual([]);
    expect(parseComponentsPayload('{"components": [ broken')).toEqual([]);
    expect(parseComponentsPayload('{"kind":"other","components":[]}')).toEqual([]);
    expect(
      parseComponentsPayload(
        JSON.stringify({ kind: 'livedesign.elements', components: [main, { id: 'x' }] }),
      ),
    ).toEqual([main]);
  });
});
