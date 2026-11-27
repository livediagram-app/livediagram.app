'use client';

// Slack and Teams (docs/specs/030-knowledgebase/chat-apps.md "Connecting"): an Editor connects the knowledgebase to a
// Slack workspace or a Teams organisation from the knowledgebase's menu, and disconnects it here. A centred modal of
// one steady height (a sheet on a phone) under the shared hero header: one row a platform, saying what it is
// connected to, then how answers work. Slack connects through its own install page and comes back here; Teams shows
// a code to send the bot, and this dialog watches for it to arrive.
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import type {
  ChatAppPlatform,
  KnowledgeChatApps,
  KnowledgeChatTeamsCode,
} from '@liveknowledge/api-schema';
import { Button, DialogFooter, lucideGlyph } from '@liveknowledge/ui';
import { Callout } from '@liveworkspace/ui/callout';
import { HeroDialogHeader } from '@liveworkspace/ui/dialog-hero';
import {
  lucideCheck,
  lucideCopy,
  lucideExternalLink,
  lucideInfo,
} from '@liveworkspace/icons/lucide';
import { ConfirmDialog } from '@liveworkspace/workbench/components/dialogs/ConfirmDialog';
import { Dialog } from '@liveworkspace/workbench/components/dialogs/Dialog';
import { useAskSession, type AskSession } from '@/components/ask/useAskSession';
import { apiChatApps, apiDisconnectChat, apiStartSlack, apiStartTeams } from '@/lib/api/chat-apps';
import {
  closeChatApps,
  useChatAppsOpen,
  useChatReturn,
  type ChatReturn,
} from '@/lib/chat-apps/chat-apps-open';
import { track } from '@/lib/telemetry';
import { chatAppsHeroArt, SlackMark, TeamsMark } from './chat-apps-art';

const CopyIcon = lucideGlyph(lucideCopy, 14);
const CheckIcon = lucideGlyph(lucideCheck, 14);
const OpenIcon = lucideGlyph(lucideExternalLink, 14);
const InfoIcon = lucideGlyph(lucideInfo, 14);

/** How often the dialog looks for the Teams code to arrive. */
export const TEAMS_POLL_MS = 5_000;

const NAMES: Record<ChatAppPlatform, string> = { slack: 'Slack', teams: 'Microsoft Teams' };

const RETURNS: Record<ChatReturn, { tone: 'success' | 'error' | 'info'; text: string }> = {
  connected: {
    tone: 'success',
    text: 'Slack is connected. Anyone in the workspace can now /ask this knowledgebase, once they connect their own account.',
  },
  taken: {
    tone: 'error',
    text: 'That Slack workspace is already connected to another knowledgebase. Disconnect it there first.',
  },
  failed: { tone: 'error', text: "Slack didn't finish connecting. Try again." },
  denied: { tone: 'info', text: 'Connecting Slack was cancelled. Nothing changed.' },
};

const dayMonth = (at: number) =>
  new Date(at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

/** The dialog, drawn once by the editor's dialogs: nothing until opened. Another knowledgebase closes it. */
export function ChatAppsHost() {
  const open = useChatAppsOpen();
  const back = useChatReturn();
  const session = useAskSession();
  const documentId = session?.documentId;
  const shown = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (shown.current !== undefined && shown.current !== documentId) closeChatApps();
    shown.current = documentId;
  }, [documentId]);
  if (!open || !session) return null;
  return <ChatAppsDialog session={session} back={back} onClose={closeChatApps} />;
}

type Api = {
  read: typeof apiChatApps;
  startSlack: typeof apiStartSlack;
  startTeams: typeof apiStartTeams;
  disconnect: typeof apiDisconnectChat;
  /** Where Slack's install page is opened. */
  go: (url: string) => void;
};

const API: Api = {
  read: apiChatApps,
  startSlack: apiStartSlack,
  startTeams: apiStartTeams,
  disconnect: apiDisconnectChat,
  go: (url) => window.location.assign(url),
};

