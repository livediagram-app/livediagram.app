'use client';

// The cover's controls, for whoever may change it (docs/specs/030-knowledgebase/page-surface.md "The cover"): at the
// band's bottom right, shown while the pointer rests on the band or the keyboard is in it (always on a touch
// screen, which has no hover): Change Cover, Reposition (pictures only) and Remove, with an Undo in the toast.
// Repositioning swaps them for Save Position and Cancel, and lays its one line across the band.
import { useEffect, useRef } from 'react';
import type { TabCover } from '@liveknowledge/document';
import { Chip, Tooltip } from '@liveknowledge/ui';
import { useToast } from '@/hooks/ui/useToast';
import { ChangeCoverIcon, RemoveCoverIcon, RepositionIcon } from './cover-icons';
import { CoverMenu, takeCoverMenuHandoff, useCoverMenu } from './CoverMenu';
import { useSetPageCover } from './page-cover-state';
import type { CoverReposition } from './useCoverReposition';

// A frosted bar over any picture: legible on a white picture and on a black one.
const BAR =
  'flex items-center overflow-hidden rounded-lg bg-white/85 shadow-sm ring-1 ring-black/10 backdrop-blur-md dark:bg-slate-900/80 dark:ring-white/10';
const BUTTON =
  'inline-flex h-8 cursor-pointer items-center gap-1.5 px-2.5 text-[13px] font-medium text-slate-700 transition-colors hover:bg-white hover:text-slate-900 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-600 phone:h-11 phone:px-3 dark:text-slate-200 dark:hover:bg-slate-800 dark:hover:text-white';
const DIVIDER = 'h-4 w-px bg-slate-900/10 dark:bg-white/10';

export function CoverControls({
  cover,
  reposition,
}: {
  cover: TabCover;
  reposition: CoverReposition;
}) {
  const setCover = useSetPageCover();
  const toast = useToast();
  const menu = useCoverMenu();
  const changeRef = useRef<HTMLButtonElement>(null);
  const { openFrom } = menu;
  // A motion just chosen from Add Cover: its menu carries on from here.
  useEffect(() => {
    if (changeRef.current && takeCoverMenuHandoff()) openFrom(changeRef.current);
  }, [openFrom]);
  if (reposition.active)
    return (
      <>
        <Chip
          data-cover-reposition-hint=""
          className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-black/55 px-3 py-1.5 text-[13px] font-medium text-white shadow-sm backdrop-blur-sm"
        >
          Drag the picture to reposition
        </Chip>
        <div className={`absolute bottom-3 right-3 ${BAR} phone:bottom-2 phone:right-2`}>
          <button type="button" className={BUTTON} onClick={reposition.cancel}>
            Cancel
          </button>
          <span aria-hidden className={DIVIDER} />
          <button
            type="button"
            className={`${BUTTON} text-brand-800 hover:text-brand-900 dark:text-brand-200 dark:hover:text-brand-100`}
            onClick={reposition.save}
          >
            Save Position
          </button>
        </div>
      </>
    );
  const remove = () => {
    const was = cover;
    setCover(undefined);
    toast.info('Cover removed', {
      action: {
        label: 'Undo',
        ariaLabel: 'Undo Removing the Cover',
        onSelect: () => setCover(was),
      },
    });
  };
  return (
    <>
      <div
        data-cover-controls=""
        // Out of sight until wanted, never out of reach: the keyboard finds them, and showing them moves nothing.
        className={`absolute bottom-3 right-3 ${BAR} opacity-0 transition-opacity duration-150 focus-within:opacity-100 group-hover/cover:opacity-100 motion-reduce:transition-none phone:bottom-2 phone:right-2 [@media(hover:none)]:opacity-100 ${
          menu.open || menu.picking ? 'opacity-100' : ''
        }`}
      >
        <Tooltip label="Change Cover">
          <button
            type="button"
            ref={changeRef}
            className={BUTTON}
            aria-haspopup="dialog"
            aria-expanded={menu.open}
            onClick={(e) => menu.openFrom(e.currentTarget)}
          >
            <ChangeCoverIcon />
            <span className="phone:sr-only">Change Cover</span>
          </button>
        </Tooltip>
        {'imageId' in cover ? (
          <>
            <span aria-hidden className={DIVIDER} />
            <Tooltip label="Reposition">
              <button type="button" className={BUTTON} onClick={reposition.start}>
                <RepositionIcon />
                <span className="phone:sr-only">Reposition</span>
              </button>
            </Tooltip>
          </>
        ) : null}
        <span aria-hidden className={DIVIDER} />
        <Tooltip label="Remove Cover">
          <button type="button" aria-label="Remove Cover" className={BUTTON} onClick={remove}>
            <RemoveCoverIcon />
          </button>
        </Tooltip>
      </div>
      <CoverMenu menu={menu} cover={cover} align="end" />
    </>
  );
}
