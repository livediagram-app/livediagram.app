'use client';

// Webhooks and History in the footer's Tools (liveworkspace/docs/specs/004-index/footer-tools-menu.md), for the item
// the editor has open: published through the Tools door by each editor's ItemToolsHost, which is mounted with the
// editor (not with the Explorer panel, which mounts only once opened). Nothing is read until History is pressed.
// Returns the dialog to render while one is open; opened from Tools, it draws inside Tools (footer-tools-menu.md
// "Opening a tool inside Tools"). Both rows always show where signing in or syncing would make them work
// (footer-tools-menu.md "Always there"), badged Sign In and Sync <Item>, and a press opens that gate first: Sign In
// leaves for the sign-in page; Sync <Item> saves the item to the server and goes on to the tool.
import { useDeferredAuth } from '../providers/deferred-auth';
import { useSavedLook } from './AuthControls';
import { accountAvatarFill, accountInitials } from '../../lib/account-avatar';
import { explorerAccounts } from '../../lib/explorer-accounts';
import { useEffect, useMemo, useRef, useState, type ComponentType, type ReactNode } from 'react';
import {
  ButtonContent,
  DialogCloseButton,
  DialogHeader,
  Glyph,
  buttonClassName,
  holdDialogSlot,
  leaveToolsWithDialog,
  useDialogDismiss,
} from '@liveworkspace/ui';
import { Dialog } from '../dialogs/Dialog';
import { DialogFooter } from '../dialogs/DialogFooter';
import { APP_ITEMS, type AppName } from '@liveworkspace/sites';
import { toolGateCopy } from '../../lib/tool-gate-copy';
import { useAuthHrefs } from './auth-routes';
import { ItemHistoryDialog, useOpenItem, type HistoryExtras } from '@liveworkspace/explorer';
import type { IndexClient } from '@liveworkspace/index-client';
import { lucideGlyph } from '@liveworkspace/ui';
import { lucideHistory, lucideWebhook } from '@liveworkspace/icons/lucide';
import type { ChromeToolsItem } from './ChromeToolsMenu';
import {
  requestToolsView,
  useItemVersions,
  usePublishToolGate,
  usePublishToolsItems,
  type ToolGate,
} from './tools-door';

const WebhookIcon = lucideGlyph(lucideWebhook, 16);
const HistoryIcon = lucideGlyph(lucideHistory, 16);

type Teams = Parameters<typeof ItemHistoryDialog>[0]['teams'];

// What History needs to show the open item's past, read only once History is pressed: the item (from the index), the
// person and their teams. The app hands its own `useTeams` (a module function, so the hook order holds).
export type ItemHistoryHost = {
  app: Parameters<typeof ItemHistoryDialog>[0]['app'];
  client: IndexClient;
  itemHref: Parameters<typeof ItemHistoryDialog>[0]['itemHref'];
  viewerId: string | null;
  itemId: string;
  shareCode: string | null;
  sharePassword: () => string | null;
  useTeams: (signedIn: boolean) => Teams;
};

// Each gated tool's name; what its gate says is the shared plain copy (toolGateCopy).
const SIGN_IN = {
  history: { title: 'History' },
  webhooks: { title: 'Webhooks' },
  walkthroughs: { title: 'Walkthroughs' },
} as const;
type SignInFor = keyof typeof SIGN_IN;

// An item kept Offline: how to save it to the server (the editor's Sync move), and whether the reader is known yet.
export type ItemToolsOffline = { sync: () => Promise<void>; ready: boolean };

// Snapshots inside History (owner, 2026-11-17): the hook the timeline calls for its Take Snapshot and pinned entries,
// and Snapshots on their own for someone with no timeline to read. The app hands `useHistorySnapshotsHost()` from
// @liveworkspace/snapshots/ui (null without its door), so this package never imports that one.
export type ItemSnapshotsHost = {
  useExtras: () => HistoryExtras;
  Alone: ComponentType<{ onClose: () => void; after?: ReactNode }>;
};

// What the History row opens, from what this person may use: the timeline (with Snapshots in it), Snapshots alone,
// the sign-in or sync gate, or livedocuments' Version History window alone (closing Tools, as it always has).
type HistoryMode = 'timeline' | 'snapshots' | 'gate' | 'versions' | null;

