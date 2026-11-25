'use client';

// Tab Style's Page Design panel (docs/specs/011-theme/canvas-and-theme-dialog.md "Page Design"): Applies to (All Pages
// or This Page), then the page as two layers (PageDesignLayers.tsx), each opening its picker in place: Design (the
// catalogue and Fine Tune) and Background (the page panel's Background section), with Quick Picks under them.
// Every pick applies live as one undo step, every slider's drag as one; the canvas behind shows it as it moves.
import { useMemo, useState } from 'react';
import {
  PAGE_DESIGN_BY_ID,
  designPalette,
  elementsOnPage,
  isNoDesign,
  resolvePageDesigns,
  resolveTuning,
  pageKindOf,
  type Page,
  type PageBackground,
  type PageDesign,
  type PageDesignId,
  type PageFill,
} from '@livedocuments/document';
import { useTabStyleSubView } from '@liveworkspace/workbench/components/dialogs/tab-style/tab-style-subview';
import { BackgroundSection } from '@/components/canvas/page-background-section';
import { AnimatedBackgroundChoices } from '@/components/canvas/page-background-animated';
import { themeBackgroundPresets } from '@/lib/page-paint';
import { getTheme } from '@/lib/themes';
import { FineTuneButton } from './FineTuneButton';
import { FinishRowArt, TextRowArt } from './StyleRowArt';
import type { TabLook } from '@/lib/tab-looks';
import { AllPagesRow, AllTabsRow, LayerRows, QuickPicks, type PageLayer } from './PageDesignLayers';
import type { TabStyleHome } from '@liveworkspace/workbench/components/dialogs/tab-style/tab-style-profile';
import { useTabStylePages } from '../tab-style-pages';
import { DesignFineTune, resetDesign } from './DesignFineTune';
import { DesignGrid, type TileLook } from './DesignGrid';
import { designTileSvg } from './design-tile-svg';
import { SaveThisDesign, SavedDesignGrid, useSavedDesigns } from './SavedDesigns';
import { picked, wornDesign, type DesignScope } from './design-tune';

