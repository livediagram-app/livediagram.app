'use client';

// The setup card a new Plan element shows in place of its body (Setup Board, docs/specs/026-plan/plan-board.md; Setup
// Sheet, docs/specs/029-sheets/sheet.md): a glyph, the title, a line and Help; the steps as a wizard stepper
// (SetupStepper); the step, which alone scrolls; and a footer. The card never outgrows its element: capped at its height, centred when it fits;
// and zoomed in it stops growing at SCREEN_SCALE_MAX (ScaleCapped).
import type { ReactNode } from 'react';
import { HelpArticleLink } from '@/components/primitives/HelpArticleLink';
import type { HelpArticleKey } from '@/lib/help-articles';
import type { PlanPalette } from './plan-palette';
import { SetupStepper } from './SetupStepper';
import { ScaleCapped } from '@/components/canvas/ScaleCapped';

const stop = (e: { stopPropagation: () => void }) => e.stopPropagation();

export type SetupStep = { label: string };

export function SetupCard({
  titleId,
  title,
  line,
  icon,
  help,
  palette,
  steps,
  at = 0,
  onStep,
  footer,
  children,
}: {
  titleId: string;
  title: string;
  line: string;
  icon: ReactNode;
  help: HelpArticleKey;
  palette: PlanPalette;
  // Absent for someone who may only view: the card is its header alone.
  steps?: readonly SetupStep[];
  at?: number;
  onStep?: (i: number) => void;
  footer?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div
      className="flex h-full min-h-0 overflow-hidden"
      onPointerDown={stop}
      onKeyDown={stop}
      onWheel={stop}
    >
      {/* Zoomed in, the card stops growing past SCREEN_SCALE_MAX; zoomed out it shrinks with its element. */}
      <ScaleCapped className="flex h-full min-h-0 w-full p-4 sm:p-6">
        <section
          aria-labelledby={titleId}
          className="m-auto flex max-h-full w-full max-w-[36rem] flex-col rounded-2xl border shadow-sm"
          style={{
            backgroundColor: palette.surface,
            borderColor: palette.border,
            color: palette.text,
          }}
        >
          <header className="flex shrink-0 items-start gap-3 px-5 pt-5">
            <span
              aria-hidden
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300"
            >
              {icon}
            </span>
            <div className="min-w-0 flex-1">
              <h2 id={titleId} className="text-[16px] font-semibold">
                {title}
              </h2>
              <p className="text-[13px]" style={{ color: palette.muted }}>
                {line}
              </p>
            </div>
            <HelpArticleLink article={help} variant="icon" />
          </header>
          {steps ? (
            <>
              {/* The steps as a wizard stepper; a hairline under it sets it apart from the step itself. */}
              <div
                className="mt-4 shrink-0 border-b px-5 pb-4"
                style={{ borderColor: palette.border }}
              >
                <SetupStepper
                  steps={steps.map((x, i) => ({ id: String(i), label: x.label }))}
                  at={at}
                  palette={palette}
                  onStep={(id) => onStep?.(Number(id))}
                />
              </div>
              {/* Keyed by the step, so each step opens at its top. */}
              <div key={at} className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
                {children}
              </div>
              {footer ? (
                <footer
                  className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t px-5 py-3"
                  style={{ borderColor: palette.border }}
                >
                  {footer}
                </footer>
              ) : null}
            </>
          ) : (
            <div className="h-5" />
          )}
        </section>
      </ScaleCapped>
    </div>
  );
}
