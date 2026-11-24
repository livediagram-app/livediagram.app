'use client';

// A file on a Screen opened large (docs/specs/009-elements/screen-and-room-sign.md "A file on the Screen", "Opened
// large"): the reader's dark shell, the file's own read-only frame filling it and taking the pointer, so a reader
// scrolls, pans and switches tabs in it at once. Its bar: the app's logo and the file's name; Show This Tab on the
// Screen (an Editor, once the frame shows another tab than the Screen's); Open in <App>, the file in its own app in a
// new browser tab; Close. Opened with the viewer's own access: without it, the lock card with Request Access. The tab
// it opens on is the Screen's as it opened, so showing a new tab on the Screen never reloads what is in front of you.
import { useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import type { LiveTab, ScreenFile } from '@livehuddle/document';
import { AppBrandMark, lucideGlyph } from '@livehuddle/ui';
import {
  lucideExternalLink,
  lucideLock,
  lucidePresentation,
  lucideRefreshCw,
} from '@liveworkspace/icons/lucide';
import { useLiveEmbedFrame } from '@liveworkspace/workbench/components/live-embed/useLiveEmbedFrame';
import { liveEmbedItemHref } from '@liveworkspace/workbench/components/live-embed/live-embed-target';
import { RequestAccessButton } from '@liveworkspace/workbench/components/request-access/RequestAccessButton';
import { useDeferredAuth } from '@liveworkspace/workbench/components/providers/deferred-auth';
import { ReaderShell } from './ReaderShell';
import { SCREEN_FRAME_SANDBOX } from './ScreenFileFace';
import { screenWords as words } from './screen-words';

const OpenGlyph = lucideGlyph(lucideExternalLink, 15);
const ShowGlyph = lucideGlyph(lucidePresentation, 15);
const LockGlyph = lucideGlyph(lucideLock, 22);
const RetryGlyph = lucideGlyph(lucideRefreshCw, 14);

const NEVER_CHANGES = () => () => {};
const pageHost = () => window.location.host;

const BAR_BUTTON =
  'flex h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-lg px-3 text-sm font-medium ring-1 transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white';

export function ScreenFileOverlay({
  file,
  canShowTab,
  onShowTab,
  onClose,
}: {
  file: ScreenFile;
  // An Editor of the Space: may put the tab the frame shows on the Screen.
  canShowTab: boolean;
  onShowTab: (tab: LiveTab) => void;
  onClose: () => void;
}) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  // The tab the Screen showed as it opened: the frame opens on it, and a later choice never reloads the frame.
  const [openedOn] = useState(() => file.liveTab ?? null);
  const frame = useLiveEmbedFrame({
    item: file.liveItem,
    active: true,
    hostName: 'livehuddle',
    frameRef,
    tabId: openedOn?.id ?? null,
  });
  const host = useSyncExternalStore(NEVER_CHANGES, pageHost, () => null);
  const { isSignedIn } = useDeferredAuth();
  const name = file.liveName || words.untitled;
  const app = file.liveItem.app;
  const href = host ? liveEmbedItemHref(app, file.liveItem.itemId, host) : null;
  const live = frame.state === 'live';
  // The tab the Screen shows now: its own, else the first the frame opened on.
  const [firstShown, setFirstShown] = useState<LiveTab | null>(null);
  const shownTab = live ? frame.tab : null;
  if (shownTab && !firstShown) setFirstShown(shownTab);
  const screenTabId = file.liveTab?.id ?? firstShown?.id ?? null;
  const offerTab = canShowTab && !!shownTab && shownTab.id !== screenTabId;

  return (
    <ReaderShell
      title={words.overlayTitle(name)}
      onClose={onClose}
      tone="dark"
      widthClassName="max-w-[1280px]"
      data-screen-file-overlay=""
      barStart={<AppBrandMark app={app} className="size-5 shrink-0" />}
      barActions={
        <>
          {offerTab ? (
            <button
              type="button"
              onClick={() => onShowTab(shownTab)}
              className={`${BAR_BUTTON} bg-brand-700 text-white ring-brand-400/40 hover:bg-brand-800 dark:bg-brand-600 dark:hover:bg-brand-700`}
            >
              <ShowGlyph />
              <span className="hidden sm:inline">{words.showThisTab}</span>
              <span className="sm:hidden">{words.shownTab}</span>
            </button>
          ) : null}
          {href ? (
            <a
              href={href}
              target="_blank"
              rel="noreferrer noopener"
              aria-label={words.open(app)}
              className={`${BAR_BUTTON} bg-white/10 text-white ring-white/15 hover:bg-white/20 active:bg-white/25`}
            >
              <OpenGlyph />
              <span className="hidden sm:inline">{words.open(app)}</span>
            </a>
          ) : null}
        </>
      }
    >
      <div className="relative h-[calc(90dvh-3.25rem)] w-full bg-slate-900">
        {live ? (
          <iframe
            ref={frameRef}
            src={frame.src}
            title={name}
            sandbox={SCREEN_FRAME_SANDBOX}
            referrerPolicy="no-referrer"
            className={`absolute inset-0 h-full w-full border-0 bg-white transition-opacity duration-200 dark:bg-slate-900 motion-reduce:transition-none ${
              frame.ready ? 'opacity-100' : 'opacity-0'
            }`}
          />
        ) : null}
        {frame.state === 'loading' || (live && !frame.ready) ? (
          <Centre>
            <AppBrandMark app={app} spinning className="size-10" />
            <span role="status" className="text-sm font-medium text-white/80">
              {words.opening(name)}
            </span>
          </Centre>
        ) : frame.state === 'no-access' ? (
          <Centre card>
            <span className="text-slate-400">
              <LockGlyph />
            </span>
            <p role="status" className="text-base font-semibold text-white">
              {words.noAccessTitle(name)}
            </p>
            <p className="max-w-[26rem] text-sm text-white/75">{words.noAccessLine}</p>
            <div className="mt-1 flex flex-wrap items-center justify-center gap-2">
              {isSignedIn ? <RequestAccessButton itemId={file.liveItem.itemId} /> : null}
              {href ? (
                <a
                  href={href}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="mt-1 inline-flex cursor-pointer items-center gap-1.5 rounded-md bg-white/10 px-2.5 py-1 text-[11px] font-semibold text-white ring-1 ring-white/15 transition hover:bg-white/20"
                >
                  {words.open(app)}
                </a>
              ) : null}
            </div>
          </Centre>
        ) : frame.state === 'gone' ? (
          <Centre card>
            <p role="status" className="text-base font-semibold text-white">
              {words.goneTitle}
            </p>
            <p className="text-sm text-white/75">{words.goneLine}</p>
          </Centre>
        ) : frame.state === 'failed' ? (
          <Centre card>
            <p role="status" className="text-base font-semibold text-white">
              {words.failedTitle(name)}
            </p>
            <button
              type="button"
              onClick={frame.retry}
              className="mt-1 flex cursor-pointer items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-sm font-semibold text-white ring-1 ring-white/15 transition hover:bg-white/20"
            >
              <RetryGlyph />
              {words.tryAgain}
            </button>
          </Centre>
        ) : null}
      </div>
    </ReaderShell>
  );
}

function Centre({ card = false, children }: { card?: boolean; children: ReactNode }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center p-6">
      <div
        className={`flex max-w-[30rem] flex-col items-center gap-2 text-center ${
          card ? 'rounded-2xl bg-white/5 px-8 py-7 ring-1 ring-white/10' : ''
        }`}
      >
        {children}
      </div>
    </div>
  );
}
