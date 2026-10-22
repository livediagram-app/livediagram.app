import { APP_SITES } from '@liveworkspace/sites';
import { describe, expect, it } from 'vitest';
import { APP_COPY, listedApps } from './apps';

describe('the apps on liveworkspace.app', () => {
  it('has copy for every app in the shared list, so no card ships empty', () => {
    for (const site of APP_SITES) expect(APP_COPY[site.id], site.id).toBeDefined();
    expect(listedApps().map((a) => a.id)).toEqual(APP_SITES.map((s) => s.id));
  });

  it('links each app’s privacy policy on its own site', () => {
    for (const app of listedApps()) expect(new URL(app.privacy).origin).toBe(app.url);
  });
});
