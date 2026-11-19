// The From Its Files card (docs/specs/020-import-export/infrastructure-import.md "Updating a tab from its files"): on
// a tab the infrastructure import drew, the Import dialog names the files it came from and when, above the formats,
// with Update From Files.

import { useState } from 'react';
import { Button, lucideGlyph } from '@livediagram/ui';
import { lucideRefreshCw } from '@liveworkspace/icons/lucide';
import { relativeSince } from '@liveworkspace/ui/relative-time';
import type { DiagramSources } from '@livediagram/document';

const UpdateGlyph = lucideGlyph(lucideRefreshCw, 16);

// "compose.yml, main.tf and 2 more".
export function namesLine(names: readonly string[]): string {
  if (names.length <= 3) return names.join(', ');
  return `${names.slice(0, 2).join(', ')} and ${names.length - 2} more`;
}

export function InfraSourcesCard({
  sources,
  onUpdate,
}: {
  sources: Pick<DiagramSources, 'files' | 'readAt' | 'env'>;
  onUpdate: () => void;
}) {
  // Read once: render stays pure, and the line does not tick while the dialog is open.
  const [now] = useState(() => Date.now());
  const names = sources.files.map((f) => f.name.slice(f.name.lastIndexOf('/') + 1));
  return (
    <section
      aria-label="From its files"
      className="mb-4 flex flex-col gap-3 rounded-lg border border-brand-200 bg-brand-50/50 px-4 py-3 sm:flex-row sm:items-center dark:border-brand-500/30 dark:bg-brand-500/10"
    >
      <span
        aria-hidden
        className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-md bg-white text-brand-700 shadow-sm sm:flex dark:bg-slate-900 dark:text-brand-200"
      >
        <UpdateGlyph />
      </span>
      <div className="min-w-0 flex-1">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">From Its Files</h3>
        <p className="mt-0.5 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
          Drawn from <span className="font-medium">{namesLine(names)}</span>
          {sources.env ? (
            <>
              {' '}
              (<span className="font-medium">{sources.env}</span>)
            </>
          ) : null}
          {sources.readAt > 0 ? `, read ${relativeSince(sources.readAt, now)}` : ''}. Update it from
          new versions and your layout and edits stay.
        </p>
      </div>
      <Button variant="secondary" size="md" className="shrink-0" onClick={onUpdate}>
        Update From Files
      </Button>
    </section>
  );
}
