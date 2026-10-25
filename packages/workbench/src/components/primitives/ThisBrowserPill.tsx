'use client';

import { useId } from 'react';
import { HoverCard, lucideGlyph } from '@liveworkspace/ui';
import { lucideAppWindow } from '@liveworkspace/icons/lucide';
import {
  THIS_BROWSER_COPY,
  THIS_BROWSER_FOCUS,
  THIS_BROWSER_HOVER,
  THIS_BROWSER_TONE,
} from '@liveworkspace/explorer/this-browser';

// The This Browser pill (each product's docs/specs/006-*/offline-mode.md#this-browser-pill): every row and
// card of an item saved only in this browser carries it, in every editor. An icon and words, never
// colour alone; what it means on hover, on focus and to a screen reader; and a link to the editor's
// Offline Mode guide. Inside a single control (a search result) it is a plain label carrying the
// same sentence, since a link cannot sit inside a button. Its words and teal tone are the shared
// Explorer's (`@liveworkspace/explorer/this-browser`), so the editor's pill and the Explorer's agree.

export const THIS_BROWSER_LABEL = THIS_BROWSER_COPY.label;
export const THIS_BROWSER_DESCRIPTION = THIS_BROWSER_COPY.sentence;
// Shared with the editor header's This Browser badge (share-states.tsx).
export { THIS_BROWSER_TONE };

// The pill's glyph, a browser window, as the editors draw it on the header badge too.
const ThisBrowserIcon = lucideGlyph(lucideAppWindow, 13);

const PILL = `optical-edges inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-1.5 py-px text-[10px] font-semibold leading-4 ${THIS_BROWSER_TONE}`;

export type ThisBrowserPillProps =
  // Inside a single control: a label, not a link.
  | { asLabel: true }
  | {
      asLabel?: false;
      // The editor's Offline Mode guide, opened in a new tab.
      helpHref: string;
      // The editor's help-link telemetry, as the guide opens.
      onOpenHelp?: () => void;
      // False inside a tree, which owns the one tab stop; the row carries the description.
      tabbable?: boolean;
    };

export function ThisBrowserPill(props: ThisBrowserPillProps) {
  const descriptionId = useId();
  const face = (
    <>
      <ThisBrowserIcon size={10} />
      <span className="text-optical-line">{THIS_BROWSER_LABEL}</span>
    </>
  );
  if (props.asLabel) {
    return (
      <HoverCard title={THIS_BROWSER_LABEL} description={THIS_BROWSER_DESCRIPTION}>
        <span className={PILL}>
          {face}
          <span className="sr-only">{THIS_BROWSER_DESCRIPTION}</span>
        </span>
      </HoverCard>
    );
  }
  const { helpHref, onOpenHelp, tabbable = true } = props;
  return (
    <HoverCard title={THIS_BROWSER_LABEL} description={THIS_BROWSER_DESCRIPTION}>
      <a
        href={helpHref}
        target="_blank"
        rel="noreferrer noopener"
        tabIndex={tabbable ? undefined : -1}
        aria-describedby={descriptionId}
        onClick={(e) => {
          // The row beneath opens its item; this opens the guide instead.
          e.stopPropagation();
          onOpenHelp?.();
        }}
        className={`${PILL} transition ${THIS_BROWSER_HOVER} ${THIS_BROWSER_FOCUS}`}
      >
        {face}
      </a>
      <span id={descriptionId} className="sr-only">
        {THIS_BROWSER_DESCRIPTION}
      </span>
    </HoverCard>
  );
}
