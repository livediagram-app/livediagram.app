'use client';

// Offline Mode conversions (docs/specs/006-document/offline-mode.md) for the menus that offer them
// (@liveworkspace/workbench/hooks/persistence/useOfflineConversion), bound to this editor's stores.
import { createOfflineConversion } from '@liveworkspace/workbench/hooks/persistence/useOfflineConversion';
import { useOptionalEditorContext } from '@/app/document/[id]/EditorContext';
import { fetchSharedTabsNotice } from '@/lib/shared-tabs-notice';
import { track } from '@/lib/telemetry';
import {
  ConversionInProgressError,
  conversionInProgress,
  saveOfflineToCloud,
  syncFailureMessage,
  takeCloudOffline,
} from '@/lib/offline/offline-convert';
import { offlineListDocuments } from '@/lib/offline/offline-store';

export const { useOfflineConversions, useOfflineConversion } = createOfflineConversion({
  useOptionalEditorContext,
  track,
  fetchSharedTabsNotice,
  ConversionInProgressError,
  conversionInProgress,
  saveOfflineToCloud,
  syncFailureMessage,
  takeCloudOffline,
  offlineListDocuments,
});
