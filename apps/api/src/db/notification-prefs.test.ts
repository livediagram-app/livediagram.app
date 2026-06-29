import { describe, expect, it } from 'vitest';
import type { Env } from '../types';
import { getNotificationPrefs } from './notification-prefs';

// Minimal D1 stub: getNotificationPrefs does a single prepare().bind().first(),
// so we only need that chain to hand back the row we want to test parsing for.
function envWithPrefsRow(prefs: string | null): Env {
  return {
    DB: {
      prepare: () => ({
        bind: () => ({
          first: async () => (prefs === null ? null : { prefs }),
        }),
      }),
    },
  } as unknown as Env;
}

describe('getNotificationPrefs (spec/65)', () => {
  it('defaults both flags to true when there is no row', async () => {
    expect(await getNotificationPrefs(envWithPrefsRow(null), 'user_x')).toEqual({
      notifyDiagramJoin: true,
      notifyInviteResponse: true,
      notifyComments: true,
      notifyTips: true,
      notifyMilestones: true,
    });
  });

  it('defaults to true when the key is absent from the blob', async () => {
    const prefs = await getNotificationPrefs(envWithPrefsRow('{"telemetryEnabled":false}'), 'u');
    expect(prefs).toEqual({
      notifyDiagramJoin: true,
      notifyInviteResponse: true,
      notifyComments: true,
      notifyTips: true,
      notifyMilestones: true,
    });
  });

  it('only an explicit false opts out', async () => {
    const prefs = await getNotificationPrefs(
      envWithPrefsRow('{"notifyDiagramJoin":false,"notifyInviteResponse":true}'),
      'u',
    );
    expect(prefs).toEqual({
      notifyDiagramJoin: false,
      notifyInviteResponse: true,
      notifyComments: true,
      notifyTips: true,
      notifyMilestones: true,
    });
  });

  it('falls back to defaults on a corrupt blob', async () => {
    const prefs = await getNotificationPrefs(envWithPrefsRow('not json'), 'u');
    expect(prefs).toEqual({
      notifyDiagramJoin: true,
      notifyInviteResponse: true,
      notifyComments: true,
      notifyTips: true,
      notifyMilestones: true,
    });
  });

  it('treats a non-boolean value as notify (defends against a misbehaving client)', async () => {
    const prefs = await getNotificationPrefs(envWithPrefsRow('{"notifyDiagramJoin":"no"}'), 'u');
    expect(prefs.notifyDiagramJoin).toBe(true);
  });
});