export function historyMode(input: {
  timeline: boolean;
  snapshots: boolean;
  gated: boolean;
  versions: boolean;
}): HistoryMode {
  if (input.timeline) return 'timeline';
  if (input.snapshots) return 'snapshots';
  if (input.gated) return 'gate';
  return input.versions ? 'versions' : null;
}

export function useItemToolsRows({
  app,
  onWebhooks,
  history,
  signedIn,
  offline = null,
  snapshots = null,
}: {
  // The app, whose word for its item the sign-in dialogs use ("this canvas", "this plan").
  app: AppName;
  // Present only for someone who may manage the open item's webhooks.
  onWebhooks?: () => void;
  // The open item's History; null where it is not offered (no item open, or one opened by a share link).
  history: ItemHistoryHost | null;
  // Whether someone is signed in; until they are, both rows show and ask for a sign-in.
  signedIn: boolean;
  // Set while the open item lives Offline: both rows show, badged Sync <Item>, and ask for a sync.
  offline?: ItemToolsOffline | null;
  // Snapshots, for someone who may take them (useHistorySnapshotsHost); null otherwise.
  snapshots?: ItemSnapshotsHost | null;
}): ReactNode {
  const [historyOpen, setHistoryOpen] = useState(false);
  const [gate, setGate] = useState<SignInFor | null>(null);
  // A tool asked for through Sync, opened once the synced item gives it its host.
  const [pending, setPending] = useState<SignInFor | null>(null);
  // livedocuments' Version History, published by its footer (usePublishItemVersions).
  const versions = useItemVersions();
  const guest = !signedIn;
  const noun = APP_ITEMS[app].noun;
  const badges = useMemo(
    () => [...(guest ? ['Sign In'] : []), ...(offline ? [`Sync ${noun}`] : [])],
    [guest, offline, noun],
  );
  const gated = guest || !!offline;
  // The gate, for tools published elsewhere (Walkthroughs): badged the same, and a press opens this gate for them.
  const toolGate = useMemo<ToolGate | null>(
    () => (gated ? { badges, open: (tool) => setGate(tool) } : null),
    [gated, badges],
  );
  usePublishToolGate(toolGate);
  const mode = historyMode({
    timeline: !!history && !gated,
    snapshots: !!snapshots,
    gated,
    versions: !!versions,
  });
  const showWebhooks = guest || !!offline || !!onWebhooks;
  // Synced, the tool asked for opens as soon as the synced item gives it its host: History here, as it renders;
  // Webhooks (the app's own dialog) from an effect, once per ask.
  const [webhooksDue, setWebhooksDue] = useState(0);
  if (pending && !offline) {
    if (pending === 'history' && history) {
      setPending(null);
      setHistoryOpen(true);
    } else if (pending === 'webhooks' && onWebhooks) {
      setPending(null);
      setWebhooksDue((n) => n + 1);
    }
  }
  const webhooksOpened = useRef(0);
  useEffect(() => {
    if (webhooksDue <= webhooksOpened.current || !onWebhooks) return;
    webhooksOpened.current = webhooksDue;
    onWebhooks();
  }, [webhooksDue, onWebhooks]);
  const rows = useMemo<ChromeToolsItem[]>(
    () => [
      ...(mode
        ? [
            {
              id: 'item-history',
              group: 'versions' as const,
              label: 'History',
              description:
                mode === 'snapshots' || (mode === 'timeline' && snapshots)
                  ? 'Snapshots, and who changed what.'
                  : 'Who changed what, and when.',
              icon: <HistoryIcon />,
              inPlace: mode !== 'versions',
              ...(mode === 'gate' ? { badges } : {}),
              onSelect: () =>
                mode === 'gate'
                  ? setGate('history')
                  : mode === 'versions'
                    ? versions?.()
                    : setHistoryOpen(true),
            },
          ]
        : []),
      ...(showWebhooks
        ? [
            {
              id: 'webhooks',
              group: 'automate' as const,
              label: 'Webhooks',
              description: 'Tell other services when it changes.',
              icon: <WebhookIcon />,
              inPlace: true,
              ...(gated ? { badges } : {}),
              onSelect: () => (gated ? setGate('webhooks') : onWebhooks?.()),
            },
          ]
        : []),
    ],
    [mode, showWebhooks, gated, badges, onWebhooks, versions, snapshots],
  );
  usePublishToolsItems('item', rows);
  const versionsLink = (close: () => void) =>
    versions ? <VersionsLink open={versions} onLeave={close} /> : null;
  if (gate && gated && (gate !== 'history' || mode === 'gate'))
    return (
      <SignInDialog
        for={gate}
        noun={noun}
        sync={guest ? null : offline}
        after={gate === 'history' ? versionsLink(() => setGate(null)) : null}
        onSynced={() => {
          // Walkthroughs' own row arrives once the synced item lets it record: Tools opens at it then (FM7).
          if (gate === 'walkthroughs') requestToolsView('walkthroughs');
          else setPending(gate);
          setGate(null);
        }}
        onClose={() => setGate(null)}
      />
    );
  if (!historyOpen) return null;
  const close = () => setHistoryOpen(false);
  if (mode === 'timeline' && history)
    return snapshots ? (
      <OpenItemHistoryWithSnapshots
        host={history}
        snapshots={snapshots}
        versionsLink={versionsLink(close)}
        onClose={close}
      />
    ) : (
      <OpenItemHistory host={history} top={versionsLink(close)} onClose={close} />
    );
  if (mode === 'snapshots' && snapshots) {
    const after =
      guest || versions ? (
        <div className="flex flex-col gap-2">
          {guest ? <AccountLine noun={noun} /> : null}
          {versionsLink(close)}
        </div>
      ) : null;
    return <snapshots.Alone onClose={close} after={after} />;
  }
  return null;
}

