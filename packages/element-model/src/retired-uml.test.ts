import { describe, expect, it } from 'vitest';
import { migrateRetiredTheme, RETIRED_THEME_IDS, RETIRED_THEMES, THEMES } from './retired-uml';
import { THEMES as SHARED_THEMES } from './themes-data';

// UML, retired by every product but livediagram (each one's docs/specs/011-theme/retired-schemes.md "UML").
describe('retired UML', () => {
  it('leaves only UML out of the shared catalogue, which still holds it for livediagram', () => {
    expect(SHARED_THEMES.map((t) => t.id)).toContain('uml');
    expect(THEMES.map((t) => t.id)).toEqual(
      SHARED_THEMES.map((t) => t.id).filter((id) => id !== 'uml'),
    );
  });

  it('migrates every theme it leaves out, onto one still offered', () => {
    for (const id of RETIRED_THEME_IDS) {
      const to = RETIRED_THEMES[id]!.to;
      expect(
        THEMES.some((t) => t.id === to),
        id,
      ).toBe(true);
    }
    expect(migrateRetiredTheme({ theme: 'uml', elements: [] }).theme).toBe('mono');
  });
});
