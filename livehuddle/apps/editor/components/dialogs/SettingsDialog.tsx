'use client';

import { useMemo } from 'react';
import {
  EditorSettingsDialog,
  type EditorSettingsBinding,
} from '@liveworkspace/workbench/components/dialogs/EditorSettingsDialog';
import { useCursorsDrawn } from '@liveworkspace/workbench/hooks/collab/useHideCursors';
import { useCapabilities } from '@/hooks/persistence/useCapabilities';
import { useAccountBootstrap } from '@/hooks/persistence/useAccountBootstrap';
import { requestAvatarTourRelaunch } from '@/lib/avatar-tour';
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
  // Section of that category to scroll to and focus (settingsSectionId).
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
  memoryKey: 'livehuddle:settings-view:v1',
  noun: 'space',
  // Which categories people actually open is the signal for what belongs on the first screen next.
  onCategoryOpened: (id) =>
    track('UI', 'Opened', `Settings${id.charAt(0).toUpperCase()}${id.slice(1)}`),
};

// Getting Started › "Receptionist's Welcome" (docs/specs/008-canvas/receptionist.md): turning its row on from off and
// closing has the Receptionist give his welcome again, as the footer's Ask Receptionist does.
export function relaunchTours(opened: UserPreferences, now: UserPreferences): void {
  if (now.avatarTourSeen !== true && opened.avatarTourSeen === true) requestAvatarTourRelaunch();
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
  // The Hide Participant Cursors row only where the tab draws cursors (collaborator-enhancements.md).
  const cursorsDrawn = useCursorsDrawn();
  const categories = useMemo(
    () =>
      visibleCategories({
        emailEnabled,
        signedIn: accountId !== null,
        preferences: settings,
        cursorsDrawn,
      }),
    [emailEnabled, accountId, settings, cursorsDrawn],
  );
  return (
    <EditorSettingsDialog
      binding={BINDING}
      settings={settings}
      onChange={onChange}
      onClose={onClose}
      accountId={accountId}
      workbench={false}
      emailEnabled={emailEnabled}
      categories={categories}
      onClosing={relaunchTours}
      focus={focus ?? null}
      initialCategoryId={initialCategoryId ?? null}
      initialSectionId={initialSectionId}
    />
  );
}