export function PageDesignPanel({ home }: { home?: TabStyleHome<TabLook> } = {}) {
  const { design: door, background: bgDoor, themeId } = useTabStylePages();
  // Affect All Pages, kept for the dialog's opening as its screens come and go (Colours and back remounts this).
  const [scope, setScope] = useOpeningScope(home?.openId);
  // Home shows the layers; a layer's row opens its picker in place (Layers).
  const [layer, setLayer] = useState<PageLayer | null>(null);
  // The designs saved to My Work and the person's teams (null without the Library).
  const saved = useSavedDesigns();
  const look = useTileLookOrNull();
  // A layer's picker replaces the panel whole: the dialog's breadcrumb is the layer's, back to Page Design.
  useTabStyleSubView(
    layer
      ? {
          current: layer === 'design' ? 'Design' : 'Background',
          line:
            layer === 'design'
              ? 'Art drawn over the background, in the theme’s colours.'
              : 'What the page sits on: a colour, a gradient, a picture or one that moves.',
          onBack: () => setLayer(null),
        }
      : null,
  );
  // A tab with no pages has no page to design: the shared home.
  if (!door || !look) return <>{home?.fallback ?? null}</>;
  const page = door.page;
  const onPage = scope === 'page' && !!page;
  const worn = wornDesign(onPage ? 'page' : 'tab', door.tabDesign, page?.design);
  const own = onPage && page?.design !== undefined;
  const paint = {
    theme: door.theme,
    page: { background: page?.background },
    paperDark: door.paperDark,
  };
  const set = (d: PageDesign | null) =>
    onPage && page ? door.edits.setPageDesign(page.id, d ?? 'none') : door.edits.setTabDesign(d);
  const tune = (d: PageDesign) =>
    onPage && page ? door.edits.tunePageDesign(page.id, d) : door.edits.tuneTabDesign(d);
  // A pick on All Pages reaches every page: a page's own design gives way to it.
  // One design to a page (owner, 2026-11-25): a design picked over a moving background stills it, its gradient kept.
  const pick = (id: PageDesignId | 'none') => {
    const d = id === 'none' ? null : worn?.id === id ? worn : picked(id, worn ?? door.tabDesign);
    const moving = page && d ? movingFill(page) : undefined;
    const still = moving ? { fill: { ...moving, motion: undefined } } : undefined;
    if (onPage) {
      if (still) bgDoor?.onPage(still);
      set(d);
    } else if (still && bgDoor) bgDoor.onAll(still, d);
    else door.edits.setTabDesign(d, { everyPage: true });
  };
  // A moving background is the page's one design: the design over it goes.
  const pickMoving = (fill: PageFill) => {
    if (onPage && page) {
      bgDoor?.onPage({ fill });
      if (worn) door.edits.setPageDesign(page.id, 'none');
    } else bgDoor?.onAll({ fill }, null);
  };
  const setBackground = (patch: Partial<PageBackground>) =>
    onPage ? bgDoor?.onPage(patch) : bgDoor?.onAll(patch);
  // Fine Tune: a full-width row pinned to the foot of the home and the Design picker, its controls beside the dialog
  // (FineTuneButton).
  const fineTune = worn ? (
    <FineTuneButton
      title={PAGE_DESIGN_BY_ID[worn.id].label}
      onReset={() => set(resetDesign(worn))}
      footer={saved && !door.edits.blocked ? <SaveThisDesign design={worn} /> : undefined}
    >
      <Tune design={worn} onTab={!onPage} onSet={set} onTune={tune} />
    </FineTuneButton>
  ) : null;
  // The screen's pinned foot: Affect All Pages (Fine Tune is the Design picker's alone, first in its foot), rows of one card (owner, 2026-11-25).
  const footOf = (withTune: boolean) =>
    (withTune && fineTune) || page ? (
      <div className="sticky -bottom-4 z-[2] mt-1 bg-white px-3 pb-4 pt-2 dark:bg-slate-900">
        <div className="divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200 dark:divide-slate-700 dark:border-slate-700">
          {withTune ? fineTune : null}
          {page ? (
            <AllPagesRow
              allPages={{
                on: !onPage,
                onChange: (on: boolean) => setScope(on ? 'tab' : 'page'),
                ...(own ? { useAll: () => door.edits.setPageDesign(page.id, null) } : {}),
              }}
            />
          ) : null}
          {home?.allTabs && !withTune ? <AllTabsRow allTabs={home.allTabs} /> : null}
        </div>
      </div>
    ) : null;
  if (layer === 'background' && bgDoor) {
    return (
      <div className="mt-3 flex flex-col gap-3" data-page-design-panel="background">
        <BackgroundSection
          page={bgDoor.page}
          themePresets={themeBackgroundPresets(getTheme(themeId))}
          onBackground={setBackground}
          onPreview={noPreview}
          // The animated backgrounds are Design's Moving chip.
          only={['solid', 'gradient', 'image']}
        />
      </div>
    );
  }
  if (layer === 'design') {
    return (
      <div className="mt-3 flex flex-col gap-4" data-page-design-panel="design">
        <section aria-label="Designs" className="flex flex-col gap-3 px-2">
          {saved && saved.length > 0 ? (
            <SavedGrid
              saved={saved}
              worn={worn}
              onPage={onPage}
              onApply={(d) => door.edits.applySavedDesign(d, onPage && page ? page.id : null)}
            />
          ) : null}
          <Grid
            worn={worn?.id ?? 'none'}
            onPage={onPage}
            onPick={pick}
            {...(bgDoor && moves(bgDoor.page)
              ? {
                  moving: {
                    open: !!movingFill(bgDoor.page),
                    body: (
                      <AnimatedBackgroundChoices
                        fill={bgDoor.page.background?.fill}
                        themePresets={themeBackgroundPresets(getTheme(themeId))}
                        onPick={pickMoving}
                        onPreview={noPreview}
                      />
                    ),
                  },
                }
              : {})}
          />
        </section>
        {footOf(true)}
      </div>
    );
  }
  return (
    <div className="mt-3 flex flex-col gap-4" data-page-design-panel="">
      <LayerRows
        look={look}
        worn={worn}
        background={bgDoor?.page.background}
        themeId={themeId}
        onOpen={setLayer}
        {...(home
          ? {
              extra: home.rows.map((r) => ({
                key: r.panel,
                // Colours, Text and Finish are the tab's, so with Affect All Pages off they are shown but disabled
                // (owner, 2026-11-25).
                label: r.label,
                disabled: onPage,
                value: r.value,
                // Text and Finish as small pages in the tab's colours, as Design and Background are.
                icon:
                  r.panel === 'font' ? (
                    <TextRowArt {...paint} font={home.font} />
                  ) : r.panel === 'finish' ? (
                    <FinishRowArt {...paint} finish={home.finish} />
                  ) : (
                    r.icon
                  ),
                onOpen: () => home.onOpenPanel(r.panel),
              })),
            }
          : {})}
      />
      {home?.extra}
      {bgDoor ? (
        <QuickPicks
          look={look}
          themeId={themeId}
          worn={worn?.id}
          fill={bgDoor.page.background?.fill}
          openId={home?.openId}
          pageOnly={onPage}
          onPick={(q) => {
            // On All Pages the look first (colours, text, finish: the tab's), then the design and background in its
            // colours. Off, the page alone: its design and background, the tab's look left as it is.
            if (!onPage) home?.applyLook(q.look);
            const d = picked(q.design, worn ?? door.tabDesign);
            if (onPage && page) {
              bgDoor.onPage({ fill: q.fill });
              door.edits.setPageDesign(page.id, d);
            } else bgDoor.onAll({ fill: q.fill }, d);
          }}
        />
      ) : null}
      {footOf(false)}
    </div>
  );
}

