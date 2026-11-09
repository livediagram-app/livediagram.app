// A host that only prefetches the Settings panel (the site's Explorer, as Settings is pointed at) imports
// preloadSettingsPanel from a module that holds nothing else: from SettingsPanel.tsx it put the whole panel, about
// 17 KiB gzipped, in the Explorer's first load. Moving it back passes every other test; this one fails.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(join(__dirname, path), 'utf8');

describe('preloadSettingsPanel', () => {
  it('lives in a module with no static imports', () => {
    expect(read('settings-panel-preload.ts')).not.toMatch(/^import\s/m);
  });

  it('is exported from that module, not the panel’s', () => {
    const index = read('index.ts');
    expect(index).toMatch(/export \{ preloadSettingsPanel \} from '\.\/settings-panel-preload';/);
    expect(read('SettingsPanel.tsx')).not.toMatch(/export function preloadSettingsPanel/);
  });

  it('fetches the catalogue view', async () => {
    const { preloadSettingsPanel, loadCatalogueView } = await import('./settings-panel-preload');
    expect(() => preloadSettingsPanel()).not.toThrow();
    await expect(loadCatalogueView()).resolves.toHaveProperty('default');
  });
});
