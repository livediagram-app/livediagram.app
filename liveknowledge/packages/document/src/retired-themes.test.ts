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
    // The elements move to Mono's colours; the tab itself then keeps no theme or surround of its own
    // (docs/specs/030-knowledgebase/page-surface.md "No tab has a style"): the look is the knowledgebase's.
    expect(out).not.toHaveProperty('theme');
    expect(out).not.toHaveProperty('backgroundColor');
    expect(out).not.toHaveProperty('patternColor');
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
    expect(migrateStoredTab(out)).toEqual(out);
  });
});
