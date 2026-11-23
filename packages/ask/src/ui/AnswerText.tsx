'use client';

// A finished answer, formatted (liveworkspace/docs/specs/019-ask/ask.md "What an answer shows"): its paragraphs and
// lists (answer-lite.ts) with its citation chips. Every piece is a React text node or an element made here: nothing
// the model wrote is set as HTML.
import { Fragment, useMemo, type ReactNode } from 'react';
import { answerLite, type LiteInline } from './answer-lite';
import { CitationChip } from './CitationChip';

const CODE =
  'rounded bg-slate-100 px-1 py-0.5 font-mono text-[0.9em] text-slate-900 dark:bg-slate-800 dark:text-slate-100';

type Cite = { title: (number: number) => string; press: (number: number) => void };

function Inline({ parts, cite }: { parts: readonly LiteInline[]; cite: Cite }) {
  return (
    <>
      {parts.map((part, at) => {
        if (part.kind === 'cite')
          return (
            <CitationChip
              // A marker has no id of its own; its place in a finished answer is stable.
              key={`${at}-${part.number}`}
              number={part.number}
              title={cite.title(part.number)}
              onPress={() => cite.press(part.number)}
            />
          );
        let node: ReactNode = part.text;
        if (part.code) node = <code className={CODE}>{node}</code>;
        if (part.b) node = <strong className="font-semibold">{node}</strong>;
        return <Fragment key={at}>{node}</Fragment>;
      })}
    </>
  );
}

export function AnswerText({
  text,
  titles,
  onCite,
}: {
  text: string;
  // The sources the answer came with, by number: only these become chips.
  titles: ReadonlyMap<number, string>;
  onCite: (number: number) => void;
}) {
  const blocks = useMemo(() => answerLite(text, new Set(titles.keys())), [text, titles]);
  const cite: Cite = { title: (number) => titles.get(number) ?? '', press: onCite };
  return (
    <div data-ask-answer="" className="flex flex-col gap-2 break-words">
      {blocks.map((block, at) =>
        block.kind === 'list' ? (
          block.ordered ? (
            <ol key={at} className="flex list-decimal flex-col gap-1 pl-5">
              {block.items.map((item, i) => (
                <li key={i} className="break-words">
                  <Inline parts={item} cite={cite} />
                </li>
              ))}
            </ol>
          ) : (
            <ul key={at} className="flex list-disc flex-col gap-1 pl-5">
              {block.items.map((item, i) => (
                <li key={i} className="break-words">
                  <Inline parts={item} cite={cite} />
                </li>
              ))}
            </ul>
          )
        ) : (
          <p
            key={at}
            className={`whitespace-pre-wrap break-words ${
              block.heading ? 'font-semibold text-slate-900 dark:text-white' : ''
            }`}
          >
            <Inline parts={block.inline} cite={cite} />
          </p>
        ),
      )}
    </div>
  );
}
