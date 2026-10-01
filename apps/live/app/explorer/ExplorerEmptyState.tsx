'use client';

// Explorer empty states (docs/specs/013-workspace/folders.md): a friendly animated illustration per section
// rather than a lone sentence in a dashed box. A floating gradient icon badge
// (the section's glyph) over a softly pulsing double ring and a faint
// mini-diagram motif, with a heading, a one-line explainer, and a contextual
// CTA where one applies. Motion is CSS-only (animate-empty-* in globals.css)
// and pauses under prefers-reduced-motion.
import {
  ClockIcon,
  DocumentIcon,
  FolderSolidIcon,
  OfflineFolderIcon,
  PlusIcon,
  ShareIcon,
  SparkleIcon,
  StarIcon,
  UnsortedIcon,
} from '@/components/primitives/explorer-icons';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { EmptyState, SOLID_BRAND_DARK_CONTROL } from '@livediagram/ui';
import { helpArticleHref } from '@/lib/help-articles';
import type { SelectedNode } from './views';

type EmptyKind =
  'recent' | 'shared' | 'unsorted' | 'favourites' | 'generated' | 'offline' | 'folder' | 'default';

const CONTENT: Record<
  EmptyKind,
  { icon: ReactNode; title: string; description: string; cta?: string }
> = {
  recent: {
    icon: <ClockIcon />,
    title: 'No recent documents',
    description: 'Documents you open show up here for quick access. Make your first one.',
    cta: 'New document',
  },
  shared: {
    icon: <ShareIcon />,
    title: 'Nothing shared with you yet',
    description: 'Open a share link someone sends you and the document lands here.',
  },
  unsorted: {
    icon: <UnsortedIcon />,
    title: 'Nothing unsorted',
    description: 'Documents not filed into a folder collect here, ready to organise.',
  },
  favourites: {
    icon: <StarIcon />,
    title: 'No favourites yet',
    // No CTA: a new document doesn't land here, starring an existing one
    // does — so the generic "New document" button would be a dead end
    // (docs/specs/013-workspace/favourites.md). Same reason Shared and Unsorted carry none.
    description: 'Mark a document as a favourite to show it here.',
  },
  generated: {
    icon: <SparkleIcon />,
    title: 'No generated documents yet',
    description:
      'Connect an AI tool and the documents it creates for you will appear here automatically.',
    cta: 'Set up an AI agent',
  },
  offline: {
    icon: <OfflineFolderIcon />,
    title: 'No offline documents',
    description:
      'Choose "Local Browser" as the Save location in the New Document wizard and browser-only documents collect here.',
    cta: 'New document',
  },
  folder: {
    icon: <FolderSolidIcon open />,
    title: 'This folder is empty',
    description: 'Add a document or a subfolder to organise your work.',
    cta: 'New document',
  },
  default: {
    icon: <DocumentIcon />,
    title: 'No documents yet',
    description: 'Create your first document and it will appear here.',
    cta: 'New document',
  },
};

function kindFor(selected: SelectedNode): EmptyKind {
  if (selected.kind === 'recent') return 'recent';
  if (selected.kind === 'shared') return 'shared';
  if (selected.kind === 'unsorted') return 'unsorted';
  if (selected.kind === 'favourites') return 'favourites';
  if (selected.kind === 'generated') return 'generated';
  if (selected.kind === 'offline') return 'offline';
  if (selected.kind === 'folder') return 'folder';
  return 'default';
}

export function EmptyPane({ selected }: { selected: SelectedNode }) {
  const c = CONTENT[kindFor(selected)];

  // Generated is a read-through view of AI output, not somewhere you
  // author into: its CTA points at the "connect an AI tool" help guide
  // (external /help, new tab) rather than the new-document flow.
  if (selected.kind === 'generated') {
    return (
      <EmptyState icon={c.icon} title={c.title} description={c.description}>
        {c.cta ? (
          <a
            href={helpArticleHref('connectAiTool')}
            target="_blank"
            rel="noreferrer noopener"
            className={`inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-500 ${SOLID_BRAND_DARK_CONTROL}`}
          >
            <SparkleIcon />
            {c.cta}
          </a>
        ) : null}
      </EmptyState>
    );
  }

  const ctaHref =
    selected.kind === 'folder' ? `/new?folder=${encodeURIComponent(selected.id)}` : '/new';

  return (
    <EmptyState icon={c.icon} title={c.title} description={c.description}>
      {c.cta ? (
        <Link
          href={ctaHref}
          className={`inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-500 ${SOLID_BRAND_DARK_CONTROL}`}
        >
          <PlusIcon size={14} />
          {c.cta}
        </Link>
      ) : null}
    </EmptyState>
  );
}
