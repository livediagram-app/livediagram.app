import type { ComponentType, ReactNode } from 'react';
import { communityCategoryLabel, type CommunityPost } from '@livediagram/api-schema';
import { CommunityAuthorBadge } from './CommunityAuthorBadge';
import { communitySharedAgo } from './shared-ago';
import { COMMUNITY_DOT_GRID } from './surfaces';

// How many tags a card shows (docs/specs/025-community/community.md "Gallery").
const TILE_TAGS = 3;

type LinkProps = { href: string; className?: string; children: ReactNode };

// A card that opens its post: it lifts and takes the brand edge on hover (still under reduced motion), and rings
// while its link has focus.
const LIVE =
  'transition duration-micro ease-out focus-within:ring-2 focus-within:ring-brand-500 hover:-translate-y-[3px] hover:border-brand-500/45 hover:shadow-[0_14px_28px_-14px_rgb(14_165_233/0.35),0_4px_10px_-6px_rgb(15_23_42/0.12)] motion-reduce:hover:translate-y-0 dark:hover:shadow-[0_14px_28px_-14px_rgb(0_0_0/0.7)]';

// One Community post as a card (docs/specs/025-community/community.md "Gallery"; blueprint §9-§11): the live
// image in a fixed 4:3 box on a dot grid (no layout shift), category, title, up to three tags, the author
// with when they shared it ("2 days ago"),
// and whatever the surface puts in the corner (the gallery's live heart, the landing page's counts). The
// whole card opens the post through the title's stretched link; anything in `stats` sits above it. Lifts
// on hover, unless motion is reduced. Shared by the Community app, the landing page and the editor's publish
// preview, so a post looks the same wherever it is shown. Without `href` it is a still preview: no link, no lift,
// and `image` in place of the post's image (the editor draws the document's own snapshot before a post exists).
export function CommunityPostTile({
  post,
  href,
  imageUrl,
  image,
  stats,
  badge,
  categoryLabel,
  LinkComponent,
  now,
}: {
  post: CommunityPost;
  href?: string;
  imageUrl?: string;
  image?: ReactNode;
  stats?: ReactNode;
  // A note pinned to the image's top-right corner (My Shares' "Hidden").
  badge?: ReactNode;
  // In place of the category's name (the publish preview before one is chosen).
  categoryLabel?: string;
  // A router link where the surface has one (next/link in the Community app); a plain anchor otherwise.
  LinkComponent?: ComponentType<LinkProps>;
  // The instant "2 days ago" is measured from, read once by the list (useState(Date.now)) so every card agrees
  // and render stays pure.
  now: number;
}) {
  const Anchor: ComponentType<LinkProps> = LinkComponent ?? PlainLink;
  const tags = post.tags.slice(0, TILE_TAGS);
  return (
    <article
      className={`group relative flex flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm shadow-slate-900/5 dark:border-slate-800 dark:bg-slate-900 dark:shadow-black/20 ${href ? LIVE : ''}`}
    >
      <div
        className={`relative aspect-[4/3] overflow-hidden border-b border-slate-100 dark:border-slate-800 ${COMMUNITY_DOT_GRID}`}
      >
        {image ??
          (imageUrl ? (
            <img
              src={imageUrl}
              alt={post.title}
              loading="lazy"
              decoding="async"
              className="absolute inset-0 h-full w-full object-contain p-5 transition-transform duration-micro ease-out group-hover:scale-[1.03] motion-reduce:group-hover:scale-100"
            />
          ) : null)}
        <span className="absolute left-3 top-3 rounded-md bg-white/90 px-2 py-0.5 text-[11px] font-semibold text-slate-600 shadow-sm ring-1 ring-slate-900/5 backdrop-blur dark:bg-slate-900/85 dark:text-slate-300 dark:ring-white/10">
          {categoryLabel ?? communityCategoryLabel(post.category)}
        </span>
        {badge ? <span className="absolute right-3 top-3">{badge}</span> : null}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <h3 className="line-clamp-2 text-[15px] font-semibold leading-snug text-slate-900 dark:text-slate-100">
          {href ? (
            <Anchor
              href={href}
              className="outline-none after:absolute after:inset-0 after:content-['']"
            >
              {post.title}
            </Anchor>
          ) : (
            post.title
          )}
        </h3>
        {tags.length > 0 ? (
          <ul className="flex flex-wrap gap-x-2 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
            {tags.map((tag) => (
              <li key={tag}>#{tag}</li>
            ))}
          </ul>
        ) : null}
        <div className="mt-auto flex items-center justify-between gap-3 pt-2 text-xs text-slate-600 dark:text-slate-300">
          {/* Who, with when beneath, like a post on a feed: side by side, a narrow card cut the name short. */}
          <span className="flex min-w-0 items-center gap-2">
            <CommunityAuthorBadge author={post.author} size={28} showName={false} />
            <span className="flex min-w-0 flex-col leading-tight">
              <span className="truncate font-medium">{post.author.name}</span>
              <time
                dateTime={new Date(post.publishedAt).toISOString()}
                className="truncate text-[11px] text-slate-500 dark:text-slate-400"
              >
                {communitySharedAgo(post.publishedAt, now)}
              </time>
            </span>
          </span>
          {stats ? <div className="relative flex shrink-0 items-center gap-1">{stats}</div> : null}
        </div>
      </div>
    </article>
  );
}

function PlainLink({ href, className, children }: LinkProps) {
  return (
    <a href={href} className={className}>
      {children}
    </a>
  );
}
