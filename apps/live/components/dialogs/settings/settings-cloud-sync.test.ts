import { describe, expect, it } from 'vitest';
import { CLOUD_SYNC_SECTION, CLOUD_SYNC_SECTION_ID } from '@/lib/cloud-sync/providers';
import { settingsSectionId, visibleCategories } from './settings-catalogue';
import { searchSettings } from './settings-search';

// Settings > Account > Cloud Sync (docs/specs/022-drive-mirror/drive-mirror.md, "Connecting").

const account = (cloudProviders: 'googleDrive'[]) =>
  visibleCategories(false, { emailEnabled: false, signedIn: true, cloudProviders }).find(
    (c) => c.id === 'account',
  )!;

describe('Cloud Sync in Settings', () => {
  it('lists Google Drive in its own section, between Your Data and Danger Zone', () => {
    const sections = account(['googleDrive']).rows.map((r) => r.section);
    expect([...new Set(sections)]).toEqual(['You', 'Your Data', 'Cloud Sync', 'Danger Zone']);
    expect(account(['googleDrive']).rows.find((r) => r.section === 'Cloud Sync')).toMatchObject({
      kind: 'cloudSync',
      key: 'cloudSync-googleDrive',
      provider: 'googleDrive',
      label: 'Google Drive',
      helpArticle: 'googleDrive',
    });
  });

  it('shows the section only where the deployment offers a provider', () => {
    expect(account([]).rows.some((r) => r.section === 'Cloud Sync')).toBe(false);
  });

  it('is found by what people type for it', () => {
    const categories = [account(['googleDrive'])];
    for (const query of ['drive', 'google', 'sync', 'backup', 'mirror', 'cloud']) {
      const keys = searchSettings(categories, query).categories.flatMap((c) =>
        c.rows.map((r) => r.key),
      );
      expect(keys, query).toContain('cloudSync-googleDrive');
    }
  });

  it('targets sections by a stable id', () => {
    expect(settingsSectionId(CLOUD_SYNC_SECTION)).toBe(CLOUD_SYNC_SECTION_ID);
    expect(settingsSectionId('Danger Zone')).toBe('danger-zone');
  });
});
