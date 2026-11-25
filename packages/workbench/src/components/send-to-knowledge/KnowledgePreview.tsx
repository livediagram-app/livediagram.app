'use client';

// The preview (liveworkspace/docs/specs/004-index/send-to-knowledge.md "The picker"): the section as it will read on
// the page, before anything is written: its heading, the summary (or the items' list), the picture and the Sent From
// line. Edit turns the words into a text area (Markdown), Done shows them again. Drawn from plain text into React
// elements: nothing the model or a label says is ever read as HTML.
import { useId } from 'react';
import type { App } from '@liveworkspace/index-client';
import { BrandMark } from '@liveworkspace/brand';
import { Chip } from '@liveworkspace/ui';
import { previewBlocks } from './knowledge-pages';

export const PREVIEW_MARKDOWN_MAX = 6_000;

function Words({ markdown }: { markdown: string }) {
  const blocks = previewBlocks(markdown);
  return (
    <div className="flex flex-col gap-2 text-sm leading-relaxed text-slate-700 dark:text-slate-200">
      {blocks.map((b, i) => {
        const key = `${i}:${b.kind}`;
        if (b.kind === 'heading')
          return (
            <h5 key={key} className="pt-1 text-sm font-semibold text-slate-900 dark:text-white">
              {b.text}
            </h5>
          );
        if (b.kind === 'item')
          return (
            <p
              key={key}
              className="relative pl-4 before:absolute before:left-1 before:top-[0.6em] before:size-1.5 before:rounded-full before:bg-slate-400 dark:before:bg-slate-500"
              style={b.depth > 0 ? { marginLeft: Math.min(b.depth, 4) * 16 } : undefined}
            >
              {b.text}
            </p>
          );
        if (b.kind === 'code')
          return (
            <pre
              key={key}
              className="overflow-x-auto rounded-md bg-slate-100 px-3 py-2 font-mono text-xs dark:bg-slate-800"
            >
              {b.text}
            </pre>
          );
        return <p key={key}>{b.text}</p>;
      })}
    </div>
  );
}

export function KnowledgePreview({
  heading,
  markdown,
  editing,
  onMarkdown,
  picture,
  source,
}: {
  heading: string;
  markdown: string;
  editing: boolean;
  onMarkdown: (m: string) => void;
  // The picture as a data URL, or null when the selection goes without one.
  picture: string | null;
  source: { app: App; title: string };
}) {
  const editId = useId();
  return (
    <article
      aria-label="Preview of the section"
      data-knowledge-preview=""
      className="flex min-w-0 flex-col gap-3 rounded-xl border border-slate-200 bg-white px-4 py-4 shadow-sm dark:border-slate-700 dark:bg-slate-900"
    >
      {heading.trim() ? (
        <h4 className="text-base font-semibold text-slate-900 dark:text-white">{heading.trim()}</h4>
      ) : null}
      {editing ? (
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor={editId}
            className="text-[13px] font-medium text-slate-700 dark:text-slate-200"
          >
            Words (Markdown)
          </label>
          <textarea
            id={editId}
            autoFocus
            value={markdown}
            maxLength={PREVIEW_MARKDOWN_MAX}
            onChange={(e) => onMarkdown(e.target.value)}
            rows={10}
            className="min-h-40 w-full resize-y rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-[13px] leading-relaxed text-slate-800 focus-visible:border-brand-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-300 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
          />
        </div>
      ) : (
        <Words markdown={markdown} />
      )}
      {picture ? (
        <img
          src={picture}
          alt={heading.trim() || 'The selected items'}
          className="max-h-56 w-auto max-w-full self-start rounded-md border border-slate-200 bg-white object-contain dark:border-slate-700"
        />
      ) : null}
      <p className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
        Sent from
        <Chip
          icon={
            <BrandMark app={source.app} className="shrink-0" style={{ width: 12, height: 12 }} />
          }
          className="max-w-full border border-slate-200 px-1.5 py-0.5 font-medium text-slate-600 dark:border-slate-600 dark:text-slate-200"
        >
          {source.title || 'Untitled'}
        </Chip>
        in {source.app}
      </p>
    </article>
  );
}
