'use client';

import {
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import type { AvatarReactionKind } from '@livehuddle/avatar/reactions';
import type { AvatarStatus } from '@livehuddle/avatar/status';
import type { CharacterLook } from '@/lib/real-3d/character';
import {
  PORTRAIT_FAILED,
  PORTRAIT_GRADE,
  portraitKey,
  portraitRatio,
  portraitUrl,
  subscribePortraits,
  type PortraitCrop,
  type PortraitRequest,
} from '@/lib/real-3d/figure-portrait';

// The avatar palette's pictures of your character (docs/specs/008-canvas/3d-engine.md "Palette portraits"): the
// scene's own 3D character, rendered offscreen by one shared renderer (figure-portraits.ts, loaded on first use) and
// kept as images, so every tile shows what the Space draws. A placeholder while one renders; the sprite if it cannot.

type Portraits = typeof import('@/components/canvas/real-3d/figure-portraits');
let loading: Promise<Portraits> | null = null;
function loadPortraits(): Promise<Portraits> {
  // A failed fetch (offline, a new deploy) is forgotten, so the next tile to mount tries again.
  loading ??= import('@/components/canvas/real-3d/figure-portraits').catch((e: unknown) => {
    loading = null;
    throw e;
  });
  return loading;
}

// The store's key only (pictures are drawn in the browser): a server render reads 1.
const ratio = () => portraitRatio(globalThis.devicePixelRatio ?? 1);

/** One picture: the look in a crop and pose, `width` x `height` CSS px. */
export function FigurePortrait({
  look,
  crop,
  move = null,
  status = null,
  width,
  height,
  fallback,
}: {
  look: CharacterLook;
  crop: PortraitCrop;
  move?: AvatarReactionKind | null;
  // A status whose signature the figure wears (the preview card's).
  status?: AvatarStatus | null;
  width: number;
  height: number;
  // What to show when it cannot be rendered (no WebGL, the pack failed): the sprite.
  fallback: ReactNode;
}) {
  const req: PortraitRequest = { look, crop, move, width, height, status };
  const key = portraitKey(req, ratio());
  const url = useSyncExternalStore(
    subscribePortraits,
    () => portraitUrl(key),
    () => undefined,
  );
  // The request is the key's; the latest one is what the effect asks for.
  const ask = useEffectEvent((m: Portraits) => m.requestPortrait(req));
  useEffect(() => {
    if (portraitUrl(key) !== undefined) return;
    let live = true;
    loadPortraits().then(
      (m) => {
        if (live) ask(m);
      },
      () => {},
    );
    return () => {
      live = false;
    };
  }, [key]);
  if (url === PORTRAIT_FAILED) return <>{fallback}</>;
  return (
    <span
      data-portrait={key}
      className="relative inline-flex shrink-0 items-end justify-center"
      style={{ width, height }}
    >
      {url ? (
        <img
          src={url}
          alt=""
          width={width}
          height={height}
          draggable={false}
          className="block animate-fade-in"
          style={{ width, height, filter: PORTRAIT_GRADE }}
        />
      ) : (
        <span
          data-portrait-loading=""
          className="absolute inset-x-[22%] inset-y-[8%] animate-pulse rounded-[40%] bg-slate-200/70 dark:bg-slate-700/50"
        />
      )}
    </span>
  );
}

/** The preview card's Behaviour, played on a loop by the shared renderer into a canvas of its own. */
export function PortraitPlayer({
  look,
  move,
  status = null,
  width,
  height,
  fallback,
}: {
  look: CharacterLook;
  move: AvatarReactionKind;
  status?: AvatarStatus | null;
  width: number;
  height: number;
  fallback: ReactNode;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [failed, setFailed] = useState(false);
  const req: PortraitRequest = { look, crop: 'stage', move, width, height, status };
  const key = portraitKey(req, ratio());
  const play = useEffectEvent((m: Portraits, canvas: HTMLCanvasElement) =>
    m.playPortrait(canvas, req, move, () => setFailed(true)),
  );
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    let stop: (() => void) | null = null;
    let live = true;
    loadPortraits().then(
      (m) => {
        if (live) stop = play(m, canvas);
      },
      () => setFailed(true),
    );
    return () => {
      live = false;
      stop?.();
    };
  }, [key, move]);
  if (failed) return <>{fallback}</>;
  return (
    <canvas
      ref={ref}
      data-portrait-player={key}
      className="block"
      style={{ width, height, filter: PORTRAIT_GRADE }}
    />
  );
}
