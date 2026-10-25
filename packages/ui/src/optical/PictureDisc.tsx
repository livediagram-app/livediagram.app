'use client';

import { useCallback, useState, useSyncExternalStore } from 'react';
import { profilePictureOf, sizedPictureUrl } from '@liveworkspace/sites/picture';
import { GlyphDisc, isText, type GlyphDiscProps } from './GlyphDisc';

// A person's avatar: their Google profile picture over the initials on their disc (liveworkspace/docs/accounts.md
// "Profile pictures"). The disc and its initials always render, so the avatar is the same size in every state and a
// picture never moves anything: the picture is an <img> of fixed size laid over it, shown once it has loaded. With
// no picture, one that isn't a Google picture URL (isProfilePictureUrl), or one that failed to load, it is the
// initials alone, exactly as GlyphDisc draws them. It makes no request of its own beyond the image: the URL comes
// with the person data the surface already has.
export type PictureDiscProps = GlyphDiscProps & {
  // The person's published picture, or null for none.
  pictureUrl?: string | null;
  // The person's name, the picture's alt text.
  name?: string;
};

// Pictures that failed to load on this page: their avatars stay on the initials for the rest of the page's life
// rather than asking again. Bounded, the oldest let go first.
export const PICTURE_FAILURES_MAX = 500;
const failed = new Set<string>();
const failedListeners = new Set<() => void>();
let failedVersion = 0;

function markFailed(url: string) {
  if (failed.has(url)) return;
  failed.add(url);
  if (failed.size > PICTURE_FAILURES_MAX) failed.delete(failed.values().next().value as string);
  failedVersion++;
  for (const listener of failedListeners) listener();
}

const subscribeFailed = (listener: () => void) => {
  failedListeners.add(listener);
  return () => {
    failedListeners.delete(listener);
  };
};
const failedSnapshot = () => failedVersion;

/** For tests: forget which pictures failed. */
export function resetPictureFailures() {
  failed.clear();
  failedVersion++;
}

// The size asked of Google when the disc's size is set by its classes (a breakpoint disc).
const DEFAULT_PICTURE_PX = 40;

export function PictureDisc({
  pictureUrl,
  name = '',
  size,
  children,
  className = '',
  ...disc
}: PictureDiscProps) {
  useSyncExternalStore(subscribeFailed, failedSnapshot, failedSnapshot);
  const url = profilePictureOf(pictureUrl);
  const shown = url && !failed.has(url) ? url : null;
  // Which URL has loaded: a new URL starts again from the initials.
  const [loaded, setLoaded] = useState<string | null>(null);
  const isLoaded = shown !== null && loaded === shown;
  // An image already in the cache can finish before React listens for its load.
  const attach = useCallback(
    (img: HTMLImageElement | null) => {
      if (img && shown && img.complete && img.naturalWidth > 0) setLoaded(shown);
    },
    [shown],
  );

  if (!shown) {
    return (
      <GlyphDisc size={size} className={className} {...disc}>
        {children}
      </GlyphDisc>
    );
  }
  const px = size ?? DEFAULT_PICTURE_PX;
  const src = sizedPictureUrl(shown, px);
  return (
    <GlyphDisc
      size={size}
      className={`relative overflow-hidden ${className}`}
      data-picture={isLoaded ? 'loaded' : 'loading'}
      {...disc}
    >
      {isText(children) ? <span className="text-optical-centre">{children}</span> : children}
      <img
        ref={attach}
        key={shown}
        src={src}
        srcSet={`${src} 1x, ${sizedPictureUrl(shown, px * 2)} 2x`}
        width={px}
        height={px}
        alt={name}
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
        draggable={false}
        onLoad={() => setLoaded(shown)}
        onError={() => markFailed(shown)}
        className={`absolute inset-0 size-full max-w-none rounded-full object-cover ${isLoaded ? '' : 'opacity-0'}`}
      />
    </GlyphDisc>
  );
}