export function ChatAppsDialog({
  session,
  back = null,
  onClose,
  api = API,
}: {
  session: AskSession;
  back?: ChatReturn | null;
  onClose: () => void;
  /** The calls, for a test to stand in for. */
  api?: Api;
}) {
  const { documentId, who } = session;
  const titleId = useId();
  const [apps, setApps] = useState<KnowledgeChatApps | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState<ChatAppPlatform | null>(null);
  const [code, setCode] = useState<KnowledgeChatTeamsCode | null>(null);
  const [confirming, setConfirming] = useState<ChatAppPlatform | null>(null);

  useEffect(() => {
    track('UI', 'Opened', 'ChatApps');
  }, []);

  useEffect(() => {
    const abort = new AbortController();
    api
      .read(who, documentId, abort.signal)
      .then(setApps)
      .catch(() => {
        if (!abort.signal.aborted)
          setFailure("Slack and Teams couldn't be read. Try again in a minute.");
      });
    return () => abort.abort();
  }, [api, who, documentId]);

  // While a Teams code shows, look every few seconds for the bot to have taken it.
  useEffect(() => {
    if (!code || apps?.teams.connection) return;
    const timer = window.setInterval(() => {
      if (Date.now() > code.expiresAt) {
        setCode(null);
        return;
      }
      // A tab in the background doesn't ask: the next look after it shows again catches up.
      if (document.visibilityState === 'hidden') return;
      api
        .read(who, documentId)
        .then((next) => {
          setApps(next);
          if (next.teams.connection) setCode(null);
        })
        .catch(() => undefined);
    }, TEAMS_POLL_MS);
    return () => window.clearInterval(timer);
  }, [api, code, apps?.teams.connection, who, documentId]);

  const connect = async (platform: ChatAppPlatform) => {
    setBusy(platform);
    setFailure(null);
    try {
      if (platform === 'slack') {
        const { url } = await api.startSlack(who, documentId);
        track('UI', 'Used', 'ChatConnectSlack');
        api.go(url);
        return;
      }
      setCode(await api.startTeams(who, documentId));
      track('UI', 'Used', 'ChatConnectTeams');
    } catch {
      setFailure(`${NAMES[platform]} couldn't start connecting. Try again.`);
    }
    setBusy(null);
  };

  const disconnect = async (platform: ChatAppPlatform) => {
    setConfirming(null);
    setBusy(platform);
    setFailure(null);
    try {
      setApps(await api.disconnect(who, documentId, platform));
      track('UI', 'Used', 'ChatDisconnect');
    } catch {
      setFailure(`${NAMES[platform]} couldn't be disconnected. Try again.`);
    }
    setBusy(null);
  };

  const returned = back ? RETURNS[back] : null;
  const confirmName = confirming ? (apps?.[confirming].connection?.name ?? NAMES[confirming]) : '';

  return (
    <>
      <Dialog
        open
        onClose={onClose}
        titleId={titleId}
        size="lg"
        phoneSheet
        className="h-[min(40rem,calc(100dvh-2rem))] max-h-[calc(100dvh-2rem)] max-sm:h-[min(42rem,85dvh)] max-sm:max-h-[85dvh]"
      >
        <HeroDialogHeader
          art={chatAppsHeroArt}
          titleId={titleId}
          title="Slack and Teams"
          subtitle="Ask this knowledgebase from chat, with sources and trust marks."
          onClose={onClose}
          underHandle
        />
        <div
          className="scrollbar-slim flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 py-5 sm:px-6"
          data-chat-apps=""
        >
          {returned ? (
            <Callout tone={returned.tone} size="md" role="status">
              {returned.text}
            </Callout>
          ) : null}
          <PlatformRow
            platform="slack"
            mark={<SlackMark />}
            apps={apps}
            busy={busy}
            onConnect={() => void connect('slack')}
            onDisconnect={() => setConfirming('slack')}
            how="Ask with /ask, a mention, or a message to the app. Pasted page links show a preview."
          />
          <PlatformRow
            platform="teams"
            mark={<TeamsMark />}
            apps={apps}
            busy={busy}
            onConnect={() => void connect('teams')}
            onDisconnect={() => setConfirming('teams')}
            how="Ask in a chat with the app, or mention it in a channel. Answers come to your own chat."
          >
            {code && !apps?.teams.connection ? (
              <TeamsCode code={code} appLink={apps?.teams.appLink ?? null} />
            ) : null}
          </PlatformRow>
          <p
            className="flex items-start gap-2 px-1 pt-1 text-xs leading-[18px] text-slate-600 dark:text-slate-400"
            data-chat-apps-note=""
          >
            <span aria-hidden className="mt-0.5 flex shrink-0">
              <InfoIcon />
            </span>
            Everyone connects their own liveknowledge account the first time they ask, and answers
            use only the pages they can open. An answer is theirs alone until they share it.
            Questions the pages don&apos;t cover go to Unanswered Questions.
          </p>
          {failure ? (
            <Callout tone="error" size="md" role="alert">
              {failure}
            </Callout>
          ) : null}
        </div>
        <DialogFooter>
          <Button variant="primary" onClick={onClose}>
            Done
          </Button>
        </DialogFooter>
      </Dialog>
      <ConfirmDialog
        open={confirming !== null}
        title={`Disconnect ${confirming ? NAMES[confirming] : ''}?`}
        message={`${confirmName} stops getting answers from this knowledgebase, and every account connected there is forgotten.`}
        confirmLabel="Disconnect"
        onConfirm={() => confirming && void disconnect(confirming)}
        onCancel={() => setConfirming(null)}
      />
    </>
  );
}

