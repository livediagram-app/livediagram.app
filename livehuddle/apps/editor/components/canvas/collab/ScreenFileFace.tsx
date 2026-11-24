'use client';

// A file on a Screen's panel (docs/specs/009-elements/screen-and-room-sign.md "A file on the Screen"): a title card
// (the file's app logo, its name, its app) on the screen's glass, and, while the viewer stands in the Screen's room,
// the file's own read-only frame over it, opened with the viewer's own access. The frame is laid out at
// SCREEN_FRAME_LAYOUT_WIDTH and scaled down to the panel, as a real screen shows a desktop page, and takes no pointer:
// pressing the Screen opens the file large. It holds one of the page's few live places (useLiveEmbedSlot), and gives
// it up when the viewer walks out, the Screen leaves the view, or the Screen is opened large (`paused`).
// Kept free of the Screen element itself, so any wall screen (the Outdoor Cinema's, Work Tracker 1428) can wear it.
import { useLayoutEffect, useRef, useState, useSyncExternalStore, type RefObject } from 'react';
import { SCREEN_ART, type ScreenFile } from '@livehuddle/document';
import { AppBrandMark, lucideGlyph } from '@livehuddle/ui';
import { lucideLock } from '@liveworkspace/icons/lucide';
import {
  settledWithoutFrame,
  useLiveEmbedFrame,
  type LiveEmbedFrame,
} from '@liveworkspace/workbench/components/live-embed/useLiveEmbedFrame';
import { useLiveEmbedSlot } from '@liveworkspace/workbench/components/live-embed/useLiveEmbedSlot';
import { screenWords as words } from './screen-words';

/** The width a Screen's wall frame lays the file out at, before it is scaled to the panel. */
export const SCREEN_FRAME_LAYOUT_WIDTH = 1280;

// The frame's permissions, as every live embed's: its own scripts and storage, and Open's new tab; never this tab.
export const SCREEN_FRAME_SANDBOX =
  'allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox';

const LockGlyph = lucideGlyph(lucideLock, 10);
const A = SCREEN_ART;
// Type sized to the screen's width (the Screen's container), so a wall-size Screen reads as a big one does.
const cq = (px: number) => `${(px / A.bezel.w) * 100}cqw`;

const NEVER_CHANGES = () => () => {};
const isFramed = () => window.parent !== window;

export function ScreenFileFace({
  file,
  inRoom,
  paused,
}: {
  file: ScreenFile;
  // The viewer's character stands in the Screen's room: only then does the wall ask for a frame.
  inRoom: boolean;
  // The Screen is open large: the overlay holds the file, so the wall's frame is given up.
  paused: boolean;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [settled, setSettled] = useState(false);
  // Inside a frame of its own (a live embed, a workbench), embeds never nest: the title card alone.
  const nested = useSyncExternalStore(NEVER_CHANGES, isFramed, () => true);
  const active = useLiveEmbedSlot(rootRef, inRoom && !paused && !settled && !nested);
  const frame = useLiveEmbedFrame({
    item: file.liveItem,
    active,
    hostName: 'livehuddle',
    frameRef,
    tabId: file.liveTab?.id ?? null,
  });
  // An answer that needs no frame (no access, gone) gives the place back, and stands.
  const done = settledWithoutFrame(frame);
  if (done !== settled) setSettled(done);
  const scale = usePanelScale(rootRef, frame.state === 'live');
  const live = frame.state === 'live';
  const name = file.liveName || words.untitled;

  return (
    <div ref={rootRef} data-screen-file={frame.state} className="absolute inset-0">
      <TitleCard file={file} name={name} />
      {live && scale ? (
        <iframe
          ref={frameRef}
          src={frame.src}
          title={name}
          tabIndex={-1}
          aria-hidden
          sandbox={SCREEN_FRAME_SANDBOX}
          referrerPolicy="no-referrer"
          className={`pointer-events-none absolute left-0 top-0 origin-top-left border-0 bg-white transition-opacity duration-200 motion-reduce:transition-none ${
            frame.ready ? 'opacity-100' : 'opacity-0'
          }`}
          style={{
            width: SCREEN_FRAME_LAYOUT_WIDTH,
            height: scale.height / scale.k,
            transform: `scale(${scale.k})`,
          }}
        />
      ) : null}
      <StatusChip frame={frame} />
    </div>
  );
}

// The panel's size and the frame's scale to it, measured as the panel is laid out and on each resize (never per
// frame); null until measured, or while there is no frame to size.
function usePanelScale(
  ref: RefObject<HTMLDivElement | null>,
  framed: boolean,
): { k: number; height: number } | null {
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  useLayoutEffect(() => {
    const node = ref.current;
    if (!framed || !node) return;
    const read = () => {
      const width = node.offsetWidth;
      const height = node.offsetHeight;
      setSize((was) =>
        was && was.width === width && was.height === height ? was : { width, height },
      );
    };
    read();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(read);
    observer.observe(node);
    return () => observer.disconnect();
  }, [ref, framed]);
  if (!framed || !size || size.width <= 0 || size.height <= 0) return null;
  return { k: size.width / SCREEN_FRAME_LAYOUT_WIDTH, height: size.height };
}

// The still under everything: which file, never what is in it (a no-access viewer sees this much and no more).
function TitleCard({ file, name }: { file: ScreenFile; name: string }) {
  return (
    <div
      className="absolute inset-0 flex flex-col items-center justify-center text-center"
      style={{ gap: cq(5), padding: cq(10), color: A.tones.ink }}
    >
      <AppBrandMark
        app={file.liveItem.app}
        className="shrink-0 drop-shadow"
        style={{ width: cq(22), height: cq(22) }}
      />
      <span
        className="line-clamp-2 max-w-full break-words font-semibold leading-tight text-white"
        style={{ fontSize: cq(11) }}
      >
        {name}
      </span>
      <span className="max-w-full truncate font-medium opacity-70" style={{ fontSize: cq(7) }}>
        {words.appOf(file.liveItem.app)}
        {file.liveTab ? ` · ${file.liveTab.name}` : ''}
      </span>
    </div>
  );
}

// The corner chip: Live once the frame shows, or why there is none.
function StatusChip({ frame }: { frame: LiveEmbedFrame }) {
  const chip =
    frame.state === 'live' && frame.ready
      ? { tone: 'bg-emerald-500/85 text-white', words: words.live, lock: false }
      : frame.state === 'no-access'
        ? { tone: 'bg-slate-900/80 text-slate-100', words: words.noAccess, lock: true }
        : frame.state === 'gone'
          ? { tone: 'bg-slate-900/80 text-slate-200', words: words.gone, lock: false }
          : frame.state === 'failed'
            ? { tone: 'bg-slate-900/80 text-slate-200', words: words.failed, lock: false }
            : null;
  if (!chip) return null;
  return (
    <span
      role="status"
      data-screen-chip=""
      className={`absolute flex items-center rounded-full font-semibold uppercase tracking-wider shadow-sm ${chip.tone}`}
      style={{
        top: cq(4),
        right: cq(4),
        gap: cq(2),
        padding: `${cq(1.5)} ${cq(4)}`,
        fontSize: cq(5.5),
      }}
    >
      {chip.lock ? (
        <LockGlyph />
      ) : frame.state === 'live' ? (
        <span
          aria-hidden
          className="rounded-full bg-white"
          style={{ width: cq(3), height: cq(3) }}
        />
      ) : null}
      {chip.words}
    </span>
  );
}
