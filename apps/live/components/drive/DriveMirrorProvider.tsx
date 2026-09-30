'use client';

// Runs the Google Drive mirror in this browser (docs/specs/022-drive-mirror/drive-mirror.md,
// "Principles", "Cadence"): signed in, on a deployment that offers it, one tab
// per browser elected to run the engine while it is open, the others relaying
// their api writes to it and showing its status.

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { DRIVE_CONNECT_FAILED } from '@/lib/drive/cloud-sync-copy';
import { usePathname } from 'next/navigation';
import type { DriveAccessToken, DriveMode } from '@livediagram/api-schema';
import {
  apiDisconnectDrive,
  apiDriveState,
  apiGetCapabilities,
  apiPutDriveConnection,
} from '@/lib/api-client';
import { notifyApiWrite, subscribeApiWrites } from '@/lib/api/write-signal';
import { useClerkApiBootstrap } from '@/hooks/persistence/useClerkApiBootstrap';
import { useDeferredAuth } from '@/components/providers/deferred-auth';
import { useConfirm } from '@/hooks/ui/useConfirm';
import { track } from '@/lib/telemetry';
import {
  createBrowserEngine,
  createBrowserTokens,
  type BrowserTokens,
} from '@/lib/drive/browser-engine';
import { driveUiMode, googleClientId, googlePickerApiKey } from '@/lib/drive/config';
import {
  driveRedirectUri,
  googleConsentUrl,
  rememberConsent,
  clearConnectOutcome,
  peekConnectOutcome,
  withSettingsTarget,
} from '@/lib/drive/consent';
import { CLOUD_SYNC_SECTION_ID } from '@/lib/cloud-sync/providers';
import type { DriveMirrorEngine, DriveMirrorNotice, DriveMirrorStatus } from '@/lib/drive/engine';
import { googleFolderPicker, requestBrowserAccessToken } from '@/lib/drive/google-scripts';
import { driveLog, driveStale, driveWarn } from '@/lib/drive/log';
import {
  DRIVE_CHECK_ANSWER_MS,
  DRIVE_FOCUS_POLL_MIN_GAP_MS,
  DRIVE_POLL_INTERVAL_MS,
  DRIVE_STALE_AFTER_MS,
  DRIVE_STALE_WATCH_MS,
} from '@/lib/drive/cadence';
import {
  electDriveTab,
  onDriveFlushRequest,
  openDriveTabChannel,
  type DriveTabChannel,
  type DriveTabMessage,
} from '@/lib/drive/tab-election';
import { localSeenStore } from '@/lib/drive/tombstones';
import {
  DRIVE_MIRROR_OFF,
  DRIVE_STATUS_INITIAL,
  DriveMirrorContext,
  type DriveMirrorContextValue,
} from './drive-mirror-context';
import { DriveReconnectBanner } from './DriveReconnectBanner';

// Pages that never run the engine: an embed lives in someone else's page,
// and the Drive routes do their own one-off work.
const QUIET_PATHS = ['/embed', '/drive'];

// How long the row says Connecting after a finished connection if no mirror
// reports on it.
const SETTING_UP_MAX_MS = 30_000;

type Runtime = {
  tokens: BrowserTokens;
  channel: DriveTabChannel;
  engine: DriveMirrorEngine | null;
  // A check, in this tab if it syncs, else asked of the tab that does.
  check(kind: CheckKind): void;
};

type CheckKind = 'focus' | 'view' | 'poll';

// Opening Cloud Sync checks unless the last sync is this recent.
const VIEW_CHECK_MIN_AGE_MS = DRIVE_FOCUS_POLL_MIN_GAP_MS;
// How long "Checking…" waits for the check's result.
const CHECKING_MAX_MS = DRIVE_CHECK_ANSWER_MS;

