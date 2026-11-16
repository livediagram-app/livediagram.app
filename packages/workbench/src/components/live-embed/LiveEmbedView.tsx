'use client';

// A live embed's face (liveworkspace/docs/specs/004-index/live-embeds.md "What a reader sees"; each host's
// docs/specs/013-workspace/embeds.md "Live embeds"): the Embed element showing another app's file. The snapshot is
// always underneath; on screen and in a place among the page's few, the file's own read-only frame fades in over it.
// A reader who cannot open the file sees the snapshot made unreadable, asked of its owner, and Open in its own app; a
// file gone says so; a failure offers Try Again. The face is pointer-inert but for its few controls, so the canvas
// drags, selects and pans over it, and the frame takes the pointer only while Use the file is on. Those controls sit
// above the element, clear of the file's own content, counter-scaled to one size on screen at any zoom.
import { useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { BrandMark } from '@liveworkspace/brand';
import { useCanvasZoom } from '../canvas/CanvasZoomContext';
import { Tooltip, lucideGlyph } from '@liveworkspace/ui';
import {
  lucideExternalLink,
  lucideHand,
  lucideLock,
  lucideRefreshCw,
} from '@liveworkspace/icons/lucide';
import type { LiveItem } from '@liveworkspace/element-model/live-item';
import { liveEmbedItemHref } from './live-embed-target';
import { liveEmbedWords as words, liveNameOr } from './live-embed-words';
import { settledWithoutFrame, useLiveEmbedFrame } from './useLiveEmbedFrame';
import { useLiveEmbedSlot } from './useLiveEmbedSlot';

const OpenGlyph = lucideGlyph(lucideExternalLink, 13);
const HandGlyph = lucideGlyph(lucideHand, 13);
const LockGlyph = lucideGlyph(lucideLock, 18);
const RetryGlyph = lucideGlyph(lucideRefreshCw, 13);

// The frame's permissions: its own scripts and storage, and Open's new tab; never the host's tab.
const FRAME_SANDBOX =
  'allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox';

export type LiveEmbedViewProps = {
  liveItem: LiveItem | undefined;
  liveName: string | undefined;
  livePoster: string | undefined;
  // This app's name, as the frame shows its workbench's ("livedocuments").
  hostName: string;
  // An Editor of the host, who chooses the file (a double-click on the element).
  canChoose: boolean;
  // A Media animation's class from the host (moves the content inside the frame).
  className?: string;
};

// Clicks on a control are the control's, never the canvas's select-and-drag.
const keepFromCanvas = {
  onPointerDown: (e: { stopPropagation: () => void }) => e.stopPropagation(),
  onDoubleClick: (e: { stopPropagation: () => void }) => e.stopPropagation(),
};

const NEVER_CHANGES = () => () => {};
const isFramed = () => window.parent !== window;
const pageHost = () => window.location.host;

export function LiveEmbedView({
  liveItem,
  liveName,
  livePoster,
  hostName,
  canChoose,
  className = '',
}: LiveEmbedViewProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [using, setUsing] = useState(false);
  const [settled, setSettled] = useState(false);
  // Inside any frame (a live embed's own, a share-code embed, a workbench), embeds never nest: the snapshot alone.
  // Neither fact changes in a page's life, so the stores never notify; the server draws the snapshot alone.
  const nested = useSyncExternalStore(NEVER_CHANGES, isFramed, () => true);
  const host = useSyncExternalStore(NEVER_CHANGES, pageHost, () => null);
  const active = useLiveEmbedSlot(rootRef, !!liveItem && !settled && !nested);
  const frame = useLiveEmbedFrame({ item: liveItem ?? null, active, hostName, frameRef });
  // An answer that needs no frame gives the place back.
  const done = settledWithoutFrame(frame);
  if (done !== settled) setSettled(done);
  const name = liveNameOr(liveName, liveItem?.app);
  const live = frame.state === 'live';
  if (!live && using) setUsing(false);
  const href =
    liveItem && host !== null ? liveEmbedItemHref(liveItem.app, liveItem.itemId, host) : null;
  const noAccess = frame.state === 'no-access';

  return (
    <div
      ref={rootRef}
      data-live-embed={frame.state}
      className="group relative h-full w-full rounded-[inherit]"
    >
      <div
        className={`relative h-full w-full overflow-hidden rounded-[inherit] bg-slate-100 dark:bg-slate-900 ${className}`}
      >
        <Snapshot
          poster={livePoster}
          app={liveItem?.app}
          look={
            noAccess
              ? 'obscured'
              : !live && !!liveItem && frame.state !== 'idle' && frame.state !== 'loading'
                ? 'dim'
                : 'clear'
          }
        />

        {live ? (
          <iframe
            ref={frameRef}
            src={frame.src}
            title={name}
            sandbox={FRAME_SANDBOX}
            referrerPolicy="no-referrer"
            className={`absolute inset-0 h-full w-full border-0 bg-white transition-opacity duration-200 motion-reduce:transition-none dark:bg-slate-900 ${
              frame.ready ? 'opacity-100' : 'opacity-0'
            } ${using ? '' : 'pointer-events-none'}`}
          />
        ) : null}

        {!liveItem ? (
          livePoster ? null : (
            <Centre>
              <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-200">
                {words.emptyTitle(canChoose)}
              </span>
              <span className="text-[10px] leading-snug text-slate-500 dark:text-slate-400">
                {words.emptyLine}
              </span>
            </Centre>
          )
        ) : noAccess ? (
          <Centre glass>
            <span className="text-slate-500 dark:text-slate-300">
              <LockGlyph />
            </span>
            <span className="text-[11px] font-semibold text-slate-800 dark:text-slate-100">
              {words.noAccess(name)}
            </span>
            <span className="text-[10px] leading-snug text-slate-500 dark:text-slate-400">
              {words.noAccessLine}
            </span>
            {href ? (
              <a
                href={href}
                target="_blank"
                rel="noreferrer noopener"
                {...keepFromCanvas}
                onClick={(e) => e.stopPropagation()}
                className="pointer-events-auto mt-1 cursor-pointer rounded-md bg-brand-700 px-2.5 py-1 text-[11px] font-semibold text-white transition hover:bg-brand-800 dark:bg-brand-400 dark:text-slate-950 dark:hover:bg-brand-300"
              >
                {words.open(liveItem.app)}
              </a>
            ) : null}
          </Centre>
        ) : frame.state === 'gone' ? (
          <Centre glass>
            <span className="text-[11px] font-semibold text-slate-800 dark:text-slate-100">
              {words.gone}
            </span>
            <span className="text-[10px] leading-snug text-slate-500 dark:text-slate-400">
              {words.goneLine(canChoose)}
            </span>
          </Centre>
        ) : frame.state === 'failed' ? (
          <Centre glass>
            <span className="text-[11px] font-semibold text-slate-800 dark:text-slate-100">
              {words.failed(name)}
            </span>
            <button
              type="button"
              {...keepFromCanvas}
              onClick={(e) => {
                e.stopPropagation();
                setSettled(false);
                frame.retry();
              }}
              className="pointer-events-auto mt-1 flex cursor-pointer items-center gap-1.5 rounded-md bg-slate-900/80 px-2.5 py-1 text-[11px] font-semibold text-white transition hover:bg-slate-900 dark:bg-white/15 dark:hover:bg-white/25"
            >
              <RetryGlyph />
              {words.tryAgain}
            </button>
          </Centre>
        ) : null}

        {liveItem ? (
          <NameChip
            app={liveItem.app}
            name={name}
            live={live && frame.ready}
            loading={frame.state === 'loading' || (live && !frame.ready)}
          />
        ) : null}
      </div>

      {liveItem && href ? (
        <Controls>
          {live && frame.ready ? (
            <Control
              label={using ? words.stopUsing : words.use}
              pressed={using}
              onPress={() => setUsing((u) => !u)}
            >
              <HandGlyph />
            </Control>
          ) : null}
          <Tooltip label={words.open(liveItem.app)}>
            <a
              href={href}
              target="_blank"
              rel="noreferrer noopener"
              aria-label={words.open(liveItem.app)}
              {...keepFromCanvas}
              onClick={(e) => e.stopPropagation()}
              className="pointer-events-auto flex h-7 w-7 cursor-pointer items-center justify-center rounded-md bg-slate-900/85 text-white shadow-sm transition hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600"
            >
              <OpenGlyph />
            </a>
          </Tooltip>
        </Controls>
      ) : null}
    </div>
  );
}

// Use the file and Open: a row just above the element's top left, outside the file's own content, at one size on
// screen whatever the zoom (counter-scaled, as the canvas's other chrome on an element is), shown on hover or focus.
function Controls({ children }: { children: ReactNode }) {
  const zoom = useCanvasZoom();
  return (
    <div
      data-live-embed-controls=""
      style={{
        transform: `scale(${1 / zoom})`,
        transformOrigin: 'bottom left',
        marginBottom: 6 / zoom,
      }}
      className="pointer-events-none absolute bottom-full left-0 z-10 flex gap-1 opacity-0 transition focus-within:opacity-100 group-hover:opacity-100 motion-reduce:transition-none"
    >
      {children}
    </div>
  );
}

// The snapshot under everything: the picture as last seen, else the app's logo on a quiet card.
function Snapshot({
  poster,
  app,
  look,
}: {
  poster: string | undefined;
  app: LiveItem['app'] | undefined;
  // obscured: a reader without access, for whom no word of it may be readable.
  look: 'clear' | 'dim' | 'obscured';
}) {
  if (poster)
    return (
      <img
        src={poster}
        alt=""
        aria-hidden
        draggable={false}
        data-snapshot={look}
        className={`pointer-events-none absolute inset-0 h-full w-full object-cover transition-[filter] duration-200 motion-reduce:transition-none ${LOOK[look]}`}
      />
    );
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 flex items-center justify-center bg-[radial-gradient(circle_at_30%_20%,rgba(148,163,184,0.18),transparent_60%)]"
    >
      {app ? (
        <BrandMark app={app} className="size-10 opacity-40" />
      ) : (
        <span className="flex size-10 items-center justify-center rounded-xl border border-dashed border-slate-300 dark:border-slate-700" />
      )}
    </div>
  );
}

