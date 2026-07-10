'use client';

// Explorer empty states (spec/15): a friendly animated illustration per section
// rather than a lone sentence in a dashed box. A floating gradient icon badge
// (the section's glyph) over a softly pulsing double ring and a faint
// mini-diagram motif, with a heading, a one-line explainer, and a contextual
// CTA where one applies. Motion is CSS-only (animate-empty-* in globals.css)
// and pauses under prefers-reduced-motion.
import Link from 'next/link';
import type { ReactNode } from 'react';
import { EmptyState } from '@livediagram/ui';
import { helpArticleHref } from '@/lib/help-articles';
import {
  ClockIcon,
  DiagramIcon,
  FolderIcon,
  OfflineFolderIcon,
  PlusIcon,
  ShareIcon,
  SparkleIcon,
  UnsortedIcon,
} from './icons';
import type { SelectedNode } from './views';

type EmptyKind = 'recent' | 'shared' | 'unsorted' | 'generated' | 'offline' | 'folder' | 'default';

const CONTENT: Record<
  EmptyKind,
  { icon: ReactNode; title: string; description: string; cta?: string }
> = {
  recent: {
    icon: <ClockIcon />,
    title: 'No recent diagrams',
    description: 'Diagrams you open show up here for quick access. Make your first one.',
    cta: 'New diagram',
  },
  shared: {
    icon: <ShareIcon />,
    title: 'Nothing shared with you yet',
    description: 'Open a share link someone sends you and the diagram lands here.',
  },
  unsorted: {
    icon: <UnsortedIcon />,
    title: 'Nothing unsorted',
    description: 'Diagrams not filed into a folder collect here, ready to organise.',
  },
  generated: {
    icon: <SparkleIcon />,
    title: 'No generated diagrams yet',
    description:
      'Connect an AI tool and the diagrams it creates for you will appear here automatically.',
    cta: 'Set up an AI agent',
  },
  offline: {
    icon: <OfflineFolderIcon />,
    title: 'No offline diagrams',
    description:
      'Turn on "Save Offline, This Browser Only" in the New Diagram wizard and browser-only diagrams collect here.',
    cta: 'New diagram',
  },
  folder: {
    icon: <FolderIcon open />,
    title: 'This folder is empty',
    description: 'Add a diagram or a subfolder to organise your work.',
    cta: 'New diagram',
  },
  default: {
    icon: <DiagramIcon />,
    title: 'No diagrams yet',
    description: 'Create your first diagram and it will appear here.',
    cta: 'New diagram',
  },
};

function kindFor(selected: SelectedNode): EmptyKind {
  if (selected.kind === 'recent') return 'recent';
  if (selected.kind === 'shared') return 'shared';
  if (selected.kind === 'unsorted') return 'unsorted';
  if (selected.kind === 'generated') return 'generated';
  if (selected.kind === 'offline') return 'offline';
  if (selected.kind === 'folder') return 'folder';
  return 'default';
}

export function EmptyPane({ selected }: { selected: SelectedNode }) {
  const c = CONTENT[kindFor(selected)];

  // Generated is a read-through view of AI output, not somewhere you
  // author into: its CTA points at the "connect an AI tool" help guide
  // (external /help, new tab) rather than the new-diagram flow.
  if (selected.kind === 'generated') {
    return (
      <EmptyState icon={c.icon} title={c.title} description={c.description}>
        {c.cta ? (
          <a
            href={helpArticleHref('connectAiTool')}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-500"
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
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-500"
        >
          <PlusIcon size={14} />
          {c.cta}
        </Link>
      ) : null}
    </EmptyState>
  );
}
