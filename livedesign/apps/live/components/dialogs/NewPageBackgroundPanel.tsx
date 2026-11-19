'use client';

// Tab Style's New Page Background panel (docs/specs/011-theme/canvas-and-theme-dialog.md "New Page Background"), in
// the Canvas panel's place: what every new page of the tab starts on (Like the Page Before, or a background of its
// own from the page panel's own Background section, less pictures; on a logo page without a pattern, as there), Apply to Every
// Page under it, and a small Around the Pages section for the surround: its colour and a calm pattern. On a photo
// page, which is its picture and takes no background, the panel says so and keeps Around the Pages.
import { useMemo } from 'react';
import { SegmentedToggle } from '@liveworkspace/ui';
import { Button, HoverCard } from '@livedesign/ui';
import type { BackgroundPattern, Page } from '@livedesign/design';
import { themeBackgroundPresets } from '@/lib/page-paint';
import type { TabStyleCanvasPanelProps } from '@liveworkspace/workbench/components/dialogs/tab-style/tab-style-profile';
import { BackgroundSection } from '@/components/canvas/page-background-section';
import { PanelSection } from '@/components/canvas/page-panel-sections';
import { ColorSwatch, PATTERNS, PatternButton } from '@/components/palette/palette-controls';
import { getTheme } from '@/lib/themes';
import { useTabStylePages } from './tab-style-pages';

// The surround's calm patterns: around pages, a busy or moving one fights them.
export const AROUND_THE_PAGES_PATTERNS: readonly BackgroundPattern[] = [
  'blank',
  'grid',
  'lines',
  'graph',
];
const AROUND = PATTERNS.filter((p) => AROUND_THE_PAGES_PATTERNS.includes(p.id));

type Mode = 'carry' | 'own';
const MODES = [
  {
    value: 'carry' as const,
    label: 'Like the Page Before',
    description: 'Each new page wears the background of the page before it.',
  },
  {
    value: 'own' as const,
    label: 'Choose One',
    description: 'Every new page starts on the background you choose here.',
  },
];

// Hovers preview nothing here: no page is on show to paint.
const noPreview = () => {};

export function NewPageBackgroundPanel({
  canvas,
}: {
  canvas: TabStyleCanvasPanelProps<BackgroundPattern>;
}) {
  const pages = useTabStylePages();
  const { themeId } = pages;
  const own = pages.newPageBackground;
  const themePresets = useMemo(() => themeBackgroundPresets(getTheme(themeId)), [themeId]);
  // The page panel's Background section, over a page of the tab's kind wearing the tab's choice.
  const sample: Page = {
    id: 'new-page',
    orientation: 'portrait',
    kind: pages.kind ?? 'wireframe',
    ...(own && (own.fill || own.pattern) ? { background: own } : {}),
  };
  if (pages.kind === 'photo')
    return (
      <div className="mt-3 flex flex-col gap-3" data-new-page-background="">
        <p className="px-3 text-[11px] text-slate-500 dark:text-slate-400">
          A photo page is its picture, so it takes no background. The pages of a tab are all one
          kind.
        </p>
        <AroundThePages canvas={canvas} />
      </div>
    );
  return (
    <div className="mt-3 flex flex-col gap-3" data-new-page-background="">
      <div className="flex flex-col gap-2 px-3">
        <SegmentedToggle<Mode>
          label="New pages start"
          value={own ? 'own' : 'carry'}
          options={MODES}
          onChange={(mode) => pages.onSet(mode === 'carry' ? null : {})}
          className="self-start"
        />
        <p className="text-[11px] text-slate-500 dark:text-slate-400">
          {own
            ? 'Every new page starts on this. A page keeps its own once it is made.'
            : 'Each new page wears the background of the page before it.'}
        </p>
      </div>
      {own ? (
        <div className="rounded-lg border border-slate-200 dark:border-slate-700">
          <BackgroundSection
            page={sample}
            themePresets={themePresets}
            only={['solid', 'gradient', 'animated']}
            onBackground={(patch) => pages.onSet(patch)}
            onPreview={noPreview}
          />
          {pages.units > 0 ? (
            <div className="border-t border-slate-100 px-3 py-2 dark:border-slate-800">
              <Button
                variant="secondary"
                size="xs"
                className="w-full"
                onClick={pages.onApplyToEveryPage}
                data-new-page-background-all=""
              >
                Apply to Every Page
              </Button>
              <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                Gives the {pages.units === 1 ? 'page' : `${pages.units} pages`} this background. A
                locked one keeps its own; Undo puts them back.
              </p>
            </div>
          ) : null}
        </div>
      ) : null}
      <AroundThePages canvas={canvas} />
    </div>
  );
}

// The surround: the canvas around the pages, which export leaves out and presenting blacks out.
function AroundThePages({ canvas }: { canvas: TabStyleCanvasPanelProps<BackgroundPattern> }) {
  return (
    <PanelSection title="Around the Pages">
      <div className="flex items-start gap-3">
        <HoverCard title="Colour" description="The colour of the canvas around the pages.">
          <ColorSwatch
            label="Around"
            value={canvas.backgroundColor}
            onChange={canvas.onSetBackgroundColor}
          />
        </HoverCard>
        <div
          role="group"
          aria-label="Pattern around the pages"
          className="grid flex-1 grid-cols-4 gap-1"
        >
          {AROUND.map((p) => (
            <HoverCard key={p.id} title={p.label} description={p.description}>
              <PatternButton
                active={canvas.backgroundPattern === p.id}
                onClick={() => canvas.onSetBackgroundPattern(p.id)}
                label={p.shortLabel}
              >
                <p.icon />
              </PatternButton>
            </HoverCard>
          ))}
        </div>
      </div>
    </PanelSection>
  );
}
