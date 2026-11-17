'use client';

// Webhooks and History in the footer's Tools (liveworkspace/docs/specs/004-index/footer-tools-menu.md), for the item
// the editor has open: published through the Tools door by each editor's ItemToolsHost, which is mounted with the
// editor (not with the Explorer panel, which mounts only once opened). Nothing is read until History is pressed.
// Returns the dialog to render while one is open; opened from Tools, it draws inside Tools (footer-tools-menu.md
// "Opening a tool inside Tools"). Both rows always show where signing in or syncing would make them work
// (footer-tools-menu.md "Always there"), badged Sign In and Sync <Item>, and a press opens that gate first: Sign In
// leaves for the sign-in page; Sync <Item> saves the item to the server and goes on to the tool.
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  ButtonContent,
  DialogCloseButton,
  DialogHeader,
  Glyph,
  buttonClassName,
  holdDialogSlot,
} from '@liveworkspace/ui';
import { Dialog } from '../dialogs/Dialog';
import { DialogFooter } from '../dialogs/DialogFooter';
import { APP_ITEMS, type AppName } from '@liveworkspace/sites';
import { useAuthHrefs } from './auth-routes';
import { ItemHistoryDialog, useOpenItem } from '@liveworkspace/explorer';
import type { IndexClient } from '@liveworkspace/index-client';
import { lucideGlyph } from '@liveworkspace/ui';
import { lucideHistory, lucideWebhook } from '@liveworkspace/icons/lucide';
import type { ChromeToolsItem } from './ChromeToolsMenu';
import { usePublishToolsItems } from './tools-door';

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

// What each says before it works, in the words and shape of Automations' gate (liveplanner AutomationsSyncGate).
const SIGN_IN = {
  history: {
    title: 'History',
    promptTitle: 'History Is Kept With Your Account',
    body: (noun: string) =>
      `Every change to this ${noun}, who made it and when, is kept with your account across devices, so it needs you signed in.`,
    syncTitle: 'History Is Kept on Our Servers',
    syncBody: (noun: string) =>
      `Every change to this ${noun}, who made it and when, is kept on our servers, so it needs saving to your account first.`,
  },
  webhooks: {
    title: 'Webhooks',
    promptTitle: 'Webhooks Run on Our Servers',
    body: (noun: string) =>
      `A webhook tells Slack, a chat or your own service each time this ${noun} changes, even when nobody has it open, so it needs you signed in.`,
    syncTitle: 'Webhooks Run on Our Servers',
    syncBody: (noun: string) =>
      `A webhook tells Slack, a chat or your own service each time this ${noun} changes, from our servers, so it needs saving to your account first.`,
  },
} as const;
type SignInFor = keyof typeof SIGN_IN;

// An item in This Browser: how to save it to the server (the editor's Sync move), and whether the reader is known yet.
export type ItemToolsOffline = { sync: () => Promise<void>; ready: boolean };

export function useItemToolsRows({
  app,
  onWebhooks,
  history,
  signedIn,
  offline = null,
}: {
  // The app, whose word for its item the sign-in dialogs use ("this canvas", "this plan").
  app: AppName;
  // Present only for someone who may manage the open item's webhooks.
  onWebhooks?: () => void;
  // The open item's History; null where it is not offered (no item open, or one opened by a share link).
  history: ItemHistoryHost | null;
  // Whether someone is signed in; until they are, both rows show and ask for a sign-in.
  signedIn: boolean;
  // Set while the open item lives in This Browser: both rows show, badged Sync <Item>, and ask for a sync.
  offline?: ItemToolsOffline | null;
}): ReactNode {
  const [historyOpen, setHistoryOpen] = useState(false);
  const [gate, setGate] = useState<SignInFor | null>(null);
  // A tool asked for through Sync, opened once the synced item gives it its host.
  const [pending, setPending] = useState<SignInFor | null>(null);
  const guest = !signedIn;
  const noun = APP_ITEMS[app].noun;
  const badges = useMemo(
    () => [...(guest ? ['Sign In'] : []), ...(offline ? [`Sync ${noun}`] : [])],
    [guest, offline, noun],
  );
  const showHistory = guest || !!offline || !!history;
  const showWebhooks = guest || !!offline || !!onWebhooks;
  const gated = guest || !!offline;
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
      ...(showHistory
        ? [
            {
              id: 'item-history',
              group: 'versions' as const,
              label: 'History',
              description: 'Who changed what, and when.',
              icon: <HistoryIcon />,
              inPlace: true,
              ...(gated ? { badges } : {}),
              onSelect: () => (gated ? setGate('history') : setHistoryOpen(true)),
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
    [showHistory, showWebhooks, gated, badges, onWebhooks],
  );
  usePublishToolsItems('item', rows);
  if (gate && gated)
    return (
      <SignInDialog
        for={gate}
        noun={noun}
        sync={guest ? null : offline}
        onSynced={() => {
          setPending(gate);
          setGate(null);
        }}
        onClose={() => setGate(null)}
      />
    );
  return historyOpen && !gated && history ? (
    <OpenItemHistory host={history} onClose={() => setHistoryOpen(false)} />
  ) : null;
}

// The History dialog for the open item, its reads made as it opens.
function OpenItemHistory({ host, onClose }: { host: ItemHistoryHost; onClose: () => void }) {
  const item = useOpenItem(host.client, host.itemId, host.shareCode, host.sharePassword);
  const teams = host.useTeams(true);
  if (!item || item.sharedVia) return null;
  return (
    <ItemHistoryDialog
      app={host.app}
      client={host.client}
      itemHref={host.itemHref}
      viewerId={host.viewerId}
      teams={teams}
      item={item}
      onClose={onClose}
    />
  );
}

// A gated press on History or Webhooks, drawn as Automations' gate is (liveplanner SyncGateDialog with
// SyncProjectPrompt): the tool's name over why it is held, a ringed disc, why it needs that, the move (Sign In, back to
// this page; or Sync <Item>, which goes on to the tool), and Cancel in the footer. Signed out comes first.
function SignInDialog({
  for: tool,
  noun,
  sync,
  onSynced,
  onClose,
}: {
  for: SignInFor;
  noun: string;
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
      <DialogHeader
        title={copy.title}
        subtitle={sync ? 'Saved only in this browser.' : 'You are not signed in.'}
      >
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
          <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
            {sync ? copy.syncTitle : copy.promptTitle}
          </p>
          <p className="mx-auto max-w-sm text-balance text-xs leading-relaxed text-slate-500 dark:text-slate-400">
            {sync ? copy.syncBody(word) : copy.body(word)}
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