// No word of the snapshot survives the obscured look: a 24 px blur over a poster drawn at most 480 px wide is wider
// than any of its letters, and the slight scale keeps the blur's soft edge out of the frame.
const LOOK = {
  clear: '',
  dim: 'blur-[1.5px] saturate-50',
  obscured: 'scale-110 blur-xl saturate-50 opacity-70',
} as const;

function Centre({ glass = false, children }: { glass?: boolean; children: ReactNode }) {
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-3">
      <div
        role="status"
        className={`flex max-w-[22rem] flex-col items-center gap-1 text-center ${
          glass
            ? 'rounded-xl border border-white/60 bg-white/85 px-4 py-3 shadow-sm backdrop-blur dark:border-white/10 dark:bg-slate-900/85'
            : ''
        }`}
      >
        {children}
      </div>
    </div>
  );
}

// Which file this is, bottom left: its app's logo and its name, and a dot while it is live.
function NameChip({
  app,
  name,
  live,
  loading,
}: {
  app: LiveItem['app'];
  name: string;
  live: boolean;
  loading: boolean;
}) {
  return (
    <div className="pointer-events-none absolute bottom-1.5 left-1.5 flex max-w-[calc(100%-0.75rem)] items-center gap-1.5 rounded-full bg-white/90 py-0.5 pl-1 pr-2 shadow-sm backdrop-blur dark:bg-slate-900/85">
      <BrandMark app={app} className="size-3.5 shrink-0" />
      <span className="truncate text-[10px] font-semibold text-slate-800 dark:text-slate-100">
        {name}
      </span>
      {live ? (
        <span className="flex shrink-0 items-center gap-1 text-[9px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
          <span aria-hidden className="size-1.5 rounded-full bg-emerald-500" />
          {words.live}
        </span>
      ) : loading ? (
        <span
          aria-label={words.loading(name)}
          role="status"
          className="size-2 shrink-0 animate-pulse rounded-full bg-slate-400 motion-reduce:animate-none"
        />
      ) : null}
    </div>
  );
}

function Control({
  label,
  pressed,
  onPress,
  children,
}: {
  label: string;
  pressed: boolean;
  onPress: () => void;
  children: ReactNode;
}) {
  return (
    <Tooltip label={label}>
      <button
        type="button"
        aria-label={label}
        aria-pressed={pressed}
        {...keepFromCanvas}
        onClick={(e) => {
          e.stopPropagation();
          onPress();
        }}
        className={`pointer-events-auto flex h-7 w-7 cursor-pointer items-center justify-center rounded-md shadow-sm transition ${
          pressed
            ? 'bg-brand-700 text-white dark:bg-brand-400 dark:text-slate-950'
            : 'bg-slate-900/85 text-white hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600'
        }`}
      >
        {children}
      </button>
    </Tooltip>
  );
}
