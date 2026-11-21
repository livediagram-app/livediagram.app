'use client';

// A finished answer, formatted (docs/specs/030-knowledgebase/search-and-ask.md "What an answer shows"): its
// Markdown as paragraphs, headings, lists, code and tables (lib/knowledge-ask/answer-blocks.ts), with its citation
// chips. Every piece is a React text node or an element made here: nothing the model wrote is set as HTML. Drawn
// once the answer has ended; while it streams it is one growing text node (StreamingAnswer), so a token never costs
// a render and this never runs per token.
import { Fragment, useMemo, type ReactNode } from 'react';
import {
  answerBlocks,
  type AnswerBlock,
  type AnswerInline,
  type AnswerListItem,
} from '@/lib/knowledge-ask/answer-blocks';
import { CitationChip } from './CitationChip';

const CODE =
  'rounded bg-slate-100 px-1 py-0.5 font-mono text-[0.9em] text-slate-900 dark:bg-slate-800 dark:text-slate-100';
const HEADING = {
  1: 'text-[17px] font-semibold leading-7 text-slate-900 dark:text-white',
  2: 'text-base font-semibold leading-7 text-slate-900 dark:text-white',
  3: 'text-[15px] font-semibold leading-7 text-slate-900 dark:text-white',
} as const;

type Cite = { title: (number: number) => string; press: (number: number) => void };

function Inline({ parts, cite }: { parts: readonly AnswerInline[]; cite: Cite }) {
  return (
    <>
      {parts.map((part, at) => {
        if (part.kind === 'cite')
          return (
            <CitationChip
              // A marker has no id of its own; its place in the answer is stable once the answer has ended.
              key={`${at}-${part.number}`}
              number={part.number}
              title={cite.title(part.number)}
              onPress={() => cite.press(part.number)}
            />
          );
        let node: ReactNode = part.text;
        if (part.code) node = <code className={CODE}>{node}</code>;
        if (part.b) node = <strong className="font-semibold">{node}</strong>;
        if (part.i) node = <em>{node}</em>;
        if (part.s) node = <s>{node}</s>;
        return <Fragment key={at}>{node}</Fragment>;
      })}
    </>
  );
}

// Items of one level in runs of one kind: a numbered list followed straight by bullets is two lists.
function listRuns(items: readonly AnswerListItem[]): AnswerListItem[][] {
  const runs: AnswerListItem[][] = [];
  for (const item of items) {
    const run = runs[runs.length - 1];
    if (run && run[0]!.list === item.list) run.push(item);
    else runs.push([item]);
  }
  return runs;
}

function Lists({ items, cite }: { items: readonly AnswerListItem[]; cite: Cite }) {
  return (
    <>
      {listRuns(items).map((run, at) => (
        <List key={at} items={run} cite={cite} />
      ))}
    </>
  );
}

function List({ items, cite }: { items: readonly AnswerListItem[]; cite: Cite }) {
  const kind = items[0]!.list;
  const Tag = kind === 'numbered' ? 'ol' : 'ul';
  return (
    <Tag
      className={`flex flex-col gap-1 pl-6 ${
        kind === 'numbered' ? 'list-decimal' : kind === 'todo' ? 'list-none' : 'list-disc'
      }`}
    >
      {items.map((item, at) => (
        <li key={at} className="whitespace-pre-wrap break-words">
          {item.list === 'todo' ? (
            <>
              <span aria-hidden className="-ml-5 mr-1.5 inline-block w-3.5">
                {item.checked ? '☑' : '☐'}
              </span>
              <span className="sr-only">{item.checked ? 'Done: ' : 'To do: '}</span>
            </>
          ) : null}
          <Inline parts={item.inline} cite={cite} />
          {item.items.length > 0 ? (
            <div className="mt-1 flex flex-col gap-1">
              <Lists items={item.items} cite={cite} />
            </div>
          ) : null}
        </li>
      ))}
    </Tag>
  );
}

function Block({ block, cite }: { block: AnswerBlock; cite: Cite }) {
  switch (block.kind) {
    case 'paragraph':
      return (
        <p className="whitespace-pre-wrap break-words">
          <Inline parts={block.inline} cite={cite} />
        </p>
      );
    case 'heading': {
      // An answer sits under the page's own headings: its headings start at the third level.
      const Tag = block.level === 1 ? 'h3' : block.level === 2 ? 'h4' : 'h5';
      return (
        <Tag className={`break-words ${HEADING[block.level]}`}>
          <Inline parts={block.inline} cite={cite} />
        </Tag>
      );
    }
    case 'quote':
      return (
        <blockquote className="whitespace-pre-wrap break-words border-l-2 border-slate-300 pl-3 text-slate-700 dark:border-slate-600 dark:text-slate-300">
          <Inline parts={block.inline} cite={cite} />
        </blockquote>
      );
    case 'list':
      return <Lists items={block.items} cite={cite} />;
    case 'code':
      return (
        <pre className="overflow-x-auto rounded-lg bg-slate-100 p-3 font-mono text-[13px] leading-5 text-slate-900 dark:bg-slate-800 dark:text-slate-100">
          <code>{block.text}</code>
        </pre>
      );
    case 'rule':
      return <hr className="border-slate-200 dark:border-slate-700" />;
    case 'table':
      return (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm leading-6">
            <tbody>
              {block.rows.map((row, r) => (
                <tr key={r} className="border-b border-slate-200 dark:border-slate-700">
                  {row.map((cell, c) => {
                    const Cell = block.header && r === 0 ? 'th' : 'td';
                    return (
                      <Cell
                        key={c}
                        {...(Cell === 'th' ? { scope: 'col' } : {})}
                        className={`break-words px-2 py-1 align-top ${
                          Cell === 'th' ? 'font-semibold text-slate-900 dark:text-white' : ''
                        }`}
                      >
                        <Inline parts={cell} cite={cite} />
                      </Cell>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
  }
}

export function AnswerBody({
  text,
  titles,
  onCite,
}: {
  text: string;
  // The passages the answer came with, by number: only these become chips.
  titles: ReadonlyMap<number, string>;
  onCite: (number: number) => void;
}) {
  // Read once per answer: the card is memoised on its turn, and a finished answer's text does not change.
  const blocks = useMemo(() => answerBlocks(text, new Set(titles.keys())), [text, titles]);
  const cite: Cite = { title: (number) => titles.get(number) ?? '', press: onCite };
  return (
    <div data-ask-answer="" className="flex flex-col gap-3 break-words">
      {blocks.map((block, at) => (
        <Block key={at} block={block} cite={cite} />
      ))}
    </div>
  );
}
