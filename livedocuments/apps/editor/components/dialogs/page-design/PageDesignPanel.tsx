'use client';

// Tab Style's Page Design panel (docs/specs/011-theme/canvas-and-theme-dialog.md "Page Design"): a preview of the page
// someone is on wearing the design, Applies to (Whole Tab or This Page), the Design Sets, the catalogue and Fine Tune.
// Every pick applies live as one undo step, every slider's drag as one; the canvas behind shows it as it moves.
import { useMemo, useState } from 'react';
import {
  PAGE_DESIGN_BY_ID,
  designPalette,
  elementsOnPage,
  isNoDesign,
  resolvePageDesigns,
  resolveTuning,
  type PageDesign,
  type PageDesignId,
} from '@livedocuments/document';
import { Button, SegmentedToggle } from '@livedocuments/ui';
import { useTabStylePages } from '../tab-style-pages';
import { DesignFineTune } from './DesignFineTune';
import { DesignGrid, type TileLook } from './DesignGrid';
import { DesignSetCards } from './DesignSetCards';
import { svgDataUri } from './DesignTile';
import { designTileSvg } from './design-tile-svg';
import { SaveThisDesign, SavedDesignGrid, useSavedDesigns } from './SavedDesigns';
import { picked, wornDesign, type DesignScope } from './design-tune';

const HEAD =
  'px-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400';

const SCOPES = [
  {
    value: 'tab' as const,
    label: 'Whole Tab',
    description: 'Every page of the tab wears this design, but a page with its own.',
  },
  {
    value: 'page' as const,
    label: 'This Page',
    description: 'Only the page you are on, over the tab’s design.',
  },
];

export function PageDesignPanel() {
  const { design: door } = useTabStylePages();
  const [scope, setScope] = useState<DesignScope>('tab');
  // The designs saved to My Work and the person's teams (null without the Library).
  const saved = useSavedDesigns();
  if (!door) return null;
  const page = door.page;
  const onPage = scope === 'page' && !!page;
  const worn = wornDesign(onPage ? 'page' : 'tab', door.tabDesign, page?.design);
  const own = onPage && page?.design !== undefined;
  const set = (d: PageDesign | null) =>
    onPage && page ? door.edits.setPageDesign(page.id, d ?? 'none') : door.edits.setTabDesign(d);
  const tune = (d: PageDesign) =>
    onPage && page ? door.edits.tunePageDesign(page.id, d) : door.edits.tuneTabDesign(d);
  const pick = (id: PageDesignId | 'none') =>
    set(id === 'none' ? null : worn?.id === id ? worn : picked(id, worn ?? door.tabDesign));
  return (
    <div className="mt-3 flex flex-col gap-4" data-page-design-panel="">
      <Preview />
      {page ? (
        <div className="flex flex-wrap items-center gap-2 px-3">
          <SegmentedToggle<DesignScope>
            label="Applies to"
            value={onPage ? 'page' : 'tab'}
            options={SCOPES}
            onChange={setScope}
          />
          {onPage && own ? (
            <Button
              variant="ghost"
              size="xs"
              onClick={() => door.edits.setPageDesign(page.id, null)}
              data-page-design-use-tab=""
            >
              Use the Tab’s Design
            </Button>
          ) : null}
        </div>
      ) : null}
      {!onPage ? (
        <section aria-label="Design Sets" className="flex flex-col gap-2">
          <h3 className={HEAD}>Design Sets</h3>
          <div className="px-3">
            <DesignSetCards onApply={(id) => void door.edits.applyDesignSet(id)} />
          </div>
        </section>
      ) : null}
      <section aria-label="Designs" className="flex flex-col gap-2">
        <h3 className={HEAD}>Designs</h3>
        <div className="flex flex-col gap-3 px-2">
          {saved && saved.length > 0 ? (
            <SavedGrid
              saved={saved}
              worn={worn}
              onPage={onPage}
              onApply={(d) => door.edits.applySavedDesign(d, onPage && page ? page.id : null)}
            />
          ) : null}
          <Grid worn={worn?.id ?? 'none'} onPage={onPage} onPick={pick} />
        </div>
      </section>
      {worn ? (
        <section
          aria-label="Fine Tune"
          className="flex flex-col gap-3 border-t border-slate-100 pt-3 dark:border-slate-800"
        >
          <h3 className={HEAD}>Fine Tune · {PAGE_DESIGN_BY_ID[worn.id].label}</h3>
          <Tune design={worn} onTab={!onPage} onSet={set} onTune={tune} />
          {saved && !door.edits.blocked ? <SaveThisDesign design={worn} /> : null}
        </section>
      ) : null}
    </div>
  );
}

