'use client';

import type { CommunityShareInfo } from '@liveworkspace/community';
import { communityPostPath } from '@liveworkspace/community/paths';
import { Button, buttonClassName, lucideGlyph } from '@liveworkspace/ui';
import { lucideArrowLeft, lucideCopyPlus, lucidePencil } from '@liveworkspace/icons/lucide';
import { CommunityAuthorBadge } from '../tile/CommunityAuthorBadge';

const BackIcon = lucideGlyph(lucideArrowLeft, 14);
const CopyIcon = lucideGlyph(lucideCopyPlus, 14);
const EditIcon = lucideGlyph(lucidePencil, 14);

// The slim bar under an editor's header when an item was opened from the Community
// (liveworkspace/docs/specs/007-community/community.md "The community link"): who shared it, the way back to its
// post, and Make a Copy, the one thing a visitor can do with it here. The item is read-only here for its author too;
// they get Edit Your <Noun> (`own`), which opens their own item, in place of copying it.
export function CommunityBar({
  community,
  own,
  onMakeCopy,
  copying,
}: {
  community: CommunityShareInfo;
  // The author's own way back to their item: its address and the button's words ("Edit Your Plan"). Null for every
  // other visitor.
  own: { href: string; label: string } | null;
  onMakeCopy: () => void;
  copying: boolean;
}) {
  return (
    <div
      role="region"
      aria-label="Community"
      className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-brand-100 bg-brand-50/70 px-4 py-1.5 text-sm dark:border-brand-500/20 dark:bg-brand-500/10"
    >
      <p className="flex min-w-0 flex-1 items-center gap-2 text-slate-700 dark:text-slate-200">
        <CommunityAuthorBadge
          author={community.author}
          size={22}
          showName={false}
          className="shrink-0"
        />
        <span className="truncate">
          Shared to the Community by{' '}
          <span className="font-medium text-slate-900 dark:text-slate-50">
            {community.author.name}
          </span>
        </span>
      </p>
      <div className="flex shrink-0 items-center gap-2">
        <a
          href={communityPostPath(community.postId)}
          className={buttonClassName({ variant: 'secondary', size: 'xs' })}
        >
          <BackIcon />
          Back to Community
        </a>
        {own ? (
          <a href={own.href} className={buttonClassName({ size: 'xs' })}>
            <EditIcon />
            {own.label}
          </a>
        ) : (
          <Button size="xs" onClick={onMakeCopy} disabled={copying}>
            <CopyIcon />
            {copying ? 'Copying' : 'Make a Copy'}
          </Button>
        )}
      </div>
    </div>
  );
}