// The timeline with Snapshots in it: Take Snapshot over it, each snapshot pinned on the rail at its time.
function OpenItemHistoryWithSnapshots({
  host,
  snapshots,
  versionsLink,
  onClose,
}: {
  host: ItemHistoryHost;
  snapshots: ItemSnapshotsHost;
  versionsLink: ReactNode;
  onClose: () => void;
}) {
  const extras = snapshots.useExtras();
  const top =
    extras.top || versionsLink ? (
      <div className="flex flex-col gap-2">
        {extras.top}
        {versionsLink}
      </div>
    ) : undefined;
  return (
    <OpenItemHistory
      host={host}
      top={top}
      action={extras.action}
      pins={extras.pins}
      onClose={onClose}
    />
  );
}

// The History dialog for the open item, its reads made as it opens.
function OpenItemHistory({
  host,
  top,
  action,
  pins,
  onClose,
}: {
  host: ItemHistoryHost;
  top?: ReactNode;
  // Snapshots' Snapshot button, at History's foot.
  action?: ReactNode;
  pins?: HistoryExtras['pins'];
  onClose: () => void;
}) {
  const item = useOpenItem(host.client, host.itemId, host.shareCode, host.sharePassword);
  const teams = host.useTeams(true);
  // Your own face as your account menu draws it (owner, 2026-11-17: History showed a blank person for you).
  const { user } = useDeferredAuth();
  const saved = useSavedLook();
  const viewerLook = useMemo(
    () =>
      user
        ? {
            fill: accountAvatarFill(user, saved),
            initials: accountInitials(user),
            picture: user.picture ?? null,
          }
        : null,
    [user, saved],
  );
  const extras = useMemo<HistoryExtras>(
    () => ({ top, action, pins: pins ?? [] }),
    [top, action, pins],
  );
  if (!item || item.sharedVia) return null;
  return (
    <ItemHistoryDialog
      app={host.app}
      client={host.client}
      itemHref={host.itemHref}
      viewerId={host.viewerId}
      teams={teams}
      item={item}
      extras={extras}
      accounts={explorerAccounts}
      viewerLook={viewerLook}
      onClose={onClose}
    />
  );
}

// livedocuments' Version History from inside History: the window given over to one tab's versions, so History
// closes, and Tools with it, as it opens.
function VersionsLink({ open, onLeave }: { open: () => void; onLeave: () => void }) {
  const dismiss = useDialogDismiss();
  return (
    <button
      type="button"
      data-history-versions=""
      onClick={() => {
        leaveToolsWithDialog();
        dismiss(() => {
          onLeave();
          open();
        });
      }}
      className={buttonClassName({ variant: 'secondary', size: 'sm', className: 'self-start' })}
    >
      <ButtonContent>Open Version History</ButtonContent>
    </button>
  );
}