// The tiles' look: the page someone is on's background (the paper on a tab with none), in the tab's theme and font.
function useTileLook(): TileLook {
  const door = useTabStylePages().design!;
  const background = door.page?.background;
  return useMemo<TileLook>(
    () => ({ theme: door.theme, paperDark: door.paperDark, background, font: door.tabFont }),
    [door.theme, door.paperDark, background, door.tabFont],
  );
}

function SavedGrid(props: Omit<Parameters<typeof SavedDesignGrid>[0], 'look'>) {
  return <SavedDesignGrid {...props} look={useTileLook()} />;
}

// The catalogue's tiles.
function Grid({
  worn,
  onPage,
  onPick,
}: {
  worn: PageDesignId | 'none';
  onPage: boolean;
  onPick: (id: PageDesignId | 'none') => void;
}) {
  const look = useTileLook();
  return (
    <DesignGrid look={look} worn={worn} noneLabel={onPage ? 'No Design' : 'None'} onPick={onPick} />
  );
}

// What the page someone is on draws now: its resolved design (role and all), and the guard's count over its texts.
function usePageDrawn() {
  const door = useTabStylePages().design!;
  const { page, pages, elements, tabDesign } = door;
  return useMemo(() => {
    if (!page) return undefined;
    const r = resolvePageDesigns(tabDesign, pages, elements).get(page.id);
    if (!r) return { svg: undefined, failing: 0, scrimmed: 0, page };
    const out = designTileSvg({
      design: r.design,
      role: r.role,
      theme: door.theme,
      paperDark: door.paperDark,
      background: page.background,
      font: door.tabFont,
      width: page.rect.width,
      height: page.rect.height,
      rect: page.rect,
      elements: elementsOnPage(elements, pages, page.id),
      idPrefix: 'pdp-',
    });
    return { ...out, page };
  }, [page, pages, elements, tabDesign, door.theme, door.paperDark, door.tabFont]);
}

function Preview() {
  const drawn = usePageDrawn();
  if (!drawn) return null;
  const { width, height } = drawn.page.rect;
  return (
    <div className="flex justify-center px-3" data-page-design-preview="">
      <div
        className="relative overflow-hidden rounded-md bg-white shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700"
        style={{ aspectRatio: `${width} / ${height}`, width: width >= height ? '100%' : '46%' }}
      >
        {drawn.svg ? (
          <img
            src={svgDataUri(drawn.svg)}
            alt="The page you are on, wearing its design"
            className="block h-full w-full"
          />
        ) : (
          <span className="absolute inset-0 flex items-center justify-center text-[11px] text-slate-500 dark:text-slate-400">
            No design on this page
          </span>
        )}
      </div>
    </div>
  );
}

function Tune({
  design,
  onTab,
  onSet,
  onTune,
}: {
  design: PageDesign;
  onTab: boolean;
  onSet: (d: PageDesign) => void;
  onTune: (d: PageDesign) => void;
}) {
  const door = useTabStylePages().design!;
  const drawn = usePageDrawn();
  const palette = useMemo(
    () =>
      designPalette(
        door.theme,
        { background: door.page?.background },
        door.paperDark,
        resolveTuning(design).colors,
      ),
    [door.theme, door.page?.background, door.paperDark, design],
  );
  const pageOwn = door.page?.design;
  // The count is the page's, when the page wears this design.
  const counts =
    drawn && (onTab ? pageOwn === undefined : pageOwn !== undefined && !isNoDesign(pageOwn))
      ? drawn
      : { failing: 0, scrimmed: 0 };
  return (
    <DesignFineTune
      design={design}
      palette={palette}
      onTab={onTab}
      failing={counts.failing}
      scrimmed={counts.scrimmed}
      onSet={onSet}
      onTune={onTune}
    />
  );
}
