import { describe, expect, it } from 'vitest';
import { isHeroArt, loadHeroArt } from './hero';

describe("Home's hero art on liveworkspace.app", () => {
  it("loads liveplanner's pictures, four sheets with both looks", async () => {
    const art = await loadHeroArt('liveplanner');
    expect(art?.sheets.map((s) => s.id)).toEqual(['board', 'sheet', 'dashboard', 'form']);
    for (const s of art!.sheets) {
      expect(Array.isArray(s.light)).toBe(true);
      expect(Array.isArray(s.dark)).toBe(true);
    }
  });

  it('is the same load for a second ask on the page', () => {
    expect(loadHeroArt('liveplanner')).toBe(loadHeroArt('liveplanner'));
  });

  it('shows none for an app that ships none', async () => {
    await expect(loadHeroArt('livedesign')).resolves.toBeNull();
  });

  it('takes only a manifest it can draw', () => {
    expect(isHeroArt({})).toBe(false);
    expect(isHeroArt({ label: 'x', sheets: [] })).toBe(false);
    expect(
      isHeroArt({ label: 'x', sheets: [{ id: 'a', label: 'A', light: 'a', dark: 'a' }] }),
    ).toBe(true);
  });
});
