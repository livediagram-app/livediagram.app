import { Fragment } from 'react';

// A step's sentence with its `**menu names**` set in bold (docs/specs/019-marketing/build-with-ai.md "The clients").
export function StepText({ text }: { text: string }) {
  return (
    <>
      {text.split(/\*\*(.+?)\*\*/g).map((part, i) =>
        i % 2 === 1 ? (
          <strong key={i} className="font-semibold text-slate-900 dark:text-slate-50">
            {part}
          </strong>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        ),
      )}
    </>
  );
}
