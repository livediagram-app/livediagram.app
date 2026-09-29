'use client';

// Runs the Google Drive mirror in this browser (docs/specs/022-drive-mirror/drive-mirror.md,
// "Principles", "Cadence"): signed in, on a deployment that offers it, one tab
// per browser elected to run the engine while it is open, the others relaying
// their api writes to it and showing its status.

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
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
import { driveRedirectUri, googleConsentUrl, rememberConsent } from '@/lib/drive/consent';
import type { DriveMirrorEngine, DriveMirrorNotice, DriveMirrorStatus } from '@/lib/drive/engine';
import { googleFolderPicker, requestBrowserAccessToken } from '@/lib/drive/google-scripts';
import { driveLog, driveWarn } from '@/lib/drive/log';
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

type Runtime = {
  tokens: BrowserTokens;
  channel: DriveTabChannel;
  engine: DriveMirrorEngine | null;
};

export function DriveMirrorProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? '';
  const { isSignedIn, authLoaded, clerkUserId } = useClerkApiBootstrap();
  const { user } = useDeferredAuth();
  const confirm = useConfirm();
  const [serverMode, setServerMode] = useState<DriveMode | undefined>(undefined);
  const [status, setStatus] = useState<DriveMirrorStatus>(DRIVE_STATUS_INITIAL);
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
      setStatus(next);
      channel.post({ type: 'status', status: next });
    };
    const onMessage = (message: DriveTabMessage) => {
      const engine = runtime.current?.engine;
      if (message.type === 'status') {
        if (!engine) setStatus(message.status);
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
      else if (message.type === 'adopt')
        void engine.adoptFolder(message.kind, message.ldId, message.folderFileId);
      else if (message.type === 'token' && tokens.mode === 'browser') {
        tokens.source.set(message.token);
        void engine.syncNow();
      }
    };
    const channel = openDriveTabChannel(onMessage);
    runtime.current = { tokens, channel, engine: null };
    const resign = electDriveTab(() => {
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
      void engine.start();
    });
    channel.post({ type: 'hello' });

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
    const onVisibility = () => {
      const engine = runtime.current?.engine;
      if (!engine) return;
      if (document.visibilityState === 'hidden') {
        void engine.onHidden().then(() => engine.releaseLease());
      } else void engine.onVisible();
    };
    const onFocus = () => void runtime.current?.engine?.onVisible();
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('focus', onFocus);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('focus', onFocus);
      unsubscribeWrites();
      unsubscribeFlush();
      runtime.current?.engine?.stop();
      resign();
      channel.close();
      runtime.current = null;
    };
  }, [mode, quiet, clerkUserId]);

  const handToEngine = useCallback((token: DriveAccessToken) => {
    const rt = runtime.current;
    if (!rt || rt.tokens.mode !== 'browser') return;
    rt.tokens.source.set(token);
    if (rt.engine) void rt.engine.syncNow();
    else rt.channel.post({ type: 'token', token });
  }, []);

  const connect = useCallback(async () => {
    if (!clerkUserId || mode === 'off') return;
    if (mode === 'broker') {
      // Redirect mode: works on iOS and past popup blockers. A refresh token
      // is stored only after this, so the consent is asked for.
      const redirectUri = driveRedirectUri(window.location.origin);
      const state = await apiDriveState(clerkUserId, redirectUri);
      rememberConsent(
        sessionStorage,
        state,
        `${window.location.pathname}${window.location.search}${window.location.hash}`,
      );
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
  }, [clerkUserId, mode, user?.email, handToEngine]);

  const resume = useCallback(async () => {
    if (mode !== 'browser') return connect();
    handToEngine(await requestBrowserAccessToken(googleClientId, () => Date.now(), ''));
  }, [mode, connect, handToEngine]);

  const syncNow = useCallback(() => {
    const rt = runtime.current;
    if (rt?.engine) void rt.engine.syncNow();
    else rt?.channel.post({ type: 'sync-now' });
  }, []);

  const disconnect = useCallback(async () => {
    if (!clerkUserId) return;
    const ok = await confirm({
      title: 'Disconnect Google Drive?',
      message: 'Your files stay in Drive; livediagram stops updating them.',
      confirmLabel: 'Disconnect',
      variant: 'danger',
    });
    if (!ok) return;
    await apiDisconnectDrive(clerkUserId);
    localSeenStore(localStorage).clear(clerkUserId);
    track('Drive', 'Unlinked', mode === 'browser' ? 'Browser' : 'Broker');
    const rt = runtime.current;
    if (rt?.tokens.mode === 'browser') rt.tokens.source.clear();
    if (rt?.tokens.mode === 'broker') rt.tokens.source.clear();
    const next = { ...DRIVE_STATUS_INITIAL, state: 'disconnected' as const };
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
            connect,
            resume,
            syncNow,
            disconnect,
            adopt,
          },
    [mode, resolved, status, connect, resume, syncNow, disconnect, adopt],
  );

  return (
    <DriveMirrorContext.Provider value={value}>
      {children}
      {mode !== 'off' && !quiet ? <DriveReconnectBanner /> : null}
    </DriveMirrorContext.Provider>
  );
}
