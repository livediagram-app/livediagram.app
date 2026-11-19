'use client';

// Tab Style's Element Colours (docs/specs/011-theme/canvas-and-theme-dialog.md "Element colours"): on a design, what a
// look or a theme pick does to the elements already there. Follow the Theme (the default) recolours what is still on
// the old theme's colours and keeps every colour someone chose, arrows included; Keep as They Are recolours nothing,
// the theme still setting the tab's backdrop, its pages' theme fills and the colours new elements take. The viewer's
// own, for this open of the dialog.
import { SegmentedToggle } from '@liveworkspace/ui';
import { track } from '@/lib/telemetry';
import { useTabStylePages } from './tab-style-pages';

type Choice = 'follow' | 'keep';
const CHOICES = [
  {
    value: 'follow' as const,
    label: 'Follow the Theme',
    description: 'Colours still on the theme’s take the new ones; a colour you chose stays.',
  },
  {
    value: 'keep' as const,
    label: 'Keep as They Are',
    description: 'Nothing on the design changes colour; new work takes the new theme.',
  },
];

export function ElementColoursRow() {
  const { keepElementColours, onSetKeepElementColours } = useTabStylePages();
  return (
    <section
      aria-labelledby="element-colours-heading"
      className="flex flex-wrap items-center justify-between gap-2"
      data-tab-style-element-colours=""
    >
      <div className="flex min-w-0 flex-col">
        <h3
          id="element-colours-heading"
          className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400"
        >
          Element Colours
        </h3>
        <p className="text-[11px] text-slate-500 dark:text-slate-400">
          {keepElementColours
            ? 'Looks and themes leave the design’s colours as they are.'
            : 'Looks and themes recolour what is on the theme’s colours.'}
        </p>
      </div>
      <SegmentedToggle<Choice>
        label="Element colours"
        value={keepElementColours ? 'keep' : 'follow'}
        options={CHOICES}
        onChange={(choice) => {
          track('UI', 'Changed', 'TabStyleElementColours');
          onSetKeepElementColours(choice === 'keep');
        }}
      />
    </section>
  );
}
