import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import { describe, expect, it } from 'vitest';
import { bindRetiredThemes, UML_AS_RETIRED, type ThemeColours } from './retired-themes';
import { themeHalf } from './theme-halves';
import { THEMES } from './themes-data';
import { createArrow, createShape, createSticky } from './testing/elements';
import type { ThemeDefinition } from './themes';

// The shared retired-theme migration (each product's docs/specs/011-theme/retired-schemes.md), over UML, the shared
// theme four products retired while livediagram keeps it.
const mono = THEMES.find((t) => t.id === 'mono')!;
const { migrate } = bindRetiredThemes({ uml: { from: UML_AS_RETIRED, to: 'mono' } });

const umlTab = (elements: unknown[]) => ({
  theme: 'uml',
  backgroundColor: '#ffffff',
  patternColor: '#e2e8f0',
  elements,
});

describe('bindRetiredThemes', () => {
  it('freezes UML as it left: the same colours livediagram still offers', () => {
    const live = THEMES.find((t) => t.id === 'uml')!;
    for (const key of [
      'backgroundColor',
      'backgroundPattern',
      'patternColor',
      'elementFill',
      'elementStroke',
      'elementText',
    ] as const)
      expect(UML_AS_RETIRED[key], key).toBe(live[key]);
  });

  it("moves a tab on UML to Mono, each colour UML painted to Mono's for the same role", () => {
    const box = {
      ...createShape('rectangle', 0, 0),
      fillColor: '#F8FAFC',
      strokeColor: '#334155',
      textColor: '#0f172a',
    };
    const out = migrate(umlTab([box]));
    expect(out.theme).toBe('mono');
    expect(out.backgroundColor).toBe(mono.backgroundColor);
    expect(out.patternColor).toBe(mono.patternColor);
    expect(out.elements[0]).toMatchObject({
      fillColor: mono.elementFill,
      strokeColor: mono.elementStroke,
      textColor: mono.elementText,
    });
  });

  it("maps UML's dark-half colours too, and an arrow's head with its line", () => {
    const dark = themeHalf(UML_AS_RETIRED, 'dark');
    const arrow = {
      ...createArrow(0, 0, 10, 10),
      strokeColor: dark.elementStroke,
      arrowheadColor: '#334155',
    };
    const box = { ...createShape('rectangle', 0, 0), fillColor: dark.elementFill };
    const out = migrate(umlTab([arrow, box]));
    expect(out.elements[0]).toMatchObject({
      strokeColor: mono.elementStroke,
      arrowheadColor: mono.elementStroke,
    });
    expect(out.elements[1]).toMatchObject({ fillColor: mono.elementFill });
  });

  it("keeps a colour someone picked, UML's colour for one shape kind, a sticky and anything not an element", () => {
    const picked = {
      ...createShape('rectangle', 0, 0),
      fillColor: '#123456',
      strokeColor: '#abcdef',
    };
    // A decision diamond's amber: Mono has no colour per kind to map it to.
    const diamond = {
      ...createShape('diamond', 0, 0),
      fillColor: '#fef3c7',
      strokeColor: '#d97706',
    };
    const sticky = { ...createSticky(0, 0), fillColor: '#f8fafc' };
    const textless = { ...createShape('rectangle', 0, 0), textColor: 42 };
    const out = migrate(umlTab([picked, diamond, sticky, null, textless]));
    expect(out.elements[0]).toBe(picked);
    expect(out.elements[1]).toBe(diamond);
    expect(out.elements[2]).toBe(sticky);
    expect(out.elements[3]).toBeNull();
    expect(out.elements[4]).toBe(textless);
  });

  it('keeps a canvas someone picked, and a tab without elements or backdrop colours', () => {
    const out = migrate({ theme: 'uml', backgroundColor: '#fafafa', elements: 'not-an-array' });
    expect(out).toMatchObject({
      theme: 'mono',
      backgroundColor: '#fafafa',
      elements: 'not-an-array',
    });
    expect('patternColor' in out && out.patternColor).toBeFalsy();
  });

  it('leaves a tab on any other theme, or on none, as the same object', () => {
    const tab = { theme: 'mono', elements: [] };
    expect(migrate(tab)).toBe(tab);
    const none = { elements: [] };
    expect(migrate(none)).toBe(none);
    const inherited = { theme: 'toString', elements: [] };
    expect(migrate(inherited)).toBe(inherited);
  });

  it('is idempotent: a migrated tab is on Mono, which nothing retired', () => {
    const once = migrate(umlTab([{ ...createShape('rectangle', 0, 0), fillColor: '#f8fafc' }]));
    expect(migrate(once)).toBe(once);
  });

  it("takes a product's own halves and colour fields, and maps nothing when the replacement is gone", () => {
    const fields: unknown[] = [];
    const own = bindRetiredThemes<ThemeColours & ThemeDefinition, { id: string }>(
      { uml: { from: UML_AS_RETIRED, to: 'not-a-theme' } },
      {
        half: (t) => t,
        colourFields: (el) => {
          fields.push(el.id);
          return [{ element: 'fillColor', theme: 'elementFill' }];
        },
      },
    );
    const box = { ...createShape('rectangle', 0, 0), id: 'b', fillColor: '#f8fafc' };
    const out = own.migrate(umlTab([box]));
    expect(out.theme).toBe('not-a-theme');
    expect(out.elements[0]).toBe(box);
    expect(out.backgroundColor).toBe('#ffffff');
    expect(fields).toEqual(['b']);
  });

  it('rewrites a 10,000-element tab on UML in one linear pass', () => {
    const elements = Array.from({ length: 10_000 }, (_, i) => ({
      ...createShape('rectangle', i, 0),
      fillColor: '#f8fafc',
      strokeColor: '#334155',
      textColor: '#0f172a',
    }));
    migrate(umlTab(elements.slice(0, 10)));
    const ms =
      cpuMsOf(() => {
        for (let k = 0; k < 5; k++) migrate(umlTab(elements));
      }) / 5;
    // Measured about 15 ms per read on a laptop under load, November 2026; cpuBudgetMs scales the budget for a CI runner.
    expect(ms).toBeLessThan(cpuBudgetMs(60));
  });
});
