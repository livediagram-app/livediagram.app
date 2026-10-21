'use client';

import type { ComponentType } from 'react';
import { GoogleDriveSyncRow } from '@/components/drive/GoogleDriveSyncRow';
import type { CloudSyncProviderId } from '@/lib/cloud-sync/providers';
import type { SettingsCloudSyncRowSpec } from './settings-catalogue';

// One Cloud Sync provider's row (docs/specs/022-drive-mirror/drive-mirror.md, "Connecting"):
// the catalogue says which providers exist; each brings its own row.
const PROVIDER_ROWS: Record<
  CloudSyncProviderId,
  ComponentType<{ row: SettingsCloudSyncRowSpec }>
> = {
  googleDrive: GoogleDriveSyncRow,
};

export function SettingsCloudSyncRow({ row }: { row: SettingsCloudSyncRowSpec }) {
  const Row = PROVIDER_ROWS[row.provider];
  return <Row row={row} />;
}
