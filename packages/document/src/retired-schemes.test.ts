import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { migrateRetiredScheme, retiredSchemeOf } from './retired-schemes';
import type { Element, Tab } from './index';

// Retired colour schemes (docs/specs/011-theme/retired-schemes.md): a scheme leaves the catalogue by
// being migrated away on read, so an old canvas opens in the scheme that replaced it.

const CHARCOAL = {
  fill: '#2c2c33',
  stroke: '#a1a1aa',
  text: '#e4e4e7',
  bg: '#2b2b33',
  grid: '#636373',
};

const shape = (o: Record<string, unknown> = {}): Element =>
  ({ id: 's', type: 'shape', shape: 'square', x: 0, y: 0, width: 10, height: 10, ...o }) as Element;
const charcoalShape = (o: Record<string, unknown> = {}) =>
  shape({ fillColor: CHARCOAL.fill, strokeColor: CHARCOAL.stroke, textColor: CHARCOAL.text, ...o });

const tab = (o: Partial<Tab> = {}): Tab => ({ id: 't', name: 'T', elements: [], ...o });
const charcoalTab = (elements: Element[] = [charcoalShape()], o: Partial<Tab> = {}): Tab =>
  tab({
    theme: 'charcoal',
    backgroundColor: CHARCOAL.bg,
    patternColor: CHARCOAL.grid,
    elements,
    ...o,
  });

let info: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  info = vi.spyOn(console, 'info').mockImplementation(() => {});
});
afterEach(() => info.mockRestore());

describe('retiredSchemeOf', () => {
  it('names a Charcoal tab', () => {
    expect(retiredSchemeOf(charcoalTab())).toBe('charcoal');
  });

  it('names a Default tab still on the previous dark half', () => {
    expect(
      retiredSchemeOf(
        tab({ theme: 'brand', backgroundColor: CHARCOAL.bg, patternColor: CHARCOAL.grid }),
      ),
    ).toBe('previous-default-dark');
    expect(
      retiredSchemeOf(tab({ backgroundColor: CHARCOAL.bg, patternColor: CHARCOAL.grid })),
    ).toBe('previous-default-dark');
  });

  it('leaves everything else alone', () => {
    expect(retiredSchemeOf(tab())).toBeNull();
    expect(
      retiredSchemeOf(tab({ theme: 'brand', backgroundColor: '#0d121a', patternColor: '#1c2735' })),
    ).toBeNull();
    // Only one of the two colours: a hand-picked canvas, not the scheme.
    expect(
      retiredSchemeOf(
        tab({ theme: 'brand', backgroundColor: CHARCOAL.bg, patternColor: '#ff0000' }),
      ),
    ).toBeNull();
    // Another scheme on the same grey is somebody's choice.
    expect(
      retiredSchemeOf(
        tab({ theme: 'custom:x', backgroundColor: CHARCOAL.bg, patternColor: CHARCOAL.grid }),
      ),
    ).toBeNull();
  });
});

describe('a Charcoal tab', () => {
  it('becomes a Default tab on the current dark half', () => {
    const out = migrateRetiredScheme(charcoalTab());
    expect(out.theme).toBe('brand');
    expect(out.backgroundColor).toBe('#0d121a');
    expect(out.patternColor).toBe('#1c2735');
  });

  it('drops the colours Charcoal baked, so elements take the canvas ink', () => {
    const [el] = migrateRetiredScheme(charcoalTab()).elements;
    expect(el).not.toHaveProperty('fillColor');
    expect(el).not.toHaveProperty('strokeColor');
    expect(el).not.toHaveProperty('textColor');
  });

  it('keeps a colour the user picked', () => {
    const [el] = migrateRetiredScheme(
      charcoalTab([charcoalShape({ fillColor: '#7c3aed' })]),
    ).elements;
    expect(el).toMatchObject({ fillColor: '#7c3aed' });
    expect(el).not.toHaveProperty('strokeColor');
  });

  it('keeps a canvas the user recoloured', () => {
    const out = migrateRetiredScheme(charcoalTab(undefined, { backgroundColor: '#112233' }));
    expect(out.theme).toBe('brand');
    expect(out.backgroundColor).toBe('#112233');
    expect(out.patternColor).toBe(CHARCOAL.grid);
  });

  it('strips an arrow, a sketch, a text, and a table as the scheme wrote them', () => {
    const elements = [
      {
        id: 'a',
        type: 'arrow',
        from: { kind: 'free', x: 0, y: 0 },
        to: { kind: 'free', x: 1, y: 1 },
        strokeColor: CHARCOAL.stroke,
      },
      {
        id: 'f',
        type: 'freehand',
        x: 0,
        y: 0,
        width: 1,
        height: 1,
        points: [],
        fillColor: CHARCOAL.fill,
        strokeColor: CHARCOAL.stroke,
      },
      {
        id: 'x',
        type: 'text',
        x: 0,
        y: 0,
        width: 1,
        height: 1,
        text: 'hi',
        textColor: CHARCOAL.text,
      },
      {
        id: 'b',
        type: 'table',
        x: 0,
        y: 0,
        width: 1,
        height: 1,
        cells: [['']],
        fillColor: CHARCOAL.bg,
        strokeColor: CHARCOAL.stroke,
        textColor: CHARCOAL.text,
      },
    ] as unknown as Element[];
    for (const el of migrateRetiredScheme(charcoalTab(elements)).elements) {
      expect(el).not.toHaveProperty('fillColor');
      expect(el).not.toHaveProperty('strokeColor');
      expect(el).not.toHaveProperty('textColor');
    }
  });

  it('leaves the kinds a scheme never paints untouched', () => {
    const sticky = {
      id: 'n',
      type: 'sticky',
      x: 0,
      y: 0,
      width: 1,
      height: 1,
      fillColor: CHARCOAL.fill,
    } as unknown as Element;
    const [out] = migrateRetiredScheme(charcoalTab([sticky])).elements;
    expect(out).toBe(sticky);
  });

  it('logs what it rewrote', () => {
    migrateRetiredScheme(charcoalTab());
    expect(info).toHaveBeenCalledWith('[tab-migrate] retired-scheme', {
      from: 'charcoal',
      stripped: 3,
    });
  });
});

