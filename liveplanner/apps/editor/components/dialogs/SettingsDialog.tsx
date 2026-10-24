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
import { PLAN_TOUR_TRACKS, planTrackSeen, requestPlanTourRelaunch } from '@/lib/plan-tour';
import { requestFormTourRelaunch } from '@/lib/form-tour';
import { track } from '@/lib/telemetry';
import { visibleCategories } from '@/components/dialogs/settings/settings-catalogue';
import { SETTINGS_KIT } from '@/components/dialogs/settings/settings-kit';
import { settingsModel } from '@/components/dialogs/settings/settings-model';
import {
  renderSettingsLogo,
  SETTINGS_APP,
  settingsRequest,
} from '@/components/dialogs/settings/settings-panel-host';
import { preferencesKeptLocally } from '@/lib/preferences-sync';
import type { UserPreferences } from '@/lib/user-preferences';
import { isPowerUserMode } from '@/lib/power-user-mode';
import { signInEnabled } from '@/lib/auth-config';
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
  // Section of that category to scroll to and focus (settingsSectionId).
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
  // A workbench's Settings reach nothing beyond its one project (docs/specs/013-workspace/
  // blueprints/workbench-embeds.md, Surface table).
  const workbench = useWorkbenchSession() !== null;
  // Power-user-only rows appear the moment the mode's own row switches on
  // (docs/specs/007-editor/power-user-mode.md), so this reads the live settings, not a snapshot.
  const powerUserMode = isPowerUserMode(settings);
  // Live settings too: a panel's rows follow its Enable switch the same way.
  const categories = useMemo(
    () =>
      visibleCategories({
        emailEnabled,
        signedIn,
        authEnabled: signInEnabled,
        powerUserMode,
        preferences: settings,
        workbench,
      }),
    [emailEnabled, signedIn, powerUserMode, settings, workbench],
  );

  // This editor's catalogue bound to the live preferences, as the shared view's model. Rebuilt
  // only when what it reads changes, so its rows keep their identity (and the view's memo) across a
  // search keystroke.
  const model = useMemo(
    () => settingsModel(categories, settings, onChange),
    [categories, settings, onChange],
  );

  // The header's liveplanner / All switch (docs/specs/007-editor/user-preferences.md "This app or All"): All needs an
  // account whose settings liveworkspace keeps, so a guest, a workbench and a self-hosted editor see this app's alone.
  const allowAll = signedIn && !workbench && !preferencesKeptLocally();
  // A targeted open (a search result, the `?settings=` deep link) lands in this app's own settings.
  const [scope, setScope] = useSettingsScope(
    'liveplanner:settings-scope:v1',
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

  // Tours › "Boards Tour" and "Sheets Tour" (docs/specs/026-plan/plan-tour.md): no handoff flag to arm, as the
  // Plan tour offers itself on entering Plan; turning a track's row on from off reruns it in place.
  const planOwed = PLAN_TOUR_TRACKS.filter((t) => !planTrackSeen(settings, t));
  const planOwedAtOpen = useRef(planOwed);
  // Tours › "Forms Tour" (docs/specs/030-forms/forms.md "The Forms tour"): as the Plan tour's.
  const formTourSeen = settings.formTourSeen === true;
  const formTourSeenAtOpen = useRef(formTourSeen);
  const close = () => {
    if (planOwed.some((t) => !planOwedAtOpen.current.includes(t))) requestPlanTourRelaunch();
    if (!formTourSeen && formTourSeenAtOpen.current) requestFormTourRelaunch();
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
          memoryKey="liveplanner:settings-view:v1"
          onCategoryOpened={onCategoryOpened}
          footer={
            <p className="text-[10px] text-slate-500 dark:text-slate-400">
              {/* A guest has no account to sync to: their settings follow them in this browser only. */}
              {signedIn
                ? 'Settings sync to your account and apply to every plan you open, on every device you sign in from.'
                : 'Settings are kept in this browser and apply to every plan you open. Sign in to have them on your other devices too.'}
            </p>
          }
        />
      </SettingsUiKitProvider>
    </Dialog>
  );
}
