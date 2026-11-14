'use client';

import { useCallback, useMemo, useRef, useSyncExternalStore, type ReactNode } from 'react';
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
  type AccountSection,
  type CloudSyncHost,
  type SettingsAppId,
  type SettingsCategory,
  type SettingsFocus,
  type SettingsPanelApp,
  type SettingsRequest,
  type SettingsUiKit,
} from '@liveworkspace/settings-ui';
import { Dialog } from './Dialog';
import { useDeferredAuth } from '../providers/deferred-auth';
import { useIsMobileViewport } from '../../hooks/ui/useIsMobileViewport';
import {
  preferencesKeptLocally,
  subscribePreferencesKeptLocally,
} from '../../lib/preferences-local-only';

/** What an editor binds once, at module scope, for its Settings: which app it is and its pieces of the shared panel. */
export type EditorSettingsBinding<C, P> = {
  app: SettingsPanelApp;
  kit: SettingsUiKit;
  // The bearer request to liveworkspace's account API through this app's router.
  request: SettingsRequest;
  // Sign-in and devices, the API tokens and Download Your Data, for an account.
  accountPanels: Pick<AccountSection, 'security' | 'renderTokens' | 'renderDataExport'>;
  cloudSyncHost: () => CloudSyncHost;
  renderLogo: (id: SettingsAppId | 'all') => ReactNode;
  // This editor's catalogue bound to the live preferences (its settings-model.tsx).
  model: (
    categories: C,
    settings: P,
    onChange: (next: P) => void,
    options: { accountRequest: SettingsRequest | null },
  ) => readonly SettingsCategory[];
  // The view's memory for this app's side (`<app>:settings-view:v1`).
  memoryKey: string;
  // What one of its items is called, for the footer: "canvas", "document", "plan", "design", "space".
  noun: string;
  onCategoryOpened: (categoryId: string) => void;
};

/** Whether the header's This app / All switch offers All (each editor's docs/specs/007-editor/user-preferences.md
 *  "This app or All"): one rule for every editor. All needs an account whose settings liveworkspace keeps, so a guest,
 *  a workbench (whose Settings reach only its one item) and an account whose preferences stay in this browser (the
 *  api keeps none, as without liveworkspace accounts) see this app's alone. */
export function settingsAllowAll(
  signedIn: boolean,
  workbench: boolean,
  keptLocally: boolean,
): boolean {
  return signedIn && !workbench && !keptLocally;
}

type EditorSettingsDialogProps<C, P> = {
  binding: EditorSettingsBinding<C, P>;
  settings: P;
  onChange: (next: P) => void;
  onClose: () => void;
  // The signed-in account's id; null for a guest.
  accountId: string | null;
  // Inside a workbench embed (docs/specs/013-workspace/blueprints/workbench-embeds.md, Surface table).
  workbench: boolean;
  // Email rows need email configured AND an account (docs/specs/014-identity/transactional-email.md).
  emailEnabled: boolean;
  // This editor's visible categories, worked out from its own inputs (settings-catalogue.ts visibleCategories).
  categories: C;
  // Called as the dialog closes with the preferences it opened on and the ones it closes on: an editor reruns the
  // tours whose rows were turned on from off (Watch It Built, the Pages, Plan and Forms tours, the Receptionist).
  onClosing?: (opened: P, now: P) => void;
  // Where to land: a search result's category and row, the `?settings=` deep link's category, and its section.
  focus?: SettingsFocus | null;
  initialCategoryId?: string | null;
  initialSectionId?: string | null;
};

