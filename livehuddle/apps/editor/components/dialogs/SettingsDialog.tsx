'use client';

import { useCallback, useMemo, useRef } from 'react';
import {
  ownToggleSetter,
  requestProfileHost,
  SETTINGS_DIALOG_CLASS,
  SETTINGS_DIALOG_SIZE,
  SettingsPanel,
  SettingsUiKitProvider,
  useCloudSync,
  useSettingsScope,
  type AccountHost,
} from '@liveworkspace/settings-ui';
import { Dialog } from '@liveworkspace/workbench/components/dialogs/Dialog';
import { useCursorsDrawn } from '@liveworkspace/workbench/hooks/collab/useHideCursors';
import { useCapabilities } from '@/hooks/persistence/useCapabilities';
import { useDeferredAuth } from '@liveworkspace/workbench/components/providers/deferred-auth';
import { useAccountBootstrap } from '@/hooks/persistence/useAccountBootstrap';
import { useIsMobileViewport } from '@liveworkspace/workbench/hooks/ui/useIsMobileViewport';
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
  // Section of that category to scroll to and focus (settingsSectionId): the
  // Drive connect flow returns to Account > Cloud Sync.
  initialSectionId?: string | null;
};

// The Settings dialog (docs/specs/007-editor/user-preferences.md), shaped like the iOS Settings app because it
// had outgrown a single scrolling accordion: six groups of long paragraphs
// stacked on one screen, where finding a setting meant opening groups until
// one of them held it.
//
// It takes BOTH of that app's shapes, on the viewport each belongs to: a phone's root list that
// pushes a pane, and the desktop's rail beside the pane. The view is shared with every liveworkspace
// app and liveworkspace.app (@liveworkspace/settings-ui, "One Settings view for every app"); this
// frames it, binds this editor's catalogue to it (settings-model.tsx) and relaunches tours on close.
export function SettingsDialog({
  settings,
  onChange,
  onClose,
  focus,
  initialCategoryId,
  initialSectionId = null,
}: SettingsDialogProps) {
  const isMobile = useIsMobileViewport();
  // Email rows need email configured (the api's EMAIL binding) AND a signed-in account: a guest has
  // no address, so those switches could never apply (docs/specs/014-identity/transactional-email.md).
  const { emailEnabled } = useCapabilities();
  const { accountUserId, isSignedIn } = useAccountBootstrap();
  const signedIn = Boolean(isSignedIn && accountUserId);
  const { user } = useDeferredAuth();
  // Live settings, not a snapshot: a panel's rows follow its Enable switch the moment it flips.
  // The Hide Participant Cursors row only where the tab draws cursors (collaborator-enhancements.md).
  const cursorsDrawn = useCursorsDrawn();
  const categories = useMemo(
    () =>
      visibleCategories({
        emailEnabled,
        signedIn,
        preferences: settings,
        cursorsDrawn,
      }),
    [emailEnabled, signedIn, settings, cursorsDrawn],
  );

  // The header's livehuddle / All switch (docs/specs/007-editor/user-preferences.md "This app or All"): All needs an
  // account whose settings liveworkspace keeps, so a guest sees this app's alone.
  const allowAll = signedIn;
  // This editor's catalogue bound to the live preferences, as the shared view's model. Rebuilt
  // only when what it reads changes, so its rows keep their identity (and the view's memo) across a
  // search keystroke. Reset All Settings reaches the account's settings in every app where All does; else this
  // browser's alone.
  const model = useMemo(
    () =>
      settingsModel(categories, settings, onChange, {
        accountRequest: allowAll ? settingsRequest : null,
      }),
    [categories, settings, onChange, allowAll],
  );
  // A targeted open (a search result, the `?settings=` deep link) lands in this app's own settings.
  const [scope, setScope] = useSettingsScope();
  // The Account section's switches are this editor's own shared preferences, changed through its own rows (counted
  // and synced as here). The profile's Name and Colour is edited in place, over the same door as All's settings
  // (`/api/workspace/account/profile` with the person's token); a save is told to the page (onProfileSaved), so this
  // editor's own presence follows it at once. Only where All is offered: a guest and a self-hosted
  // editor have no liveworkspace account to set it on.
  const identityName = signedIn && user ? (user.fullName ?? user.username ?? user.email ?? '') : '';
  const profile = useMemo(
    () =>
      allowAll ? requestProfileHost(settingsRequest, { accountName: identityName }) : undefined,
    [allowAll, identityName],
  );
  // Cloud Sync (liveworkspace/docs/specs/005-drive/drive.md "Connecting"), only where All is offered: an account's.
  const cloudSyncFor = useMemo(() => (allowAll ? cloudSyncHost() : null), [allowAll]);
  const cloudSync = useCloudSync(cloudSyncFor);
  const account = useMemo<AccountHost>(
    () => ({
      shared: {
        all: settings,
        set: ownToggleSetter(model, (key, value) => onChange({ ...settings, [key]: value })),
      },
      // The Profile's header card: who is signed in, as this editor's session has them.
      identity:
        signedIn && user
          ? {
              name: user.fullName ?? user.username ?? user.email ?? 'Your account',
              email: user.email,
              joined: user.createdAt,
            }
          : null,
      ...(profile ? { profile } : {}),
      // Sign-in and devices, the API tokens and Download Your Data, in place for an account; a guest, a
      // workbench and a self-hosted editor have none. Phone notifications stay this editor's own (none here).
      ...(allowAll ? ACCOUNT_SETTINGS : {}),
      phone: null,
      emails: emailEnabled,
      cloudSync,
    }),
    [settings, model, onChange, emailEnabled, signedIn, user, profile, cloudSync, allowAll],
  );

  // Which categories people actually open is the signal for whether this
  // reorganisation helped, and for what belongs on the first screen next.
  const onCategoryOpened = useCallback((id: string) => {
    track('UI', 'Opened', `Settings${id.charAt(0).toUpperCase()}${id.slice(1)}`);
  }, []);

  // Tours › "Avatar Tour" (docs/specs/008-canvas/avatar-tour.md): turning its row on from off and closing reruns the
  // tour in place, as the footer's Start Tour button does.
  const avatarTourSeen = settings.avatarTourSeen === true;
  const avatarTourSeenAtOpen = useRef(avatarTourSeen);
  const close = () => {
    if (!avatarTourSeen && avatarTourSeenAtOpen.current) requestAvatarTourRelaunch();
    onClose();
  };

  return (
    <Dialog
      open
      onClose={close}
      ariaLabel="Settings"
      // Wide enough for the rail plus a readable pane, and for All's app headings (60rem). Below `sm:` the Dialog
      // goes edge-to-edge for every size at or above `md`, which is exactly what the phone layout wants.
      size={SETTINGS_DIALOG_SIZE}
      // The existing see-through backdrop rather than the default dim+blur:
      // Settings is where you flip things whose effect is ON the canvas
      // behind it (panel opacity, UI scale, the minimap), so blurring that
      // canvas out hides the very thing you are adjusting.
      backdrop="desktop-light"
      // One fixed height on desktop, not a cap: sized to content, the frame
      // jumped between categories as the reader moved down the rail. The pane
      // scrolls inside. The phone layout still fills its screen, which is what
      // a pushed pane wants.
      className={SETTINGS_DIALOG_CLASS}
    >
      <SettingsUiKitProvider kit={SETTINGS_KIT}>
        <SettingsPanel
          app={SETTINGS_APP}
          own={model}
          allowAll={allowAll}
          scope={scope}
          onScopeChange={setScope}
          store={settingsRequest}
          account={account}
          renderLogo={renderSettingsLogo}
          isMobile={isMobile}
          onClose={close}
          focus={focus ?? null}
          initialCategoryId={initialCategoryId ?? null}
          initialSectionId={initialSectionId}
          memoryKey="livehuddle:settings-view:v1"
          onCategoryOpened={onCategoryOpened}
          footer={
            <p className="text-[10px] text-slate-500 dark:text-slate-400">
              {/* A guest has no account to sync to: their settings follow them in this browser only. */}
              {signedIn
                ? 'Settings sync to your account and apply to every space you open, on every device you sign in from.'
                : 'Settings are kept in this browser and apply to every space you open. Sign in to have them on your other devices too.'}
            </p>
          }
        />
      </SettingsUiKitProvider>
    </Dialog>
  );
}