// Signed out with only Snapshots to show: the rest of History is a sign-in away.
function AccountLine({ noun }: { noun: string }) {
  const { signInHref } = useAuthHrefs();
  return (
    <p data-history-account="" className="text-xs text-slate-600 dark:text-slate-300">
      <a
        href={signInHref}
        className="font-semibold text-brand-700 underline-offset-2 hover:underline dark:text-brand-300"
      >
        Sign In
      </a>{' '}
      to see who changed this {noun.toLowerCase()}, and when.
    </p>
  );
}

// A gated press on History or Webhooks, drawn as Automations' gate is (liveplanner SyncGateDialog with
// SyncProjectPrompt): the tool's name over why it is held, a ringed disc, why it needs that, the move (Sign In, back to
// this page; or Sync <Item>, which goes on to the tool), and Cancel in the footer. Signed out comes first.
function SignInDialog({
  for: tool,
  noun,
  sync,
  after = null,
  onSynced,
  onClose,
}: {
  for: SignInFor;
  noun: string;
  // Under the prompt: what works without it (Version History).
  after?: ReactNode;
  // Set when the item needs syncing (and the person is signed in): the gate syncs instead of signing in.
  sync: ItemToolsOffline | null;
  onSynced: () => void;
  onClose: () => void;
}) {
  const { signInHref } = useAuthHrefs();
  const copy = SIGN_IN[tool];
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const word = noun.toLowerCase();
  const said = toolGateCopy(sync ? 'sync' : 'sign_in', copy.title, noun);
  const doSync = async () => {
    if (!sync) return;
    setBusy(true);
    setFailed(false);
    // Inside Tools, the tool opens in the gate's place there once the item is synced (holdDialogSlot).
    const undo = holdDialogSlot();
    try {
      await sync.sync();
      onSynced();
    } catch {
      undo();
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open onClose={onClose} ariaLabel={copy.title} size="md">
      <DialogHeader title={copy.title}>
        <DialogCloseButton onClick={onClose} />
      </DialogHeader>
      <div
        data-tools-sign-in={tool}
        className="flex flex-col items-center gap-4 px-6 py-7 text-center"
      >
        <span
          data-prompt-glyph={sync ? 'cloud' : 'person'}
          className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-700 ring-1 ring-brand-200 dark:bg-brand-500/10 dark:text-brand-300 dark:ring-brand-500/30"
        >
          <Glyph size={24} units={24}>
            {sync ? (
              <>
                <path d="M4 14.9A7 7 0 1 1 15.7 8h1.8a4.5 4.5 0 0 1 2.5 8.2" />
                <path d="M12 12v9" />
                <path d="m16 16-4-4-4 4" />
              </>
            ) : (
              <>
                <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </>
            )}
          </Glyph>
        </span>
        <div className="flex flex-col gap-1.5">
          <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{said.title}</p>
          <p className="mx-auto max-w-sm text-balance text-xs leading-relaxed text-slate-500 dark:text-slate-400">
            {said.body}
          </p>
          {failed ? (
            <p role="alert" className="text-xs text-red-600 dark:text-red-400">
              {`Couldn't sync this ${word}. Try again.`}
            </p>
          ) : null}
        </div>
        {sync ? (
          <button
            type="button"
            onClick={() => void doSync()}
            disabled={busy || !sync.ready}
            className={buttonClassName({
              variant: 'primary',
              size: 'sm',
              className: 'mt-1 shadow-sm',
            })}
          >
            <ButtonContent>{busy ? 'Syncing…' : `Sync ${noun}`}</ButtonContent>
          </button>
        ) : (
          <a
            href={signInHref}
            className={buttonClassName({
              variant: 'primary',
              size: 'sm',
              className: 'mt-1 shadow-sm',
            })}
          >
            <ButtonContent>Sign In</ButtonContent>
          </a>
        )}
        {after ? <div className="mt-1 flex justify-center">{after}</div> : null}
      </div>
      <DialogFooter>
        <button
          type="button"
          onClick={onClose}
          className={buttonClassName({ variant: 'secondary', size: 'xs' })}
        >
          <ButtonContent>Cancel</ButtonContent>
        </button>
      </DialogFooter>
    </Dialog>
  );
}
