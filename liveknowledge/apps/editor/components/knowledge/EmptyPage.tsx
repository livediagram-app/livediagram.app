'use client';

// An empty page, read (docs/specs/030-knowledgebase/editing.md "Read mode"): a page with nothing under its title shows
// a quiet drawing of a blank page and a line saying so, instead of a white sheet. Whoever may edit gets Start Writing,
// which opens edit mode as Edit and a double-click do; a reader is told the page has nothing yet. It never shows while
// the page is being edited, so the writing starts on a clean page.
import { Button } from '@liveknowledge/ui';
import { useEditorChrome, useEditorChromeStore } from '@/app/document/[id]/EditorContext';
import { PencilIcon } from '@/components/primitives/explorer-icons';

type Run = { text?: string };
type Block = { type?: string; style?: string; runs?: readonly Run[] };

/** Whether a page's writing has nothing under its title: only empty paragraphs (and the title) in every article. */
export function isEmptyPage(
  articles: Record<string, { blocks: readonly unknown[] }> | undefined,
): boolean {
  const all = Object.values(articles ?? {});
  return all.every(({ blocks }) =>
    (blocks as readonly Block[]).every(
      (b) =>
        b.style === 'title' ||
        (b.type === 'paragraph' && (b.runs ?? []).every((r) => !(r.text ?? '').trim())),
    ),
  );
}

export function EmptyPage() {
  const store = useEditorChromeStore();
  const empty = useEditorChrome((s) => isEmptyPage(s.pageTab.articles));
  const editing = useEditorChrome((s) => s.pageEditing.editing);
  const mayEdit = useEditorChrome((s) => s.pageEditing.mayEdit);
  if (!empty || editing) return null;
  return (
    <div
      data-empty-page=""
      className="flex flex-col items-center gap-3 px-6 pb-10 pt-14 text-center"
      contentEditable={false}
    >
      <EmptyPageArt />
      <div>
        <p className="text-[15px] font-semibold text-slate-800 dark:text-slate-100">
          Nothing Written Yet
        </p>
        <p className="mt-1 max-w-[22rem] text-[13px] leading-5 text-slate-500 dark:text-slate-400">
          {mayEdit
            ? 'Start writing, or double-click anywhere on the page.'
            : 'This page has no writing yet. Check back soon.'}
        </p>
      </div>
      {mayEdit ? (
        <Button
          variant="primary"
          size="sm"
          className="mt-1 cursor-pointer"
          onClick={() => store.get().pageEditing.start()}
        >
          <PencilIcon size={13} />
          Start Writing
        </Button>
      ) : null}
    </div>
  );
}

/** A blank sheet on the theme's tint, its lines still to write, and a pencil resting on it. */
function EmptyPageArt() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 160 112"
      className="h-28 w-40 text-brand-700 dark:text-brand-300"
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <ellipse cx="80" cy="102" rx="50" ry="5" className="fill-brand-100 dark:fill-brand-900/40" />
      <g transform="rotate(-6 64 54)">
        <rect
          x="40"
          y="14"
          width="56"
          height="76"
          rx="6"
          className="fill-white dark:fill-slate-800"
        />
        <rect
          x="40"
          y="14"
          width="56"
          height="76"
          rx="6"
          stroke="currentColor"
          strokeOpacity=".25"
          strokeWidth="1.5"
        />
      </g>
      <rect
        x="58"
        y="10"
        width="58"
        height="80"
        rx="6"
        className="fill-white dark:fill-slate-900"
        stroke="currentColor"
        strokeOpacity=".45"
        strokeWidth="1.5"
      />
      <path d="M68 24h26" stroke="currentColor" strokeOpacity=".7" strokeWidth="3" />
      <path
        d="M68 36h38M68 45h32M68 54h36M68 63h22"
        stroke="currentColor"
        strokeOpacity=".22"
        strokeWidth="2"
        strokeDasharray="3 4"
      />
      <g transform="rotate(38 118 66)">
        <rect
          x="112"
          y="40"
          width="10"
          height="44"
          rx="2"
          className="fill-brand-500 dark:fill-brand-400"
        />
        <rect
          x="112"
          y="40"
          width="10"
          height="7"
          rx="2"
          className="fill-brand-200 dark:fill-brand-700"
        />
        <path d="M112 84l5 9 5-9Z" className="fill-amber-200 dark:fill-amber-300/80" />
        <path d="M115.6 90.4L117 93l1.4-2.6Z" className="fill-slate-700 dark:fill-slate-200" />
      </g>
      <path
        d="M30 30l1.6 3.2 3.2 1.6-3.2 1.6L30 39.6l-1.6-3.2-3.2-1.6 3.2-1.6Z"
        fill="currentColor"
        fillOpacity=".35"
      />
      <path
        d="M134 18l1.2 2.4 2.4 1.2-2.4 1.2-1.2 2.4-1.2-2.4-2.4-1.2 2.4-1.2Z"
        fill="currentColor"
        fillOpacity=".3"
      />
    </svg>
  );
}
