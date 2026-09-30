// The Cloud Sync provider catalogue (docs/specs/022-drive-mirror/drive-mirror.md,
// "Connecting"; blueprint "Cloud Sync in Settings"): one Settings row per
// provider in Account > Cloud Sync. Another provider is another entry here and
// its row component, nothing else.

import type { HelpArticleKey } from '@/lib/help-articles';

export type CloudSyncProviderId = 'googleDrive';

export type CloudSyncProvider = {
  id: CloudSyncProviderId;
  label: string;
  // Settings search synonyms, lower-case, space-separated.
  keywords: string;
  description: string;
  helpArticle: HelpArticleKey;
};

// The Settings section the providers sit in, and its target id
// (`settingsSectionId(CLOUD_SYNC_SECTION)`).
export const CLOUD_SYNC_SECTION = 'Cloud Sync';
export const CLOUD_SYNC_SECTION_ID = 'cloud-sync';

export const CLOUD_SYNC_PROVIDERS: readonly CloudSyncProvider[] = [
  {
    id: 'googleDrive',
    label: 'Google Drive',
    keywords: 'drive google sync backup mirror cloud gdrive',
    description:
      'Your Personal Space, copied to your Google Drive in matching folders. Renames, moves and deletions sync both ways. livediagram only sees files it created.',
    helpArticle: 'googleDrive',
  },
];