describe("Default's previous dark half", () => {
  it('moves to the current dark half, keeping the pattern kind', () => {
    const out = migrateRetiredScheme(
      tab({
        theme: 'brand',
        backgroundColor: CHARCOAL.bg,
        patternColor: CHARCOAL.grid,
        backgroundPattern: 'graph',
      }),
    );
    expect(out).toMatchObject({
      theme: 'brand',
      backgroundColor: '#0d121a',
      patternColor: '#1c2735',
      backgroundPattern: 'graph',
    });
  });

  it('touches no element (Default never painted one)', () => {
    const el = charcoalShape();
    const out = migrateRetiredScheme(
      tab({ backgroundColor: CHARCOAL.bg, patternColor: CHARCOAL.grid, elements: [el] }),
    );
    expect(out.elements[0]).toBe(el);
  });
});

describe("Default's previous light half", () => {
  it('names a Default tab still on the white canvas', () => {
    expect(retiredSchemeOf(tab({ backgroundColor: '#ffffff', patternColor: '#cbd5e1' }))).toBe(
      'previous-default-light',
    );
    expect(retiredSchemeOf(tab({ theme: 'brand', backgroundColor: '#ffffff' }))).toBe(
      'previous-default-light',
    );
  });

  it('moves to the off-white light half, keeping the pattern kind', () => {
    const out = migrateRetiredScheme(
      tab({
        theme: 'brand',
        backgroundColor: '#ffffff',
        patternColor: '#cbd5e1',
        backgroundPattern: 'grid',
      }),
    );
    expect(out).toMatchObject({
      theme: 'brand',
      backgroundColor: '#fbfaf7',
      patternColor: '#cbd5e1',
      backgroundPattern: 'grid',
    });
    expect(retiredSchemeOf(out)).toBeNull();
  });

  it('leaves a white canvas on another scheme, or with a hand-picked grid, alone', () => {
    expect(retiredSchemeOf(tab({ theme: 'mono', backgroundColor: '#ffffff' }))).toBeNull();
    expect(
      retiredSchemeOf(tab({ backgroundColor: '#ffffff', patternColor: '#ff0000' })),
    ).toBeNull();
  });
});

describe('properties', () => {
  it('is idempotent', () => {
    const once = migrateRetiredScheme(charcoalTab([charcoalShape({ fillColor: '#7c3aed' })]));
    const twice = migrateRetiredScheme(once);
    expect(twice).toBe(once);
    expect(retiredSchemeOf(once)).toBeNull();
  });

  it('returns the same tab when there is nothing to migrate, and says nothing', () => {
    const t = tab({ theme: 'midnight', elements: [charcoalShape()] });
    expect(migrateRetiredScheme(t)).toBe(t);
    expect(info).not.toHaveBeenCalled();
  });

  it('passes a body without an elements array through', () => {
    const body = {
      theme: 'charcoal',
      backgroundColor: CHARCOAL.bg,
      patternColor: CHARCOAL.grid,
    } as unknown as Tab;
    expect(migrateRetiredScheme(body).theme).toBe('brand');
  });
});
