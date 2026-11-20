'use client';

// Pages That Disagree (docs/specs/030-knowledgebase/ai-knowledge.md "Pages that disagree"): the question a pair of
// passages answers differently, both passages side by side with each page's trust, and the two ways to settle it.
// Ask Both Owners emails the two pages' owners once (knowledge-email-routes.ts); once asked, the row says when in
// its place. The passages are text.
import type { KnowledgeConflict, KnowledgeConflictSide } from '@liveknowledge/api-schema';
import { Button, CompactEmptyState } from '@liveknowledge/ui';
import { Callout } from '@liveworkspace/ui/callout';
import { ownersEmailedText } from '@/lib/knowledge-ask/email-words';
import { trustText } from '@/lib/knowledge-ask/source-meta';
import { ConflictIcon, MailIcon } from './ai-knowledge-icons';
import { AI_MUTED, AiSection } from './AiSection';

function Side({
  side,
  now,
  onOpen,
}: {
  side: KnowledgeConflictSide;
  now: number;
  onOpen: (tab: string, block?: string) => void;
}) {
  return (
    <div className="min-w-0 rounded-xl border border-slate-200 p-3 dark:border-slate-800">
      <button
        type="button"
        onClick={() => onOpen(side.tab, side.firstBlock)}
        className="block w-full cursor-pointer truncate rounded text-left text-sm font-semibold text-slate-900 underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 phone:min-h-11 dark:text-white"
      >
        {side.title || 'Untitled Page'}
      </button>
      <p className={`text-xs ${AI_MUTED}`}>
        {trustText(side.trust, side.verifiedAt, undefined, now)}
      </p>
      <p className="mt-2 line-clamp-6 whitespace-pre-wrap break-words text-[13px] leading-5 text-slate-700 dark:text-slate-300">
        {side.text}
      </p>
    </div>
  );
}

export function ConflictsSection({
  conflicts,
  hasKey,
  canResolve,
  canManageAi,
  canAskOwners,
  busy,
  now,
  onOpenPage,
  onDismiss,
  onAskOwners,
  onOpenAiSettings,
}: {
  conflicts: readonly KnowledgeConflict[];
  hasKey: boolean;
  canResolve: boolean;
  canManageAi: boolean;
  // A signed-in Editor, where this deployment sends email.
  canAskOwners: boolean;
  busy: ReadonlySet<string>;
  now: number;
  // The page, at the block where the passage begins when one is named.
  onOpenPage: (tab: string, block?: string) => void;
  onDismiss: (id: string) => void;
  onAskOwners: (id: string) => void;
  onOpenAiSettings: () => void;
}) {
  return (
    <AiSection
      id="ai-conflicts"
      title="Pages That Disagree"
      about="Passages on two pages that state opposite facts, found when a page is verified or saved."
      count={conflicts.length}
    >
      {!hasKey ? (
        <Callout
          tone="info"
          size="md"
          role="note"
          title="This Needs Your Team's AI Key"
          {...(canManageAi
            ? { action: { label: 'Open AI Settings', onSelect: onOpenAiSettings } }
            : {})}
          className={conflicts.length > 0 ? 'mb-3' : ''}
        >
          Finding pages that disagree asks a model to compare them, on your team&apos;s own key.
          {canManageAi ? '' : ' Ask an Editor to add one.'}
        </Callout>
      ) : null}
      {conflicts.length === 0 ? (
        hasKey ? (
          <CompactEmptyState
            icon={<ConflictIcon />}
            title="No Disagreements Yet"
            description="When two pages state opposite facts, the pair shows here to settle."
          />
        ) : null
      ) : (
        <ul className="flex flex-col gap-4">
          {conflicts.map((conflict) => (
            <li key={conflict.id} data-conflict={conflict.id}>
              <p className="break-words text-sm font-medium text-slate-900 dark:text-slate-100">
                {conflict.question}
              </p>
              <div className="mt-2 grid gap-3 md:grid-cols-2">
                <Side side={conflict.a} now={now} onOpen={onOpenPage} />
                <Side side={conflict.b} now={now} onOpen={onOpenPage} />
              </div>
              {canResolve ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {/* Whichever page is right, the other is the one that opens to be fixed. */}
                  <Button
                    variant="secondary"
                    size="xs"
                    onClick={() => onOpenPage(conflict.b.tab, conflict.b.firstBlock)}
                    className="max-w-full phone:min-h-11"
                  >
                    <span className="truncate">
                      {conflict.a.title || 'The First Page'} Is Right, Fix the Other
                    </span>
                  </Button>
                  <Button
                    variant="secondary"
                    size="xs"
                    onClick={() => onOpenPage(conflict.a.tab, conflict.a.firstBlock)}
                    className="max-w-full phone:min-h-11"
                  >
                    <span className="truncate">
                      {conflict.b.title || 'The Second Page'} Is Right, Fix the Other
                    </span>
                  </Button>
                  {!canAskOwners ? null : conflict.askedAt === undefined ? (
                    <Button
                      variant="secondary"
                      size="xs"
                      busy={busy.has(`ask:${conflict.id}`)}
                      onClick={() => onAskOwners(conflict.id)}
                      className="phone:min-h-11"
                    >
                      <MailIcon />
                      Ask Both Owners
                    </Button>
                  ) : (
                    <span className={`flex items-center gap-1.5 px-1 text-xs ${AI_MUTED}`}>
                      <MailIcon />
                      {ownersEmailedText('ask', conflict.askedAt, now)}
                    </span>
                  )}
                  <Button
                    variant="ghost"
                    size="xs"
                    busy={busy.has(conflict.id)}
                    onClick={() => onDismiss(conflict.id)}
                    className="phone:min-h-11"
                  >
                    Not a Conflict
                  </Button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </AiSection>
  );
}
