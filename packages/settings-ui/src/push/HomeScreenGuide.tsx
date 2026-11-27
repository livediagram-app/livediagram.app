'use client';

// The Add to Home Screen steps (liveworkspace/docs/specs/003-accounts/push.md "Settings"): what the Phone row's Add to
// Home Screen opens on an iPhone or iPad, where no page can add itself. Three numbered steps, each with a small drawing
// of where to tap on this device, worded for this browser (home-screen-guide.ts). Always three steps, so the dialog
// keeps its height.
import { useId, type ReactNode } from 'react';
import { Button, Dialog, DialogFooter } from '@liveworkspace/ui';
import { HeroDialogHeader } from '@liveworkspace/ui/dialog-hero';
import { homeScreenHeroArt } from '@liveworkspace/ui/dialog-hero-art/home-screen';
import type { HomeScreenGuide as Guide, HomeScreenStep, SharePlace } from './home-screen-guide';

const STROKE = 'stroke-slate-300 dark:stroke-slate-600';
const FILL = 'fill-white dark:fill-slate-800';
const MUTED = 'fill-slate-200 dark:fill-slate-700';
const ACCENT = 'stroke-brand-600 dark:stroke-brand-300';

// The Share icon: a square open at the top with an arrow out of it, centred on (x, y).
function ShareMark({ x, y }: { x: number; y: number }) {
  return (
    <g
      className={ACCENT}
      fill="none"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={`M${x - 2} ${y - 1.5}h-1.5v6h7v-6H${x + 2}`} />
      <path d={`M${x} ${y + 1.5}v-6m-2 2 2-2 2 2`} />
    </g>
  );
}

// Where Share is: on an iPad's toolbar at the top right, an iPhone's bottom bar, or behind the menu.
function ShareDrawing({ device, share }: { device: Guide['device']; share: SharePlace }) {
  const tablet = device === 'iPad';
  const [x, w, h] = tablet ? [8, 32, 40] : [13, 22, 40];
  const right = x + w;
  return (
    <>
      <rect x={x} y="4" width={w} height={h} rx={tablet ? 4 : 5} className={`${FILL} ${STROKE}`} />
      {/* The toolbar's address bar, top (and a phone's bottom bar for Safari). */}
      <rect
        x={x + 3}
        y="8"
        width={w - (share === 'bottom' ? 6 : 12)}
        height="4"
        rx="2"
        className={MUTED}
      />
      {share === 'bottom' ? (
        <>
          <path d={`M${x} 34h${w}`} className={STROKE} />
          <ShareMark x={x + w / 2} y={39} />
        </>
      ) : share === 'top' ? (
        <ShareMark x={right - 4.5} y={10.5} />
      ) : (
        <g className="fill-brand-600 dark:fill-brand-300">
          {[-2.5, 0, 2.5].map((d) => (
            <circle key={d} cx={right - 4.5 + d} cy="10" r="0.9" />
          ))}
        </g>
      )}
      {[18, 23, 28].map((y) => (
        <rect
          key={y}
          x={x + 3}
          y={y}
          width={w - 10 + (y % 2) * 4}
          height="2"
          rx="1"
          className={MUTED}
        />
      ))}
    </>
  );
}

// The Share sheet: its list of actions, Add to Home Screen picked out.
function AddDrawing() {
  return (
    <>
      <rect x="6" y="8" width="36" height="34" rx="5" className={`${FILL} ${STROKE}`} />
      {[13, 31].map((y) => (
        <rect key={y} x="10" y={y} width="20" height="2.5" rx="1.25" className={MUTED} />
      ))}
      <rect
        x="8"
        y="19"
        width="32"
        height="9"
        rx="3"
        className="fill-brand-50 stroke-brand-600 dark:fill-brand-500/15 dark:stroke-brand-300"
      />
      <rect
        x="10.5"
        y="21"
        width="17"
        height="2.25"
        rx="1.1"
        className="fill-brand-600 dark:fill-brand-300"
      />
      <g className={ACCENT} fill="none" strokeWidth="1.3" strokeLinecap="round">
        <rect x="31" y="20.5" width="6" height="6" rx="1.75" />
        <path d="M34 22v3M32.5 23.5h3" />
      </g>
    </>
  );
}

// The Home Screen with the app's new tile.
function OpenDrawing() {
  const tiles = [12, 21, 30].flatMap((x) => [12, 21, 30].map((y) => [x, y] as const));
  return (
    <>
      <rect x="7" y="4" width="34" height="40" rx="5" className={`${FILL} ${STROKE}`} />
      {tiles.map(([x, y]) =>
        x === 30 && y === 30 ? (
          <rect
            key="app"
            x={x - 0.5}
            y={y - 0.5}
            width="7"
            height="7"
            rx="2"
            className="fill-brand-600 dark:fill-brand-400"
          />
        ) : (
          <rect key={`${x}-${y}`} x={x} y={y} width="6" height="6" rx="1.75" className={MUTED} />
        ),
      )}
    </>
  );
}

function StepDrawing({ step, guide }: { step: HomeScreenStep; guide: Guide }) {
  let drawing: ReactNode;
  if (step.key === 'share') drawing = <ShareDrawing device={guide.device} share={guide.share} />;
  else if (step.key === 'add') drawing = <AddDrawing />;
  else drawing = <OpenDrawing />;
  return (
    <span
      aria-hidden
      data-home-screen-drawing={step.key}
      className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-slate-50 shadow-[inset_0_0_0_1px] shadow-slate-200 dark:bg-slate-900 dark:shadow-slate-700"
    >
      <svg width="48" height="48" viewBox="0 0 48 48" focusable="false">
        {drawing}
      </svg>
    </span>
  );
}

export function HomeScreenGuide({
  open,
  guide,
  onClose,
}: {
  open: boolean;
  guide: Guide;
  onClose: () => void;
}) {
  const titleId = useId();
  return (
    <Dialog open={open} onClose={onClose} titleId={titleId} size="sm">
      <HeroDialogHeader
        art={homeScreenHeroArt}
        titleId={titleId}
        title="Add to Home Screen"
        subtitle={`Your ${guide.device} sends notifications only from apps on its Home Screen.`}
        onClose={onClose}
      />
      <ol
        data-home-screen-guide={`${guide.device} ${guide.browser}`}
        className="flex flex-col gap-4 px-4 py-5 sm:px-6"
      >
        {guide.steps.map((step, i) => (
          <li key={step.key} className="flex items-start gap-3.5">
            <StepDrawing step={step} guide={guide} />
            <div className="min-w-0 flex-1 pt-1">
              <p className="flex items-baseline gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
                <span
                  aria-hidden
                  className="inline-flex size-5 shrink-0 items-center justify-center self-center rounded-full bg-brand-600 text-[11px] font-semibold text-white dark:bg-brand-500"
                >
                  {i + 1}
                </span>
                {step.title}
              </p>
              <p className="mt-1 text-[13px] leading-[18px] text-slate-600 dark:text-slate-300">
                {step.detail}
              </p>
            </div>
          </li>
        ))}
      </ol>
      <DialogFooter>
        <Button size="sm" onClick={onClose}>
          Done
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
