'use client';

import { useMemo } from 'react';
import {
  EditorSettingsDialog,
  type EditorSettingsBinding,
} from '@liveworkspace/workbench/components/dialogs/EditorSettingsDialog';
import { useCursorsDrawn } from '@liveworkspace/workbench/hooks/collab/useHideCursors';
import { useCapabilities } from '@/hooks/persistence/useCapabilities';
import { useAccountBootstrap } from '@/hooks/persistence/useAccountBootstrap';
import { requestWatchRelaunch } from '@/lib/watch-relaunch';
import { topicsOwed } from '@/lib/watch-topics';
import { useWorkbenchSession } from '@/components/providers/workbench-session-context';
import { useRetiredPartsCount } from '@/hooks/persistence/useRetiredPartsCount';
import { track } from '@/lib/telemetry';
import { visibleCategories } from '@/components/dialogs/settings/settings-catalogue';
import { SETTINGS_KIT } from '@/components/dialogs/settings/settings-kit';
import { settingsModel } from '@/components/dialogs/settings/settings-model';
import {
  ACCOUNT_SETTINGS,
  cloudSyncHost,
  renderSettingsLogo,
  SETTINGS_APP,
  settingsRequest,
} from '@/components/dialogs/settings/settings-panel-host';
import type { UserPreferences } from '@/lib/user-preferences';

type SettingsDialogProps = {
  settings: UserPreferences;
  onChange: (next: UserPreferences) => void;
  onClose: () => void;
  // Where to land. Set when Settings is opened from a search result: the
  // setting IS the destination, so we open its category and ring the row
  // rather than dropping the reader at the dialog's front door.
  focus?: { categoryId: string; rowKey: string } | null;
  // Category to open on without ringing a row, for the `?settings=` deep link
  // that mail and the account menu use.
  initialCategoryId?: string | null;
  // Section of that category to scroll to and focus (settingsSectionId): the
  // Drive connect flow returns to Account > Cloud Sync.
  initialSectionId?: string | null;
};

// This editor's part of the shared Settings dialog (docs/specs/007-editor/user-preferences.md): which app it is, its
// catalogue and the pieces of the shared panel, bound once. The frame, the This app / All rule and the Account
// section are the shared host's (@liveworkspace/workbench/components/dialogs/EditorSettingsDialog), the same in every
// editor.
const BINDING: EditorSettingsBinding<ReturnType<typeof visibleCategories>, UserPreferences> = {
  app: SETTINGS_APP,
  kit: SETTINGS_KIT,
  request: settingsRequest,
  accountPanels: ACCOUNT_SETTINGS,
  cloudSyncHost,
  renderLogo: renderSettingsLogo,
  model: settingsModel,
  memoryKey: 'livediagram:settings-view:v1',
  noun: 'canvas',
  // Which categories people actually open is the signal for what belongs on the first screen next.
  onCategoryOpened: (id) =>
    track('UI', 'Opened', `Settings${id.charAt(0).toUpperCase()}${id.slice(1)}`),
};

// The modes Watch It Built teaches, whose start panel a Settings change can reopen.
const WATCH_MODES = ['diagram', 'draw', 'workshop'] as const;

// Watch It Built (docs/specs/007-editor/watch-it-built.md "Settings"): a mode with every topic taken when Settings
// opened and one owed again as it closes opens that mode's start panel in place, as the Start Tour button does.
export function relaunchTours(opened: UserPreferences, now: UserPreferences): void {
  for (const mode of WATCH_MODES) {
    if (topicsOwed(now, mode).length > 0 && topicsOwed(opened, mode).length === 0) {
      requestWatchRelaunch(mode);
    }
  }
}

// The Settings dialog: this editor's door to the shared host, handing in only what is its own (its catalogue's
// inputs, the tours it reruns on close).
export function SettingsDialog({
  settings,
  onChange,
  onClose,
  focus,
  initialCategoryId,
  initialSectionId = null,
}: SettingsDialogProps) {
  // Email rows need email configured AND a signed-in account: a guest has no address, so those switches could never
  // apply (docs/specs/014-identity/transactional-email.md).
  const { emailEnabled } = useCapabilities();
  const { accountUserId, isSignedIn } = useAccountBootstrap();
  const accountId = isSignedIn && accountUserId ? accountUserId : null;
  // A workbench's Settings reach nothing beyond its one canvas (docs/specs/013-workspace/
  // blueprints/workbench-embeds.md, Surface table).
  const workbench = useWorkbenchSession() !== null;
  // Canvases in This Browser with parts set aside: Account's way back to the offer
  // (docs/specs/006-document/offline-mode.md "Moving retired parts to the other apps").
  const retiredParts = useRetiredPartsCount(!workbench);
  // The Hide Participant Cursors row only where the tab draws cursors (collaborator-enhancements.md).
  const cursorsDrawn = useCursorsDrawn();
  const categories = useMemo(
    () =>
      visibleCategories({
        emailEnabled,
        signedIn: accountId !== null,
        preferences: settings,
        workbench,
        retiredParts,
        cursorsDrawn,
      }),
    [emailEnabled, accountId, settings, workbench, retiredParts, cursorsDrawn],
  );
  return (
    <EditorSettingsDialog
      binding={BINDING}
      settings={settings}
      onChange={onChange}
      onClose={onClose}
      accountId={accountId}
      workbench={workbench}
      emailEnabled={emailEnabled}
      categories={categories}
      onClosing={relaunchTours}
      focus={focus ?? null}
      initialCategoryId={initialCategoryId ?? null}
      initialSectionId={initialSectionId}
    />
  );
}