export function DriveMirrorProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? '';
  const { isSignedIn, authLoaded, clerkUserId } = useClerkApiBootstrap();
  const { user } = useDeferredAuth();
  const confirm = useConfirm();
  const [serverMode, setServerMode] = useState<DriveMode | undefined>(undefined);
  const [status, setStatus] = useState<DriveMirrorStatus>(DRIVE_STATUS_INITIAL);
  // Connect in flight, from the press until the page leaves for Google
  // (docs/specs/022-drive-mirror/drive-mirror.md, "What the row says").
  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);
  // How a trip to Google ended, read on the first render (a pure peek) and
  // cleared from storage once mounted.
  const [outcome] = useState(() =>
    typeof window === 'undefined' ? null : peekConnectOutcome(sessionStorage),
  );
  // A cancel at Google: said once, calmly.
  const [connectNote, setConnectNote] = useState<'cancelled' | null>(
    outcome === 'cancelled' ? 'cancelled' : null,
  );
  // A finished connection: the connection exists, so until the mirror reports
  // on it the row says Connecting, never Not connected. The tab that runs the
  // mirror may be another one, still showing what it saw before; it is asked
  // to sync at once (below), and its first report ends this.
  const [settingUp, setSettingUp] = useState(outcome === 'connected');
  const announceConnected = useRef(outcome === 'connected');
  // A check the Cloud Sync row asked for: since when, until its result arrives.
  const [checkingSince, setCheckingSince] = useState<number | null>(null);
  const checkingSinceRef = useRef<number | null>(null);
  const statusRef = useRef<DriveMirrorStatus>(DRIVE_STATUS_INITIAL);
  // Cloud Sync came into view during a pass: check once it ends.
  const viewCheckPending = useRef(false);
  const requestCheckRef = useRef<() => void>(() => {});
  const showStatus = useCallback((next: DriveMirrorStatus) => {
    statusRef.current = next;
    setStatus(next);
    if (next.state !== 'starting' && next.state !== 'disconnected') setSettingUp(false);
    if (viewCheckPending.current && next.state !== 'syncing') {
      viewCheckPending.current = false;
      if (next.state === 'idle') queueMicrotask(() => requestCheckRef.current());
    }
    const since = checkingSinceRef.current;
    if (
      since !== null &&
      next.state !== 'syncing' &&
      (next.state !== 'idle' || (next.lastSyncedAt ?? 0) >= since)
    ) {
      checkingSinceRef.current = null;
      setCheckingSince(null);
    }
  }, []);
  useEffect(() => {
    if (checkingSince === null) return;
    const timer = window.setTimeout(() => {
      checkingSinceRef.current = null;
      setCheckingSince(null);
    }, CHECKING_MAX_MS);
    return () => window.clearTimeout(timer);
  }, [checkingSince]);
  // A mirror that never reports (no tab can run it) does not hold the row forever.
  useEffect(() => {
    if (!settingUp) return;
    const timer = window.setTimeout(() => setSettingUp(false), SETTING_UP_MAX_MS);
    return () => window.clearTimeout(timer);
  }, [settingUp]);
  useEffect(() => {
    clearConnectOutcome(sessionStorage);
  }, []);
  // Back from Google out of the bfcache: the page is live again, not leaving.
  useEffect(() => {
    const onShow = (e: PageTransitionEvent) => {
      if (e.persisted) setConnecting(false);
    };
    window.addEventListener('pageshow', onShow);
    return () => window.removeEventListener('pageshow', onShow);
  }, []);
  const runtime = useRef<Runtime | null>(null);
  const signedIn = !!isSignedIn && authLoaded && !!clerkUserId;
  const quiet = QUIET_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  useEffect(() => {
    if (!googleClientId || !signedIn) return;
    let live = true;
    void apiGetCapabilities().then((caps) => {
      if (live) setServerMode(caps.driveMode ?? 'off');
    });
    return () => {
      live = false;
    };
  }, [signedIn]);

  const mode = signedIn ? driveUiMode(serverMode) : 'off';
  const resolved = authLoaded && (!signedIn || !googleClientId || serverMode !== undefined);

  useEffect(() => {
    if (mode === 'off' || quiet || !clerkUserId) return;
    const tokens = createBrowserTokens(mode, clerkUserId);
    const publish = (next: DriveMirrorStatus) => {
      showStatus(next);
      channel.post({ type: 'status', status: next });
    };
    const onMessage = (message: DriveTabMessage) => {
      const engine = runtime.current?.engine;
      if (message.type === 'status') {
        // The tab that syncs answered.
        clearAnswerTimer();
        if (!engine) showStatus(message.status);
        return;
      }
      // A change from Drive landed in the elected tab: this tab's views re-read.
      if (message.type === 'drive-applied') {
        notifyApiWrite({ drive: true });
        return;
      }
      if (!engine) return;
      if (message.type === 'hello') channel.post({ type: 'status', status: engine.current });
      else if (message.type === 'write') engine.noteWrite();
      else if (message.type === 'flush') void engine.flush();
      else if (message.type === 'sync-now') void engine.syncNow();
      else if (message.type === 'check')
        void engine
          .requestCheck(message.kind)
          .then(() => channel.post({ type: 'status', status: engine.current }));
      else if (message.type === 'adopt')
        void engine.adoptFolder(message.kind, message.ldId, message.folderFileId);
      else if (message.type === 'token' && tokens.mode === 'browser') {
        tokens.source.set(message.token);
        void engine.syncNow();
      }
    };
    // A visible tab that does not sync asks the one that does; with no answer in
    // time (that tab is frozen or gone) it takes the sync over
    // (docs/specs/022-drive-mirror/drive-mirror.md, "A visible tab is never left unsynced").
    let answerTimer: number | null = null;
    const clearAnswerTimer = () => {
      if (answerTimer !== null) window.clearTimeout(answerTimer);
      answerTimer = null;
    };
    const check = (kind: CheckKind) => {
      const engine = runtime.current?.engine;
      if (engine) {
        void engine.requestCheck(kind);
        return;
      }
      channel.post({ type: 'check', kind });
      if (answerTimer !== null) return;
      const askedAt = Date.now();
      answerTimer = window.setTimeout(() => {
        answerTimer = null;
        // Far later than asked for: the machine slept (or the clock jumped),
        // and the answer may simply not have arrived yet. Ask again rather
        // than take the sync from a tab that is fine.
        if (Date.now() - askedAt > 2 * DRIVE_CHECK_ANSWER_MS) {
          driveLog('check-reasked', { kind });
          check(kind);
          return;
        }
        driveWarn('check-unanswered', { kind });
        election.takeOver();
      }, DRIVE_CHECK_ANSWER_MS);
    };
    const channel = openDriveTabChannel(onMessage);
    runtime.current = { tokens, channel, engine: null, check };
    const onElected = () => {
      const engine = createBrowserEngine({
        ownerId: clerkUserId,
        tokens: tokens.source,
        onStatus: publish,
        onInboundApplied: () => {
          notifyApiWrite({ drive: true });
          channel.post({ type: 'drive-applied' });
        },
      });
      if (runtime.current) runtime.current.engine = engine;
      clearAnswerTimer();
      void engine.start();
    };
    // Another tab took the sync over: stop, and wait for it again.
    const onLost = () => {
      driveWarn('election-lost', {});
      runtime.current?.engine?.stop();
      if (runtime.current) runtime.current.engine = null;
      election = electDriveTab(onElected, onLost);
    };
    let election = electDriveTab(onElected, onLost);
    channel.post({ type: 'hello' });
    driveLog('tab-ready', {});
    // Back from a finished connection: whichever tab runs the mirror syncs now,
    // not at its next focus or poll. This tab, if elected, starts anyway.
    if (announceConnected.current) {
      announceConnected.current = false;
      driveLog('connected-announce', {});
      channel.post({ type: 'sync-now' });
    }

    const unsubscribeWrites = subscribeApiWrites((signal) => {
      // A change from Drive is not an edit to write back.
      if (signal.drive) return;
      const engine = runtime.current?.engine;
      if (engine) engine.noteWrite();
      else channel.post({ type: 'write' });
    });
    const unsubscribeFlush = onDriveFlushRequest(() => {
      const engine = runtime.current?.engine;
      if (engine) void engine.flush();
      else channel.post({ type: 'flush' });
    });
    const visible = () => document.visibilityState === 'visible';
    const onVisibility = () => {
      const engine = runtime.current?.engine;
      if (engine) {
        if (!visible()) void engine.onHidden().then(() => engine.releaseLease());
        else void engine.onVisible();
      } else if (visible()) check('focus');
    };
    const onFocus = () => {
      const engine = runtime.current?.engine;
      if (engine) void engine.onVisible();
      else check('focus');
    };
    // The 2-minute rhythm for a visible tab that does not sync; the tab that
    // syncs keeps its own while it is visible.
    const pollTimer = window.setInterval(() => {
      if (!runtime.current?.engine && visible()) check('poll');
    }, DRIVE_POLL_INTERVAL_MS);
    // A visible tab never shows an old "Synced" quietly: a bug to log, and a
    // check at once.
    const staleTimer = window.setInterval(() => {
      const current = statusRef.current;
      if (!visible() || current.lastSyncedAt === null) return;
      if (current.state !== 'idle' && current.state !== 'syncing') return;
      const ageMs = Date.now() - current.lastSyncedAt;
      if (ageMs <= DRIVE_STALE_AFTER_MS) return;
      driveStale({ ageMs, elected: !!runtime.current?.engine });
      check('focus');
    }, DRIVE_STALE_WATCH_MS);
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('focus', onFocus);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('focus', onFocus);
      window.clearInterval(pollTimer);
      window.clearInterval(staleTimer);
      clearAnswerTimer();
      unsubscribeWrites();
      unsubscribeFlush();
      runtime.current?.engine?.stop();
      election.resign();
      channel.close();
      runtime.current = null;
    };
  }, [mode, quiet, clerkUserId, showStatus]);

  const handToEngine = useCallback((token: DriveAccessToken) => {
    const rt = runtime.current;
    if (!rt || rt.tokens.mode !== 'browser') return;
    rt.tokens.source.set(token);
    if (rt.engine) void rt.engine.syncNow();
    else rt.channel.post({ type: 'token', token });
  }, []);

  // Broker mode leaves for Google and never returns here (connecting stays
  // set); browser mode hands the token to the engine and is done.
  const startConnect = useCallback(async () => {
    if (!clerkUserId) return;
    if (mode === 'broker') {
      // Redirect mode: works on iOS and past popup blockers. A refresh token
      // is stored only after this, so the consent is asked for.
      const redirectUri = driveRedirectUri(window.location.origin);
      const state = await apiDriveState(clerkUserId, redirectUri);
      // This page's own history entry names Cloud Sync, so Back from Google
      // reopens it; the same place is where the consent comes back to.
      const here = withSettingsTarget(
        `${window.location.pathname}${window.location.search}${window.location.hash}`,
        'account',
        CLOUD_SYNC_SECTION_ID,
      );
      window.history.replaceState(null, '', here);
      rememberConsent(sessionStorage, state, here);
      driveLog('consent-redirect', {});
      window.location.assign(
        googleConsentUrl({
          clientId: googleClientId,
          redirectUri,
          state,
          promptConsent: true,
          loginHint: user?.email,
        }),
      );
      return;
    }
    const token = await requestBrowserAccessToken(googleClientId, () => Date.now(), 'consent');
    await apiPutDriveConnection(clerkUserId, {});
    track('Drive', 'Linked', 'Browser');
    handToEngine(token);
    setConnecting(false);
  }, [clerkUserId, mode, user?.email, handToEngine]);

  const connect = useCallback(async () => {
    if (!clerkUserId || mode === 'off') return;
    setConnecting(true);
    setConnectError(null);
    setConnectNote(null);
    setSettingUp(false);
    try {
      await startConnect();
    } catch (err) {
      driveWarn('connect-failed', { error: err instanceof Error ? err.message : String(err) });
      setConnectError(DRIVE_CONNECT_FAILED);
      setConnecting(false);
    }
  }, [clerkUserId, mode, startConnect]);

  const resume = useCallback(async () => {
    if (mode !== 'browser') return connect();
    handToEngine(await requestBrowserAccessToken(googleClientId, () => Date.now(), ''));
  }, [mode, connect, handToEngine]);

  // Another pass at once, in whichever tab runs the mirror (after a disconnect).
  const syncNow = useCallback(() => {
    const rt = runtime.current;
    if (rt?.engine) void rt.engine.syncNow();
    else rt?.channel.post({ type: 'sync-now' });
  }, []);

  // The Cloud Sync row came into view: a gated check, unless one is running or
  // the last finished moments ago.
  const requestCheck = useCallback(() => {
    const current = statusRef.current;
    if (current.state === 'syncing') {
      viewCheckPending.current = true;
      return;
    }
    if (current.state !== 'idle' || checkingSinceRef.current !== null) return;
    if (current.lastSyncedAt !== null && Date.now() - current.lastSyncedAt < VIEW_CHECK_MIN_AGE_MS)
      return;
    const since = Date.now();
    checkingSinceRef.current = since;
    setCheckingSince(since);
    runtime.current?.check('view');
  }, []);
  useEffect(() => {
    requestCheckRef.current = requestCheck;
  }, [requestCheck]);

  const disconnect = useCallback(async () => {
    if (!clerkUserId) return;
    const ok = await confirm({
      title: 'Disconnect Google Drive?',
      message: 'Your files stay in Drive; livediagram stops updating them.',
      confirmLabel: 'Disconnect',
      variant: 'neutral',
    });
    if (!ok) return;
    await apiDisconnectDrive(clerkUserId);
    localSeenStore(localStorage).clear(clerkUserId);
    track('Drive', 'Unlinked', mode === 'browser' ? 'Browser' : 'Broker');
    const rt = runtime.current;
    if (rt?.tokens.mode === 'browser') rt.tokens.source.clear();
    if (rt?.tokens.mode === 'broker') rt.tokens.source.clear();
    const next = { ...DRIVE_STATUS_INITIAL, state: 'disconnected' as const };
    setSettingUp(false);
    setStatus(next);
    rt?.channel.post({ type: 'status', status: next });
    syncNow();
  }, [clerkUserId, confirm, mode, syncNow]);

  const adopt = useCallback(async (notice: DriveMirrorNotice) => {
    const rt = runtime.current;
    if (!rt || !googlePickerApiKey) return;
    try {
      const accessToken = await rt.tokens.source.get();
      const picked = await googleFolderPicker(
        googlePickerApiKey,
        googleClientId,
      )({ accessToken, parentId: notice.parentId });
      if (!picked) return;
      if (rt.engine) await rt.engine.adoptFolder(notice.kind, notice.ldId, picked);
      else
        rt.channel.post({
          type: 'adopt',
          kind: notice.kind,
          ldId: notice.ldId,
          folderFileId: picked,
        });
    } catch (err) {
      driveWarn('adopt-failed', { error: err instanceof Error ? err.message : String(err) });
    }
  }, []);

  const value = useMemo<DriveMirrorContextValue>(
    () =>
      mode === 'off'
        ? { ...DRIVE_MIRROR_OFF, resolved }
        : {
            mode,
            resolved,
            status,
            canAdopt: !!googlePickerApiKey,
            connecting:
              connecting ||
              (settingUp && (status.state === 'starting' || status.state === 'disconnected')),
            connectError,
            connectNote,
            checking: checkingSince !== null,
            requestCheck,
            connect,
            resume,
            disconnect,
            adopt,
          },
    [
      mode,
      resolved,
      status,
      connecting,
      settingUp,
      connectError,
      connectNote,
      checkingSince,
      requestCheck,
      connect,
      resume,
      disconnect,
      adopt,
    ],
  );

  return (
    <DriveMirrorContext.Provider value={value}>
      {children}
      {mode !== 'off' && !quiet ? <DriveReconnectBanner /> : null}
    </DriveMirrorContext.Provider>
  );
}
