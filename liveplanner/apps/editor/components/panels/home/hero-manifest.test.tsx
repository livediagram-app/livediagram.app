// @vitest-environment jsdom
// Home's hero art as a static manifest (liveworkspace/docs/site.md "The Explorer"): the pictures HeroFeatureFan draws,
// written beside the templates as @liveplanner/templates/hero.json so liveworkspace.app's Explorer draws the same art
// without any of this editor's code (@liveworkspace/explorer HeroArt). Each picture is its markup as data
// (@liveworkspace/explorer/hero-manifest), in the light and the dark plan palette. This test is the
// generator and its guard: run with HERO_WRITE=1 to write it; without, it fails when the file has drifted from the
// pictures.
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { HeroArtManifest } from '@liveworkspace/explorer';
import { HERO_MANIFEST_MAX_BYTES, heroArtManifest } from '@liveworkspace/explorer/hero-manifest';
import { HERO_FEATURES_LABEL, heroSheets } from './HeroFeatureFan';

// From the editor's folder, where its tests run (jsdom's import.meta.url is not a file address).
const FILE = resolve(process.cwd(), '../../packages/templates/hero.json');

export function heroManifest(): HeroArtManifest {
  return heroArtManifest('liveplanner', HERO_FEATURES_LABEL, heroSheets());
}

describe('the hero manifest', () => {
  it('matches the pictures (HERO_WRITE=1 writes it)', () => {
    const text = `${JSON.stringify(heroManifest())}\n`;
    if (process.env.HERO_WRITE === '1') writeFileSync(FILE, text);
    expect(readFileSync(FILE, 'utf8')).toBe(text);
    expect(text.length).toBeLessThan(HERO_MANIFEST_MAX_BYTES);
  });

  it('draws each of the four sheets in both palettes, as data alone', () => {
    const m = heroManifest();
    expect(m.sheets.map((s) => s.id)).toEqual(['board', 'sheet', 'dashboard', 'form']);
    const text = JSON.stringify(m);
    expect(text).not.toMatch(/"on[A-Z]|dangerouslySetInnerHTML|<script/);
    for (const s of m.sheets) expect(JSON.stringify(s.light)).not.toBe(JSON.stringify(s.dark));
  });
});
