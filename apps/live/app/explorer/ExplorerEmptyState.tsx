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
  ThisBrowserIcon,
  PlusIcon,
  ShareIcon,
  StarIcon,
} from '@/components/primitives/explorer-icons';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { EmptyState, SOLID_BRAND_DARK_CONTROL } from '@livediagram/ui';
import type { SelectedNode } from './views';

type EmptyKind = 'recent' | 'shared' | 'favourites' | 'offline' | 'folder' | 'default';

const CONTENT: Record<
  EmptyKind,
  { icon: ReactNode; title: string; description: string; cta?: string }
> = {
  recent: {
    icon: <ClockIcon />,
    title: 'No recent documents',
    description: 'Documents show up here as they change, newest first. Make your first one.',
    cta: 'New document',
  },
  shared: {
    icon: <ShareIcon />,
    title: 'Nothing shared with you yet',
    description: 'Open a share link someone sends you and the document lands here.',
  },
  favourites: {
    icon: <StarIcon />,
    title: 'No favourites yet',
    // No CTA: a new document doesn't land here, starring an existing one
    // does — so the generic "New document" button would be a dead end
    // (docs/specs/013-workspace/favourites.md). Same reason Shared with me carries none.
    description: 'Mark a document as a favourite to show it here.',
  },
  offline: {
    icon: <ThisBrowserIcon />,
    title: 'Nothing in this browser',
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
  if (selected.kind === 'favourites') return 'favourites';
  if (selected.kind === 'offline') return 'offline';
  if (selected.kind === 'folder') return 'folder';
  return 'default';
}

export function EmptyPane({ selected }: { selected: SelectedNode }) {
  const c = CONTENT[kindFor(selected)];

  const ctaHref =
    selected.kind === 'folder' ? `/new?folder=${encodeURIComponent(selected.id)}` : '/new';

  return (
    <EmptyState icon={c.icon} title={c.title} description={c.description}>
      {c.cta ? (
        <Link
          href={ctaHref}
          className={`inline-flex items-center gap-1.5 rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-800 ${SOLID_BRAND_DARK_CONTROL}`}
        >
          <PlusIcon size={14} />
          {c.cta}
        </Link>
      ) : null}
    </EmptyState>
  );
}
