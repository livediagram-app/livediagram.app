import { existsSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { LICENCE_APPS } from './apps.ts';

const appsDir = fileURLToPath(new URL('../../../apps/', import.meta.url));
const appDirs = readdirSync(appsDir).filter((d) => statSync(appsDir + d).isDirectory());

describe('LICENCE_APPS', () => {
  it('registers every app in apps/, so a new one cannot ship unlisted', () => {
    expect(appDirs.length).toBeGreaterThan(5);
    expect(LICENCE_APPS.map((a) => a.id).toSorted()).toEqual(appDirs.toSorted());
  });

  it('bundles each app with the tool it builds with', () => {
    for (const app of LICENCE_APPS) {
      const next = existsSync(`${appsDir}${app.id}/next.config.ts`);
      expect(app.bundler, app.id).toBe(next ? 'next' : 'worker');
    }
  });

  it('puts the static apps in the browser and the workers on the server', () => {
    for (const app of LICENCE_APPS) {
      expect(app.side, app.id).toBe(app.bundler === 'next' ? 'browser' : 'server');
    }
  });

  it('labels every app once', () => {
    const labels = LICENCE_APPS.map((a) => a.label);
    expect(new Set(labels).size).toBe(labels.length);
  });
});
