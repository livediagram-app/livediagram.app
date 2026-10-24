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

  it("loads livedocuments' pictures, its three templates with the slide deck in front", async () => {
    const art = await loadHeroArt('livedocuments');
    expect(art?.sheets.map((s) => s.id)).toEqual(['event-poster', 'year-in-review', 'slide-deck']);
  });

  it('is the same load for a second ask on the page', () => {
    expect(loadHeroArt('liveplanner')).toBe(loadHeroArt('liveplanner'));
  });

  it("loads livediagram's pictures, the flowchart in front", async () => {
    const art = await loadHeroArt('livediagram');
    expect(art?.sheets.map((s) => s.id)).toEqual(['mindmap', 'retrospective', 'flowchart']);
  });

  it("loads livedesign's pictures, the logo in front", async () => {
    const art = await loadHeroArt('livedesign');
    expect(art?.sheets.map((s) => s.id)).toEqual([
      'wireframe-mobile-app',
      'wireframe-website',
      'logo-design',
    ]);
  });

  it('takes only a manifest it can draw', () => {
    expect(isHeroArt({})).toBe(false);
    expect(isHeroArt({ label: 'x', sheets: [] })).toBe(false);
    expect(
      isHeroArt({ label: 'x', sheets: [{ id: 'a', label: 'A', light: 'a', dark: 'a' }] }),
    ).toBe(true);
  });
});
