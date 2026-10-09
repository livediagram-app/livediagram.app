import { describe, expect, it } from 'vitest';
import type { Runtime } from '../types';
import { getNotificationPrefs } from './notification-prefs';

// Minimal D1 stub: getNotificationPrefs does a single prepare().bind().first(),
// so we only need that chain to hand back the row we want to test parsing for.
function envWithPrefsRow(prefs: string): Runtime {
  return {
    db: {
      prepare: () => ({
        bind: () => ({
          first: async () => ({ prefs }),
        }),
      }),
    },
  } as unknown as Runtime;
}

describe('getNotificationPrefs, preferences stored before the document rename', () => {
  it('honours an opt-out stored under notifyDiagramJoin', async () => {
    const prefs = await getNotificationPrefs(envWithPrefsRow('{"notifyDiagramJoin":false}'), 'u');
    expect(prefs.notifyDocumentJoin).toBe(false);
  });
});
