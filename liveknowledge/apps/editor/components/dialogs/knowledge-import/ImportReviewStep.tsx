import { useMemo } from 'react';
import { trimOffer, type PagesBound } from '@/lib/knowledge-import/import-trim';
import { ImportTrimNotice, usePagesOffer } from './ImportTrimOffer';
import type { ImportPlan } from '@liveknowledge/knowledge-import';
import { BackBar, Button, CompactEmptyState } from '@liveknowledge/ui';
import { Callout } from '@liveworkspace/ui/callout';
import { PagesIcon } from '@/components/page-tree/page-tree-icons';
import {
  blockedCopy,
  issueGroups,
  pagesLabel,
  picturesLabel,
} from '@/lib/knowledge-import/import-copy';
import type { ImportDestination } from '@/lib/knowledge-import/run-import';
import { DestinationPicker, type DestinationPage } from './DestinationPicker';
import { ImportIssues } from './ImportIssues';
import { PlanTreePreview } from './PlanTreePreview';
import type { KnowledgeSource } from './sources';

// The review step (docs/specs/020-import-export/knowledgebase-import.md "Where it lands"): what was found, what is
// left out and why, where it will land, and Import <n> Pages. A plan that cannot fit says why and offers no Import.
export function ImportReviewStep({
  source,
  archiveName,
  plan,
  destination,
  replanning,
  bound,
  pages,
  activePageId,
  onDestination,
  onImport,
  onTrim,
  onBack,
}: {
  source: KnowledgeSource;
  archiveName: string;
  plan: ImportPlan;
  destination: ImportDestination;
  replanning: boolean;
  /** What bounds the destination's pages with Pro on (tiers.md); null with Pro off. */
  bound: PagesBound | null;
  pages: readonly DestinationPage[];
  activePageId: string;
  onDestination: (destination: ImportDestination) => void;
  onImport: () => void;
  // Import the first pages that fit (tiers.md "Import over the limit"); absent where none is offered.
  onTrim?: () => void;
  onBack: () => void;
}) {
  const { summary } = plan;
  const groups = useMemo(() => issueGroups(plan), [plan]);
  // With Pro on, a plan over what the destination may hold offers the pages that fit, in place of the refusal.
  const offer = usePagesOffer(bound);
  const over =
    bound && onTrim && summary.blocked?.reason === 'too-many-pages' ? summary.blocked : null;
  const blocked = summary.blocked && !over ? blockedCopy(summary.blocked) : null;
  const empty = !summary.blocked && plan.pages.length === 0;
  const under =
    destination.kind === 'under' ? pages.find((p) => p.id === destination.pageId) : null;

  return (
    <div className="flex min-h-[28rem] flex-col" aria-busy={replanning}>
      <BackBar label={source.title} current={archiveName} onClick={onBack} />
      {empty ? (
        <div className="flex flex-1 items-center justify-center">
          <CompactEmptyState
            icon={<PagesIcon size={18} />}
            title="No Pages Found"
            description={
              source.key === 'confluence'
                ? 'This archive holds no HTML pages. Export the space as HTML and try again.'
                : 'This archive holds no Markdown pages. Check it is the right export and try again.'
            }
            action={
              <Button variant="secondary" size="md" onClick={onBack}>
                Choose Another
              </Button>
            }
          />
        </div>
      ) : (
        <div className="space-y-4">
          {over && bound ? (
            <ImportTrimNotice found={over.found} room={over.room} bound={bound} />
          ) : blocked ? (
            <Callout tone="error" role="alert" title={blocked.title}>
              {blocked.detail}
            </Callout>
          ) : (
            <>
              {summary.leftOut && bound ? (
                <ImportTrimNotice
                  found={summary.pages + summary.leftOut}
                  room={summary.pages}
                  bound={bound}
                />
              ) : null}
              <section aria-label="Found">
                <p
                  className="text-sm font-semibold text-slate-900 dark:text-slate-100"
                  data-testid="knowledge-import-found"
                >
                  {pagesLabel(summary.pages)}
                  {summary.pictures > 0 ? ` and ${picturesLabel(summary.pictures)}` : ''} Found
                </p>
                <div className="mt-2">
                  <PlanTreePreview pages={plan.pages} />
                </div>
              </section>
            </>
          )}
          <ImportIssues groups={groups} />
          <DestinationPicker
            destination={destination}
            pages={pages}
            defaultPageId={activePageId}
            newName={archiveName}
            disabled={replanning}
            onChange={onDestination}
          />
          {blocked || over ? null : (
            <Callout tone="info" role="note">
              An import cannot be undone as one step.{' '}
              {destination.kind === 'new'
                ? 'The pages land in a Knowledgebase of their own, so they can be deleted together.'
                : `The pages land together under ${under?.name.trim() || 'the page you chose'}, so they can be deleted together.`}
            </Callout>
          )}
        </div>
      )}
      {empty ? null : (
        <div className="mt-auto flex justify-end gap-2 pt-4">
          <Button variant="secondary" size="md" onClick={onBack}>
            {blocked ? 'Choose Another' : over ? 'Cancel' : 'Back'}
          </Button>
          {(over || summary.leftOut) && offer ? (
            <Button variant="secondary" size="md" onClick={offer.open}>
              {offer.label}
            </Button>
          ) : null}
          {over && over.room > 0 && bound ? (
            <Button variant="primary" size="md" busy={replanning} onClick={onTrim}>
              {trimOffer(over.found, over.room, bound).importLabel}
            </Button>
          ) : null}
          {blocked || over ? null : (
            <Button variant="primary" size="md" busy={replanning} onClick={onImport}>
              {/* One string: the button draws each text child apart. */}
              {`Import ${pagesLabel(plan.pages.length)}`}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
