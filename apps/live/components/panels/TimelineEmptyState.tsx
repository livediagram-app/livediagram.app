'use client';

// The Timeline's own empty state (docs/specs/013-workspace/timeline.md §2.4).
//
// Separate from ExplorerEmptyState, which is built around "this folder
// has no documents" and offers a New Document CTA per section. A feed
// with nothing in it is a different sentence: nothing has HAPPENED
// yet, which is a statement about time rather than about a container.
//
// Rare in practice. The backfill seeds an existing account's feed from
// its documents and team memberships on first read (docs/specs/013-workspace/timeline.md §5), so
// this is mostly what a genuinely new visitor sees.

import Link from 'next/link';
import { EmptyState, SOLID_BRAND_DARK_CONTROL, Glyph } from '@livediagram/ui';

export function TimelineEmptyState() {
  return (
    <EmptyState
      icon={
        <Glyph size={32} units={24} className="h-8 w-8" strokeLinecap="butt" strokeLinejoin="miter">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </Glyph>
      }
      title="Nothing has happened yet"
      description="Create a document, comment on one, or join a team, and it will show up here."
    >
      {/* Same CTA treatment as every other Explorer empty state
          (ExplorerEmptyState), so the two read as one surface. */}
      <Link
        href="/new"
        className={`inline-flex items-center gap-1.5 rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-800 ${SOLID_BRAND_DARK_CONTROL}`}
      >
        New document
      </Link>
    </EmptyState>
  );
}
