'use client';

import { useState } from 'react';
import type { CommunityAuthor } from '@livediagram/api-schema';
import { IDENTITY_FILL, identityVars } from '../identity-fill';
import { GlyphDisc } from '../optical/GlyphDisc';

// The one initial shown for an author with no picture (docs/specs/025-community/community.md).
export function communityAuthorInitial(name: string): string {
  const first = name.trim().charAt(0);
  return first ? first.toUpperCase() : '?';
}

// Who shared a Community post: their picture, or their initial on a disc in their own colour, and their
// display name ("Anonymous" for an anonymous post). Never an id. Shared by the Community app, the editor
// and the landing page so an author looks the same everywhere. A picture that fails to load (an expired or
// blocked link) falls back to the initial, as profile pictures do everywhere (docs/specs/014-identity/profile-picture.md).
export function CommunityAuthorBadge({
  author,
  size = 22,
  showName = true,
  className = '',
}: {
  author: CommunityAuthor;
  size?: number;
  showName?: boolean;
  className?: string;
}) {
  // The picture that failed, so a new picture (another author) gets its own try.
  const [failed, setFailed] = useState<string | null>(null);
  const picture = author.picture && author.picture !== failed ? author.picture : null;
  return (
    <span className={`flex min-w-0 items-center gap-2 ${className}`}>
      {picture ? (
        // A plain img: the static exports have no image loader.
        <img
          src={picture}
          onError={() => setFailed(picture)}
          alt=""
          width={size}
          height={size}
          loading="lazy"
          referrerPolicy="no-referrer"
          className="shrink-0 rounded-full object-cover ring-2 ring-white dark:ring-slate-900"
          style={{ width: size, height: size }}
        />
      ) : (
        <GlyphDisc
          size={size}
          aria-hidden
          // The author's colour, deepened in dark mode so the white initial stays readable.
          className={`${IDENTITY_FILL} font-semibold text-white ring-2 ring-white dark:ring-slate-900`}
          style={{ ...identityVars(author.color), fontSize: Math.round(size * 0.48) }}
        >
          {communityAuthorInitial(author.name)}
        </GlyphDisc>
      )}
      {showName ? <span className="truncate">{author.name}</span> : null}
    </span>
  );
}
