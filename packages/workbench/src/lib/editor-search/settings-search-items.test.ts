import { describe, expect, it } from 'vitest';
import { buildSettingsSearchItems } from './settings-search-items';

describe('buildSettingsSearchItems', () => {
  it('makes one item per row, its haystack the path, section, description and keywords', () => {
    const categories = [
      {
        id: 'account/notifications',
        rows: [
          {
            key: 'email',
            label: 'Email',
            description: 'Mail me',
            section: 'Mail',
            keywords: 'inbox',
          },
          { key: 'push', label: 'Push', description: 'Ping me' },
        ],
      },
    ];
    const items = buildSettingsSearchItems(categories, () => 'Account › Notifications');
    expect(items).toEqual([
      {
        id: 'setting:account/notifications/email',
        title: 'Email',
        keywords: 'Account › Notifications Mail Mail me inbox',
        categoryId: 'account/notifications',
        categoryLabel: 'Account › Notifications',
        rowKey: 'email',
      },
      expect.objectContaining({ keywords: 'Account › Notifications  Ping me ', rowKey: 'push' }),
    ]);
  });
});
