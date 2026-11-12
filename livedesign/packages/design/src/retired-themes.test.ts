import { describe, expect, it } from 'vitest';
import { migrateRetiredTheme, RETIRED_THEMES } from './retired-themes';
import { migrateStoredTab } from './stored-tab';
import { RETIRED_THEME_IDS, THEMES } from './themes-data';
import type { Element } from './index';

const box = (extra: Record<string, unknown>) =>
  ({
    id: 'a',
    type: 'shape',
    shape: 'rectangle',
    x: 0,
    y: 0,
    width: 10,
    height: 10,
    ...extra,
  }) as unknown as Element;

describe('retired themes (docs/specs/011-theme/light-and-dark.md "Retired: Autumn and Jewel")', () => {
  it('are gone from the catalogue', () => {
    expect(THEMES.map((t) => t.id)).not.toContain('autumn');
    expect(THEMES.map((t) => t.id)).not.toContain('jewel');
  });

  it('moves Autumn to Tropical, its colours to the same roles', () => {
    const out = migrateRetiredTheme({
      theme: 'autumn',
      backgroundColor: '#fffaf5',
      patternColor: '#fed7aa',
      elements: [box({ fillColor: '#fee2e2', strokeColor: '#dc2626', textColor: '#7f1d1d' })],
    });
    expect(out.theme).toBe('tropical');
    expect(out.backgroundColor).toBe('#f0fdfa');
    expect(out.patternColor).toBe('#99f6e4');
    expect(out.elements[0]).toMatchObject({
      fillColor: '#ccfbf1',
      strokeColor: '#0d9488',
      textColor: '#134e4a',
    });
  });

  it('moves Jewel to Rainbow and keeps a colour someone picked', () => {
    const out = migrateRetiredTheme({
      theme: 'jewel',
      backgroundColor: '#fbfbfd',
      patternColor: '#e2e8f0',
      elements: [box({ fillColor: '#123456', strokeColor: '#334155' })],
    });
    expect(out.theme).toBe('rainbow');
    expect(out.elements[0]).toMatchObject({ fillColor: '#123456', strokeColor: '#475569' });
  });

  // Jewel's canvas and element fill are one colour, so a single map for every role sent the canvas to Rainbow's
  // element fill, which a dark viewer then read as a colour someone picked.
  it("maps the canvas to the new theme's canvas, never an element colour sharing the old value", () => {
    const rainbow = THEMES.find((t) => t.id === 'rainbow')!;
    const out = migrateRetiredTheme({
      theme: 'jewel',
      backgroundColor: '#FBFBFD',
      patternColor: '#e2e8f0',
      elements: [box({ fillColor: '#fbfbfd' })],
    });
    expect(out.backgroundColor).toBe(rainbow.backgroundColor);
    expect(out.patternColor).toBe(rainbow.patternColor);
    expect(out.elements[0]).toMatchObject({ fillColor: rainbow.elementFill });
  });

  // Autumn's outline is also its second branch's text.
  it("maps each field by its own role, so a branch's text takes the new branch's text", () => {
    const tropical = THEMES.find((t) => t.id === 'tropical')!;
    const out = migrateRetiredTheme({
      theme: 'autumn',
      elements: [box({ fillColor: '#ffedd5', strokeColor: '#ea580c', textColor: '#7c2d12' })],
    });
    expect(out.elements[0]).toMatchObject({
      fillColor: tropical.palette![1]!.fill,
      strokeColor: tropical.palette![1]!.stroke,
      textColor: tropical.palette![1]!.text,
    });
    const outline = migrateRetiredTheme({
      theme: 'autumn',
      elements: [
        box({ strokeColor: '#7c2d12' }),
        {
          id: 'r',
          type: 'arrow',
          from: { kind: 'free', x: 0, y: 0 },
          to: { kind: 'free', x: 1, y: 1 },
          strokeColor: '#7c2d12',
          arrowheadColor: '#7c2d12',
        } as unknown as Element,
      ],
    });
    expect(outline.elements[0]).toMatchObject({ strokeColor: tropical.elementStroke });
    expect(outline.elements[1]).toMatchObject({
      strokeColor: tropical.elementStroke,
      arrowheadColor: tropical.elementStroke,
    });
  });

  it('leaves the kinds a theme never paints, and a locked fill, as they are', () => {
    const sticky = { ...box({ fillColor: '#fef3c7' }), type: 'sticky' } as unknown as Element;
    const locked = box({ id: 'g', fillColor: '#fef3c7', themeLockFill: true });
    const out = migrateRetiredTheme({ theme: 'autumn', elements: [sticky, locked, null as never] });
    expect(out.elements[0]).toBe(sticky);
    expect(out.elements[1]).toBe(locked);
  });

  it('leaves any other tab as it is, and runs on every stored-tab read', () => {
    const tab = {
      theme: 'tropical',
      backgroundColor: '#f0fdfa',
      patternColor: '#99f6e4',
      elements: [],
    };
    expect(migrateRetiredTheme(tab)).toBe(tab);
    expect(migrateStoredTab({ ...tab, theme: 'jewel' }).theme).toBe('rainbow');
  });
});

// UML, retired here while livediagram keeps it (docs/specs/011-theme/retired-schemes.md "UML").
describe('the retired UML theme', () => {
  const mono = THEMES.find((t) => t.id === 'mono')!;

  it('is gone from this catalogue, and every theme left out of it has a migration', () => {
    expect(THEMES.map((t) => t.id)).not.toContain('uml');
    for (const id of RETIRED_THEME_IDS) expect(Object.hasOwn(RETIRED_THEMES, id), id).toBe(true);
  });

  it("moves a stored tab on UML to Mono on read, UML's colours to Mono's and a picked colour kept", () => {
    const out = migrateStoredTab({
      theme: 'uml',
      backgroundColor: '#ffffff',
      patternColor: '#e2e8f0',
      elements: [
        box({ fillColor: '#f8fafc', strokeColor: '#334155', textColor: '#0f172a' }),
        box({ id: 'b', fillColor: '#123456', strokeColor: '#334155' }),
      ],
    });
    expect(out.theme).toBe('mono');
    expect(out.backgroundColor).toBe(mono.backgroundColor);
    expect(out.patternColor).toBe(mono.patternColor);
    expect(out.elements[0]).toMatchObject({
      fillColor: mono.elementFill,
      strokeColor: mono.elementStroke,
      textColor: mono.elementText,
    });
    expect(out.elements[1]).toMatchObject({
      fillColor: '#123456',
      strokeColor: mono.elementStroke,
    });
    expect(migrateRetiredTheme(out)).toBe(out);
  });
});
