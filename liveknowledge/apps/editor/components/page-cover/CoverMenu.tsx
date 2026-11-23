'use client';

// The cover menu (docs/specs/030-knowledgebase/page-surface.md "The cover"), opened from Add Cover in the meta row
// and Change Cover on the band: Choose a Picture (the image picker every picture in a page uses: Upload, Your
// Images and Search); the knowledgebase theme's gradients as swatches, each named in a tooltip; and the animated
// backgrounds a form's cover and a slide offer (AnimatedBackgroundChoices), in the theme's colourings alone, at a
// speed. Each is stored by its role, so it follows the knowledgebase's style. A picture or a gradient sets the cover
// and closes the menu; a motion sets it and keeps the menu open for its colours and speed. The picker stays open
// over a closed menu until it picks or is closed.
import { useId, useState } from 'react';
import { ResponsivePopover, Tooltip } from '@liveknowledge/ui';
import {
  COVER_GRADIENT_IDS,
  colouringOf,
  coverFill,
  coverGradientLabel,
  type PageFill,
  type TabCover,
} from '@liveknowledge/document';
import { useEditorChrome } from '@/app/document/[id]/EditorContext';
import { ImagePicker } from '@/components/panels/ImagePicker';
import { AnimatedBackgroundChoices } from '@/components/canvas/page-background-animated';
import { fillCss } from '@/lib/page-paint';
import { PictureIcon } from './cover-icons';
import { useCoverTheme, useSetPageCover, type CoverTheme } from './page-cover-state';

const MOTION_NOTE =
  'Moves on the page; still with Reduce Motion on and while the page is out of sight.';

/** The cover an animated choice makes: its motion in the theme colouring it matches, at its speed. */
export function animatedCoverOf(fill: PageFill, theme: CoverTheme): TabCover | undefined {
  if (fill.kind !== 'gradient' || !fill.motion) return undefined;
  const colouring = colouringOf(theme, fill);
  if (!colouring) return undefined;
  return {
    motion: fill.motion,
    colouring,
    ...(fill.speed !== undefined && fill.speed !== 1 ? { speed: fill.speed } : {}),
  };
}

const ROW =
  'flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-brand-600 phone:min-h-11 dark:text-slate-200 dark:hover:bg-slate-800';

// A motion chosen from Add Cover gives the page its cover, and Add Cover leaves the meta row with it: the menu
// opens again from the band's Change Cover, so its colours and speed are a press away. Read once, by the band.
let handedOff = false;
export function takeCoverMenuHandoff(): boolean {
  const was = handedOff;
  handedOff = false;
  return was;
}

/** What a menu host holds: whether the menu is open, the control it opens from, and the picker. */
export function useCoverMenu() {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [open, setOpen] = useState(false);
  const [picking, setPicking] = useState(false);
  return {
    open,
    anchor,
    picking,
    openFrom: (el: HTMLElement) => {
      setAnchor(el);
      setOpen(true);
    },
    close: () => setOpen(false),
    pick: () => {
      setOpen(false);
      setPicking(true);
    },
    endPick: () => setPicking(false),
  };
}

export type CoverMenuState = ReturnType<typeof useCoverMenu>;

export function CoverMenu({
  menu,
  cover,
  align = 'start',
  handOff = false,
}: {
  menu: CoverMenuState;
  cover: TabCover | undefined;
  align?: 'start' | 'end';
  /** Add Cover's: a motion picked here carries on from the band's Change Cover, which is there in edit mode alone. */
  handOff?: boolean;
}) {
  const titleId = useId();
  const setCover = useSetPageCover();
  const { theme, presets } = useCoverTheme();
  const current = cover && 'gradient' in cover ? cover.gradient : undefined;
  const moving = cover && 'motion' in cover ? coverFill(cover, theme) : undefined;
  return (
    <>
      <ResponsivePopover
        open={menu.open}
        onClose={menu.close}
        anchor={menu.anchor}
        titleId={titleId}
        width={340}
        align={align}
      >
        <div data-cover-menu="" className="flex flex-col gap-3">
          <h2 id={titleId} className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            {cover ? 'Change Cover' : 'Add Cover'}
          </h2>
          <button type="button" className={ROW} onClick={menu.pick}>
            <span className="text-slate-500 dark:text-slate-400">
              <PictureIcon />
            </span>
            Choose a Picture
          </button>
          <div>
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Gradients
            </p>
            <div role="group" aria-label="Gradients" className="grid grid-cols-7 gap-1.5">
              {COVER_GRADIENT_IDS.map((id) => {
                const on = id === current;
                const label = coverGradientLabel(id);
                const fill = presets.find((p) => p.id === id)?.fill;
                return (
                  <Tooltip key={id} label={label}>
                    <button
                      type="button"
                      aria-label={label}
                      aria-pressed={on}
                      data-cover-gradient={id}
                      onClick={() => {
                        menu.close();
                        if (!on) setCover({ gradient: id });
                      }}
                      className={`aspect-square w-full cursor-pointer rounded-lg ring-1 ring-inset ring-black/10 transition-transform duration-100 hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 motion-reduce:transition-none dark:ring-white/10 ${
                        on
                          ? 'outline-2 outline-offset-2 outline-brand-600 dark:outline-brand-400'
                          : ''
                      }`}
                      style={fill ? { background: fillCss(fill) } : undefined}
                    />
                  </Tooltip>
                );
              })}
            </div>
          </div>
          <div data-cover-animated="">
            <AnimatedBackgroundChoices
              fill={moving}
              themePresets={presets}
              customColours={false}
              note={MOTION_NOTE}
              onPreview={() => {}}
              onPick={(fill) => {
                const next = animatedCoverOf(fill, theme);
                if (!next) return;
                if (!cover && handOff) handedOff = true;
                setCover(next);
              }}
            />
          </div>
        </div>
      </ResponsivePopover>
      {menu.picking ? <CoverPicker onClose={menu.endPick} cover={cover} /> : null}
    </>
  );
}

function CoverPicker({ onClose, cover }: { onClose: () => void; cover: TabCover | undefined }) {
  const setCover = useSetPageCover();
  const ownerId = useEditorChrome((s) => s.selfParticipant.id);
  const documentId = useEditorChrome((s) => s.documentId);
  const workbenchMode = useEditorChrome((s) => s.workbenchMode);
  if (!documentId) return null;
  return (
    <ImagePicker
      ownerId={ownerId}
      documentId={documentId}
      uploadOnly={workbenchMode}
      forElementId={null}
      currentImageId={cover && 'imageId' in cover ? cover.imageId : null}
      onSelect={(image) => {
        onClose();
        setCover({ imageId: image.id, ...(image.credit ? { credit: image.credit.text } : {}) });
      }}
      onClose={onClose}
    />
  );
}
