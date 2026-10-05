import type { CommunityAuthor } from '@livediagram/api-schema';
import { GlyphDisc } from '@livediagram/ui';
import { initialOf } from '@/lib/format';

// Who shared a post (docs/specs/025-community/community.md "What a post shows"): their picture, or
// their initial on a disc in their own colour, and their display name. Never an id.
export function AuthorBadge({
  author,
  size = 22,
  className = '',
}: {
  author: CommunityAuthor;
  size?: number;
  className?: string;
}) {
  return (
    <span className={`flex min-w-0 items-center gap-2 ${className}`}>
      {author.picture ? (
        // A plain img: the static export has no image loader.
        <img
          src={author.picture}
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
          className="font-semibold text-white ring-2 ring-white dark:ring-slate-900"
          style={{ backgroundColor: author.color, fontSize: Math.round(size * 0.48) }}
        >
          {initialOf(author.name)}
        </GlyphDisc>
      )}
      <span className="truncate">{author.name}</span>
    </span>
  );
}
