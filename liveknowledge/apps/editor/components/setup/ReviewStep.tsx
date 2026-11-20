'use client';

// Step 2 of Describe to Set Up (docs/specs/030-knowledgebase/describe-to-set-up.md "The flow"): the proposed pages
// as the sidebar draws a tree, each with a checkbox, a title that can be renamed in place and one line on what
// belongs there. Everything shown came from a model: it is drawn as text in inputs and text nodes, never as HTML.
import { useId } from 'react';
import { TextInput } from '@liveknowledge/ui';
import { Callout } from '@liveworkspace/ui/callout';
import type { PageTreeRefusal } from '@liveknowledge/document';
import { SETUP_MAX_TITLE_CHARS } from '@liveknowledge/knowledge';
import { setupLimitText, titleOf, type ReviewPage } from '@/lib/knowledge-setup/setup-tree';
import { UNDO_NOTE } from '@/lib/knowledge-setup/setup-words';
import { SetupPageIcon } from './setup-icons';

const INDENT_PX = 18;
const TITLE_FIELD =
  'min-w-0 flex-1 cursor-text rounded-md border border-transparent bg-transparent px-1.5 py-0.5 text-sm font-medium text-slate-900 motion-safe:transition-colors motion-safe:duration-micro hover:border-slate-300 focus-visible:border-brand-500 focus-visible:bg-white focus-visible:outline-2 focus-visible:outline-brand-600 disabled:cursor-not-allowed disabled:text-slate-400 disabled:line-through dark:text-slate-100 dark:hover:border-slate-600 dark:focus-visible:bg-slate-950 dark:disabled:text-slate-500';

export function ReviewStep({
  pages,
  name,
  refusal,
  onTick,
  onTitle,
  onName,
}: {
  pages: readonly ReviewPage[];
  /** The suggested name of the knowledgebase, or null when it already has a name of its own. */
  name: string | null;
  refusal: PageTreeRefusal | null;
  onTick: (id: string, ticked: boolean) => void;
  onTitle: (id: string, title: string) => void;
  onName: (name: string) => void;
}) {
  const nameId = useId();
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3" data-setup-step="review">
      {name !== null ? (
        <div className="flex flex-col gap-1">
          <label
            htmlFor={nameId}
            className="text-xs font-medium text-slate-700 dark:text-slate-200"
          >
            Knowledgebase Name
          </label>
          <TextInput
            id={nameId}
            value={name}
            maxLength={SETUP_MAX_TITLE_CHARS}
            data-setup-name=""
            onChange={(event) => onName(event.target.value)}
          />
        </div>
      ) : null}
      <ul
        aria-label="Suggested Pages"
        data-setup-tree=""
        className="min-h-0 flex-1 overflow-y-auto rounded-lg border border-slate-200 py-1 dark:border-slate-700"
      >
        {pages.map((page) => (
          <li
            key={page.id}
            data-setup-page={page.id}
            data-depth={page.depth}
            className="flex items-start gap-2 py-1 pr-2 pointer-coarse:min-h-11 has-[:focus-visible]:bg-brand-50/60 dark:has-[:focus-visible]:bg-brand-500/10"
            style={{ paddingLeft: 10 + (page.depth - 1) * INDENT_PX }}
          >
            <label className="flex h-7 shrink-0 cursor-pointer items-center pointer-coarse:h-9 pointer-coarse:w-9 pointer-coarse:justify-center">
              <input
                type="checkbox"
                className="h-4 w-4 cursor-pointer accent-brand-600"
                checked={page.ticked}
                aria-label={`Create ${titleOf(page)}`}
                onChange={(event) => onTick(page.id, event.target.checked)}
              />
            </label>
            <span
              aria-hidden
              className="flex h-7 shrink-0 items-center text-slate-400 pointer-coarse:h-9"
            >
              <SetupPageIcon />
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
              <input
                type="text"
                value={page.title}
                maxLength={SETUP_MAX_TITLE_CHARS}
                disabled={!page.ticked}
                aria-label="Page Title"
                spellCheck={false}
                className={TITLE_FIELD}
                onChange={(event) => onTitle(page.id, event.target.value)}
              />
              {page.summary ? (
                <span
                  className={`px-1.5 text-xs leading-snug [overflow-wrap:anywhere] ${
                    page.ticked
                      ? 'text-slate-600 dark:text-slate-400'
                      : 'text-slate-400 dark:text-slate-500'
                  }`}
                >
                  {page.summary}
                </span>
              ) : null}
            </span>
          </li>
        ))}
      </ul>
      {refusal ? (
        <Callout tone="warning" size="md" role="alert" title="These Pages Do Not Fit">
          {setupLimitText(refusal)}
        </Callout>
      ) : (
        <p className="text-xs text-slate-600 dark:text-slate-400">
          Nothing has been written yet. Untick what you do not want and rename what you like.{' '}
          {UNDO_NOTE}
        </p>
      )}
    </div>
  );
}
