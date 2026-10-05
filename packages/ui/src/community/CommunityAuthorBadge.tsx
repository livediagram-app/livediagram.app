'use client';

import type { CommunityAuthor } from '@livediagram/api-schema';
import { IDENTITY_FILL, identityVars } from '../identity-fill';
import { PictureDisc } from '../PictureDisc';

// The one initial shown for an author with no picture (docs/specs/025-community/community.md).
export function communityAuthorInitial(name: string): string {
  const first = name.trim().charAt(0);
  return first ? first.toUpperCase() : '?';
}

// Who shared a Community post: their picture, or their initial on a disc in their own colour, and their
// display name ("Anonymous" for an anonymous post). Never an id. Shared by the Community app, the editor
// and the landing page so an author looks the same everywhere; the disc is the shared PictureDisc, as for
// every other person in the product.
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
  return (
    <span className={`flex min-w-0 items-center gap-2 ${className}`}>
      {/* The initial holds the box until the picture loads, and stays if it fails (profile-picture.md). */}
      <PictureDisc
        pictureUrl={author.picture}
        size={size}
        aria-hidden
        // The author's colour, deepened in dark mode so the white initial stays readable.
        className={`${IDENTITY_FILL} font-semibold text-white ring-2 ring-white dark:ring-slate-900`}
        style={{ ...identityVars(author.color), fontSize: Math.round(size * 0.48) }}
      >
        {communityAuthorInitial(author.name)}
      </PictureDisc>
      {showName ? <span className="truncate">{author.name}</span> : null}
    </span>
  );
}
