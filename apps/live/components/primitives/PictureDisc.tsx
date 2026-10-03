'use client';

import { useState } from 'react';
import { GlyphDisc, type GlyphDiscProps } from '@livediagram/ui';
import { pictureHost, pictureSrc, pictureSrcSet, PICTURE_SIZES_PX } from '@/lib/account-avatar';

// A disc that may carry a profile picture (docs/specs/014-identity/profile-picture.md): the
// initials disc exactly as before, with the picture laid over it once the picture has loaded. The
// initial always holds the box, so the picture arriving or failing never moves anything; a picture
// that fails leaves the initial. Every GlyphDisc prop (ARIA, style, a presence ring's box-shadow)
// lands on the disc itself, so named avatars stay named and rings stay drawn around the picture.
//
// The picture is decorative (`alt=""`): every surface names the person beside or on the disc.

type AvatarState = 'initial' | 'loading' | 'picture';

export function PictureDisc({
  pictureUrl,
  size,
  className = '',
  children,
  ...disc
}: Omit<GlyphDiscProps, 'size'> & {
  // A profile picture URL from `resolveProfilePicture` / the api, or null / undefined for none.
  pictureUrl?: string | null;
  // Diameter in px, fixed in every state.
  size: number;
}) {
  // Keyed on the URL rather than reset by an effect: a new picture starts from "loading" on the
  // very render that brings it, and an old failure cannot hide it.
  const [loadedUrl, setLoadedUrl] = useState<string | null>(null);
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const url = pictureUrl ?? null;
  const showImg = url !== null && failedUrl !== url;
  const state: AvatarState = !showImg ? 'initial' : loadedUrl === url ? 'picture' : 'loading';

  return (
    <span
      data-avatar-state={state}
      className="relative inline-flex shrink-0 rounded-full"
      style={{ width: size, height: size }}
    >
      <GlyphDisc
        size={size}
        className={`${className} ${state === 'picture' ? '[&>span]:invisible' : ''}`}
        {...disc}
      >
        {children}
      </GlyphDisc>
      {showImg ? (
        <img
          src={pictureSrc(url, PICTURE_SIZES_PX[0])}
          srcSet={pictureSrcSet(url)}
          sizes={`${size}px`}
          alt=""
          aria-hidden="true"
          width={size}
          height={size}
          decoding="async"
          referrerPolicy="no-referrer"
          draggable={false}
          onLoad={() => setLoadedUrl(url)}
          onError={() => {
            console.warn('[profile-picture] load failed', { host: pictureHost(url) });
            setFailedUrl(url);
          }}
          className={`pointer-events-none absolute inset-0 h-full w-full rounded-full object-cover ${
            state === 'picture' ? 'opacity-100' : 'opacity-0'
          }`}
        />
      ) : null}
    </span>
  );
}
