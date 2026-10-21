import type { ImageCredit } from '@livediagram/document';

// The Image section's credit line for a picture picked from Image search
// (docs/specs/009-elements/image-search.md "Credit on the element"): who made it,
// its licence, and links to its source page and licence deed.

const LINK = 'font-medium text-brand-700 underline-offset-2 hover:underline dark:text-brand-300';

export function ImageCreditRow({ credit }: { credit: ImageCredit }) {
  return (
    <div className="px-3 py-2 text-xs">
      <p className="font-medium text-slate-700 dark:text-slate-200">Credit</p>
      <p className="mt-0.5 break-words text-slate-600 dark:text-slate-300">{credit.text}</p>
      <p className="mt-1 flex gap-3">
        <a href={credit.sourceUrl} target="_blank" rel="noopener noreferrer" className={LINK}>
          Source
        </a>
        {credit.licenseUrl ? (
          <a href={credit.licenseUrl} target="_blank" rel="noopener noreferrer" className={LINK}>
            Licence
          </a>
        ) : null}
      </p>
    </div>
  );
}
