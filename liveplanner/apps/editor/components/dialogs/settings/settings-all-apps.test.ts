import { afterEach, describe, expect, it, vi } from 'vitest';
import { __resetPreferencesSync, keepPreferencesLocally } from '@/lib/preferences-sync';
import { rowSharedAcrossApps } from './settings-all-apps';

vi.mock('@/lib/api-client', () => ({ apiPutPreferences: vi.fn() }));

afterEach(() => __resetPreferencesSync());

describe('rowSharedAcrossApps', () => {
  it('marks the rows whose preference every app shares, UI Scale parts included', () => {
    expect(rowSharedAcrossApps('reduceMotion')).toBe(true);
    expect(rowSharedAcrossApps('uiScale')).toBe(true);
    expect(rowSharedAcrossApps('uiScale-cornerButtons')).toBe(true);
    expect(rowSharedAcrossApps('notifyComments')).toBe(true);
    // A setting two or more apps have is one shared setting (liveworkspace/docs/specs/003-accounts/accounts.md "Common settings").
    expect(rowSharedAcrossApps('homeBanner')).toBe(true);
    expect(rowSharedAcrossApps('collaboratePanelEnabled')).toBe(true);
    expect(rowSharedAcrossApps('notifyFormResponses')).toBe(false);
    expect(rowSharedAcrossApps('uiScaleLink')).toBe(false);
  });

  it('marks nothing where preferences stay in this browser', () => {
    keepPreferencesLocally();
    expect(rowSharedAcrossApps('reduceMotion')).toBe(false);
  });
});
