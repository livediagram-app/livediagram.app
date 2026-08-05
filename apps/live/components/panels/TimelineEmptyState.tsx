'use client';

// The Timeline's own empty state (spec/138 §2.4).
//
// Separate from ExplorerEmptyState, which is built around "this folder
// has no diagrams" and offers a New Diagram CTA per section. A feed
// with nothing in it is a different sentence: nothing has HAPPENED
// yet, which is a statement about time rather than about a container.
//
// Rare in practice. The backfill seeds an existing account's feed from
// its diagrams and team memberships on first read (spec/138 §5), so
// this is mostly what a genuinely new visitor sees.

import Link from 'next/link';
import { EmptyState } from '@livediagram/ui';

export function TimelineEmptyState() {
  return (
    <EmptyState
      icon={
        <svg
          className="h-8 w-8"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.6}
          viewBox="0 0 24 24"
          aria-hidden
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      }
      title="Nothing has happened yet"
      description="Create a diagram, comment on one, or join a team, and it will show up here."
    >
      {/* Same CTA treatment as every other Explorer empty state
          (ExplorerEmptyState), so the two read as one surface. */}
      <Link
        href="/new"
        className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-500"
      >
        New diagram
      </Link>
    </EmptyState>
  );
}
