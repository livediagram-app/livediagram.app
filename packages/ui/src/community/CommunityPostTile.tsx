import type { ComponentType, ReactNode } from 'react';
import { communityCategoryLabel, type CommunityPost } from '@livediagram/api-schema';
import { CommunityAuthorBadge } from './CommunityAuthorBadge';

// How many tags a card shows (docs/specs/025-community/community.md "Gallery").
const TILE_TAGS = 3;

type LinkProps = { href: string; className?: string; children: ReactNode };

// One Community post as a card (docs/specs/025-community/community.md "Gallery"; blueprint §9-§11): the live
// image in a fixed 4:3 box on a dot grid (no layout shift), category, title, up to three tags, the author,
// and whatever the surface puts in the corner (the gallery's live heart, the landing page's counts). The
// whole card opens the post through the title's stretched link; anything in `stats` sits above it. Lifts
// on hover, unless motion is reduced. Shared by the Community app and the landing page, so a post looks
// the same wherever it is shown.
export function CommunityPostTile({
  post,
  href,
  imageUrl,
  stats,
  LinkComponent,
}: {
  post: CommunityPost;
  href: string;
  imageUrl: string;
  stats?: ReactNode;
  // A router link where the surface has one (next/link in the Community app); a plain anchor otherwise.
  LinkComponent?: ComponentType<LinkProps>;
}) {
  const Anchor: ComponentType<LinkProps> = LinkComponent ?? PlainLink;
  const tags = post.tags.slice(0, TILE_TAGS);
  return (
    <article className="group relative flex flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm shadow-slate-900/5 transition duration-micro ease-out focus-within:ring-2 focus-within:ring-brand-500 hover:-translate-y-[3px] hover:border-brand-500/45 hover:shadow-[0_14px_28px_-14px_rgb(14_165_233/0.35),0_4px_10px_-6px_rgb(15_23_42/0.12)] motion-reduce:hover:translate-y-0 dark:border-slate-800 dark:bg-slate-900 dark:shadow-black/20 dark:hover:shadow-[0_14px_28px_-14px_rgb(0_0_0/0.7)]">
      <div className="relative aspect-[4/3] overflow-hidden border-b border-slate-100 bg-slate-50 bg-[radial-gradient(circle,rgb(148_163_184/0.35)_1px,transparent_1.2px)] bg-[length:14px_14px] dark:border-slate-800 dark:bg-slate-950 dark:bg-[radial-gradient(circle,rgb(100_116_139/0.3)_1px,transparent_1.2px)]">
        <img
          src={imageUrl}
          alt={post.title}
          loading="lazy"
          decoding="async"
          className="absolute inset-0 h-full w-full object-contain p-5 transition-transform duration-micro ease-out group-hover:scale-[1.03] motion-reduce:group-hover:scale-100"
        />
        <span className="absolute left-3 top-3 rounded-md bg-white/90 px-2 py-0.5 text-[11px] font-semibold text-slate-600 shadow-sm ring-1 ring-slate-900/5 backdrop-blur dark:bg-slate-900/85 dark:text-slate-300 dark:ring-white/10">
          {communityCategoryLabel(post.category)}
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <h3 className="line-clamp-2 text-[15px] font-semibold leading-snug text-slate-900 dark:text-slate-100">
          <Anchor
            href={href}
            className="outline-none after:absolute after:inset-0 after:content-['']"
          >
            {post.title}
          </Anchor>
        </h3>
        {tags.length > 0 ? (
          <ul className="flex flex-wrap gap-x-2 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
            {tags.map((tag) => (
              <li key={tag}>#{tag}</li>
            ))}
          </ul>
        ) : null}
        <div className="mt-auto flex items-center justify-between gap-3 pt-2 text-xs text-slate-600 dark:text-slate-300">
          <CommunityAuthorBadge author={post.author} />
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