// Affect All Pages for one opening of the dialog: on as it opens, then as the person leaves it.
let openingScope: { openId: string; scope: DesignScope } | null = null;
function useOpeningScope(openId: string | undefined) {
  const [scope, setScope] = useState<DesignScope>(() =>
    openId && openingScope?.openId === openId ? openingScope.scope : 'tab',
  );
  const set = (next: DesignScope) => {
    if (openId) openingScope = { openId, scope: next };
    setScope(next);
  };
  return [scope, set] as const;
}

// Whether the page's background can move (a slide or a flashcard), and its moving fill when it does.
const moves = (page: Page) => pageKindOf(page) === 'slide' || pageKindOf(page) === 'flashcard';
const movingFill = (page: Page) => {
  const fill = page.background?.fill;
  return fill?.kind === 'gradient' && fill.motion ? fill : undefined;
};

// Hovers preview nothing here: the page behind the dialog shows each pick once made.
const noPreview = () => {};

// The tiles' look: the page someone is on's background (the paper on a tab with none), in the tab's theme and font.
function useTileLookOrNull(): TileLook | null {
  const door = useTabStylePages().design;
  const background = door?.page?.background;
  return useMemo<TileLook | null>(
    () =>
      door
        ? { theme: door.theme, paperDark: door.paperDark, background, font: door.tabFont }
        : null,
    [door, background],
  );
}

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
  moving,
}: {
  worn: PageDesignId | 'none';
  onPage: boolean;
  onPick: (id: PageDesignId | 'none') => void;
  moving?: Parameters<typeof DesignGrid>[0]['moving'];
}) {
  const look = useTileLook();
  return (
    <DesignGrid
      look={look}
      worn={worn}
      noneLabel={onPage ? 'No Design' : 'None'}
      onPick={onPick}
      {...(moving ? { moving } : {})}
    />
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
