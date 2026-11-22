'use client';

// A conflict's row in Needs Attention (docs/specs/030-knowledgebase/ai-knowledge.md "Pages that disagree"): the
// question a pair of passages answers differently, both passages side by side with each page's trust, and the two
// ways to settle it.
// Ask Both Owners emails the two pages' owners once (knowledge-email-routes.ts); once asked, the row says when in
// its place. The passages are text.
import type { KnowledgeConflict, KnowledgeConflictSide } from '@liveknowledge/api-schema';
import { likelierRight } from '@liveknowledge/knowledge';
import { Button } from '@liveknowledge/ui';
import { HealthChip } from '@/components/knowledge/HealthChip';
import { ownersEmailedText } from '@/lib/knowledge-ask/email-words';
import { trustText } from '@/lib/knowledge-ask/source-meta';
import { MailIcon } from './ai-knowledge-icons';
import { AI_MUTED } from './AiSection';

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
    <div className="min-w-0 rounded-xl border border-slate-200 p-3 dark:border-slate-700">
      <button
        type="button"
        onClick={() => onOpen(side.tab, side.firstBlock)}
        className="block w-full cursor-pointer truncate rounded text-left text-sm font-semibold text-slate-900 underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 phone:min-h-11 dark:text-white"
      >
        {side.title || 'Untitled Page'}
      </button>
      <p className={`flex flex-wrap items-center gap-x-2 gap-y-1 text-xs ${AI_MUTED}`}>
        {side.trust === 'off' ? null : (
          <span>{trustText(side.trust, side.verifiedAt, undefined, now)}</span>
        )}
        {side.health ? (
          <HealthChip score={side.health.score} label={side.health.label} prefix />
        ) : null}
      </p>
      <p className="mt-2 line-clamp-6 whitespace-pre-wrap break-words text-[13px] leading-5 text-slate-700 dark:text-slate-300">
        {side.text}
      </p>
    </div>
  );
}

/** One pair of pages that disagree, as Needs Attention draws it: the question, both passages, and the ways to settle
 *  it for a writer. */
export function ConflictRow({
  conflict,
  canResolve,
  canAskOwners,
  busy,
  now,
  onOpenPage,
  onDismiss,
  onAskOwners,
}: {
  conflict: KnowledgeConflict;
  canResolve: boolean;
  // A signed-in Editor, where this deployment sends email.
  canAskOwners: boolean;
  busy: ReadonlySet<string>;
  now: number;
  // The page, at the block where the passage begins when one is named.
  onOpenPage: (tab: string, block?: string) => void;
  onDismiss: (id: string) => void;
  onAskOwners: (id: string) => void;
}) {
  // The likelier right side (ai-knowledge.md "Pages that disagree"): 10 or more points healthier. A suggestion only:
  // both buttons stay, the likelier one first.
  const likely = likelierRight(conflict.a.health?.score, conflict.b.health?.score);
  const right = likely === 'b' ? conflict.b : conflict.a;
  const other = likely === 'b' ? conflict.a : conflict.b;
  const fixOther = (side: KnowledgeConflictSide, fallback: string, fix: KnowledgeConflictSide) => (
    <Button
      key={side.passageId}
      variant={likely && side === right ? 'primary' : 'secondary'}
      size="xs"
      onClick={() => onOpenPage(fix.tab, fix.firstBlock)}
      className="max-w-full phone:min-h-11"
    >
      <span className="truncate">{side.title || fallback} Is Right, Fix the Other</span>
    </Button>
  );
  return (
    <div data-conflict={conflict.id}>
      <p className="break-words text-sm font-medium text-slate-900 dark:text-slate-100">
        {conflict.question}
      </p>
      {likely ? (
        <p data-likelier-right={likely} className={`mt-1 text-xs ${AI_MUTED}`}>
          <span className="font-medium text-slate-800 dark:text-slate-200">
            {right.title || 'Untitled Page'}
          </span>{' '}
          is more likely right (health {right.health!.score} against {other.health!.score})
        </p>
      ) : null}
      <div className="mt-2 grid gap-3 md:grid-cols-2">
        <Side side={conflict.a} now={now} onOpen={onOpenPage} />
        <Side side={conflict.b} now={now} onOpen={onOpenPage} />
      </div>
      {canResolve ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {/* Whichever page is right, the other is the one that opens to be fixed; the likelier right leads. */}
          {likely === 'b'
            ? [
                fixOther(conflict.b, 'The Second Page', conflict.a),
                fixOther(conflict.a, 'The First Page', conflict.b),
              ]
            : [
                fixOther(conflict.a, 'The First Page', conflict.b),
                fixOther(conflict.b, 'The Second Page', conflict.a),
              ]}
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
    </div>
  );
}

/** Where no AI can check (no key, and no built-in AI on this server): one quiet line under the Disagreements
 *  filter, never a blocker. With built-in AI there is no line at all (search-and-ask.md "Built-in AI"). */
export function ConflictKeyNote({
  canManageAi,
  onOpenAiSettings,
}: {
  canManageAi: boolean;
  onOpenAiSettings: () => void;
}) {
  return (
    <p
      role="note"
      className={`mb-3 flex flex-wrap items-center gap-x-2 text-xs leading-5 ${AI_MUTED}`}
    >
      <span>
        This server has no built-in AI, so finding pages that disagree needs your team&apos;s AI
        key.
        {canManageAi ? '' : ' Ask an Editor to add one.'}
      </span>
      {canManageAi ? (
        <button
          type="button"
          onClick={onOpenAiSettings}
          className="cursor-pointer rounded font-medium text-brand-700 underline underline-offset-2 hover:text-brand-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 phone:min-h-11 dark:text-brand-300 dark:hover:text-brand-200"
        >
          Open AI Settings
        </button>
      ) : null}
    </p>
  );
}