function PlatformRow({
  platform,
  mark,
  apps,
  busy,
  how,
  onConnect,
  onDisconnect,
  children,
}: {
  platform: ChatAppPlatform;
  mark: ReactNode;
  apps: KnowledgeChatApps | null;
  busy: ChatAppPlatform | null;
  how: string;
  onConnect: () => void;
  onDisconnect: () => void;
  children?: ReactNode;
}) {
  const state = apps?.[platform];
  const connection = state?.connection ?? null;
  const status = !state
    ? 'Loading'
    : !state.offered
      ? 'Not set up on this server'
      : connection
        ? `Connected to ${connection.name} since ${dayMonth(connection.connectedAt)}`
        : 'Not connected';
  return (
    <section
      className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900"
      data-chat-platform={platform}
      aria-label={NAMES[platform]}
    >
      {/* On a phone the action drops under the words, in line with them, so the words keep the row's width. */}
      <div className="flex items-start gap-3 max-sm:flex-wrap">
        <span className="shrink-0">{mark}</span>
        <div className="min-w-0 flex-1 max-sm:basis-[calc(100%-52px)]">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              {NAMES[platform]}
            </h3>
            {connection ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
                <CheckIcon />
                Connected
              </span>
            ) : null}
          </div>
          <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400" data-chat-status="">
            {status}
          </p>
          <p className="mt-1.5 text-xs leading-[18px] text-slate-500 dark:text-slate-400">{how}</p>
        </div>
        {state?.offered ? (
          <Button
            variant={connection ? 'ghost' : 'secondary'}
            onClick={connection ? onDisconnect : onConnect}
            disabled={busy !== null}
            data-chat-action={connection ? 'disconnect' : 'connect'}
            // A ghost button's words sit inside its padding: it moves left by that much to line up.
            className={connection ? 'shrink-0 max-sm:ml-[40px]' : 'shrink-0 max-sm:ml-[52px]'}
          >
            {busy === platform
              ? connection
                ? 'Disconnecting'
                : 'Connecting'
              : connection
                ? 'Disconnect'
                : `Connect ${platform === 'slack' ? 'Slack' : 'Teams'}`}
          </Button>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function TeamsCode({ code, appLink }: { code: KnowledgeChatTeamsCode; appLink: string | null }) {
  const [copied, setCopied] = useState(false);
  // The clock, read when the code shows and each half minute after, for the minutes left.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);
  const message = `connect ${code.code}`;
  const minutes = Math.max(1, Math.round((code.expiresAt - now) / 60_000));
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2_000);
    } catch {
      setCopied(false);
    }
  };
  return (
    <div
      className="flex flex-col gap-3 rounded-lg border border-dashed border-indigo-300 bg-indigo-50/60 p-3 dark:border-indigo-400/40 dark:bg-indigo-500/10"
      data-teams-code=""
    >
      <p className="text-xs text-slate-700 dark:text-slate-300">
        In Teams, open the liveknowledge app and send it this message:
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <code className="rounded-md bg-white px-3 py-1.5 font-mono text-base font-semibold tracking-wider text-slate-900 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:text-slate-100 dark:ring-slate-700">
          {message}
        </code>
        <Button variant="secondary" onClick={() => void copy()} data-teams-copy="">
          <span aria-hidden className="flex">
            {copied ? <CheckIcon /> : <CopyIcon />}
          </span>
          {copied ? 'Copied' : 'Copy'}
        </Button>
        {appLink ? (
          <a
            href={appLink}
            target="_blank"
            rel="noreferrer"
            className="inline-flex cursor-pointer items-center gap-1 text-xs font-medium text-brand-700 hover:underline dark:text-brand-300"
          >
            Open Teams
            <OpenIcon />
          </a>
        ) : null}
      </div>
      <p className="text-[11px] text-slate-500 dark:text-slate-400" aria-live="polite">
        Waiting for Teams. The code works once, for {minutes} more minute{minutes === 1 ? '' : 's'}.
      </p>
    </div>
  );
}
