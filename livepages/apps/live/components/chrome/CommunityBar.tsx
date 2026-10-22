'use client';

import { communityPostPath, documentPath } from '@livediagram/api-schema';
import { Button, buttonClassName, lucideGlyph, CommunityAuthorBadge } from '@livediagram/ui';
import { lucideArrowLeft, lucideCopyPlus, lucidePencil } from '@livediagram/icons/lucide';
import type { CommunitySession } from '@/app/document/[id]/editor-realtime';

const BackIcon = lucideGlyph(lucideArrowLeft, 14);
const CopyIcon = lucideGlyph(lucideCopyPlus, 14);
const EditIcon = lucideGlyph(lucidePencil, 14);

// The slim bar under the header when a document was opened from the Community
// (docs/specs/025-community/community.md "Viewing a post's document"; copy in the blueprint §9): who
// shared it, the way back to its post, and Make a Copy, the one thing a visitor can do with it here.
// The document is read-only here for its author too; they get Edit Your Document, which opens their own
// document, in place of copying it.
export function CommunityBar({
  community,
  onMakeCopy,
  copying,
}: {
  community: CommunitySession;
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
        <CommunityAuthorBadge author={community.author} size={22} showName={false} />
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
        {community.ownDocumentId ? (
          <a
            href={documentPath(community.ownDocumentId)}
            className={buttonClassName({ size: 'xs' })}
          >
            <EditIcon />
            Edit Your Document
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
