'use client';

import { useCallback, useMemo, useRef } from 'react';
import {
  ownToggleSetter,
  SETTINGS_DIALOG_CLASS,
  SETTINGS_DIALOG_SIZE,
  SettingsPanel,
  SettingsUiKitProvider,
  useSettingsScope,
  type AccountHost,
} from '@liveworkspace/settings-ui';
import { workspaceOriginFor } from '@liveworkspace/sites';
import { Dialog } from '@/components/dialogs/Dialog';
import { useCapabilities } from '@/hooks/persistence/useCapabilities';
import { useAccountBootstrap } from '@/hooks/persistence/useAccountBootstrap';
import { useIsMobileViewport } from '@/hooks/ui/useIsMobileViewport';
import { markTourPending, requestTourRelaunch } from '@/lib/tour-pending';
import { requestWorkshopTourRelaunch } from '@/lib/workshop-tour';
import { requestDrawTourRelaunch } from '@/lib/draw-tour';
import { requestAvatarTourRelaunch } from '@/lib/avatar-tour';
import { track } from '@/lib/telemetry';
import { visibleCategories } from '@/components/dialogs/settings/settings-catalogue';
import { SETTINGS_KIT } from '@/components/dialogs/settings/settings-kit';
import { settingsModel } from '@/components/dialogs/settings/settings-model';
import {
  renderSettingsLogo,
  SETTINGS_APP,
  settingsRequest,
} from '@/components/dialogs/settings/settings-panel-host';
import type { UserPreferences } from '@/lib/user-preferences';
import { isPowerUserMode } from '@/lib/power-user-mode';
import { useDriveMirror } from '@/components/drive/drive-mirror-context';
import type { CloudSyncProviderId } from '@/lib/cloud-sync/providers';
import { useWorkbenchSession } from '@/components/providers/workbench-session-context';

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
  // Email rows need Resend configured AND a signed-in account: a guest has
  // no address, so those switches could never apply (docs/specs/014-identity/transactional-email.md).
  const { emailEnabled } = useCapabilities();
  const { accountUserId, isSignedIn } = useAccountBootstrap();
  const signedIn = Boolean(isSignedIn && accountUserId);
  // A workbench's Settings reach nothing beyond its one document (docs/specs/013-workspace/
  // blueprints/workbench-embeds.md, Surface table).
  const workbench = useWorkbenchSession() !== null;
  // Power-user-only rows appear the moment the mode's own row switches on
  // (docs/specs/007-editor/power-user-mode.md), so this reads the live settings, not a snapshot.
  const powerUserMode = isPowerUserMode(settings);
  // Live settings too: a panel's rows follow its Enable switch the same way.
  // Cloud Sync rows only where the deployment offers the provider
  // (docs/specs/022-drive-mirror/drive-mirror.md, "Connecting").
  const driveMode = useDriveMirror().mode;
  const cloudProviders = useMemo<CloudSyncProviderId[]>(
    () => (driveMode !== 'off' ? ['googleDrive'] : []),
    [driveMode],
  );
  const categories = useMemo(
    () =>
      visibleCategories({
        emailEnabled,
        signedIn,
        powerUserMode,
        preferences: settings,
        cloudProviders,
        workbench,
      }),
    [emailEnabled, signedIn, powerUserMode, settings, cloudProviders, workbench],
  );

  // This editor's catalogue bound to the live preferences, as the shared view's model. Rebuilt
  // only when what it reads changes, so its rows keep their identity (and the view's memo) across a
  // search keystroke.
  const model = useMemo(
    () => settingsModel(categories, settings, onChange),
    [categories, settings, onChange],
  );

  // The header's livediagram / All switch (docs/specs/007-editor/user-preferences.md "This app or All"): All needs an
  // account whose settings liveworkspace keeps, so a guest and a workbench see this app's alone.
  const allowAll = signedIn && !workbench;
  // A targeted open (a search result, the `?settings=` deep link) lands in this app's own settings.
  const [scope, setScope] = useSettingsScope(
    'livediagram:settings-scope:v1',
    focus || initialCategoryId ? 'app' : null,
  );
  // The Account section's switches are this editor's own shared preferences, changed through its own rows (counted
  // and synced as here); the profile is set on liveworkspace.app.
  const account = useMemo<AccountHost>(
    () => ({
      shared: {
        all: settings,
        set: ownToggleSetter(model, (key, value) => onChange({ ...settings, [key]: value })),
      },
      profileHref: `${workspaceOriginFor(window.location.host)}/explorer?settings=profile`,
      emails: emailEnabled,
    }),
    [settings, model, onChange, emailEnabled],
  );

  // Which categories people actually open is the signal for whether this
  // reorganisation helped, and for what belongs on the first screen next.
  const onCategoryOpened = useCallback((id: string) => {
    track('UI', 'Opened', `Settings${id.charAt(0).toUpperCase()}${id.slice(1)}`);
  }, []);

  // Tours › "Diagram Tour" (docs/specs/007-editor/editor-tour.md). The row is ON when the tour has not been
  // resolved, and promises it will be offered, so closing the dialog has to
  // MAKE that true. `tourSeen !== true` alone never was: TourHost also needs
  // the per-tab pending flag, which only /new sets for a brand-new user. A
  // reader who had simply never taken the tour therefore saw the row sitting
  // on, promising a tour that would never arrive.
  //
  // Marking pending is idempotent, so leaving the row alone just re-arms the
  // offer it already claims. Turning it on from off additionally relaunches
  // in place, which is the "run it again" case the row's copy describes.
  const tourSeen = settings.tourSeen === true;
  const tourSeenAtOpen = useRef(tourSeen);
  // Tours › "Workshop Tour" (docs/specs/012-collaboration/workshop-tour.md): no handoff flag to arm, as the
  // tour offers itself on entering Workshop; turning its row on from off reruns it in place.
  const workshopTourSeen = settings.workshopTourSeen === true;
  const workshopTourSeenAtOpen = useRef(workshopTourSeen);
  // Tours › "Draw Tour" (docs/specs/023-draw-mode/draw-tour.md): as the Workshop tour's.
  const drawTourSeen = settings.drawTourSeen === true;
  const drawTourSeenAtOpen = useRef(drawTourSeen);
  // Tours › "Avatar Tour" (docs/specs/008-canvas/avatar-tour.md): as the Workshop tour's.
  const avatarTourSeen = settings.avatarTourSeen === true;
  const avatarTourSeenAtOpen = useRef(avatarTourSeen);
  const close = () => {
    if (!tourSeen) {
      markTourPending();
      if (tourSeenAtOpen.current) requestTourRelaunch();
    }
    if (!workshopTourSeen && workshopTourSeenAtOpen.current) requestWorkshopTourRelaunch();
    if (!drawTourSeen && drawTourSeenAtOpen.current) requestDrawTourRelaunch();
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
          memoryKey="livediagram:settings-view:v1"
          onCategoryOpened={onCategoryOpened}
          footer={
            <p className="text-[10px] text-slate-500 dark:text-slate-400">
              {/* A guest has no account to sync to: their settings follow them in this browser only. */}
              {signedIn
                ? 'Settings sync to your account and apply to every document you open, on every device you sign in from.'
                : 'Settings are kept in this browser and apply to every document you open. Sign in to have them on your other devices too.'}
            </p>
          }
        />
      </SettingsUiKitProvider>
    </Dialog>
  );
}
