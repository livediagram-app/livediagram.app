'use client';

import { useState } from 'react';
import { GlyphDisc } from '@livediagram/ui';
import { pictureHost } from '@/lib/account-avatar';

// The disc that draws the signed-in user to themselves (docs/specs/014-identity/profile-picture.md):
// the initials avatar, with their profile picture laid over it once the picture has loaded. The
// initial always holds the box, so the picture arriving or failing never moves anything; a picture
// that fails leaves the initial, exactly as the avatar was before pictures existed.
//
// Decorative throughout: every host already names the person beside the disc.

type AvatarState = 'initial' | 'loading' | 'picture';

export function AccountAvatar({
  initial,
  pictureUrl,
  size,
  className,
}: {
  initial: string;
  // The resolved, sized URL from `resolveProfilePicture`, or null for the initials avatar.
  pictureUrl: string | null;
  // Diameter in px, fixed in every state.
  size: number;
  // The disc's colour and type classes.
  className: string;
}) {
  // Keyed on the URL rather than reset by an effect: a new picture starts from "loading" on the
  // very render that brings it, and an old failure cannot hide it.
  const [loadedUrl, setLoadedUrl] = useState<string | null>(null);
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const showImg = pictureUrl !== null && failedUrl !== pictureUrl;
  const state: AvatarState = !showImg
    ? 'initial'
    : loadedUrl === pictureUrl
      ? 'picture'
      : 'loading';

  return (
    <span
      aria-hidden="true"
      data-avatar-state={state}
      className="relative inline-flex shrink-0 overflow-hidden rounded-full"
      style={{ width: size, height: size }}
    >
      <GlyphDisc
        size={size}
        className={`${className} ${state === 'picture' ? '[&>span]:invisible' : ''}`}
      >
        {initial}
      </GlyphDisc>
      {showImg ? (
        <img
          src={pictureUrl}
          alt=""
          width={size}
          height={size}
          decoding="async"
          referrerPolicy="no-referrer"
          draggable={false}
          onLoad={() => setLoadedUrl(pictureUrl)}
          onError={() => {
            console.warn('[profile-picture] load failed', { host: pictureHost(pictureUrl) });
            setFailedUrl(pictureUrl);
          }}
          className={`absolute inset-0 h-full w-full rounded-full object-cover ${
            state === 'picture' ? 'opacity-100' : 'opacity-0'
          }`}
        />
      ) : null}
    </span>
  );
}