// The Settings dialog every editor opens (docs/specs/007-editor/user-preferences.md), shaped like the iOS Settings
// app: on a phone a root list that pushes a pane, on a desktop the rail beside the pane. The view is
// @liveworkspace/settings-ui's SettingsPanel, shared with liveworkspace.app; this frames it, binds the editor's
// catalogue, works out This app / All once for every editor (settingsAllowAll) and hands the Account section its
// pieces. The editor's door at components/dialogs/SettingsDialog.tsx passes only what is its own.
export function EditorSettingsDialog<C, P extends object>({
  binding,
  settings,
  onChange,
  onClose,
  accountId,
  workbench,
  emailEnabled,
  categories,
  onClosing,
  focus = null,
  initialCategoryId = null,
  initialSectionId = null,
}: EditorSettingsDialogProps<C, P>) {
  const isMobile = useIsMobileViewport();
  const signedIn = accountId !== null;
  const { user } = useDeferredAuth();
  // Followed as the api answers: an open Settings drops All the moment it says it keeps none.
  const readKept = () => preferencesKeptLocally(accountId);
  const keptLocally = useSyncExternalStore(subscribePreferencesKeptLocally, readKept, readKept);
  const allowAll = settingsAllowAll(signedIn, workbench, keptLocally);
  const { model: buildModel, request } = binding;
  // Rebuilt only when what it reads changes, so its rows keep their identity (and the view's memo) across a search
  // keystroke. Reset All Settings reaches the account's settings in every app where All does; else this browser's.
  const model = useMemo(
    () => buildModel(categories, settings, onChange, { accountRequest: allowAll ? request : null }),
    [buildModel, categories, settings, onChange, allowAll, request],
  );
  // A targeted open (a search result, the `?settings=` deep link) lands in this app's own settings.
  const [scope, setScope] = useSettingsScope();
  // The profile's Name and Colour, edited in place over the same door as All's settings, only where All is offered:
  // a guest, a workbench and an editor without liveworkspace accounts have no account to set it on.
  const identityName = signedIn && user ? (user.fullName ?? user.username ?? user.email ?? '') : '';
  const profile = useMemo(
    () => (allowAll ? requestProfileHost(request, { accountName: identityName }) : undefined),
    [allowAll, request, identityName],
  );
  // Cloud Sync (liveworkspace/docs/specs/005-drive/drive.md "Connecting"), only where All is offered.
  const { cloudSyncHost, accountPanels } = binding;
  const cloudSyncFor = useMemo(
    () => (allowAll ? cloudSyncHost() : null),
    [allowAll, cloudSyncHost],
  );
  const cloudSync = useCloudSync(cloudSyncFor);
  const account = useMemo<AccountHost>(
    () => ({
      // The Account section's switches are this editor's own shared preferences, changed through its own rows
      // (counted and synced as there).
      shared: {
        all: settings as Record<string, unknown>,
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
      ...(allowAll ? accountPanels : {}),
      // Phone notifications stay each editor's own (none here).
      phone: null,
      emails: emailEnabled,
      cloudSync,
    }),
    [
      settings,
      model,
      onChange,
      emailEnabled,
      signedIn,
      user,
      profile,
      cloudSync,
      allowAll,
      accountPanels,
    ],
  );

  // The tours an editor reruns compare the preferences Settings opened on with the ones it closes on.
  const openedOn = useRef(settings);
  const close = useCallback(() => {
    onClosing?.(openedOn.current, settings);
    onClose();
  }, [onClosing, settings, onClose]);

  return (
    <Dialog
      open
      onClose={close}
      ariaLabel="Settings"
      // Wide enough for the rail plus a readable pane, and for All's app headings (60rem). Below `sm:` the Dialog
      // goes edge-to-edge, which is what the phone layout wants.
      size={SETTINGS_DIALOG_SIZE}
      // The see-through backdrop rather than the default dim and blur: Settings changes things whose effect is on
      // the canvas behind it (panel opacity, UI scale), so blurring the canvas hides what is being adjusted.
      backdrop="desktop-light"
      // One fixed height on desktop, not a cap, so the frame never jumps between categories; the pane scrolls inside.
      className={SETTINGS_DIALOG_CLASS}
    >
      <SettingsUiKitProvider kit={binding.kit}>
        <SettingsPanel
          app={binding.app}
          own={model}
          allowAll={allowAll}
          scope={scope}
          onScopeChange={setScope}
          store={request}
          account={account}
          renderLogo={binding.renderLogo}
          isMobile={isMobile}
          onClose={close}
          focus={focus}
          initialCategoryId={initialCategoryId}
          initialSectionId={initialSectionId}
          memoryKey={binding.memoryKey}
          onCategoryOpened={binding.onCategoryOpened}
          footer={
            <p className="text-[10px] text-slate-500 dark:text-slate-400">
              {/* A guest has no account to sync to, and an account whose preferences the api keeps none of has nothing
                  to sync them with: either way they stay in this browser only. */}
              {!signedIn
                ? `Settings are kept in this browser and apply to every ${binding.noun} you open. Sign in to have them on your other devices too.`
                : keptLocally
                  ? `Settings are kept in this browser and apply to every ${binding.noun} you open here.`
                  : `Settings sync to your account and apply to every ${binding.noun} you open, on every device you sign in from.`}
            </p>
          }
        />
      </SettingsUiKitProvider>
    </Dialog>
  );
}
