'use client';

// Webhooks and History in the footer's Tools (liveworkspace/docs/specs/004-index/footer-tools-menu.md), for the item
// the editor has open: published through the Tools door by each editor's ItemToolsHost, which is mounted with the
// editor (not with the Explorer panel, which mounts only once opened). Nothing is read until History is pressed. Returns the History dialog to render while it is open. Signed out, both rows
// still show, and each opens a dialog of its own that says what it does and asks for a sign-in.
import { useMemo, useState, type ReactNode } from 'react';
import { ButtonContent, DialogCloseButton, DialogHeader, Glyph, buttonClassName } from '@liveworkspace/ui';
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

// What each says to a guest, in the words and shape of Automations' sign-in gate (liveplanner AutomationsSyncGate).
const SIGN_IN = {
  history: {
    title: 'History',
    promptTitle: 'History Is Kept With Your Account',
    body: (noun: string) =>
      `Every change to this ${noun}, who made it and when, is kept with your account across devices, so it needs you signed in.`,
  },
  webhooks: {
    title: 'Webhooks',
    promptTitle: 'Webhooks Run on Our Servers',
    body: (noun: string) =>
      `A webhook tells Slack, a chat or your own service each time this ${noun} changes, even when nobody has it open, so it needs you signed in.`,
  },
} as const;
type SignInFor = keyof typeof SIGN_IN;

export function useItemToolsRows({
  app,
  onWebhooks,
  history,
  signedIn,
}: {
  // The app, whose word for its item the sign-in dialogs use ("this canvas", "this plan").
  app: AppName;
  // Present only for someone who may manage the open item's webhooks.
  onWebhooks?: () => void;
  // The open item's History; null where it is not offered (no item open, or one opened by a share link).
  history: ItemHistoryHost | null;
  // Whether someone is signed in; until they are, both rows show and ask for a sign-in.
  signedIn: boolean;
}): ReactNode {
  const [historyOpen, setHistoryOpen] = useState(false);
  const [signIn, setSignIn] = useState<SignInFor | null>(null);
  const guest = !signedIn;
  const showHistory = guest || !!history;
  const showWebhooks = guest || !!onWebhooks;
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
              onSelect: () => (guest ? setSignIn('history') : setHistoryOpen(true)),
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
              onSelect: () => (guest ? setSignIn('webhooks') : onWebhooks?.()),
            },
          ]
        : []),
    ],
    [showHistory, showWebhooks, guest, onWebhooks],
  );
  usePublishToolsItems('item', rows);
  if (signIn && guest) return (
      <SignInDialog for={signIn} noun={APP_ITEMS[app].noun.toLowerCase()} onClose={() => setSignIn(null)} />
    );
  return historyOpen && !guest && history ? (
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

// A signed-out press on History or Webhooks, drawn as Automations' sign-in gate is (liveplanner SyncGateDialog with
// SyncProjectPrompt): the tool's name over "You are not signed in.", a person in a ringed disc, why it needs an
// account, Sign In (back to this page), and Cancel in the footer.
function SignInDialog({
  for: tool,
  noun,
  onClose,
}: {
  for: SignInFor;
  noun: string;
  onClose: () => void;
}) {
  const { signInHref } = useAuthHrefs();
  const copy = SIGN_IN[tool];
  return (
    <Dialog open onClose={onClose} ariaLabel={copy.title} size="md">
      <DialogHeader title={copy.title} subtitle="You are not signed in.">
        <DialogCloseButton onClick={onClose} />
      </DialogHeader>
      <div data-tools-sign-in={tool} className="flex flex-col items-center gap-4 px-6 py-7 text-center">
        <span
          data-prompt-glyph="person"
          className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-700 ring-1 ring-brand-200 dark:bg-brand-500/10 dark:text-brand-300 dark:ring-brand-500/30"
        >
          <Glyph size={24} units={24}>
            <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </Glyph>
        </span>
        <div className="flex flex-col gap-1.5">
          <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{copy.promptTitle}</p>
          <p className="mx-auto max-w-sm text-balance text-xs leading-relaxed text-slate-500 dark:text-slate-400">
            {copy.body(noun)}
          </p>
        </div>
        <a
          href={signInHref}
          className={buttonClassName({ variant: 'primary', size: 'sm', className: 'mt-1 shadow-sm' })}
        >
          <ButtonContent>Sign In</ButtonContent>
        </a>
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
